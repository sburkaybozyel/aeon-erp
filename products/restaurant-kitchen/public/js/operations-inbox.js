const TYPE_LABELS = {
  order: 'Sipariş',
  waiter_call: 'Garson çağrısı',
  bill_call: 'Hesap talebi',
  towel: 'Havlu talebi',
  towel_request: 'Havlu talebi',
  cleaning: 'Temizlik talebi',
  cleaning_request: 'Temizlik talebi',
  linen: 'Çarşaf talebi',
  linen_request: 'Çarşaf talebi',
  amenity: 'Oda malzemesi talebi',
  amenity_request: 'Oda malzemesi talebi',
  water: 'Su talebi',
  water_request: 'Su talebi',
  maintenance: 'Teknik servis talebi',
  maintenance_request: 'Teknik servis talebi',
  room_service_call: 'Oda servisi çağrısı',
  transport_request: 'Transfer talebi'
};

const STATUS_LABELS = {
  pending: 'Bekliyor',
  accepted: 'Kabul edildi',
  in_progress: 'İşlemde',
  preparing: 'Hazırlanıyor',
  ready: 'Hazır',
  served: 'Servis edildi',
  blocked: 'Bekletildi'
};

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

function detailText(details) {
  if (!details) return 'Açıklama yok';
  try {
    const parsed = typeof details === 'string' ? JSON.parse(details) : details;
    if (Array.isArray(parsed)) {
      const lines = parsed.map(item => `${item.quantity || 1}× ${item.name || item.product_name || 'Ürün'}`).join(', ');
      const note = parsed.find(item => item?.service_note)?.service_note;
      return [lines, note ? `Not: ${note}` : ''].filter(Boolean).join(' · ') || 'Açıklama yok';
    }
    if (parsed && typeof parsed === 'object') return Object.entries(parsed).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`).join(' · ');
  } catch (error) {}
  return String(details);
}

function requestNote(details) {
  try {
    const parsed = typeof details === 'string' ? JSON.parse(details) : details;
    if (Array.isArray(parsed)) return String(parsed.find(item => item?.service_note)?.service_note || '');
  } catch (error) {}
  return String(details || '');
}

function nextAction(request) {
  const status = String(request.status || 'pending');
  if (status === 'pending') return { status: 'accepted', label: 'Siparişi Al' };
  if (status === 'accepted') return { status: 'preparing', label: 'Hazırla' };
  if (status === 'preparing') return { status: 'ready', label: 'Hazır' };
  if (status === 'ready') return { status: 'served', label: request.target_identifier?.startsWith('Room-') ? 'Odaya Teslim' : 'Masaya Servis' };
  if (status === 'in_progress') return { status: 'completed', label: 'Tamamla' };
  return null;
}

function formatTime(value) {
  if (!value) return '';
  const date = new Date(value.includes?.('T') ? value : `${value.replace(' ', 'T')}Z`);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }).format(date);
}

export function mountOperationsInbox({ tenantId }) {
  if (window.__aeonOperationsInboxMounted) return;
  window.__aeonOperationsInboxMounted = true;
  const state = { requests: [], open: false, loading: false };
  const style = document.createElement('style');
  style.textContent = '.aeon-operations-inbox-launcher{position:fixed;left:16px;bottom:16px;z-index:10020;display:flex;align-items:center;gap:8px;border:0;border-radius:999px;padding:12px 15px;background:#123b57;color:#fff;font:700 14px system-ui;box-shadow:0 10px 28px rgba(11,42,63,.3)}.aeon-operations-inbox-count{display:none;min-width:20px;padding:2px 6px;border-radius:999px;background:#e44b4b;color:#fff;text-align:center;font-size:12px}.aeon-operations-inbox-count.visible{display:inline-block}.aeon-operations-inbox{position:fixed;inset:0;z-index:10030;display:grid;align-items:end;background:rgba(7,26,39,.44);font:14px system-ui;color:#18324b}.aeon-operations-inbox[hidden]{display:none}.aeon-operations-inbox-card{width:min(760px,100%);max-height:min(86vh,900px);margin:0 auto;padding:20px;overflow:auto;border-radius:22px 22px 0 0;background:#f7fbfe;box-shadow:0 -18px 48px rgba(7,26,39,.25)}.aeon-operations-inbox-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:14px}.aeon-operations-inbox-head h2{margin:0;font-size:21px}.aeon-operations-inbox-head p{margin:5px 0 0;color:#637b8d;line-height:1.4}.aeon-operations-inbox-close{border:0;border-radius:9px;padding:8px 11px;background:#e4eef4;color:#18324b;font:700 14px system-ui}.aeon-operations-inbox-list{display:grid;gap:10px}.aeon-operations-inbox-item{padding:14px;border:1px solid #d7e5ed;border-left:5px solid #078fd0;border-radius:13px;background:#fff}.aeon-operations-inbox-row{display:flex;align-items:center;justify-content:space-between;gap:10px}.aeon-operations-inbox-item h3{margin:0;font-size:15px}.aeon-operations-inbox-target{margin:5px 0;color:#078fd0;font-weight:700}.aeon-operations-inbox-detail{margin:0;color:#526d80;line-height:1.4;word-break:break-word}.aeon-operations-inbox-meta{margin:9px 0 0;color:#8296a5;font-size:12px}.aeon-operations-inbox-status{flex:0 0 auto;border-radius:999px;padding:4px 8px;background:#eaf5fb;color:#08618e;font-size:12px;font-weight:700}.aeon-operations-inbox-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:13px}.aeon-operations-inbox-actions button{border:0;border-radius:8px;padding:8px 10px;font:700 12px system-ui}.aeon-operations-inbox-progress{background:#078fd0;color:#fff}.aeon-operations-inbox-edit{background:#e4eef4;color:#18324b}.aeon-operations-inbox-cancel{background:#fff0f0;color:#b32d2d}.aeon-operations-inbox-empty{padding:26px 16px;border:1px dashed #c5d7e2;border-radius:13px;background:#fff;color:#627b8d;text-align:center}@media(min-width:621px){.aeon-operations-inbox-card{margin-bottom:18px;border-radius:22px}.aeon-operations-inbox-launcher{bottom:16px}}';
  document.head.appendChild(style);
  const launcher = document.createElement('button');
  launcher.type = 'button';
  launcher.className = 'aeon-operations-inbox-launcher';
  launcher.innerHTML = 'Gelen Siparişler <span class="aeon-operations-inbox-count"></span>';
  const panel = document.createElement('section');
  panel.className = 'aeon-operations-inbox';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.innerHTML = '<div class="aeon-operations-inbox-card"><div class="aeon-operations-inbox-head"><div><h2>Gelen Sipariş Akışı</h2><p>Size yönlendirilen açık sipariş ve talepleri bu ekrandan yönetin.</p></div><button type="button" class="aeon-operations-inbox-close">Kapat</button></div><div class="aeon-operations-inbox-list"></div></div>';
  const count = launcher.querySelector('.aeon-operations-inbox-count');
  const list = panel.querySelector('.aeon-operations-inbox-list');
  const render = () => {
    count.textContent = String(state.requests.length);
    count.classList.toggle('visible', state.requests.length > 0);
    if (!state.requests.length) {
      list.innerHTML = '<div class="aeon-operations-inbox-empty">Şu anda size yönlendirilmiş açık talep yok.</div>';
      return;
    }
    list.innerHTML = state.requests.map(request => {
      const progress = nextAction(request);
      const progressButton = progress ? `<button type="button" class="aeon-operations-inbox-progress" data-inbox-status="${escapeHtml(progress.status)}" data-inbox-id="${escapeHtml(request.id)}">${escapeHtml(progress.label)}</button>` : '';
      return `<article class="aeon-operations-inbox-item"><div class="aeon-operations-inbox-row"><h3>${escapeHtml(TYPE_LABELS[request.type] || request.type || 'Talep')}</h3><span class="aeon-operations-inbox-status">${escapeHtml(STATUS_LABELS[request.status] || request.status || 'Bekliyor')}</span></div><p class="aeon-operations-inbox-target">${escapeHtml(request.target_identifier || 'Hedef belirtilmedi')}</p><p class="aeon-operations-inbox-detail">${escapeHtml(detailText(request.details))}</p><p class="aeon-operations-inbox-meta">${escapeHtml(formatTime(request.created_at))}</p><div class="aeon-operations-inbox-actions">${progressButton}<button type="button" class="aeon-operations-inbox-edit" data-inbox-edit="${escapeHtml(request.id)}">Düzenle</button><button type="button" class="aeon-operations-inbox-cancel" data-inbox-cancel="${escapeHtml(request.id)}">İptal</button></div></article>`;
    }).join('');
  };
  const load = async () => {
    if (state.loading) return;
    state.loading = true;
    try {
      const response = await window.fetch(`/api/requests?tenant_id=${encodeURIComponent(tenantId)}&scope=active`, { cache: 'no-store' });
      if (!response.ok) return;
      const payload = await response.json();
      state.requests = Array.isArray(payload) ? payload : [];
      render();
    } finally {
      state.loading = false;
    }
  };
  const setOpen = open => {
    state.open = open;
    panel.hidden = !open;
    if (open) load();
  };
  const updateStatus = async (requestId, status) => {
    const response = await window.fetch('/api/requests/status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId, status }) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Durum güncellenemedi.');
    await load();
  };
  launcher.addEventListener('click', () => setOpen(true));
  panel.querySelector('.aeon-operations-inbox-close').addEventListener('click', () => setOpen(false));
  list.addEventListener('click', async event => {
    const statusButton = event.target.closest('[data-inbox-status]');
    const editButton = event.target.closest('[data-inbox-edit]');
    const cancelButton = event.target.closest('[data-inbox-cancel]');
    try {
      if (statusButton) await updateStatus(statusButton.dataset.inboxId, statusButton.dataset.inboxStatus);
      if (editButton) {
        const request = state.requests.find(item => item.id === editButton.dataset.inboxEdit);
        const note = window.prompt('Sipariş veya talep notunu düzenleyin.', requestNote(request?.details));
        if (note === null) return;
        const response = await window.fetch(`/api/requests/${encodeURIComponent(editButton.dataset.inboxEdit)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note }) });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || 'Kayıt düzenlenemedi.');
        await load();
      }
      if (cancelButton && window.confirm('Bu sipariş veya talep iptal edilsin mi?')) await updateStatus(cancelButton.dataset.inboxCancel, 'cancelled');
    } catch (error) {
      window.alert(error.message);
    }
  });
  panel.addEventListener('click', event => { if (event.target === panel) setOpen(false); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && state.open) setOpen(false); });
  document.body.append(launcher, panel);
  window.addEventListener('focus', load);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
  try {
    const events = new EventSource(`/api/events?tenant_id=${encodeURIComponent(tenantId)}`);
    ['request_created', 'request_updated', 'request_deleted'].forEach(eventName => events.addEventListener(eventName, load));
  } catch (error) {}
  load();
  if (new URLSearchParams(window.location.search).get('inbox') === 'orders') setOpen(true);
}
