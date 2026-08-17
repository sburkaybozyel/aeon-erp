import { createNotify } from './stay/helpers.js';
import { registerStayEvents } from './stay/events.js';
import { registerRoomRoutes } from './stay/rooms.js';
import { registerMaintenanceRoutes } from './stay/maintenance.js';
import { registerHousekeepingRoutes } from './stay/housekeeping.js';

export function initStay({ app, eventBus, hookRegistry, getDb, broadcastSSE }) {
  const notify = createNotify(eventBus);

  registerStayEvents({ eventBus, hookRegistry, getDb });
  registerRoomRoutes({ app, broadcastSSE });
  registerMaintenanceRoutes({ app, broadcastSSE, notify });
  registerHousekeepingRoutes({ app, broadcastSSE, notify });
}
