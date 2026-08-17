import { initMenu } from './dining/menu.js';
import { initTables } from './dining/tables.js';
import { initInventory } from './dining/inventory.js';
import { initRequests } from './dining/requests.js';
import { initProduction } from './dining/production.js';

export function initDining({ app, eventBus, hookRegistry, getDb, broadcastSSE }) {
  initTables({ app, broadcastSSE });
  initMenu({ app });
  initInventory({ app });
  initRequests({ app, eventBus, broadcastSSE });
  initProduction({ app, eventBus, getDb, broadcastSSE });
}
