import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

const firebaseRoot = String(process.env.AEON_FIREBASE_ROOT || 'aeon_erp').replace(/^\/+|\/+$/g, '');

// Firebase persistence is optional and must be supplied through private environment variables.
if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
  try {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      }),
      databaseURL: process.env.FIREBASE_DATABASE_URL
    });
    console.log('Firebase Admin SDK initialized from environment.');
  } catch (err) {
    console.error('Firebase initialization failed:', err.message);
  }
}

export function hasFirebasePersistence() {
  return getApps().length > 0 && Boolean(process.env.FIREBASE_DATABASE_URL);
}

let simulateFirebaseFailure = false;

export function setSimulateFirebaseFailure(val) {
  simulateFirebaseFailure = val;
}

export function getFirebaseRef(tenantId, pathSegment) {
  if (simulateFirebaseFailure) {
    return {
      set: () => Promise.reject(new Error("Simulated Firebase persistence failure")),
      update: () => Promise.reject(new Error("Simulated Firebase persistence failure")),
      transaction: (fn) => {
        return Promise.reject(new Error("Simulated Firebase persistence failure"));
      },
      get: () => Promise.resolve({ exists: () => false, val: () => null }),
      remove: () => Promise.reject(new Error("Simulated Firebase persistence failure"))
    };
  }

  if (tenantId.startsWith('acceptance_runs_')) {
    const runId = tenantId.replace('acceptance_runs_', '');
    return getDatabase().ref(`${firebaseRoot}/acceptance_runs/${runId}/${pathSegment}`);
  }

  if (pathSegment.startsWith('lock')) {
    return getDatabase().ref(`${firebaseRoot}/tenant_locks/${tenantId}`);
  }
  if (pathSegment.startsWith('session/')) {
    const tokenHash = pathSegment.split('/')[1];
    return getDatabase().ref(`${firebaseRoot}/auth_sessions/${tenantId}/${tokenHash}`);
  }
  return getDatabase().ref(`${firebaseRoot}/tenants/${tenantId}`);
}

export async function savePersistentSession(tenantId, tokenHash, session) {
  if (!hasFirebasePersistence()) return false;
  await getFirebaseRef(tenantId, `session/${tokenHash}`).set(session);
  return true;
}

export async function getPersistentSession(tenantId, tokenHash) {
  if (!hasFirebasePersistence()) return null;
  const snapshot = await getFirebaseRef(tenantId, `session/${tokenHash}`).get();
  return snapshot.exists() ? snapshot.val() : null;
}

export async function revokePersistentSession(tenantId, tokenHash, revokedAt) {
  if (!hasFirebasePersistence()) return false;
  await getFirebaseRef(tenantId, `session/${tokenHash}`).update({ revoked_at: revokedAt });
  return true;
}

export async function acquireTenantLock(tenantId, owner, leaseMs = 60000, timeoutMs = 10000) {
  if (!hasFirebasePersistence() || tenantId === 'test_suite_run') return true;
  const ref = getFirebaseRef(tenantId, 'lock');
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const now = Date.now();
    const result = await ref.transaction(current => {
      if (!current || current.owner === owner || Number(current.expires_at || 0) <= now) {
        return { owner, expires_at: now + leaseMs };
      }
      return;
    });
    if (result.committed && result.snapshot.val()?.owner === owner) return true;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  return false;
}

export async function releaseTenantLock(tenantId, owner) {
  if (!hasFirebasePersistence() || tenantId === 'test_suite_run') return;
  const ref = getFirebaseRef(tenantId, 'lock');
  await ref.transaction(current => current?.owner === owner ? null : current);
}

export async function renewTenantLock(tenantId, owner, leaseMs = 60000) {
  if (!hasFirebasePersistence() || tenantId === 'test_suite_run') return;
  const ref = getFirebaseRef(tenantId, 'lock');
  const now = Date.now();
  await ref.transaction(current => current?.owner === owner ? { owner, expires_at: now + leaseMs } : current);
}
