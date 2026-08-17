import crypto from 'crypto';
import {
  getDb, hasFirebasePersistence, hasD1Persistence, hashPin,
  savePersistentSession, getPersistentSession, refreshDb, commitDb,
  acquireTenantLock, releaseTenantLock, renewTenantLock
} from './db.js';
import { isCloudflareWorker, isHostedRuntime } from './server-config.js';

// Shared middleware, auth/session helpers, tenant resolution, rate limiting
// and SSE registry extracted verbatim from server.js — no behavior change.

export function hasDurablePersistence() {
  return hasFirebasePersistence() || hasD1Persistence();
}

export function isSecureRequest(req) {
  return isHostedRuntime || req.secure === true;
}

export const loginAttempts = new Map();

export function loginAttemptKey(req) {
  return `${req.tenantId}:${req.ip || req.socket.remoteAddress || 'unknown'}`;
}

export function isLoginRateLimited(req) {
  const record = loginAttempts.get(loginAttemptKey(req));
  if (!record) return false;
  if (record.resetAt <= Date.now()) {
    loginAttempts.delete(loginAttemptKey(req));
    return false;
  }
  return record.count >= 5;
}

export function recordFailedLogin(req) {
  const key = loginAttemptKey(req);
  const current = loginAttempts.get(key);
  const resetAt = current?.resetAt && current.resetAt > Date.now() ? current.resetAt : Date.now() + 15 * 60 * 1000;
  loginAttempts.set(key, { count: (current?.count || 0) + 1, resetAt });
}

// SSE Connection Registry
export const sseClients = new Map(); // tenantId -> Set<Response>

export function broadcastSSE(tenantId, eventName, data) {
  const clients = sseClients.get(tenantId);
  if (!clients || clients.size === 0) return;
  const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    try { res.write(payload); } catch (e) { clients.delete(res); }
  }
}

export function configuredTenantForHost(host) {
  const hostname = String(host || '').split(':')[0].toLowerCase();
  const raw = process.env.MODULE_TENANT_HOSTS;
  if (raw) {
    try {
      const hosts = JSON.parse(raw);
      if (typeof hosts[hostname] === 'string' && /^[a-z0-9_-]+$/i.test(hosts[hostname])) return hosts[hostname];
    } catch (error) {
      console.error('Invalid AEON_TENANT_HOSTS configuration');
    }
  }
  return process.env.MODULE_DEFAULT_TENANT || 'reception';
}

function requestedTenant(req) {
  if (isHostedRuntime || process.env.AEON_ALLOW_TENANT_OVERRIDE !== 'true') return null;
  const value = req.query?.tenant_id || req.headers['x-tenant-id'];
  if (Array.isArray(value)) return value[0];
  return value ? String(value) : null;
}

function allowedTenants() {
  const configured = String(process.env.MODULE_ALLOWED_TENANTS || 'reception')
    .split(',')
    .map(value => value.trim())
    .filter(value => /^[a-z0-9_-]+$/i.test(value));
  return new Set(configured.length ? configured : ['aeon']);
}

const activeMutations = new Map();

function captureDatabaseSnapshot(db) {
  if (!db || !db.db || !db.db.tables) return null;
  const backup = {};
  for (const tableName of Object.keys(db.db.tables)) {
    backup[tableName] = JSON.parse(JSON.stringify(db.db.tables[tableName].data || []));
  }
  return backup;
}

async function rollbackDatabase(db, backup) {
  if (!db || !db.db || !db.db.tables || !backup) return;
  const previousSuspend = db.suspendSave;
  db.suspendSave = true;
  try {
    for (const tableName of Object.keys(backup)) {
      await db.run(`DELETE FROM ${tableName}`);
      const rows = backup[tableName];
      for (const row of rows) {
        const columns = Object.keys(row);
        const values = Object.values(row);
        const placeholders = columns.map(() => '?').join(', ');
        await db.run(`INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`, values);
      }
    }
  } catch (e) {
    console.error('[Rollback] Index-safe database rollback failed:', e);
  } finally {
    db.suspendSave = previousSuspend;
  }
}

export async function tenantDbResolver(req, res, next) {
  const forwardedHost = (isHostedRuntime || process.env.AEON_TRUST_FORWARDED_HOST === 'true')
    ? req.headers['x-forwarded-host']
    : '';
  const tenantId = requestedTenant(req) || configuredTenantForHost(forwardedHost || req.headers.host);

  const permittedTenants = allowedTenants();
  const acceptanceTenant = !isHostedRuntime && process.env.NODE_ENV === 'test' && tenantId.startsWith('acceptance_runs_');
  if (!permittedTenants.has(tenantId) && !acceptanceTenant) {
    return res.status(403).json({ error: 'tenant_not_allowed' });
  }

  const coordinated = !hasD1Persistence() && (hasFirebasePersistence() || tenantId === 'tenant_a' || tenantId === 'tenant_b' || tenantId.startsWith('acceptance_runs_')) && req.path !== '/events';
  const mutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  const lockOwner = crypto.randomUUID();
  let lockAcquired = false;
  let renewInterval = null;
  let resolveMutation = null;
  let dbBackup = null;

  const idempotencyKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'] || req.get('idempotency-key') || req.get('x-idempotency-key');
  let responseBody = null;
  let hasCommitted = false;

  const originalJson = res.json.bind(res);
  res.json = function(body) {
    responseBody = body;
    return originalJson(body);
  };
  const originalSend = res.send.bind(res);
  res.send = function(body) {
    if (typeof body === 'string') {
      try {
        responseBody = JSON.parse(body);
      } catch (e) {
        responseBody = body;
      }
    } else {
      responseBody = body;
    }

    // Idempotency-key persistence (recording the response so a retried request can be replayed
    // instead of re-executed) must not be gated purely on `coordinated` — `coordinated` is always
    // false in D1/production mode (D1 needs no in-process alasql-instance locking), which used to
    // silently skip writing idempotency_records for every D1-backed deployment even though the
    // frontend (public/js/boot.js) sends an Idempotency-Key header on every mutation expecting the
    // server to dedupe it. D1 is otherwise a normal durable, atomic-per-statement store, so it's
    // safe to run this finalization path there too (commitDb/rollbackDatabase already no-op for D1).
    if ((coordinated || hasD1Persistence()) && mutation && !hasCommitted) {
      hasCommitted = true;
      const completeCommit = async () => {
        try {
          if (res.statusCode < 400) {
            if (idempotencyKey && responseBody) {
              const bodyHash = crypto.createHash('sha256').update(JSON.stringify(req.body || {})).digest('hex');
              const lookupId = req.path.includes('/requests') ? `request:${idempotencyKey}` : idempotencyKey;
              const existing = await req.db.get("SELECT * FROM idempotency_records WHERE id = ?", [lookupId]);
              const expiresAt = Date.now() + 86400000; // 24 hours TTL
              if (!existing) {
                await req.db.run(
                  "INSERT INTO idempotency_records (id, idempotency_key, tenant, http_method, normalized_path, request_body_hash, response_status, response_body, expires_at, operation, request_hash, response_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                  [
                    lookupId,
                    idempotencyKey,
                    tenantId,
                    req.method,
                    req.path,
                    bodyHash,
                    res.statusCode,
                    JSON.stringify(responseBody),
                    expiresAt,
                    req.path,
                    JSON.stringify(req.body),
                    JSON.stringify({ status: res.statusCode, body: responseBody })
                  ]
                );
              } else if (!existing.request_body_hash) {
                await req.db.run(
                  "UPDATE idempotency_records SET idempotency_key = ?, tenant = ?, http_method = ?, normalized_path = ?, request_body_hash = ?, response_status = ?, response_body = ?, expires_at = ? WHERE id = ?",
                  [
                    idempotencyKey,
                    tenantId,
                    req.method,
                    req.path,
                    bodyHash,
                    res.statusCode,
                    JSON.stringify(responseBody),
                    expiresAt,
                    lookupId
                  ]
                );
              }
            }
            await commitDb(tenantId);
          } else {
            if (req.db) {
              await rollbackDatabase(req.db, dbBackup);
              await refreshDb(tenantId);
            }
          }
          if (req.db) req.db.suspendSave = false;
          originalSend(body);
        } catch (error) {
          console.error(`Persistence finalization error for tenant ${tenantId}:`, error);
          if (req.db) {
            await rollbackDatabase(req.db, dbBackup);
            req.db.suspendSave = false;
          }
          res.statusCode = 503;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          originalSend(JSON.stringify({ success: false, error: 'Datastore commit failed.', error_code: 'persistence_error' }));
        } finally {
          if (renewInterval) clearInterval(renewInterval);
          if (coordinated && lockAcquired) {
            await releaseTenantLock(tenantId, lockOwner).catch(error => console.error(`Tenant lock release error for ${tenantId}:`, error));
          }
          if (resolveMutation) {
            const active = activeMutations.get(tenantId);
            if (active) {
              active.activeMutationPromise = null;
              active.resolveActiveMutation = null;
            }
            resolveMutation();
          }
        }
      };
      completeCommit();
      return res;
    }
    return originalSend(body);
  };

  try {
    // 1. Read Consistency Coordination: GET waits for any active mutation on this tenant
    if (coordinated && !mutation) {
      const active = activeMutations.get(tenantId);
      if (active && active.activeMutationPromise) {
        await active.activeMutationPromise;
      }
    }

    // 2. Lock Acquisition for Mutations
    if (coordinated && mutation) {
      lockAcquired = await acquireTenantLock(tenantId, lockOwner);
      if (!lockAcquired) return res.status(503).json({ error: 'Datastore is busy. Please retry.' });

      // Start lock lease renewal interval
      if (hasFirebasePersistence()) renewInterval = setInterval(() => renewTenantLock(tenantId, lockOwner).catch(error => console.error(`[Lock] Lease renewal failed for ${tenantId}:`, error)), 10000);

      // Set active mutation promise
      let active = activeMutations.get(tenantId);
      if (!active) {
        active = {};
        activeMutations.set(tenantId, active);
      }
      const promise = new Promise(r => resolveMutation = r);
      active.activeMutationPromise = promise;
      active.resolveActiveMutation = resolveMutation;
    }

    req.db = await getDb(tenantId);
    if (coordinated) {
      req.db = await refreshDb(tenantId);
    }

    // 3. Idempotency Check — see the comment on the res.send override above for why this also
    // has to run in D1 mode (hasD1Persistence()), not just under the alasql `coordinated` path.
    if ((coordinated || hasD1Persistence()) && idempotencyKey && mutation) {
      try {
        const bodyHash = crypto.createHash('sha256').update(JSON.stringify(req.body || {})).digest('hex');
        const lookupId = req.path.includes('/requests') ? `request:${idempotencyKey}` : idempotencyKey;
        const prior = await req.db.get("SELECT * FROM idempotency_records WHERE id = ?", [lookupId]);
        if (prior) {
          if (prior.expires_at && Number(prior.expires_at) <= Date.now()) {
            await req.db.run("DELETE FROM idempotency_records WHERE id = ?", [lookupId]);
          } else if (prior.request_body_hash && prior.request_body_hash !== bodyHash) {
            if (renewInterval) clearInterval(renewInterval);
            if (lockAcquired) {
              await releaseTenantLock(tenantId, lockOwner).catch(() => {});
            }
            if (resolveMutation) {
              const active = activeMutations.get(tenantId);
              if (active) {
                active.activeMutationPromise = null;
                active.resolveActiveMutation = null;
              }
              resolveMutation();
            }
            return res.status(409).json({ error: "Conflict: Idempotency key already used with a different body." });
          } else if (prior.request_body_hash) {
            if (renewInterval) clearInterval(renewInterval);
            if (lockAcquired) {
              await releaseTenantLock(tenantId, lockOwner).catch(() => {});
            }
            if (resolveMutation) {
              const active = activeMutations.get(tenantId);
              if (active) {
                active.activeMutationPromise = null;
                active.resolveActiveMutation = null;
              }
              resolveMutation();
            }
            res.status(prior.response_status);
            let parsedBody;
            try {
              parsedBody = JSON.parse(prior.response_body);
            } catch (e) {
              parsedBody = prior.response_body;
            }
            return originalSend(parsedBody);
          } else if (req.path === '/requests' && req.method === 'POST' && prior.request_hash && prior.response_json) {
            const isPublicRoomOrder = !req.headers.authorization && req.body?.type === 'order' && String(req.body?.target_identifier || '').startsWith('Room-');
            const requestHash = JSON.stringify({ ...(req.body || {}), payment_method: isPublicRoomOrder ? 'room_charge' : (req.body?.payment_method || null) });
            if (prior.request_hash === requestHash) {
              if (renewInterval) clearInterval(renewInterval);
              if (lockAcquired) {
                await releaseTenantLock(tenantId, lockOwner).catch(() => {});
              }
              if (resolveMutation) {
                const active = activeMutations.get(tenantId);
                if (active) {
                  active.activeMutationPromise = null;
                  active.resolveActiveMutation = null;
                }
                resolveMutation();
              }
              res.status(200);
              return originalSend(JSON.parse(prior.response_json));
            }
            if (renewInterval) clearInterval(renewInterval);
            if (lockAcquired) {
              await releaseTenantLock(tenantId, lockOwner).catch(() => {});
            }
            if (resolveMutation) {
              const active = activeMutations.get(tenantId);
              if (active) {
                active.activeMutationPromise = null;
                active.resolveActiveMutation = null;
              }
              resolveMutation();
            }
            return res.status(409).json({ error: "Conflict: Idempotency key already used with a different body." });
          }
        }
      } catch (e) {
        console.error("[Idempotency] Error querying idempotency record:", e);
      }
    }

    // 4. Capture database snapshot before mutation starts
    if (coordinated && mutation) {
      dbBackup = captureDatabaseSnapshot(req.db);
      req.db.suspendSave = true;
    }

    if (coordinated) {
      const originalEnd = res.end.bind(res);
      let ending = false;
      res.end = function(...args) {
        if (ending) return res;
        ending = true;

        if (mutation && !hasCommitted) {
          hasCommitted = true;
          const completeCommitEnd = async () => {
            try {
              if (res.statusCode < 400) {
                await commitDb(tenantId);
              } else {
                await rollbackDatabase(req.db, dbBackup);
                await refreshDb(tenantId);
              }
              req.db.suspendSave = false;
            } catch (error) {
              console.error(`Persistence finalization error (end) for tenant ${tenantId}:`, error);
              await rollbackDatabase(req.db, dbBackup);
              req.db.suspendSave = false;
            } finally {
              if (renewInterval) clearInterval(renewInterval);
              if (lockAcquired) {
                await releaseTenantLock(tenantId, lockOwner).catch(error => console.error(error));
              }
              if (resolveMutation) {
                const active = activeMutations.get(tenantId);
                if (active) {
                  active.activeMutationPromise = null;
                  active.resolveActiveMutation = null;
                }
                resolveMutation();
              }
              originalEnd(...args);
            }
          };
          completeCommitEnd();
          return res;
        }

        if (renewInterval) clearInterval(renewInterval);
        if (lockAcquired) {
          releaseTenantLock(tenantId, lockOwner).catch(() => {});
        }
        if (resolveMutation) {
          const active = activeMutations.get(tenantId);
          if (active) {
            active.activeMutationPromise = null;
            active.resolveActiveMutation = null;
          }
          resolveMutation();
        }
        originalEnd(...args);
        return res;
      };
    }
    req.tenantId = tenantId;
    next();
  } catch (err) {
    if (renewInterval) clearInterval(renewInterval);
    if (lockAcquired) {
      await releaseTenantLock(tenantId, lockOwner).catch(() => {});
    }
    if (resolveMutation) {
      const active = activeMutations.get(tenantId);
      if (active) {
        active.activeMutationPromise = null;
        active.resolveActiveMutation = null;
      }
      resolveMutation();
    }
    console.error(`Database resolution error for tenant ${tenantId}:`, err);
    if (err.message.includes('Firebase') || err.message.includes('persistence') || err.message.includes('lock')) {
      res.status(503).json({ error: 'Service Unavailable: Database connection failed.', error_code: 'persistence_failure' });
    } else {
      res.status(500).json({ error: 'Database connection failed.' });
    }
  }
}

export function readSessionTokens(req) {
  const tokens = [];
  const authorization = req.get('authorization') || '';
  if (authorization.startsWith('Bearer ')) tokens.push(authorization.slice(7).trim());
  const headerToken = req.get('x-aeon-session');
  if (headerToken) tokens.push(headerToken);
  const cookie = String(req.get('cookie') || '').split(';').map(value => value.trim()).find(value => value.startsWith('aeon_session='));
  if (cookie) tokens.push(decodeURIComponent(cookie.slice('aeon_session='.length)));
  return [...new Set(tokens.filter(Boolean))];
}

export function sessionTokenHash(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function staffPinKey() {
  const material = process.env.STAFF_PIN_ENCRYPTION_KEY || process.env.FIREBASE_PRIVATE_KEY || 'reception-local-staff-pin-key';
  return crypto.createHash('sha256').update(String(material)).digest();
}

export function encryptStaffPin(pin) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', staffPinKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(pin), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join('.');
}

export function decryptStaffPin(value) {
  try {
    const [version, iv, tag, encrypted] = String(value || '').split('.');
    if (version !== 'v1' || !iv || !tag || !encrypted) return null;
    const decipher = crypto.createDecipheriv('aes-256-gcm', staffPinKey(), Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

export function knownStaffPin(person) {
  const candidates = {
    staff_reception: process.env.INITIAL_RECEPTION_PIN || '1234',
    staff_manager: process.env.INITIAL_ADMIN_PIN || '9999',
    staff_ahmet: process.env.INITIAL_HOUSEKEEPING_PIN || '1111',
    staff_mehmet: process.env.INITIAL_RESTAURANT_PIN || '2222',
    staff_can: process.env.INITIAL_KITCHEN_PIN || '3333',
    staff_veli: process.env.INITIAL_MAINTENANCE_PIN || '5555'
  };
  const candidate = candidates[person.id];
  return candidate && hashPin(candidate) === person.pin ? candidate : null;
}

export async function resolveSession(req, res, next) {
  const tokens = readSessionTokens(req);
  if (tokens.length === 0) return next();
  try {
    for (const token of tokens) {
      const tokenHash = sessionTokenHash(token);
      let session = hasD1Persistence() ? null : await getPersistentSession(req.tenantId, tokenHash);
      if (!session) {
        session = await req.db.get(
          "SELECT s.id, s.tenant_id, s.expires_at, s.revoked_at, st.id AS staff_id, st.name, st.role, st.department FROM sessions s JOIN staff st ON st.id = s.staff_id WHERE s.id = ?",
          [tokenHash]
        );
      }
      if (session && !session.revoked_at && new Date(session.expires_at).getTime() > Date.now() && session.tenant_id === req.tenantId) {
        const currentStaff = await req.db.get("SELECT id, name, role, department FROM staff WHERE id = ?", [session.staff_id]);
        if (!currentStaff) continue;
        req.session = session;
        req.actor = { ...currentStaff, tenant_id: session.tenant_id };
        break;
      }
    }
    next();
  } catch (error) {
    next(error);
  }
}

export function isManagementRole(actor) {
  return ['yönetici', 'manager', 'admin', 'restoran müdürü'].includes(String(actor?.role || '').toLocaleLowerCase('tr-TR'));
}

export function roleAllowed(actor, roles) {
  return isManagementRole(actor) || roles.includes(String(actor?.department || '').toLowerCase()) || roles.includes(String(actor?.role || '').toLowerCase());
}

function isPublicApiRequest(req) {
  // /erp/* is the CRM↔ERP bridge (modules/crm_bridge.js) — it's server-to-server, not a staff
  // session, so it can't carry a PIN/session cookie. It gates itself with a separate shared
  // secret (CRM_BRIDGE_KEY, checked in the bridge module), so letting it past the staff-session
  // check here does not make it open to the public.
  if (req.path === '/erp/health' || req.path.startsWith('/erp/')) return true;
  if (req.path === '/auth/login' || req.path === '/auth/logout' || req.path === '/tenant/branding' || req.path === '/system/persistence' || req.path === '/system/build' || req.path === '/system/health' || req.path === '/guest/precheckin' || req.path.startsWith('/guest/precheckin/') || req.path === '/integrations/hotelrunner/push') return true;
  if (req.method === 'GET' && ['/catalog/availability', '/guest/requests', '/guest/room-context', '/guest/folio', '/push/public-key', '/guest/targets'].includes(req.path)) return true;
  if (req.method === 'POST' && req.path === '/requests') return true;
  if (req.path.startsWith('/print-bridge/')) return true;
  return false;
}

export function authorizeOperation(req, res, next) {
  if (isPublicApiRequest(req)) return next();
  if (!req.actor) return res.status(401).json({ error: 'Oturum gerekli veya oturum süresi dolmuş.' });
  if (['/auth/session', '/auth/logout', '/events', '/operations/context', '/payment-methods', '/push/subscribe', '/push/unsubscribe'].includes(req.path)) return next();
  if (isManagementRole(req.actor)) return next();
  const normalize = value => String(value || '').toLocaleLowerCase('tr-TR');
  const department = normalize(req.actor.department);
  const role = normalize(req.actor.role);
  const hasAny = values => values.includes(department) || values.includes(role);
  const path = req.path;
  const mutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  const reception = ['reception', 'resepsiyon'];
  const housekeeping = ['housekeeping', 'kat hizmetleri'];
  const dining = ['restaurant', 'waiter', 'servis', 'kitchen', 'chef', 'mutfak', 'bar'];
  const technical = ['maintenance', 'teknik'];
  if (path.startsWith('/crm/')) return hasAny(['management', 'reception', 'resepsiyon', 'sales', 'satış'])
    ? next()
    : res.status(403).json({ error: 'Bu işlem için CRM yetkisi gereklidir.' });
  if (path.startsWith('/system/') || path.startsWith('/tenant/') || path.startsWith('/admin/') || path === '/staff' || path.startsWith('/staff/') || path === '/audit-logs') {
    return res.status(403).json({ error: 'Bu işlem yönetici yetkisi gerektirir.' });
  }
  if (path.startsWith('/reception') || path.startsWith('/guests/search') || path.startsWith('/folios/')) {
    return hasAny(reception) ? next() : res.status(403).json({ error: 'Bu işlem ön büro yetkisi gerektirir.' });
  }
  if (path.startsWith('/hk/') || path.startsWith('/public_areas') || path.startsWith('/rooms')) {
    const allowed = mutation ? [...reception, ...housekeeping, ...technical] : [...reception, ...housekeeping, ...technical];
    return hasAny(allowed) ? next() : res.status(403).json({ error: 'Bu işlem için departman yetkiniz yok.' });
  }
  if (path.startsWith('/maintenance')) return hasAny([...reception, ...housekeeping, ...technical]) ? next() : res.status(403).json({ error: 'Bu işlem için teknik servis yetkisi gereklidir.' });
  if (path.startsWith('/bar/')) return hasAny(dining) ? next() : res.status(403).json({ error: 'Bu işlem için yeme-içme yetkisi gereklidir.' });
  if (path.startsWith('/kitchen/') || path.startsWith('/tables') || path.startsWith('/requests') || path.startsWith('/inventory') || path.startsWith('/catalog') || path.startsWith('/recipes') || path.startsWith('/purchase_requests') || path.startsWith('/campaigns')) {
    return hasAny(dining) ? next() : res.status(403).json({ error: 'Bu işlem için yeme-içme yetkisi gereklidir.' });
  }
  if (path.startsWith('/marina/')) return hasAny(['marina', 'reception', 'resepsiyon']) ? next() : res.status(403).json({ error: 'Bu işlem için marina yetkisi gereklidir.' });
  return res.status(403).json({ error: 'Bu işlem için yetkiniz yok.' });
}

export function requireDurableStorage(req, res, next) {
  const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  if (isMutation && isHostedRuntime && !hasDurablePersistence()) {
    return res.status(503).json({ error: 'Kalıcı production veri deposu yapılandırılmadan işlem kaydedilemez.' });
  }
  next();
}
