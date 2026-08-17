export function hasFirebasePersistence() {
  return false;
}

export function setSimulateFirebaseFailure() {}

export function getFirebaseRef() {
  throw new Error('Firebase persistence was retired after the Cloudflare D1 migration.');
}

export async function savePersistentSession() {
  return false;
}

export async function getPersistentSession() {
  return null;
}

export async function revokePersistentSession() {
  return false;
}

export async function acquireTenantLock() {
  return true;
}

export async function releaseTenantLock() {}

export async function renewTenantLock() {}
