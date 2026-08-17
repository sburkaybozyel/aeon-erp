const apiBase = '/api/integrations/hotelrunner';
const app = { view: 'overview', status: {}, reservations: [], mappings: { rooms: [], rates: [] }, failures: [], channels: [], busy: false };
const content = document.getElementById('channel-content');
const banner = document.getElementById('channel-banner');
const health = document.getElementById('channel-health');
const title = document.getElementById('channel-title');
const modal = document.getElementById('channel-modal');
const viewNames = { overview: 'HotelRunner Genel Durum', reservations: 'Rezervasyon Gelen Kutusu', mappings: 'Oda ve Fiyat Eşlemeleri', failures: 'Senkronizasyon Hataları', channels: 'Bağlı Satış Kanalları' };

const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
const toArray = (value, keys = []) => { if (Array.isArray(value)) return value; for (const key of keys) if (Array.isArray(value?.[key])) return value[key]; return []; };
const dateTime = value => value ? new Intl.DateTimeFormat('tr-TR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Istanbul' }).format(new Date(value)) : 'Henüz yok';
const date = value => value ? new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Istanbul' }).format(new Date(`${String(value).slice(0, 10)}T12:00:00Z`)) : '-';
const money = (value, currency = 'TRY') => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: currency || 'TRY', maximumFractionDigits: 2 }).format(Number(value || 0));
const statusValue = value => String(value || '').toLowerCase();
const badge = value => { const normalized = statusValue(value); const tone = ['connected', 'healthy', 'success', 'synced', 'imported', 'confirmed', 'active', 'acknowledged'].includes(normalized) ? 'success' : ['failed', 'error', 'rejected', 'cancelled', 'disconnected'].includes(normalized) ? 'danger' : ['pending', 'queued', 'processing', 'warning', 'unmapped'].includes(normalized) ? 'warning' : ['modified', 'new', 'received'].includes(normalized) ? 'info' : ''; return `<span class="channel-badge ${tone}">${escapeHtml(value || '-')}</span>`; };
const empty = (icon, text) => `<div class="channel-empty"><i class="fa-solid ${icon}"></i><strong>${escapeHtml(text)}</strong></div>`;
const table = (headers, rows) => `<div class="table-responsive"><table class="table"><thead><tr>${headers.map(header => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;

async function api(path = '', options = {}) {
  const request = { ...options, headers: { ...(options.headers || {}) } };
  if (request.body && !request.headers['Content-Type']) request.headers['Content-Type'] = 'application/json';
  const response = await fetch(`${apiBase}${path}`, request);
  if (response.status === 204) return null;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || body.error || `HotelRunner servisi ${response.status} hatası verdi.`);
  return body;
}

function showBanner(message, type = '') {
  banner.textContent = message;
  banner.className = `channel-banner ${type}`.trim();
  banner.hidden = false;
  window.clearTimeout(showBanner.timer);
  showBanner.timer = window.setTimeout(() => { banner.hidden = true; }, 7000);
}

function setHealth() {
  const connected = app.status.connected === true || ['connected', 'healthy'].includes(statusValue(app.status.status || app.status.connection_status));
  const configured = app.status.configured !== false;
  health.className = `channel-health ${connected ? 'connected' : configured ? 'warning' : ''}`;
  health.innerHTML = `<span class="channel-health-dot"></span><span>${connected ? 'HotelRunner bağlı' : configured ? 'Bağlantı uyarısı' : 'Kurulum bekliyor'}</span>`;
}

function normalizePayloads(payloads) {
  const statusPayload = payloads.status.status === 'fulfilled' ? payloads.status.value : {};
  const reservationPayload = payloads.reservations.status === 'fulfilled' ? payloads.reservations.value : [];
  const mappingPayload = payloads.mappings.status === 'fulfilled' ? payloads.mappings.value : {};
  const failurePayload = payloads.failures.status === 'fulfilled' ? payloads.failures.value : [];
  const channelPayload = payloads.channels.status === 'fulfilled' ? payloads.channels.value : [];
  app.status = statusPayload || {};
  app.reservations = toArray(reservationPayload, ['reservations', 'items', 'data']);
  const allMappings = toArray(mappingPayload, ['mappings', 'items', 'data']);
  app.mappings = {
    rooms: toArray(mappingPayload, ['rooms', 'room_mappings']).length ? toArray(mappingPayload, ['rooms', 'room_mappings']) : allMappings.filter(item => statusValue(item.type || item.mapping_type) === 'room'),
    rates: toArray(mappingPayload, ['rates', 'rate_mappings']).length ? toArray(mappingPayload, ['rates', 'rate_mappings']) : allMappings.filter(item => ['rate', 'rate_plan'].includes(statusValue(item.type || item.mapping_type)))
  };
  app.failures = toArray(failurePayload, ['failures', 'items', 'data']);
  app.channels = toArray(channelPayload, ['channels', 'items', 'data']);
  setHealth();
}

async function loadAll(silent = false) {
  if (!silent) content.innerHTML = empty('fa-spinner fa-spin', 'HotelRunner verileri yükleniyor');
  const [status, reservations, mappings, failures, channels] = await Promise.allSettled([
    api('/status'),
    api('/reservations?limit=100'),
    api('/mappings'),
    api('/failures?status=open&limit=100'),
    api('/channels')
  ]);
  const payloads = { status, reservations, mappings, failures, channels };
  normalizePayloads(payloads);
  const failed = Object.entries(payloads).filter(([, result]) => result.status === 'rejected');
  if (failed.length) showBanner(`${failed.length} HotelRunner veri grubu yüklenemedi. Ayrıntı için senkron hatalarını kontrol edin.`, 'error');
  renderCurrentView();
}

function statusMetric(name, fallback = 0) {
  return app.status.counts?.[name] ?? app.status.metrics?.[name] ?? app.status[name] ?? fallback;
}

function renderOverview() {
  const unmapped = [...app.mappings.rooms, ...app.mappings.rates].filter(item => !item.external_id && !item.hotelrunner_id && !item.external_code).length;
  const pending = app.reservations.filter(item => ['new', 'received', 'pending', 'queued'].includes(statusValue(item.sync_status || item.status))).length;
  const openFailures = app.failures.filter(item => !['resolved', 'ignored', 'completed'].includes(statusValue(item.status))).length;
  const connectedChannels = app.channels.filter(item => item.connected !== false && !['disconnected', 'inactive'].includes(statusValue(item.status))).length;
  content.innerHTML = `<div class="grid-4">
    <article class="card kpi-card channel-kpi" style="--kpi-color:var(--color-primary)"><div class="kpi-icon"><i class="fa-solid fa-inbox"></i><span>GELEN</span></div><strong>${pending}</strong><div class="text-muted small">İşlem bekleyen rezervasyon</div></article>
    <article class="card kpi-card channel-kpi" style="--kpi-color:var(--color-success)"><div class="kpi-icon"><i class="fa-solid fa-building-circle-check"></i><span>AKTİF</span></div><strong>${connectedChannels}</strong><div class="text-muted small">Bağlı satış kanalı</div></article>
    <article class="card kpi-card channel-kpi" style="--kpi-color:var(--color-warning)"><div class="kpi-icon"><i class="fa-solid fa-code-compare"></i><span>EŞLEME</span></div><strong>${unmapped}</strong><div class="text-muted small">Eksik oda veya fiyat eşlemesi</div></article>
    <article class="card kpi-card channel-kpi" style="--kpi-color:var(--color-danger)"><div class="kpi-icon"><i class="fa-solid fa-triangle-exclamation"></i><span>HATA</span></div><strong>${openFailures}</strong><div class="text-muted small">Açık senkronizasyon hatası</div></article>
  </div>
  <div class="grid-2 margin-top-md">
    <article class="card"><div class="channel-section-head"><div><h3>Bağlantı Sağlığı</h3><p>HotelRunner üretim bağlantısının son durumu</p></div>${badge(app.status.connection_status || app.status.status || (app.status.connected ? 'connected' : 'not_configured'))}</div><div class="channel-list">
      <div class="channel-list-item"><div><strong>Son başarılı rezervasyon alımı</strong><p>HotelRunner'dan Aeon'e</p></div><strong>${dateTime(app.status.last_reservation_sync_at || app.status.last_pull_at)}</strong></div>
      <div class="channel-list-item"><div><strong>Son başarılı envanter gönderimi</strong><p>Aeon'den HotelRunner'a</p></div><strong>${dateTime(app.status.last_availability_sync_at || app.status.last_push_at)}</strong></div>
      <div class="channel-list-item"><div><strong>Son tam mutabakat</strong><p>Rezervasyon, fiyat ve müsaitlik</p></div><strong>${dateTime(app.status.last_reconciliation_at || app.status.last_sync_at)}</strong></div>
      <div class="channel-list-item"><div><strong>Bekleyen gönderim kuyruğu</strong><p>Yeniden denenecek değişiklikler</p></div><strong>${statusMetric('outbox_pending')}</strong></div>
    </div></article>
    <article class="card"><div class="channel-section-head"><div><h3>Son Rezervasyon Hareketleri</h3><p>HotelRunner üzerinden gelen son kayıtlar</p></div><button class="btn btn-sm btn-secondary" data-open-view="reservations">Tümünü Gör</button></div>${renderReservationRows(app.reservations.slice(0, 6), true)}</article>
  </div>`;
}

function reservationGuest(item) {
  return item.guest_name || [item.first_name, item.last_name].filter(Boolean).join(' ') || item.customer?.name || '-';
}

function renderReservationRows(items, compact = false) {
  if (!items.length) return empty('fa-inbox', 'HotelRunner rezervasyonu bulunmuyor');
  const rows = items.map(item => `<tr>
    <td><div class="channel-source"><span class="channel-source-icon"><i class="fa-solid fa-hotel"></i></span><div><strong>${escapeHtml(item.channel_name || item.source_channel || item.source || 'HotelRunner')}</strong><div class="channel-subtext">${escapeHtml(item.external_id || item.hotelrunner_reservation_id || item.reservation_number || '-')}</div></div></div></td>
    <td><strong>${escapeHtml(reservationGuest(item))}</strong><div class="channel-subtext">${escapeHtml(item.voucher_number || item.confirmation_number || '')}</div></td>
    ${compact ? '' : `<td>${date(item.arrival_date || item.checkin_date)} — ${date(item.departure_date || item.checkout_date)}</td><td>${escapeHtml(item.room_type_name || item.room_name || item.room_type_code || '-')}</td><td>${money(item.total_amount || item.amount, item.currency || 'TRY')}</td>`}
    <td>${badge(item.sync_status || item.import_status || item.status)}</td>
  </tr>`).join('');
  return table(compact ? ['Kaynak', 'Misafir', 'Durum'] : ['Kaynak / Referans', 'Misafir / Voucher', 'Konaklama', 'Oda Tipi', 'Toplam', 'Senkron'], rows);
}

function renderReservations() {
  content.innerHTML = `<article class="card"><div class="channel-section-head"><div><h3>Rezervasyon Gelen Kutusu</h3><p>Yeni, değişen ve iptal edilen HotelRunner kayıtları</p></div><div class="channel-filter"><input id="reservation-filter" type="search" placeholder="Misafir, voucher, referans ara"><select id="reservation-status"><option value="">Tüm durumlar</option><option value="new">Yeni</option><option value="synced">Aktarıldı</option><option value="modified">Değişti</option><option value="cancelled">İptal</option><option value="failed">Hatalı</option></select></div></div><div id="reservation-results">${renderReservationRows(app.reservations)}</div></article>`;
  const applyFilter = () => {
    const query = document.getElementById('reservation-filter').value.trim().toLocaleLowerCase('tr-TR');
    const status = document.getElementById('reservation-status').value;
    const filtered = app.reservations.filter(item => {
      const haystack = [reservationGuest(item), item.voucher_number, item.external_id, item.hotelrunner_reservation_id, item.reservation_number, item.channel_name, item.source_channel].join(' ').toLocaleLowerCase('tr-TR');
      const itemStatus = statusValue(item.sync_status || item.import_status || item.status);
      return (!query || haystack.includes(query)) && (!status || itemStatus === status);
    });
    document.getElementById('reservation-results').innerHTML = renderReservationRows(filtered);
  };
  document.getElementById('reservation-filter').addEventListener('input', applyFilter);
  document.getElementById('reservation-status').addEventListener('change', applyFilter);
}

function mappingRows(items, type) {
  if (!items.length) return empty('fa-code-compare', `${type === 'room' ? 'Oda tipi' : 'Fiyat planı'} eşleme kaydı bulunmuyor`);
  return table(['Aeon Kaydı', 'Aeon Kodu', 'HotelRunner Kaydı', 'HotelRunner Kodu', 'Durum', 'İşlem'], items.map(item => {
    const externalCode = item.external_code || item.hotelrunner_code || item.external_id || '';
    const mapped = Boolean(externalCode);
    return `<tr><td><strong>${escapeHtml(item.local_name || item.name || item.room_type_name || item.rate_name || '-')}</strong></td><td>${escapeHtml(item.local_code || item.room_type_code || item.rate_code || '-')}</td><td>${escapeHtml(item.external_name || item.hotelrunner_name || '-')}</td><td>${escapeHtml(externalCode || '-')}</td><td>${badge(mapped ? 'mapped' : 'unmapped')}</td><td><button class="btn btn-xs btn-secondary" data-mapping-type="${type}" data-mapping-id="${escapeHtml(item.id || item.mapping_id || '')}">Eşle</button></td></tr>`;
  }).join(''));
}

function renderMappings() {
  content.innerHTML = `<article class="card"><div class="channel-section-head"><div><h3>Oda Tipi Eşlemeleri</h3><p>Aeon fiziksel oda tiplerini HotelRunner envanteriyle eşleştirin</p></div>${badge(`${app.mappings.rooms.filter(item => item.external_code || item.hotelrunner_code || item.external_id).length}/${app.mappings.rooms.length} mapped`)}</div>${mappingRows(app.mappings.rooms, 'room')}</article><article class="card"><div class="channel-section-head"><div><h3>Fiyat Planı Eşlemeleri</h3><p>Pansiyon ve fiyat planlarının karşılıklarını belirleyin</p></div>${badge(`${app.mappings.rates.filter(item => item.external_code || item.hotelrunner_code || item.external_id).length}/${app.mappings.rates.length} mapped`)}</div>${mappingRows(app.mappings.rates, 'rate')}</article>`;
}

function renderFailures() {
  const rows = app.failures.map(item => `<tr class="channel-error-row"><td>${dateTime(item.created_at || item.occurred_at)}</td><td>${escapeHtml(item.operation || item.event_type || item.type || '-')}</td><td><strong>${escapeHtml(item.resource_type || '-')}</strong><div class="channel-subtext">${escapeHtml(item.resource_id || item.external_id || '-')}</div></td><td class="channel-error-message"><strong>${escapeHtml(item.error_code || 'SYNC_ERROR')}</strong><div class="channel-subtext">${escapeHtml(item.message || item.error_message || 'Açıklama yok')}</div></td><td>${Number(item.retry_count || 0)}</td><td>${badge(item.status || 'open')}</td><td><button class="btn btn-xs btn-secondary" data-retry="${escapeHtml(item.id || '')}"><i class="fa-solid fa-rotate-right"></i> Tekrar Dene</button></td></tr>`).join('');
  content.innerHTML = `<article class="card"><div class="channel-section-head"><div><h3>Senkronizasyon Hataları</h3><p>Başarısız HotelRunner işlemleri ve güvenli yeniden deneme kuyruğu</p></div><button id="retry-all" class="btn btn-secondary"><i class="fa-solid fa-arrows-rotate"></i> Tüm Uygun Hataları Dene</button></div>${rows ? table(['Zaman', 'İşlem', 'Kayıt', 'Hata', 'Deneme', 'Durum', 'Aksiyon'], rows) : empty('fa-circle-check', 'Açık senkronizasyon hatası yok')}</article>`;
}

function renderChannels() {
  const cards = app.channels.map(item => `<article class="connected-channel"><div class="connected-channel-head"><div class="connected-channel-logo"><i class="fa-solid fa-building"></i><div><strong>${escapeHtml(item.name || item.channel_name || item.code || 'Satış Kanalı')}</strong><div class="channel-subtext">${escapeHtml(item.code || item.channel_code || '')}</div></div></div>${badge(item.status || (item.connected === false ? 'disconnected' : 'active'))}</div><dl><dt>Son rezervasyon</dt><dd>${dateTime(item.last_reservation_at || item.last_booking_at)}</dd><dt>Son güncelleme</dt><dd>${dateTime(item.last_sync_at || item.updated_at)}</dd><dt>Aktif oda tipi</dt><dd>${Number(item.room_type_count || item.rooms || 0)}</dd><dt>Aktif fiyat planı</dt><dd>${Number(item.rate_plan_count || item.rates || 0)}</dd></dl></article>`).join('');
  content.innerHTML = `<article class="card"><div class="channel-section-head"><div><h3>HotelRunner Üzerinden Bağlı Kanallar</h3><p>Bu liste HotelRunner hesabındaki dağıtım bağlantılarından okunur</p></div>${badge(`${app.channels.length} kanal`)}</div>${cards ? `<div class="channel-card-grid">${cards}</div>` : empty('fa-building-circle-xmark', 'Bağlı kanal bilgisi henüz alınamadı')}</article>`;
}

function renderCurrentView() {
  title.textContent = viewNames[app.view];
  document.querySelectorAll('[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === app.view));
  if (app.view === 'overview') renderOverview();
  if (app.view === 'reservations') renderReservations();
  if (app.view === 'mappings') renderMappings();
  if (app.view === 'failures') renderFailures();
  if (app.view === 'channels') renderChannels();
  bindViewActions();
}

function bindViewActions() {
  document.querySelectorAll('[data-open-view]').forEach(button => button.addEventListener('click', () => setView(button.dataset.openView)));
  document.querySelectorAll('[data-mapping-id]').forEach(button => button.addEventListener('click', () => openMapping(button.dataset.mappingType, button.dataset.mappingId)));
  document.querySelectorAll('[data-retry]').forEach(button => button.addEventListener('click', () => retryFailure(button.dataset.retry, button)));
  document.getElementById('retry-all')?.addEventListener('click', retryAllFailures);
}

function setView(view) {
  if (!viewNames[view]) return;
  app.view = view;
  renderCurrentView();
}

function findMapping(type, id) {
  return app.mappings[type === 'room' ? 'rooms' : 'rates'].find(item => String(item.id || item.mapping_id || '') === String(id));
}

function openMapping(type, id) {
  const mapping = findMapping(type, id);
  if (!mapping) return showBanner('Eşleme kaydı bulunamadı.', 'error');
  document.getElementById('channel-modal-title').textContent = type === 'room' ? 'Oda Tipini Eşle' : 'Fiyat Planını Eşle';
  document.getElementById('channel-modal-body').innerHTML = `<form id="mapping-form" class="channel-form"><label>Aeon Kaydı<input value="${escapeHtml(mapping.local_name || mapping.name || mapping.local_code || '')}" disabled></label><label>HotelRunner Kodu<input name="external_code" value="${escapeHtml(mapping.external_code || mapping.hotelrunner_code || mapping.external_id || '')}" required autocomplete="off"></label><label>HotelRunner Adı<input name="external_name" value="${escapeHtml(mapping.external_name || mapping.hotelrunner_name || '')}" autocomplete="off"></label><div class="channel-form-actions"><button type="button" class="btn btn-secondary" data-modal-close>Vazgeç</button><button type="submit" class="btn btn-primary">Eşlemeyi Kaydet</button></div></form>`;
  modal.hidden = false;
  document.querySelector('[data-modal-close]').addEventListener('click', closeModal);
  document.getElementById('mapping-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = { mapping_type: type, local_id: mapping.local_id || mapping.local_code || mapping.id, external_code: form.get('external_code'), external_name: form.get('external_name') };
    try {
      const mappingId = mapping.id || mapping.mapping_id;
      await api(mappingId ? `/mappings/${encodeURIComponent(mappingId)}` : '/mappings', { method: mappingId ? 'PUT' : 'POST', body: JSON.stringify(payload) });
      closeModal();
      showBanner('Eşleme kaydedildi. Bir sonraki senkronizasyonda kullanılacak.', 'success');
      await loadAll(true);
    } catch (error) {
      showBanner(error.message, 'error');
    }
  });
}

function closeModal() {
  modal.hidden = true;
  document.getElementById('channel-modal-body').innerHTML = '';
}

async function retryFailure(id, button) {
  if (!id) return showBanner('Hata kaydı kimliği bulunamadı.', 'error');
  button.disabled = true;
  try {
    await api(`/failures/${encodeURIComponent(id)}/retry`, { method: 'POST', body: JSON.stringify({ mode: 'manual' }) });
    showBanner('Hata yeniden deneme kuyruğuna alındı.', 'success');
    await loadAll(true);
  } catch (error) {
    showBanner(error.message, 'error');
  } finally {
    button.disabled = false;
  }
}

async function retryAllFailures(event) {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    const result = await api('/failures/retry', { method: 'POST', body: JSON.stringify({ status: 'open', mode: 'manual' }) });
    showBanner(`${Number(result?.queued ?? result?.count ?? 0)} hata yeniden deneme kuyruğuna alındı.`, 'success');
    await loadAll(true);
  } catch (error) {
    showBanner(error.message, 'error');
  } finally {
    button.disabled = false;
  }
}

async function runSync(type, button) {
  if (app.busy) return;
  app.busy = true;
  const label = button.innerHTML;
  button.disabled = true;
  button.innerHTML = `<span class="channel-loading"></span><span><strong>Senkronize ediliyor</strong><span>İşlem güvenli biçimde çalışıyor</span></span>`;
  const endpoint = type === 'reconcile' ? '/sync/reconcile' : `/sync/${type}`;
  try {
    const result = await api(endpoint, { method: 'POST', body: JSON.stringify({ mode: 'manual', requested_at: new Date().toISOString() }) });
    const count = result?.processed ?? result?.imported ?? result?.queued ?? result?.updated;
    showBanner(`HotelRunner işlemi tamamlandı${count === undefined ? '' : `: ${count} kayıt işlendi`}.`, 'success');
    await loadAll(true);
  } catch (error) {
    showBanner(error.message, 'error');
  } finally {
    app.busy = false;
    button.disabled = false;
    button.innerHTML = label;
  }
}

async function testConnection() {
  const button = document.getElementById('channel-test');
  button.disabled = true;
  const label = button.innerHTML;
  button.innerHTML = '<span class="channel-loading"></span> Test ediliyor';
  try {
    const result = await api('/connection/test', { method: 'POST', body: JSON.stringify({ mode: 'manual' }) });
    showBanner(result?.message || 'HotelRunner bağlantısı başarıyla doğrulandı.', 'success');
    await loadAll(true);
  } catch (error) {
    showBanner(error.message, 'error');
  } finally {
    button.disabled = false;
    button.innerHTML = label;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const user = await window.aeonBoot();
  if (!user) return;
  const role = statusValue(user.role);
  if (!['admin', 'manager', 'yönetici', 'reception'].includes(role)) {
    window.location.replace(`/login.html?tenant_id=${encodeURIComponent(window.tenantId || 'reception')}`);
    return;
  }
  document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
  document.querySelectorAll('[data-sync]').forEach(button => button.addEventListener('click', () => runSync(button.dataset.sync, button)));
  document.getElementById('channel-refresh').addEventListener('click', () => loadAll());
  document.getElementById('channel-test').addEventListener('click', testConnection);
  document.getElementById('channel-logout').addEventListener('click', () => window.aeonLogout());
  document.getElementById('channel-modal-close').addEventListener('click', closeModal);
  modal.addEventListener('click', event => { if (event.target === modal) closeModal(); });
  await loadAll();
});
