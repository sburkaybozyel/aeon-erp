import { requireReception } from './reception/helpers.js';
import { registerGuestPortalRoutes } from './reception/guest-portal.js';
import { registerPrecheckinAdminRoutes } from './reception/precheckin-admin.js';
import { registerDashboardRoutes } from './reception/dashboard.js';
import { registerReservationRoutes } from './reception/reservations.js';
import { registerStayRoutes } from './reception/stays.js';
import { registerFolioRoutes } from './reception/folios.js';
import { registerOperationsRoutes } from './reception/operations.js';
import { registerGuestRequestRoutes } from './reception/guest-requests.js';
import { registerCrmSync } from './reception/crm-sync.js';

export function initReception({ app, eventBus, getDb }) {
  // Public guest-facing precheckin endpoints must be registered before the
  // `/api/reception` auth gate below.
  registerGuestPortalRoutes({ app, eventBus });
  registerGuestRequestRoutes({ app, eventBus });

  app.use('/api/reception', requireReception);

  registerPrecheckinAdminRoutes({ app, eventBus });
  registerDashboardRoutes({ app });
  registerReservationRoutes({ app, eventBus });
  registerStayRoutes({ app, eventBus });
  registerFolioRoutes({ app, eventBus });
  registerOperationsRoutes({ app });
  registerCrmSync({ eventBus, getDb });
}
