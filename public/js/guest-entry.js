import { setupGuestPortal } from './guest.js?v=20260730-qr-isolation';

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const roomId = params.get('room_id') || '';
  const requestedTarget = params.get('target') || (roomId ? `Room-${roomId}` : '');
  const type = params.get('type') || (roomId ? 'room' : '');
  const target = type === 'room'
    ? (requestedTarget.startsWith('Room-') ? requestedTarget : '')
    : type === 'restaurant'
      ? (requestedTarget.startsWith('Table-') ? requestedTarget : '')
      : requestedTarget;
  if (!target) {
    document.body.textContent = 'Geçersiz QR hedefi.';
    return;
  }
  window.guestTarget = target;

  setupGuestPortal(target, type);
});
