import { activeTarget, targetIsRoom } from './portal-state.js';

export async function loadFolioData() {
  if (!targetIsRoom()) return;
  const roomNumber = activeTarget.replace('Room-', '').trim();

  try {
    // Resolve the room via the public room-context lookup (works for anonymous guests) instead
    // of /api/rooms, which requires a staff session and previously 401'd here, leaving the bill
    // panel permanently empty with no visible error.
    const folioRes = await fetch(`/api/guest/folio?target=${encodeURIComponent(roomNumber)}`);
    if (!folioRes.ok) { renderFolio(null, 'Hesap bilgisi alınamadı.'); return; }
    const data = await folioRes.json();
    renderFolio(data);
  } catch (err) {
    console.error(err);
    renderFolio(null, 'Hesap bilgisi yüklenirken bağlantı hatası oluştu.');
  }
}

function renderFolio(data, errorMessage) {
  const container = document.getElementById('guest-folio-charges-list');
  const totalEl = document.getElementById('guest-folio-total');
  if (!container || !totalEl) return;

  if (!data) {
    container.innerHTML = `<div class="text-muted text-xs padding-sm">${errorMessage || 'Hesap bilgisi şu anda gösterilemiyor.'}</div>`;
    totalEl.textContent = '—';
    return;
  }

  container.innerHTML = '';

  let total = 0;
  const charges = data.charges || [];

  if (charges.length === 0) {
    container.innerHTML = `<div class="text-muted text-xs padding-sm">Şu ana kadar yansıtılmış harcama bulunmuyor.</div>`;
    // Reception-posted charges/payments can still exist even with zero order/service requests;
    // prefer the real folio ledger balance when available instead of hardcoding 0.
    totalEl.textContent = `${Number(data.stay_folio?.balance ?? 0).toFixed(2)} TL`;
    return;
  }

  charges.forEach(charge => {
    let detailsLabel = charge.details;
    if (charge.type === 'order') {
      try {
        const items = JSON.parse(charge.details);
        if (Array.isArray(items)) {
          detailsLabel = items.map(i => `${i.name} x ${i.quantity}`).join(', ');
        }
      } catch(e) {}
    }

    const row = document.createElement('div');
    row.className = 'flex-between text-xs';
    row.style.borderBottom = '1px solid var(--border-glass)';
    row.style.padding = '8px 0';
    row.innerHTML = `
      <div style="max-width: 70%;">
        <div style="font-weight:700;">${charge.type === 'room_service_charge' ? 'Oda Servisi' : 'Sipariş'}</div>
        <div class="text-muted" style="font-size:9px;">${detailsLabel}</div>
      </div>
      <div class="bold text-success">${charge.total_amount} TL</div>
    `;
    container.appendChild(row);
    total += charge.total_amount;
  });

  // stay_folio.balance is the authoritative ledger total (includes reception-posted charges and
  // already-collected payments); fall back to the summed request rows only when there's no
  // active stay folio to read from.
  const displayTotal = data.stay_folio ? data.stay_folio.balance : total;
  totalEl.textContent = `${Number(displayTotal).toFixed(2)} TL`;
}
