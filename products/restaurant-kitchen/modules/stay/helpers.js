// Shared helpers for the stay module split.

export function createNotify(eventBus) {
  return (tenantId, payload, targetDepartments) => eventBus.emit('staff_push', { tenantId, targetRoles: [], targetDepartments, payload });
}
