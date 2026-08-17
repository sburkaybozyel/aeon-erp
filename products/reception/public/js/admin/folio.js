import { state, logEvent } from '../state.js';
import { esc } from './utils.js';
import { loadAdminDashboardData } from './dispatch.js';

// Wires up the previously-dead #room-folio-modal to the real reception folio API
// (modules/reception/folios.js) so a manager can inspect charges, post a manual
// charge, and settle the balance without leaving the dashboard.
let activeFolioId = null;

async function folioApi(path, options = {}) {
  const response = await fetch(`/api/reception${path}?tenant_id=${encodeURIComponent(state.currentTenant)}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'İşlem tamamlanamadı.');
  return body;
}

window.openRoomFolio = async (folioId) => {
  activeFolioId = folioId;
  const modal = document.getElementById('room-folio-modal');
  const guestInfoEl = document.getElementById('folio-guest-info');
  const chargesListEl = document.getElementById('folio-charges-list');
  const totalEl = document.getElementById('folio-total-amount');
  if (!modal) return;
  modal.style.display = 'flex';
  if (guestInfoEl) guestInfoEl.textContent = 'Yükleniyor...';
  if (chargesListEl) chargesListEl.innerHTML = '';

  try {
    const data = await folioApi(`/folios/${encodeURIComponent(folioId)}`);
    const folio = data.folio || {};
    if (guestInfoEl) {
      guestInfoEl.innerHTML = `<strong>Folyo</strong> — ${esc(folio.details || folio.id)}<br><span class="text-muted text-xs">Durum: ${esc(folio.status || '-')}</span>`;
    }
    if (totalEl) totalEl.textContent = `${Number(data.balance || 0).toFixed(2)} TL`;

    const openTransactions = (data.transactions || []).filter(t => t.transaction_type !== 'reversal');
    if (chargesListEl) {
      chargesListEl.innerHTML = openTransactions.length === 0
        ? '<div class="text-muted text-xs" style="padding:10px;">Bu folyoya ait hareket bulunmuyor.</div>'
        : openTransactions.map(t => `
          <div class="flex-between" style="padding:8px 0; border-bottom:1px solid var(--border-glass);">
            <span class="text-sm">${esc(t.description || t.transaction_type)}</span>
            <strong>${Number(t.debit || 0) > 0 ? Number(t.debit).toFixed(2) : `-${Number(t.credit || 0).toFixed(2)}`} TL</strong>
          </div>
        `).join('');
    }
  } catch (error) {
    if (guestInfoEl) guestInfoEl.textContent = error.message || 'Folyo bilgisi alınamadı.';
  }
};

window.submitFolioCharge = async () => {
  if (!activeFolioId) return;
  const descEl = document.getElementById('folio-charge-desc');
  const typeEl = document.getElementById('folio-charge-type');
  const amountEl = document.getElementById('folio-charge-amount');
  const description = descEl?.value.trim();
  const amount = parseFloat(amountEl?.value);

  if (!description || !Number.isFinite(amount) || amount <= 0) {
    alert('Lütfen açıklama ve geçerli bir tutar girin.');
    return;
  }

  try {
    await folioApi(`/folios/${encodeURIComponent(activeFolioId)}/transactions`, {
      method: 'POST',
      body: JSON.stringify({ description, amount, transaction_type: typeEl?.value || 'manual_charge', department: 'Reception' })
    });
    if (descEl) descEl.value = '';
    if (amountEl) amountEl.value = '';
    logEvent('system', `Folyoya harcama işlendi: <strong>${description} (${amount.toFixed(2)} TL)</strong>`);
    window.openRoomFolio(activeFolioId);
  } catch (error) {
    alert(error.message || 'Harcama eklenemedi.');
  }
};

window.printFolio = () => {
  window.print();
};

window.folioCheckout = async () => {
  if (!activeFolioId) return;
  if (!confirm('Bu folyonun tüm bakiyesini nakit olarak tahsil etmek istediğinize emin misiniz?')) return;

  try {
    const data = await folioApi(`/folios/${encodeURIComponent(activeFolioId)}`);
    const balance = Number(data.balance || 0);
    if (balance > 0.009) {
      await folioApi(`/folios/${encodeURIComponent(activeFolioId)}/payments`, {
        method: 'POST',
        body: JSON.stringify({ amount: balance, payment_method: 'cash' })
      });
    }
    document.getElementById('room-folio-modal').style.display = 'none';
    logEvent('system', 'Folyo bakiyesi tahsil edildi.');
    activeFolioId = null;
    loadAdminDashboardData();
  } catch (error) {
    alert(error.message || 'Tahsilat yapılamadı. Check-out işlemi resepsiyon ekranından tamamlanmalıdır.');
  }
};
