// Thin entrypoint: wires together the split admin dashboard modules under ./admin/.

// folio.js has module-top-level side effects (registers window.openRoomFolio etc.
// for the room-folio-modal's inline onclick handlers) that must run once on load.
import './admin/folio.js';

export { setupDesktopAdminDashboard, loadDesktopAdminDashboardData } from './admin/desktop-dashboard.js';
export { setupAdminDashboard, loadAdminDashboardData } from './admin/dispatch.js';
