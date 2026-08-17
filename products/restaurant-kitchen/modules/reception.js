import { requireReception } from './reception/helpers.js';
import { registerGuestPortalRoutes } from './reception/guest-portal.js';
import { registerPrecheckinAdminRoutes } from './reception/precheckin-admin.js';
import { registerDashboardRoutes } from './reception/dashboard.js';
import { registerReservationRoutes } from './reception/reservations.js';
import { registerStayRoutes } from './reception/stays.js';
import { registerFolioRoutes } from './reception/folios.js';
import { registerOperationsRoutes } from './reception/operations.js';

export function initReception({ app, eventBus }) {
  // Public guest-facing precheckin endpoints must be registered before the
  // `/api/reception` auth gate below.
  registerGuestPortalRoutes({ app, eventBus });

  app.use('/api/reception', requireReception);

  registerPrecheckinAdminRoutes({ app });
  registerDashboardRoutes({ app });
  registerReservationRoutes({ app });
  registerStayRoutes({ app, eventBus });
  registerFolioRoutes({ app });
  registerOperationsRoutes({ app });
}
