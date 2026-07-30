import { state, loadAllData, registerLoader, initSSE } from './state.js';
import { setupAdminDashboard } from './admin.js';

document.addEventListener('DOMContentLoaded', async () => {
  const user = await window.aeonBoot();
  if (!user || !['admin', 'manager', 'yönetici'].includes(String(user.role || '').toLowerCase())) return;
  state.activePanel = 'panel-admin';
  setupAdminDashboard();
  loadAllData();
  initSSE(state.currentTenant);
});
