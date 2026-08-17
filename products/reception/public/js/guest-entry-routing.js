const restaurantPaths = new Set(['/restaurant', '/restaurant/', '/restaurant.html', '/menu', '/menu/', '/menu.html', '/restaurant-menu', '/restaurant-menu/']);
const roomPaths = new Set(['/room', '/room/', '/room.html', '/room-portal', '/room-portal/', '/room-portal.html', '/guest', '/guest/', '/guest.html']);

export function resolvePortalEntry(pathname, search = '') {
  const params = new URLSearchParams(search);
  const roomId = String(params.get('room_id') || '').trim();
  const rawTarget = String(params.get('target') || (roomId ? `Room-${roomId}` : '')).trim();
  const requestedType = params.get('type');
  const explicitType = requestedType === 'room' || requestedType === 'restaurant' ? requestedType : '';
  const pathType = restaurantPaths.has(pathname) ? 'restaurant' : roomPaths.has(pathname) ? 'room' : '';
  const targetType = rawTarget.startsWith('Table-') ? 'restaurant' : rawTarget.startsWith('Room-') ? 'room' : '';
  const mode = explicitType || pathType || targetType || 'room';
  const target = targetType && targetType !== mode ? '' : rawTarget;
  return { mode, target };
}
