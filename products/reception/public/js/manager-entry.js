import { state, loadAllData, registerLoader, initSSE } from './state.js';
import { setupAdminDashboard } from './admin.js';

document.addEventListener('DOMContentLoaded', () => {
  // Enforce correct role-based panel view
  state.activePanel = 'panel-admin';

  // Setup Dashboard
  setupAdminDashboard();
  setupTenantAndFlags();

  // Initial load
  loadAllData();
  initSSE(state.currentTenant);
  setInterval(loadAllData, 15000);
});

function setupTenantAndFlags() {
  const tenantSelect = document.getElementById('tenant-select');
  const btnCreateTenant = document.getElementById('btn-create-tenant');
  const btnSaveFlags = document.getElementById('btn-save-flags');
  const flagDining = document.getElementById('flag-dining');
  const flagStay = document.getElementById('flag-stay');
  const flagPrinter = document.getElementById('flag-printer');

  if (tenantSelect) {
    tenantSelect.value = state.currentTenant || 'reception';
    tenantSelect.addEventListener('change', () => {
      state.currentTenant = tenantSelect.value;
      const label = document.getElementById('current-tenant-label');
      if (label) label.textContent = tenantSelect.options[tenantSelect.selectedIndex].text;
      loadAllData();
    });
  }

  if (btnCreateTenant && tenantSelect) {
    btnCreateTenant.addEventListener('click', () => {
      const name = prompt("Yeni işletme (Tenant ID) girin (küçük harfler ve alt çizgi):");
      if (name) {
        const formatted = name.toLowerCase().replace(/[^a-z0-9_]/g, '');
        if (formatted) {
          const exists = Array.from(tenantSelect.options).some(opt => opt.value === formatted);
          if (!exists) {
            const opt = document.createElement('option');
            opt.value = formatted;
            opt.textContent = name;
            tenantSelect.appendChild(opt);
            tenantSelect.value = formatted;
            state.currentTenant = formatted;
            const label = document.getElementById('current-tenant-label');
            if (label) label.textContent = name;
            loadAllData();
          }
        }
      }
    });
  }

  if (btnSaveFlags) {
    btnSaveFlags.addEventListener('click', async () => {
      const flags = {
        MODULE_DINING: flagDining ? flagDining.checked : true,
        MODULE_STAY: flagStay ? flagStay.checked : true,
        MODULE_PRINTER: flagPrinter ? flagPrinter.checked : false
      };
      try {
        const res = await fetch(`/api/tenant/config?tenant_id=${state.currentTenant}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(flags)
        });
        if (res.ok) {
          alert("Modül yapılandırması kaydedildi.");
        }
      } catch (err) {
        console.error(err);
      }
    });
  }
}
