// Bağımsız CRM → bağımsız AEON Reception entegrasyon istemcisi.
import crypto from 'crypto';

const RECEPTION_MODULE_URL = (process.env.RECEPTION_MODULE_URL || 'https://aeon-reception.aeon-global.workers.dev/api/module/crm').replace(/\/$/, '');
const RECEPTION_MODULE_TOKEN = process.env.CRM_MODULE_TOKEN || '';
const REQUEST_TIMEOUT = Number(process.env.RECEPTION_TIMEOUT_MS) || 8000;

function uid(prefix = 'log') {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

async function erpFetch(db, { operation, path, method = 'GET', body }) {
  let response = null, statusCode = null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    const requestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(RECEPTION_MODULE_TOKEN ? { 'x-aeon-crm-token': RECEPTION_MODULE_TOKEN } : {})
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    };
    const service = globalThis.__RECEPTION_SERVICE;
    const res = service
      ? await service.fetch(new Request(`https://aeon-reception.internal/api/module/crm${path}`, requestInit))
      : await fetch(`${RECEPTION_MODULE_URL}${path}`, requestInit);
    clearTimeout(timer);
    statusCode = res.status;
    const text = await res.text();
    try { response = JSON.parse(text); } catch (e) { response = { raw: text }; }
    if (res.status >= 400) throw new Error(response.error || `ERP hatası (${res.status})`);
    await logIntegration(db, { operation, payload: body, status: 'success', response: JSON.stringify(response), retry: false });
    return response;
  } catch (err) {
    await logIntegration(db, { operation, payload: body, status: 'error', error_message: err.message, response: statusCode ? String(statusCode) : null, retry: false });
    throw err;
  }
}

async function logIntegration(db, { operation, payload, status, error_message, response, retry, opportunity_id }) {
  try {
    await db.run(
      "INSERT INTO integration_logs (id, operation, payload, status, error_message, response, retry_count, opportunity_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [uid('log'), operation, payload ? JSON.stringify(payload) : null, status, error_message || null, response || null, retry ? 1 : 0, opportunity_id || null]);
  } catch (e) { /* log failure is non-fatal */ }
}

function computeNights(a, b) {
  if (!a || !b) return null;
  const d1 = new Date(a), d2 = new Date(b);
  if (isNaN(d1) || isNaN(d2)) return null;
  return Math.max(0, Math.round((d2 - d1) / 86400000));
}

export function initIntegration({ app, getCrmDb, broadcastSSE, isManagement, requireManagement }) {
  const ok = (res, data) => res.json(data);
  const badRequest = (res, msg) => res.status(400).json({ error: msg });
  const notFound = (res, msg) => res.status(404).json({ error: msg });

  // Entegrasyon yapılandırması ve bağlantı sağlığı (admin)
  app.get('/api/crm/integration/config', requireManagement, async (req, res) => {
    try {
      const db = await getCrmDb(req);
      let reachable = false, health = null;
      try {
        const r = await erpFetch(db, { operation: 'health', path: '/health', method: 'GET' });
        reachable = true;
        health = r;
      } catch (e) { reachable = false; }
      const pendingErrors = await db.get("SELECT COUNT(*) AS cnt FROM integration_logs WHERE status = 'error'");
      ok(res, { reception_url: RECEPTION_MODULE_URL, reachable, health, pending_errors: Number(pendingErrors?.cnt || 0) });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ERP'den müsaitlik/fiyat sorgulama
  app.post('/api/crm/integration/availability', async (req, res) => {
    const { check_in, check_out, room_type, board, guests, currency } = req.body;
    if (!check_in || !check_out) return badRequest(res, 'check_in ve check_out zorunludur.');
    try {
      const db = await getCrmDb(req);
      const result = await erpFetch(db, { operation: 'availability', path: '/availability', method: 'POST', body: { check_in, check_out, room_type, board, guests, currency } });
      ok(res, result);
    } catch (err) { res.status(502).json({ error: err.message }); }
  });

  // Kazanılmış fırsatı ERP rezervasyonuna dönüştürme (idempotent)
  app.post('/api/crm/integration/opportunities/:id/convert', async (req, res) => {
    try {
      const db = await getCrmDb(req);
      const opp = await db.get("SELECT * FROM opportunities WHERE id = ?", [req.params.id]);
      if (!opp) return notFound(res, 'Fırsat bulunamadı.');
      if (opp.pipeline_stage !== 'won') return badRequest(res, 'Yalnızca kazanılmış (won) fırsatlar ERP rezervasyonuna dönüştürülebilir.');

      // Tekrar dönüşümü engelle (idempotency)
      if (opp.erp_reservation_id) {
        return ok(res, { duplicate: true, erp_reservation_id: opp.erp_reservation_id, reservation_no: opp.erp_reservation_no, message: 'Bu fırsat zaten ERP rezervasyonuna dönüştürülmüş.' });
      }

      // Fiyat/müsaitlik ERP'den yeniden sorgulanır (roadmap kural 5)
      const firm = await db.get("SELECT name, phone, email FROM firms WHERE id = ?", [opp.firm_id]);
      const contact = await db.get("SELECT first_name, last_name, phone, email FROM contacts WHERE id = ?", [opp.contact_id]);
      const offer = await db.get("SELECT * FROM offers WHERE opportunity_id = ? ORDER BY version DESC LIMIT 1", [opp.id]);
      const check_in = offer?.check_in || opp.check_in;
      const check_out = offer?.check_out || opp.check_out;
      if (!check_in || !check_out) return badRequest(res, 'ERP dönüşümü için konaklama tarihi gereklidir (tekliften gelir).');

      const roomType = offer?.room_type || 'rt_std';
      const board = offer?.board_type || 'BB';
      const guests = offer?.guests || 2;
      const currency = offer?.currency || opp.currency || 'EUR';
      const nights = computeNights(check_in, check_out);

      let availability;
      try {
        availability = await erpFetch(db, { operation: 'availability', path: '/availability', method: 'POST', body: { check_in, check_out, room_type: roomType, board, guests, currency } });
      } catch (err) {
        return res.status(502).json({ error: `Müsaitlik sorgulanamadı: ${err.message}` });
      }
      if (!availability.available) return res.status(409).json({ error: `ERP müsait değil: ${availability.message || 'Oda tipi dolu.'}` });

      const guestName = contact ? `${contact.first_name} ${contact.last_name}`.trim() : (firm?.name || null);
      const idempotencyKey = `crm-opp-${opp.id}`;

      let reservation;
      try {
        reservation = await erpFetch(db, {
          operation: 'convert_to_reservation',
          path: '/reservations',
          method: 'POST',
          body: {
            source_system: 'crm',
            source_id: opp.id,
            idempotency_key: idempotencyKey,
            guest_name: guestName,
            guest_email: contact?.email || firm?.email || null,
            guest_phone: contact?.phone || firm?.phone || null,
            firm_name: firm?.name || null,
            check_in, check_out,
            room_type: roomType, board_type: board, guests,
            currency, total_amount: availability.total,
            notes: `CRM fırsatı: ${opp.title}`
          }
        });
      } catch (err) {
        return res.status(502).json({ error: `Rezervasyon oluşturulamadı: ${err.message}` });
      }

      // ERP rezervasyon numarası CRM fırsatına geri yazılır (roadmap kural 6)
      await db.run("UPDATE opportunities SET erp_reservation_id = ?, erp_reservation_no = ?, erp_status = ?, integration_status = 'synced', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [reservation.erp_reservation_id, reservation.reservation_no, reservation.status, opp.id]);
      await db.run("UPDATE opportunities SET erp_check_in = ?, erp_check_out = ?, erp_total_amount = ?, erp_currency = ? WHERE id = ?",
        [check_in, check_out, Number(availability.total), currency, opp.id]);

      await db.run("INSERT INTO activities (id, opportunity_id, type, subject, notes, owner_id) VALUES (?, ?, ?, ?, ?, ?)",
        [uid('act'), opp.id, 'email', `ERP rezervasyonu oluşturuldu: ${reservation.reservation_no}`, `ERP tarafı ${reservation.status} durumunda başladı (${reservation.erp_reservation_id}).`, req.crmUser?.id || opp.owner_id]);

      broadcastSSE('crm_data_changed', { type: 'opportunity', id: opp.id });
      ok(res, { duplicate: false, ...reservation });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ERP rezervasyon/konaklama durumunu CRM fırsatına geri çekme
  app.post('/api/crm/integration/opportunities/:id/refresh-status', async (req, res) => {
    try {
      const db = await getCrmDb(req);
      const opp = await db.get("SELECT * FROM opportunities WHERE id = ?", [req.params.id]);
      if (!opp) return notFound(res, 'Fırsat bulunamadı.');
      if (!opp.erp_reservation_id) return badRequest(res, 'Bu fırsatın ERP rezervasyonu yok. Önce dönüştürün.');
      let reservation;
      try {
        reservation = await erpFetch(db, { operation: 'reservation_status', path: `/reservations/${opp.erp_reservation_id}`, method: 'GET' });
      } catch (err) {
        return res.status(502).json({ error: err.message });
      }
      await db.run("UPDATE opportunities SET erp_status = ?, integration_status = 'synced', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [reservation.status, opp.id]);
      broadcastSSE('crm_data_changed', { type: 'opportunity', id: opp.id });
      ok(res, { erp_status: reservation.status, reservation_no: reservation.reservation_no, stay: reservation.stay || null });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // Teklif/fırsat üzerindeki tarih, fiyat, oda veya misafir değişikliğini mevcut
  // resepsiyon rezervasyonuna taşır. İptal/no-show da aynı sözleşmeden geçer.
  app.post('/api/crm/integration/opportunities/:id/sync', async (req, res) => {
    try {
      const db = await getCrmDb(req);
      const opp = await db.get('SELECT * FROM opportunities WHERE id = ?', [req.params.id]);
      if (!opp?.erp_reservation_id) return badRequest(res, 'Bu fırsatın bağlı resepsiyon rezervasyonu yok.');
      const firm = await db.get('SELECT name, phone, email FROM firms WHERE id = ?', [opp.firm_id]);
      const contact = await db.get('SELECT first_name, last_name, phone, email, nationality, identity_number, passport_number, address FROM contacts WHERE id = ?', [opp.contact_id]);
      const offer = await db.get('SELECT * FROM offers WHERE opportunity_id = ? ORDER BY version DESC LIMIT 1', [opp.id]);
      const check_in = offer?.check_in || opp.erp_check_in;
      const check_out = offer?.check_out || opp.erp_check_out;
      const guest_name = contact ? `${contact.first_name} ${contact.last_name}`.trim() : firm?.name || null;
      const reservation = await erpFetch(db, {
        operation: 'sync_reservation', path: `/reservations/${opp.erp_reservation_id}`, method: 'PATCH',
        body: {
          status: req.body.status || opp.erp_status || 'confirmed', check_in, check_out,
          room_type: offer?.room_type, board_type: offer?.board_type, total_amount: offer?.guests ? Number(opp.amount || 0) : Number(opp.erp_total_amount || opp.amount || 0), currency: offer?.currency || opp.currency,
          guest: contact ? { first_name: contact.first_name, last_name: contact.last_name, phone: contact.phone || firm?.phone, email: contact.email || firm?.email, nationality: contact.nationality, identity_number: contact.identity_number, passport_number: contact.passport_number, address: contact.address } : null,
          notes: `CRM güncellemesi: ${opp.title}`
        }
      });
      await db.run("UPDATE opportunities SET erp_status = ?, integration_status = 'synced', erp_check_in = ?, erp_check_out = ?, erp_total_amount = ?, erp_currency = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [reservation.status, check_in, check_out, Number(reservation.total_amount || opp.erp_total_amount || 0), reservation.currency || opp.erp_currency, opp.id]);
      broadcastSSE('crm_data_changed', { type: 'opportunity', id: opp.id });
      ok(res, { success: true, ...reservation });
    } catch (err) { res.status(502).json({ error: err.message }); }
  });

  // CRM müşteri kartındaki kimlik/iletişim değişikliği resepsiyon misafir kartına da taşınabilir.
  app.post('/api/crm/integration/contacts/:id/sync-reception', async (req, res) => {
    try {
      const db = await getCrmDb(req);
      const contact = await db.get('SELECT first_name, last_name, phone, email, nationality, identity_number, passport_number, address FROM contacts WHERE id = ?', [req.params.id]);
      if (!contact) return notFound(res, 'Kişi bulunamadı.');
      const result = await erpFetch(db, { operation: 'sync_guest', path: '/guests/upsert', method: 'POST', body: { guest: contact } });
      ok(res, result);
    } catch (err) { res.status(502).json({ error: err.message }); }
  });

  // Hatalı senkronizasyon kaydını tekrar deneme (güvenli retry)
  app.post('/api/crm/integration/logs/:id/retry', requireManagement, async (req, res) => {
    try {
      const db = await getCrmDb(req);
      const log = await db.get("SELECT * FROM integration_logs WHERE id = ?", [req.params.id]);
      if (!log) return notFound(res, 'Kayıt bulunamadı.');
      if (!log.opportunity_id) return badRequest(res, 'Bu kayıt fırsat bazlı olmadığı için yeniden denenemez.');

      const opp = await db.get("SELECT * FROM opportunities WHERE id = ?", [log.opportunity_id]);
      if (!opp) return notFound(res, 'İlişkili fırsat bulunamadı.');

      let reservation = null;
      if (opp.erp_reservation_id) {
        // Önce mevcut rezervasyonun durumunu dene
        try {
          reservation = await erpFetch(db, { operation: 'reservation_status', path: `/reservations/${opp.erp_reservation_id}`, method: 'GET' });
        } catch (e) { /* fall through to re-convert */ }
      }
      if (!reservation) {
        try {
          reservation = await erpFetch(db, {
            operation: 'convert_to_reservation',
            path: '/reservations',
            method: 'POST',
            body: { source_system: 'crm', source_id: opp.id, idempotency_key: `crm-opp-${opp.id}` }
          });
        } catch (err) {
          await db.run("UPDATE integration_logs SET retry_count = retry_count + 1, error_message = ?, status = 'error' WHERE id = ?", [err.message, log.id]);
          return res.status(502).json({ error: err.message });
        }
      }
      await db.run("UPDATE opportunities SET erp_reservation_id = ?, erp_reservation_no = ?, erp_status = ?, integration_status = 'synced', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [reservation.erp_reservation_id, reservation.reservation_no, reservation.status, opp.id]);
      await db.run("UPDATE integration_logs SET retry_count = retry_count + 1, status = 'resolved', error_message = NULL, response = ? WHERE id = ?",
        [JSON.stringify(reservation), log.id]);
      broadcastSSE('crm_data_changed', { type: 'opportunity', id: opp.id });
      ok(res, { success: true, reservation_no: reservation.reservation_no });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // Entegrasyon günlükleri (tarihçe)
  app.get('/api/crm/integration/logs', requireManagement, async (req, res) => {
    try {
      const db = await getCrmDb(req);
      const rows = await db.all("SELECT l.*, o.title AS opportunity_title FROM integration_logs l LEFT JOIN opportunities o ON o.id = l.opportunity_id ORDER BY l.created_at DESC LIMIT 100");
      ok(res, rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // fırsat listesi görünümünde ERP durumu
  app.get('/api/crm/integration/opportunities', async (req, res) => {
    try {
      const db = await getCrmDb(req);
      const rows = await db.all("SELECT id, title, erp_reservation_id, erp_reservation_no, erp_status, integration_status, erp_total_amount, erp_currency FROM opportunities WHERE erp_reservation_id IS NOT NULL ORDER BY updated_at DESC LIMIT 100");
      ok(res, rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // Resepsiyondan gelen rezervasyon ve check-in kayıtları CRM müşteri kartına bağlanır.
  app.get('/api/crm/reception-reservations', async (req, res) => {
    try {
      const db = await getCrmDb(req);
      const rows = await db.all(`SELECT rr.*, c.first_name, c.last_name, c.email, c.phone
        FROM reception_reservations rr
        LEFT JOIN contacts c ON c.id = rr.contact_id
        ORDER BY COALESCE(rr.check_in, rr.created_at) DESC LIMIT 200`);
      ok(res, rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.get('/api/crm/reception-events', async (req, res) => {
    try {
      const db = await getCrmDb(req);
      ok(res, await db.all(`SELECT e.*, rr.reservation_number, c.first_name, c.last_name
        FROM reception_event_log e
        LEFT JOIN reception_reservations rr ON rr.reception_reservation_id = e.reception_reservation_id
        LEFT JOIN contacts c ON c.id = e.contact_id
        ORDER BY e.occurred_at DESC LIMIT 300`));
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
}

export function hashSourceId(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 24);
}
