import { setupGuestPortal } from './guest.js';

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const roomId = params.get('room_id') || '';
  const target = params.get('target') || (roomId ? `Room-${roomId}` : '');
  const type = params.get('type') || (roomId ? 'room' : '');
  window.guestTarget = target;

  setupGuestPortal(target, type);
});
