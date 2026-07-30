import { registerOrderRoutes } from './bar/orders.js';
import { registerInventoryRoutes } from './bar/inventory.js';
import { registerMenuRoutes } from './bar/menu.js';

export function initBar({ app, eventBus, broadcastSSE }) {
  registerOrderRoutes({ app, eventBus, broadcastSSE });
  registerInventoryRoutes({ app, broadcastSSE });
  registerMenuRoutes({ app, broadcastSSE });
}
