import express from 'express';
import { getDb, initSchema, hasFirebasePersistence, hashPin, savePersistentSession, getPersistentSession, revokePersistentSession, refreshDb, commitDb, acquireTenantLock, releaseTenantLock, renewTenantLock } from './db.js';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import fs from 'fs';
import webpush from 'web-push';
import crypto from 'crypto';

// Import Pluggable Modules
import { initDining } from './modules/dining.js';
import { initStay } from './modules/stay.js';
import { initMarina } from './modules/marina.js';
import { initBar } from './modules/bar.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const ENABLE_STOCK_ALGORITHM = process.env.ENABLE_STOCK_ALGORITHM !== 'false';
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

function hasDurablePersistence() {
  return hasFirebasePersistence();
}

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(process.env.VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

app.use(express.json());
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});
app.use('/api', (req, res, next) => {
  const sendJson = res.json.bind(res);
  res.json = payload => {
    if (!payload || typeof payload.error !== 'string') return sendJson(payload);
    const status = res.statusCode;
    const code = status === 400 ? 'validation_error'
      : status === 401 ? 'unauthorized'
        : status === 403 ? 'forbidden'
          : status === 404 ? 'not_found'
            : status === 409 ? 'conflict'
              : status === 429 ? 'rate_limited'
                : status === 503 ? 'service_unavailable'
                  : 'internal_error';
    const error = status >= 500 ? 'İşlem şu anda tamamlanamadı. Lütfen tekrar deneyin.' : payload.error;
    return sendJson({ ...payload, success: false, error, error_code: code });
  };
  next();
});
app.use((req, res, next) => {
  if (req.url.endsWith('.css') || req.url.endsWith('.html') || req.url.endsWith('.js')) {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }
  next();
});

app.use(express.static(path.join(__dirname, 'public'), { maxAge: 0 }));
app.use('/crm', express.static(path.join(__dirname, 'crm/public'), { maxAge: 0 }));

const aeonDataDir = process.env.AEON_DATA_PATH || (process.env.VERCEL ? path.join('/tmp', 'aeon') : path.join(__dirname, 'aeon'));

// Simple Event Bus
class EventBus {
  constructor() {
    this.listeners = {};
  }

  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  async emit(event, data) {
    if (!this.listeners[event]) return;
    await Promise.all(this.listeners[event].map(callback => callback(data)));
  }
}

// Hooks System
class HookRegistry {
  constructor() {
    this.hooks = {};
  }

  register(hookName, providerFn) {
    if (!this.hooks[hookName]) {
      this.hooks[hookName] = [];
    }
    this.hooks[hookName].push(providerFn);
  }

  async call(hookName, context, defaultValues = []) {
    const results = [...defaultValues];
    if (this.hooks[hookName]) {
      for (const provider of this.hooks[hookName]) {
        const res = await provider(context);
        if (Array.isArray(res)) {
          results.push(...res);
        } else if (res) {
          results.push(res);
        }
      }
    }
    return results;
  }
}

const eventBus = new EventBus();
const hookRegistry = new HookRegistry();
const loginAttempts = new Map();

function loginAttemptKey(req) {
  return `${req.tenantId}:${req.ip || req.socket.remoteAddress || 'unknown'}`;
}

function isLoginRateLimited(req) {
  const record = loginAttempts.get(loginAttemptKey(req));
  if (!record) return false;
  if (record.resetAt <= Date.now()) {
    loginAttempts.delete(loginAttemptKey(req));
    return false;
  }
  return record.count >= 5;
}

function recordFailedLogin(req) {
  const key = loginAttemptKey(req);
  const current = loginAttempts.get(key);
  const resetAt = current?.resetAt && current.resetAt > Date.now() ? current.resetAt : Date.now() + 15 * 60 * 1000;
  loginAttempts.set(key, { count: (current?.count || 0) + 1, resetAt });
}

// SSE Connection Registry
const sseClients = new Map(); // tenantId -> Set<Response>

function broadcastSSE(tenantId, eventName, data) {
  const clients = sseClients.get(tenantId);
  if (!clients || clients.size === 0) return;
  const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    try { res.write(payload); } catch (e) { clients.delete(res); }
  }
}

function configuredTenantForHost(host) {
  const hostname = String(host || '').split(':')[0].toLowerCase();
  const raw = process.env.AEON_TENANT_HOSTS;
  if (raw) {
    try {
      const hosts = JSON.parse(raw);
      if (typeof hosts[hostname] === 'string' && /^[a-z0-9_-]+$/i.test(hosts[hostname])) return hosts[hostname];
    } catch (error) {
      console.error('Invalid AEON_TENANT_HOSTS configuration');
    }
  }
  return process.env.AEON_DEFAULT_TENANT || 'aeon';
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

async function tenantDbResolver(req, res, next) {
  const forwardedHost = (Boolean(process.env.VERCEL) || process.env.AEON_TRUST_FORWARDED_HOST === 'true')
    ? req.headers['x-forwarded-host']
    : '';
  const requestedTenant = (req.query && req.query.tenant_id) || req.headers['x-tenant-id'];
  const tenantId = requestedTenant || configuredTenantForHost(forwardedHost || req.headers.host);
  req.tenantId = tenantId;
  
  const allowedTenants = (Boolean(process.env.VERCEL)) ? ['aeon'] : ['aeon', 'tenant_a', 'tenant_b'];
  if (!allowedTenants.includes(tenantId) && !tenantId.startsWith('acceptance_runs_')) {
    return res.status(403).json({ error: 'tenant_not_allowed' });
  }

  const coordinated = (hasFirebasePersistence() || tenantId === 'tenant_a' || tenantId === 'tenant_b' || tenantId.startsWith('acceptance_runs_')) && req.path !== '/events';
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

    if (coordinated && mutation && !hasCommitted) {
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
      renewInterval = setInterval(async () => {
        try {
          await renewTenantLock(tenantId, lockOwner);
        } catch (e) {
          console.error(`[Lock] Lease renewal failed for ${tenantId}:`, e);
        }
      }, 10000);

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

    // 3. Idempotency Check
    if (coordinated && idempotencyKey && mutation) {
      try {
        const bodyHash = crypto.createHash('sha256').update(JSON.stringify(req.body || {})).digest('hex');
        const lookupId = req.path.includes('/requests') ? `request:${idempotencyKey}` : idempotencyKey;
        const prior = await req.db.get("SELECT * FROM idempotency_records WHERE id = ?", [lookupId]);
        if (prior) {
          if (prior.expires_at && Number(prior.expires_at) <= Date.now()) {
            await req.db.run("DELETE FROM idempotency_records WHERE id = ?", [lookupId]);
          } else if (prior.request_body_hash !== bodyHash) {
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
          } else {
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

app.use('/api', tenantDbResolver);

function readSessionTokens(req) {
  const tokens = [];
  const authorization = req.get('authorization') || '';
  if (authorization.startsWith('Bearer ')) tokens.push(authorization.slice(7).trim());
  const headerToken = req.get('x-aeon-session');
  if (headerToken) tokens.push(headerToken);
  const cookie = String(req.get('cookie') || '').split(';').map(value => value.trim()).find(value => value.startsWith('aeon_session='));
  if (cookie) tokens.push(decodeURIComponent(cookie.slice('aeon_session='.length)));
  return [...new Set(tokens.filter(Boolean))];
}

function sessionTokenHash(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

async function resolveSession(req, res, next) {
  const tokens = readSessionTokens(req);
  if (tokens.length === 0) return next();
  try {
    for (const token of tokens) {
      const tokenHash = sessionTokenHash(token);
      let session = await getPersistentSession(req.tenantId, tokenHash);
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

function isManagementRole(actor) {
  return ['yönetici', 'manager', 'admin', 'restoran müdürü'].includes(String(actor?.role || '').toLowerCase());
}

function roleAllowed(actor, roles) {
  return isManagementRole(actor) || roles.includes(String(actor?.department || '').toLowerCase()) || roles.includes(String(actor?.role || '').toLowerCase());
}

function isPublicApiRequest(req) {
  if (req.path === '/auth/login' || req.path === '/auth/logout' || req.path === '/tenant/branding' || req.path === '/system/persistence' || req.path === '/system/build') return true;
  if (req.method === 'GET' && ['/catalog/availability', '/push/public-key'].includes(req.path)) return true;
  if (req.method === 'POST' && req.path === '/requests') return true;
  return false;
}

function authorizeOperation(req, res, next) {
  if (isPublicApiRequest(req)) return next();
  if (!req.actor) return res.status(401).json({ error: 'Oturum gerekli veya oturum süresi dolmuş.' });
  if (['/auth/session', '/auth/logout', '/events', '/operations/context', '/payment-methods', '/push/subscribe', '/push/unsubscribe'].includes(req.path)) return next();
  if (isManagementRole(req.actor)) return next();
  const actorDepartment = String(req.actor.department || '').toLocaleLowerCase('tr-TR');
  const reception = ['reception', 'resepsiyon'].includes(actorDepartment);
  const mutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  if (req.path === '/guests/search' || req.path.startsWith('/folios/') || /^\/rooms\/[^/]+\/folio$/.test(req.path)) {
    return reception ? next() : res.status(403).json({ error: 'Bu işlem ön büro yetkisi gerektirir.' });
  }
  if ((req.path === '/rooms/checkin' || req.path === '/rooms/checkout') && mutation) {
    return reception ? next() : res.status(403).json({ error: 'Check-in ve check-out ön büro yetkisi gerektirir.' });
  }
  const masterDataMutation = mutation && (
    req.path === '/rooms' || (req.method === 'DELETE' && /^\/rooms\/[^/]+$/.test(req.path)) ||
    req.path === '/inventory' || req.path.startsWith('/inventory/receipt') || (req.method === 'DELETE' && req.path.startsWith('/inventory/')) ||
    req.path === '/catalog/toggle' || req.path === '/catalog' || req.path.startsWith('/catalog/') ||
    req.path === '/recipes' || req.path.startsWith('/recipes/') ||
    req.path === '/campaigns' || req.path.startsWith('/campaigns/')
  );
  if (masterDataMutation) return res.status(403).json({ error: 'Ana veri değişikliği yönetici yetkisi gerektirir.' });
  if (req.path.startsWith('/system/') || req.path.startsWith('/tenant/') || req.path.startsWith('/admin/') || req.path === '/staff' || req.path.startsWith('/staff/')) {
    return res.status(403).json({ error: 'Bu işlem yönetici yetkisi gerektirir.' });
  }
  const path = req.path;
  if (path === '/audit-logs') return isManagementRole(req.actor) ? next() : res.status(403).json({ error: 'Audit kayıtları yönetici yetkisi gerektirir.' });
  if (req.method === 'GET') {
    const readable = path.startsWith('/rooms') || path.startsWith('/hk/') || path.startsWith('/public_areas')
      ? ['reception', 'resepsiyon', 'housekeeping', 'kat hizmetleri', 'maintenance', 'teknik']
      : path.startsWith('/requests')
        ? ['reception', 'resepsiyon', 'housekeeping', 'kat hizmetleri', 'maintenance', 'teknik', 'restaurant', 'waiter', 'servis', 'kitchen', 'chef', 'mutfak']
      : path.startsWith('/tables') || path.startsWith('/catalog') || path.startsWith('/inventory') || path.startsWith('/recipes') || path.startsWith('/purchase_requests')
        ? ['reception', 'resepsiyon', 'restaurant', 'waiter', 'servis', 'kitchen', 'chef', 'mutfak']
        : path.startsWith('/maintenance')
          ? ['reception', 'resepsiyon', 'housekeeping', 'kat hizmetleri', 'maintenance', 'teknik']
          : [];
    return roleAllowed(req.actor, readable) ? next() : res.status(403).json({ error: 'Bu kaynağı görüntüleme yetkiniz yok.' });
  }
  const allowed = path.startsWith('/folios/')
    ? ['reception', 'resepsiyon', 'restaurant', 'waiter', 'servis']
    : path.startsWith('/rooms/checkin') || path.startsWith('/rooms/checkout')
    ? ['reception', 'resepsiyon']
    : path.startsWith('/rooms/') || path.startsWith('/hk/') || path.startsWith('/public_areas')
      ? ['housekeeping', 'kat hizmetleri', 'reception', 'resepsiyon', 'maintenance', 'teknik']
      : path.startsWith('/maintenance')
        ? ['maintenance', 'teknik']
        : path.startsWith('/tables/') || path.startsWith('/tables')
        ? ['restaurant', 'waiter', 'servis']
        : path.startsWith('/requests/status')
          ? ['restaurant', 'waiter', 'servis', 'kitchen', 'chef', 'mutfak', 'reception', 'resepsiyon']
          : path.startsWith('/inventory') || path.startsWith('/catalog') || path.startsWith('/recipes') || path.startsWith('/purchase_requests') || path.startsWith('/campaigns')
            ? ['restaurant', 'waiter', 'servis', 'kitchen', 'chef', 'mutfak']
            : [];
  return roleAllowed(req.actor, allowed) ? next() : res.status(403).json({ error: 'Bu işlem için departman yetkiniz yok.' });
}

function requireDurableStorage(req, res, next) {
  const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  if (isMutation && Boolean(process.env.VERCEL) && !hasDurablePersistence()) {
    return res.status(503).json({ error: 'Kalıcı production veri deposu yapılandırılmadan işlem kaydedilemez.' });
  }
  next();
}

app.use('/api', resolveSession, authorizeOperation, requireDurableStorage);

// Server-Sent Events endpoint
app.get('/api/events', tenantDbResolver, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const tenantId = req.tenantId || 'aeon';
  if (!sseClients.has(tenantId)) sseClients.set(tenantId, new Set());
  sseClients.get(tenantId).add(res);

  // Send initial ping
  res.write(': ping\n\n');

  // Heartbeat every 20s (keeps connection alive, avoids Vercel 25s timeout)
  const heartbeat = setInterval(() => {
    try { res.write(': ping\n\n'); } catch (e) { clearInterval(heartbeat); }
  }, 20000);

  req.on('close', () => {
    clearInterval(heartbeat);
    const clients = sseClients.get(tenantId);
    if (clients) clients.delete(res);
  });
});

function getWorkflowDepartments(request) {
  if (request.departments) {
    try {
      const parsed = JSON.parse(request.departments);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    } catch (e) {}
  }
  const departments = new Set([request.department || 'Reception']);
  if (request.type === 'order') {
    departments.add('Kitchen');
    departments.add('Restaurant');
  }
  if (request.type === 'waiter_call' || request.type === 'bill_call') departments.add('Restaurant');
  return Array.from(departments);
}

app.get('/api/operations/context', async (req, res) => {
  try {
    const [rooms, tables, requests, inventory, catalog, publicAreas] = await Promise.all([
      req.db.all(`
        SELECT r.*, g.first_name AS guest_first_name, g.last_name AS guest_last_name,
          g.car_plate, g.phone,
          CASE WHEN g.id IS NOT NULL THEN trim(g.first_name || ' ' || g.last_name) ELSE r.guest_name END AS canonical_guest_name
        FROM rooms r
        LEFT JOIN guest_registry g ON r.id = g.room_id AND g.checked_out_at IS NULL
        ORDER BY r.room_number
      `),
      req.db.all('SELECT * FROM tables ORDER BY table_number'),
      req.db.all('SELECT * FROM requests ORDER BY created_at DESC'),
      req.db.all('SELECT * FROM inventory ORDER BY name'),
      req.db.all('SELECT * FROM catalog_items ORDER BY category, name'),
      req.db.all('SELECT * FROM public_areas ORDER BY name')
    ]);
    const actorRole = String(req.actor?.role || '').toLocaleLowerCase('tr-TR');
    const actorDepartment = String(req.actor?.department || '').toLocaleLowerCase('tr-TR');
    const management = ['admin', 'manager', 'yönetici'].includes(actorRole);
    const reception = ['reception', 'resepsiyon'].includes(actorDepartment);
    const dining = ['restaurant', 'waiter', 'servis', 'kitchen', 'chef', 'mutfak'].includes(actorDepartment) || ['restaurant', 'waiter', 'servis', 'kitchen', 'chef', 'mutfak'].includes(actorRole);
    const housekeeping = ['housekeeping', 'kat hizmetleri'].includes(actorDepartment) || ['housekeeping', 'kat hizmetleri'].includes(actorRole);
    const maintenance = ['maintenance', 'teknik'].includes(actorDepartment) || ['maintenance', 'teknik'].includes(actorRole);
    const visibleRequests = management || reception ? requests : requests.filter(request => {
      const departments = getWorkflowDepartments(request).map(value => String(value).toLocaleLowerCase('tr-TR'));
      return departments.includes(actorDepartment) || departments.includes(actorRole);
    });
    const visibleRooms = rooms.map(room => {
      if (management || reception) return { ...room, guest_name: room.canonical_guest_name || room.guest_name || '' };
      const { phone, car_plate, guest_first_name, guest_last_name, canonical_guest_name, guest_name, ...operationalRoom } = room;
      return operationalRoom;
    });
    res.json({
      tenant_id: req.tenantId,
      generated_at: new Date().toISOString(),
      rooms: management || reception || housekeeping || maintenance ? visibleRooms : [],
      tables: management || reception || dining ? tables : [],
      requests: visibleRequests.map(request => ({ ...request, departments: getWorkflowDepartments(request) })),
      inventory: management || dining ? inventory : [],
      catalog: management || dining ? catalog : [],
      publicAreas: management || reception || housekeeping ? publicAreas : []
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/push/public-key', (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

app.post('/api/push/subscribe', async (req, res) => {
  const { subscription } = req.body;
  if (!subscription?.endpoint) {
    return res.status(400).json({ error: 'subscription.endpoint is required' });
  }

  try {
    await req.db.run(
      "INSERT OR REPLACE INTO push_subscriptions (endpoint, subscription, staff_id, staff_name, role, department) VALUES (?, ?, ?, ?, ?, ?)",
      [
        subscription.endpoint,
        JSON.stringify(subscription),
        req.actor?.id || null,
        req.actor?.name || null,
        req.actor?.role || null,
        req.actor?.department || null
      ]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/push/unsubscribe', async (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) return res.status(400).json({ error: 'endpoint is required' });

  try {
    await req.db.run("DELETE FROM push_subscriptions WHERE endpoint = ?", [endpoint]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function sendStaffPush(tenantId, payload, targetRoles = [], targetDepartments = []) {
  try {
    const db = await getDb(tenantId || 'aeon');
    const rows = await db.all("SELECT * FROM push_subscriptions");
    await Promise.all(rows.map(async row => {
      // Check if this subscription role matches targetRoles
      const matchesRole = targetRoles.length > 0 && targetRoles.includes(row.role);
      const matchesDepartment = targetDepartments.length > 0 && targetDepartments.includes(row.department);
      const matchesAudience = targetRoles.length === 0 && targetDepartments.length === 0 || matchesRole || matchesDepartment;
      
      // Managers should NEVER receive push notifications
      const isManager = row.role === 'Yönetici' || row.role === 'Manager';

      if (matchesAudience && !isManager) {
        try {
          await webpush.sendNotification(JSON.parse(row.subscription), JSON.stringify(payload));
        } catch (err) {
          if (err.statusCode === 404 || err.statusCode === 410) {
            await db.run("DELETE FROM push_subscriptions WHERE endpoint = ?", [row.endpoint]);
          } else {
            console.error('Push notification failed:', err.message);
          }
        }
      }
    }));
  } catch (err) {
    console.error('Push dispatch failed:', err);
  }
}

eventBus.on('staff_push', data => {
  const { tenantId, payload, targetRoles, targetDepartments } = data;
  sendStaffPush(tenantId, payload, targetRoles, targetDepartments).catch(console.error);
});

eventBus.on('room_updated', data => {
  broadcastSSE(data.tenantId || 'aeon', 'room_updated', data);
});
eventBus.on('request_created', data => {
  broadcastSSE(data.tenantId || 'aeon', 'request_created', data);
});
eventBus.on('request_updated', data => {
  broadcastSSE(data.tenantId || 'aeon', 'request_updated', data);
});

// --- INITIALIZE PLUGGABLE MODULES ---
initDining({ app, eventBus, hookRegistry, getDb, broadcastSSE });
initStay({ app, eventBus, hookRegistry, getDb, broadcastSSE });
initMarina({ app, eventBus, hookRegistry, getDb });
initBar({ app, eventBus, broadcastSSE });

// --- CORE SYSTEM ROUTES ---

// Tenant Config
app.get('/api/tenant/branding', (req, res) => {
  let tenantId = req.query.tenant_id || 'aeon';
  if (Array.isArray(tenantId)) {
    tenantId = tenantId[0];
  }
  if (tenantId === 'default') tenantId = 'aeon';

  // 1. Validate tenant ID to prevent path traversal
  if (!/^[a-z0-9_-]+$/i.test(tenantId)) {
    return res.status(400).json({ error: 'Geçersiz tenant kimliği.' });
  }

  // 2. Resolve only under public/brands/
  const brandingFile = path.join(__dirname, 'public', 'brands', tenantId, 'branding.json');
  if (fs.existsSync(brandingFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(brandingFile, 'utf8'));
      return res.json({
        tenant_id: tenantId,
        name: data.name || 'AEON ERP',
        logo: data.logo || `/brands/${tenantId}/logo.svg`,
        primary_color: data.primary_color || '#0891b2',
        accent_color: data.accent_color || '#d4af37'
      });
    } catch (e) {
      console.error('Error reading branding file:', e);
    }
  }

  // 3. Reject unknown tenants with 404 tenant_not_found (no default fallback)
  res.status(404).json({ error: 'tenant_not_found' });
});



app.get('/api/tenant/config', async (req, res) => {
  try {
    const configRows = await req.db.all("SELECT * FROM config");
    const config = {};
    configRows.forEach(row => {
      config[row.key] = row.value;
    });
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/system/persistence', (req, res) => {
  const isVercel = Boolean(process.env.VERCEL);
  res.json({
    customer: req.tenantId,
    mode: hasDurablePersistence() ? 'firebase-rtdb' : (isVercel ? 'filesystem-ephemeral' : 'local-file'),
    durable: hasDurablePersistence() || !isVercel,
    warning: hasDurablePersistence() || !isVercel
      ? null
      : 'Vercel üzerinde Firebase veya başka bir kalıcı veri deposu yapılandırılmadı.'
  });
});

app.get('/api/system/build', (req, res) => {
  res.json({
    build: process.env.VERCEL_GIT_COMMIT_SHA || process.env.AEON_BUILD_ID || 'local',
    deployed_at: process.env.VERCEL_DEPLOYMENT_ID || null,
    environment: process.env.VERCEL_ENV || 'local'
  });
});

app.post('/api/tenant/config', async (req, res) => {
  const { MODULE_DINING, MODULE_STAY, MODULE_CRUISE, MODULE_PRINTER } = req.body;
  try {
    const staff_name = req.actor?.name || 'Sistem / Yönetici';
    if (MODULE_DINING !== undefined) {
      await req.db.run("UPDATE config SET value = ? WHERE key = 'MODULE_DINING'", [String(MODULE_DINING)]);
    }
    if (MODULE_STAY !== undefined) {
      await req.db.run("UPDATE config SET value = ? WHERE key = 'MODULE_STAY'", [String(MODULE_STAY)]);
    }
    if (MODULE_CRUISE !== undefined) {
      await req.db.run("UPDATE config SET value = ? WHERE key = 'MODULE_CRUISE'", [String(MODULE_CRUISE)]);
    }
    if (MODULE_PRINTER !== undefined) {
      await req.db.run("UPDATE config SET value = ? WHERE key = 'MODULE_PRINTER'", [String(MODULE_PRINTER)]);
    }
    
    // Log action
    const logId = 'log_' + Math.random().toString(36).substr(2, 9);
    await req.db.run(
      "INSERT INTO audit_logs (id, staff_name, action, details) VALUES (?, ?, ?, ?)",
      [logId, staff_name, 'Modül Yapılandırması Güncellendi', `Dining=${MODULE_DINING}, Stay=${MODULE_STAY}, Cruise=${MODULE_CRUISE}, Printer=${MODULE_PRINTER}`]
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Audit Logs Endpoints
app.get('/api/audit-logs', async (req, res) => {
  try {
    const logs = await req.db.all("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 200");
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/audit-logs', async (req, res) => {
  const { action, details } = req.body;
  const staff_name = req.actor?.name;
  if (!staff_name || !action) {
    return res.status(400).json({ error: 'action is required' });
  }
  try {
    const id = 'log_' + Math.random().toString(36).substr(2, 9);
    await req.db.run(
      "INSERT INTO audit_logs (id, staff_name, action, details) VALUES (?, ?, ?, ?)",
      [id, staff_name, action, details || '']
    );
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Payment Methods Hook Endpoint
app.get('/api/payment-methods', async (req, res) => {
  try {
    const defaultMethods = [
      { id: 'cash', name: 'Nakit' },
      { id: 'card', name: 'Kredi Kartı' }
    ];
    const methods = await hookRegistry.call('payment_methods', { db: req.db }, defaultMethods);
    res.json(methods);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { pin } = req.body;
  if (!pin) {
    return res.status(400).json({ error: 'PIN is required' });
  }
  if (isLoginRateLimited(req)) {
    return res.status(429).json({ error: 'Çok fazla hatalı giriş denemesi yapıldı. Lütfen daha sonra tekrar deneyin.' });
  }

  try {
    const user = await req.db.get("SELECT id, name, role, department FROM staff WHERE pin = ?", [hashPin(pin)]);
    if (!user) {
      recordFailedLogin(req);
      return res.status(401).json({ error: 'Geçersiz PIN.' });
    }

    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
    const token = crypto.randomBytes(32).toString('base64url');
    await req.db.run("DELETE FROM sessions WHERE revoked_at IS NOT NULL OR expires_at <= ?", [new Date().toISOString()]);
    await req.db.run(
      "INSERT INTO sessions (id, staff_id, tenant_id, expires_at) VALUES (?, ?, ?, ?)",
      [sessionTokenHash(token), user.id, req.tenantId, expiresAt]
    );
    await savePersistentSession(req.tenantId, sessionTokenHash(token), {
      id: sessionTokenHash(token),
      staff_id: user.id,
      tenant_id: req.tenantId,
      expires_at: expiresAt,
      revoked_at: null
    });
    loginAttempts.delete(loginAttemptKey(req));
    res.cookie('aeon_session', token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: Boolean(process.env.VERCEL),
      maxAge: 8 * 60 * 60 * 1000,
      path: '/'
    });

    res.json({
      success: true,
      token,
      expires_at: expiresAt,
      user: { ...user, tenant_id: req.tenantId }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/session', (req, res) => {
  if (!req.actor) return res.status(401).json({ error: 'Oturum bulunamadı.' });
  res.json({ user: req.actor, expires_at: req.session.expires_at });
});

app.post('/api/auth/logout', async (req, res) => {
  const tokens = readSessionTokens(req);
  const revokedAt = new Date().toISOString();
  for (const token of tokens) {
    const tokenHash = sessionTokenHash(token);
    await req.db.run("UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE id = ?", [tokenHash]);
    await revokePersistentSession(req.tenantId, tokenHash, revokedAt);
  }
  res.clearCookie('aeon_session', { httpOnly: true, sameSite: 'strict', secure: Boolean(process.env.VERCEL), path: '/' });
  res.status(204).end();
});

app.get('/api/staff', async (req, res) => {
  try {
    const staff = await req.db.all("SELECT id, name, role, department FROM staff ORDER BY name");
    res.json(staff);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/staff', async (req, res) => {
  const { name, role, pin, department } = req.body;
  const staff_name = req.actor?.name || 'Yönetici';
  if (!name || !role || !pin) {
    return res.status(400).json({ error: 'name, role and pin are required' });
  }

  try {
    const existing = await req.db.get("SELECT id FROM staff WHERE pin = ?", [hashPin(pin)]);
    if (existing) return res.status(409).json({ error: 'PIN already exists' });

    const id = 'staff_' + Math.random().toString(36).substr(2, 9);
    await req.db.run(
      "INSERT INTO staff (id, name, role, department, pin) VALUES (?, ?, ?, ?, ?)",
      [id, name, role, department || 'Reception', hashPin(pin)]
    );

    // Log action
    const logId = 'log_' + Math.random().toString(36).substr(2, 9);
    await req.db.run(
      "INSERT INTO audit_logs (id, staff_name, action, details) VALUES (?, ?, ?, ?)",
      [logId, staff_name, 'Personel Eklendi', `İsim: ${name}, Rol: ${role}`]
    );

    res.json({ success: true, staff: { id, name, role, department: department || 'Reception' } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/staff/:id', async (req, res) => {
  const staff_name = req.actor?.name || 'Yönetici';
  try {
    const staff = await req.db.get("SELECT name, role FROM staff WHERE id = ?", [req.params.id]);
    await req.db.run("DELETE FROM staff WHERE id = ?", [req.params.id]);

    if (staff) {
      // Log action
      const logId = 'log_' + Math.random().toString(36).substr(2, 9);
      await req.db.run(
        "INSERT INTO audit_logs (id, staff_name, action, details) VALUES (?, ?, ?, ?)",
        [logId, staff_name, 'Personel Silindi', `İsim: ${staff.name}, Rol: ${staff.role}`]
      );
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- INVENTORY & MENU MANAGEMENT ENDPOINTS ---

app.post('/api/inventory/receipt', async (req, res) => {
  const { receipt_number, vendor, total_amount, items, created_by } = req.body;
  const receipt_id = 'rec_' + Date.now() + Math.random().toString(36).substring(7);
  try {
    await req.db.run(`INSERT INTO inventory_receipts (id, receipt_number, vendor, total_amount, created_by) VALUES (?, ?, ?, ?, ?)`,
      [receipt_id, receipt_number, vendor, total_amount, created_by || 'Unknown']);
    
    for (const item of items) {
      const item_id = 'reci_' + Date.now() + Math.random().toString(36).substring(7);
      await req.db.run(`INSERT INTO inventory_receipt_items (id, receipt_id, inventory_id, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?)`,
        [item_id, receipt_id, item.inventory_id, item.quantity, item.unit_price, item.total_price]);
      // Update inventory stock
      await req.db.run(`UPDATE inventory SET stock = stock + ? WHERE id = ?`, [item.quantity, item.inventory_id]);
    }
    res.json({ success: true, receipt_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/inventory/receipts', tenantDbResolver, async (req, res) => {
  try {
    const receipts = await req.db.all(`
      SELECT r.*, GROUP_CONCAT(ri.inventory_id || ':' || ri.quantity || ':' || ri.unit_price) as items_summary
      FROM inventory_receipts r
      LEFT JOIN inventory_receipt_items ri ON r.id = ri.receipt_id
      GROUP BY r.id
      ORDER BY r.created_at DESC
      LIMIT 100
    `);
    res.json(receipts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/inventory/update', async (req, res) => {
  const { inventory_id, quantity_change } = req.body;
  try {
    await req.db.run(`UPDATE inventory SET stock = stock + ? WHERE id = ?`, [Number(quantity_change) || 0, inventory_id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/catalog/toggle', async (req, res) => {
  const { catalog_id, in_stock } = req.body;
  try {
    await req.db.run(`UPDATE catalog_items SET in_stock = ? WHERE id = ?`, [in_stock ? 1 : 0, catalog_id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/dashboard', async (req, res) => {
  try {
    const [rooms, openRequests, kitchenQueue, openTables, criticalStock, maintenance, receivables, recentAudit] = await Promise.all([
      req.db.all("SELECT status, COUNT(*) AS cnt FROM rooms GROUP BY status"),
      req.db.get("SELECT COUNT(*) AS cnt FROM requests WHERE status NOT IN ('completed', 'paid', 'cancelled', 'rejected', 'resolved')"),
      req.db.get("SELECT COUNT(*) AS cnt FROM requests WHERE type = 'order' AND status IN ('pending', 'accepted', 'preparing', 'ready')"),
      req.db.get("SELECT COUNT(*) AS cnt FROM tables WHERE status != 'empty'"),
      req.db.all("SELECT id, name, stock, par_level, unit FROM inventory WHERE stock <= par_level ORDER BY stock ASC"),
      req.db.all("SELECT id, target_identifier, status, details, created_at FROM requests WHERE type = 'maintenance_request' AND status != 'resolved' ORDER BY created_at ASC"),
      req.db.get("SELECT COALESCE(SUM(total_amount), 0) AS amount FROM requests WHERE type = 'order' AND status NOT IN ('paid', 'completed', 'cancelled', 'rejected')"),
      req.db.all("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 50")
    ]);
    res.json({
      generated_at: new Date().toISOString(),
      rooms: Object.fromEntries(rooms.map(row => [row.status, Number(row.cnt)])),
      open_tasks: Number(openRequests.cnt),
      kitchen_queue: Number(kitchenQueue.cnt),
      open_tables: Number(openTables.cnt),
      critical_stock: criticalStock,
      maintenance,
      receivables: Number(receivables.amount),
      audit: recentAudit
    });
  } catch (err) {
    res.status(500).json({ error: 'Yönetici özeti oluşturulamadı.' });
  }
});

// System Info & Network Connectivity
function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

app.get('/api/system/info', (req, res) => {
  const ip = getLocalIpAddress();
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers.host || '';
  res.json({
    ip,
    port: PORT,
    url: host ? `${protocol}://${host}` : `http://${ip}:${PORT}`
  });
});

app.post('/api/system/reset', tenantDbResolver, async (req, res) => {
  if (process.env.AEON_ALLOW_DESTRUCTIVE_ADMIN !== 'true') return res.status(403).json({ error: 'Reset işlemi bu ortamda kapalıdır.' });
  try {
    const tables = ['requests', 'rooms', 'guest_registry', 'tables', 'inventory', 'catalog_items', 'recipes', 'bar_blind_audits', 'apa_ledger', 'campaigns'];
    for (const table of tables) {
      try {
        await req.db.run(`DELETE FROM ${table}`);
      } catch (e) {
        // Table might not exist, ignore
      }
    }
    
    // Re-seed default mock data for the active tenant
    await initSchema(req.db, req.tenantId);
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/system/reset-data', tenantDbResolver, async (req, res) => {
  if (process.env.AEON_ALLOW_DESTRUCTIVE_ADMIN !== 'true') return res.status(403).json({ error: 'Reset işlemi bu ortamda kapalıdır.' });
  try {
    const tables = ['requests', 'audit_logs', 'guest_registry', 'folios', 'registrations', 'bar_blind_audits', 'purchase_requests', 'laundry_orders', 'lost_and_found', 'inventory_receipts', 'inventory_receipt_items', 'apa_ledger'];
    for (const table of tables) {
      try {
        await req.db.run(`DELETE FROM [${table}]`);
      } catch (e) {
        // Table might not exist yet
      }
    }
    
    // reset room statuses
    await req.db.run("UPDATE rooms SET status = 'clean_vacant', guest_name = '', eta = '', dnd_active = 0, updated_by = NULL, updated_at = CURRENT_TIMESTAMP, vip = 0, late_checkout = 0, arrival_date = NULL, departure_date = NULL");
    
    // reset table statuses
    await req.db.run("UPDATE tables SET status = 'empty'");

    // reset public areas
    await req.db.run("UPDATE public_areas SET status = 'clean', last_cleaned_at = NULL, last_cleaned_by = NULL");

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.use((err, req, res, next) => {
  console.error('Unhandled request error:', err);
  if (res.headersSent) return next(err);
  if (req.path.startsWith('/api/')) return res.status(500).json({ error: 'İşlem şu anda tamamlanamadı.' });
  res.status(500).send('İşlem şu anda tamamlanamadı.');
});

// Catch-all route to serve SPA
app.get('*', (req, res) => {
  const hasExtension = path.extname(req.path) !== '';
  if (hasExtension) {
    res.status(404).end();
  } else {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

if (!process.env.VERCEL && process.env.AEON_DISABLE_LISTEN !== 'true') {
  app.listen(PORT, () => {
    console.log(`AEON ERP Server is running on http://localhost:${PORT}`);
  });
}

export default app;
