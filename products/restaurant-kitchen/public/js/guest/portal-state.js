// Shared mutable state for the guest portal flow (public/js/guest/*.js).
// These are read across multiple modules; reassignment (as opposed to in-place
// mutation) must go through the exported setters below so every module keeps
// observing the same single source of truth via ES module live bindings.

export let activeTarget = ''; // e.g. 'Room-101' or 'Table-Masa 1'
export let cart = []; // array of { itemId, quantity, name, price }
export let portalMode = '';
export let currentMenuItems = [];
export let trackedOrderIds = [];
export let orderStatusCache = {};
export let guestOrderPollTimer = null;

export function setActiveTarget(value) {
  activeTarget = value;
}

export function setPortalMode(value) {
  portalMode = value;
}

export function setCurrentMenuItems(value) {
  currentMenuItems = value;
}

export function setTrackedOrderIds(value) {
  trackedOrderIds = value;
}

export function setGuestOrderPollTimer(value) {
  guestOrderPollTimer = value;
}

export function targetIsRoom() {
  return activeTarget.startsWith('Room-');
}
