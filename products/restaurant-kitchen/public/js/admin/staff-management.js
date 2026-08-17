import { state, logEvent } from '../state.js';
import { esc } from './utils.js';

export async function loadStaffManagementData() {
  try {
    const res = await fetch(`/api/staff?tenant_id=${state.currentTenant}`);
    if (res.ok) {
      const staff = await res.json();
      renderStaffManagement(staff);
    }

    const auditRes = await fetch(`/api/audit-logs?tenant_id=${state.currentTenant}`);
    if (auditRes.ok) {
      const logs = await auditRes.json();
      renderAuditLogs(logs);
    }
  } catch (err) {
    console.error(err);
  }
}

const hotelProfileFields = ['hotel_name', 'legal_name', 'tax_number', 'tax_office', 'mersis_number', 'address', 'phone', 'email', 'invoice_prefix', 'kbs_property_code'];

export async function loadHotelProfile() {
  try {
    const res = await fetch(`/api/tenant/config?tenant_id=${state.currentTenant}`);
    if (!res.ok) return;
    const config = await res.json();
    const profile = config.hotel_profile || {};
    hotelProfileFields.forEach(key => {
      const input = document.getElementById(`hotel-profile-${key.replaceAll('_', '-')}`);
      if (input) input.value = profile[key] || '';
    });
  } catch (err) {
    console.error(err);
  }
}

export function setupHotelProfileForm() {
  const form = document.getElementById('form-hotel-profile');
  if (!form) return;
  const status = document.getElementById('hotel-profile-status');
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const hotel_profile = Object.fromEntries(hotelProfileFields.map(key => {
      const input = document.getElementById(`hotel-profile-${key.replaceAll('_', '-')}`);
      return [key, input?.value.trim() || ''];
    }));
    const res = await fetch(`/api/tenant/config?tenant_id=${state.currentTenant}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hotel_profile })
    });
    if (res.ok) {
      if (status) status.textContent = 'Otel bilgileri kaydedildi.';
      loadHotelProfile();
      loadStaffManagementData();
    } else {
      const error = await res.json().catch(() => ({}));
      if (status) status.textContent = error.error || 'Otel bilgileri kaydedilemedi.';
    }
  });
  loadHotelProfile();
}

function renderAuditLogs(logs) {
  const tbody = document.getElementById('audit-logs-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (logs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-muted text-center text-xs">İşlem kaydı bulunmuyor.</td></tr>';
    return;
  }

  logs.forEach(log => {
    const tr = document.createElement('tr');
    const dateStr = new Date(log.created_at).toLocaleString('tr-TR');
    tr.innerHTML = `
      <td><span class="text-muted text-xs">${esc(dateStr)}</span></td>
      <td><strong>${esc(log.staff_name)}</strong></td>
      <td><span class="badge ${esc(getLogActionBadgeClass(log.action))}" style="font-size:10px; padding:2px 6px;">${esc(log.action)}</span></td>
      <td><span class="text-xs">${esc(log.details)}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

function getLogActionBadgeClass(action) {
  if (action.includes('Giriş') || action.includes('Oluşturuldu') || action.includes('Eklendi')) return 'clean_vacant';
  if (action.includes('Çıkış') || action.includes('Silindi') || action.includes('Zayiat')) return 'dirty_vacant';
  return 'maintenance';
}

function renderStaffManagement(staff) {
  const tbody = document.getElementById('staff-management-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (staff.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-muted text-center text-xs">Personel kaydı bulunmuyor.</td></tr>';
    return;
  }

  staff.forEach(person => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${person.name}</strong></td>
      <td>${person.department || person.role}</td>
      <td><strong>${person.has_pin ? '••••' : 'PIN tanımlı değil — değiştir'}</strong></td>
      <td>
        <button class="btn btn-secondary btn-xs" onclick="resetStaffPin('${person.id}')"><i class="fa-solid fa-key"></i> PIN Değiştir</button>
        <button class="btn btn-danger btn-xs" onclick="deleteStaffLive('${person.id}')"><i class="fa-solid fa-trash-can"></i> Sil</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  const count = document.getElementById('admin-settings-staff-count');
  const list = document.getElementById('admin-settings-staff-list');
  if (count) count.textContent = `${staff.length} aktif personel kaydı`;
  if (list) list.innerHTML = staff.slice(0, 5).map(person => `<span><i class="fa-solid fa-user"></i>${esc(person.name)} · ${esc(person.department || person.role)}</span>`).join('') || '<span>Personel kaydı yok.</span>';
}

export function setupStaffManagementForm() {
  const form = document.getElementById('form-add-staff');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('add-staff-name').value.trim();
    const role = document.getElementById('add-staff-role').value;
    const pin = document.getElementById('add-staff-pin').value.trim();

    const res = await fetch(`/api/staff?tenant_id=${state.currentTenant}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, role, pin })
    });

    if (res.ok) {
      form.reset();
      logEvent('system', `Personel eklendi: <strong>${name}</strong>`);
      loadStaffManagementData();
    } else {
      const errData = await res.json();
      alert(errData.error || 'Personel eklenemedi.');
    }
  });
}

window.deleteStaffLive = async (id) => {
  if (!confirm("Bu personel kaydını silmek istediğinize emin misiniz?")) return;
  const res = await fetch(`/api/staff/${id}?tenant_id=${state.currentTenant}`, { method: 'DELETE' });
  if (res.ok) {
    logEvent('system', 'Personel silindi.');
    loadStaffManagementData();
  }
};

window.resetStaffPin = async (id) => {
  const pin = prompt('Yeni PIN girin (4-8 rakam):');
  if (pin === null) return;
  const res = await fetch(`/api/staff/${id}/pin?tenant_id=${state.currentTenant}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: pin.trim() })
  });
  const result = await res.json().catch(() => ({}));
  if (!res.ok) {
    alert(result.error || 'PIN güncellenemedi.');
    return;
  }
  await loadStaffManagementData();
};
