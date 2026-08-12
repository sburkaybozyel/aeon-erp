import { setupGuestPortal } from './guest.js';
import { resolvePortalEntry } from './guest-entry-routing.js';

document.addEventListener('DOMContentLoaded', () => {
  const { target, mode } = resolvePortalEntry(window.location.pathname, window.location.search);
  window.guestTarget = target;
  window.guestPortalMode = mode;
  setupGuestPortal(target, mode);
});
