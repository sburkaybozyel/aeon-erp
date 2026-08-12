import { getCrmDbForRequest } from '../crm/runtime-db.js';
import { initCrm } from '../crm/modules/crm.js';
import { initIntegration } from '../crm/modules/integration.js';
import { initAfterSales } from '../crm/modules/after_sales.js';
import { initReports } from '../crm/modules/reports.js';
import { isManagementRole } from '../server-middleware.js';

export function initCrmModule({ app, broadcastSSE }) {
  app.use('/api/crm', async (req, res, next) => {
    try {
      req.crmUser = req.actor;
      req.crmDb = await getCrmDbForRequest(req);
      next();
    } catch (error) {
      next(error);
    }
  });
  const getCrmDb = req => req.crmDb || getCrmDbForRequest(req);
  const publish = (eventName, data) => broadcastSSE('aeon', eventName, data);
  const isManagement = user => isManagementRole(user);
  const requireManagement = (req, res, next) => isManagementRole(req.actor)
    ? next()
    : res.status(403).json({ error: 'Bu işlem yönetici yetkisi gerektirir.' });
  const context = { app, getCrmDb, broadcastSSE: publish, isManagement, requireManagement };
  initCrm(context);
  initIntegration(context);
  initAfterSales(context);
  initReports(context);
}
