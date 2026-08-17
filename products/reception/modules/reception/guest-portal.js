import { id, json, parse, validateIdentity } from './helpers.js';

// Public (unauthenticated) guest-facing precheckin endpoints — reachable before the
// `/api/reception` requireReception gate that route-admin.js installs.
export function registerGuestPortalRoutes({ app, eventBus }) {
  app.get('/api/guest/precheckin/:token', async (req, res) => {
    const reservation = await req.db.get('SELECT reservation_number, arrival_date, departure_date, adults, children, board_type, precheckin_expires_at FROM reservations WHERE precheckin_token = ?', [req.params.token]);
    if (!reservation || (reservation.precheckin_expires_at && new Date(reservation.precheckin_expires_at).getTime() < Date.now())) return res.status(404).json({ error: 'Online ön giriş bağlantısı geçersiz veya süresi dolmuş.' });
    const entry = await req.db.get("SELECT status, submitted_at FROM guest_precheckins WHERE token = ? ORDER BY created_at DESC", [req.params.token]);
    res.json({ reservation_number: reservation.reservation_number, arrival_date: reservation.arrival_date, departure_date: reservation.departure_date, adults: reservation.adults, children: reservation.children, board_type: reservation.board_type, status: entry?.status || 'not_started', submitted_at: entry?.submitted_at || null });
  });

  app.post('/api/guest/precheckin/:token', async (req, res) => {
    const reservation = await req.db.get('SELECT * FROM reservations WHERE precheckin_token = ?', [req.params.token]);
    if (!reservation || (reservation.precheckin_expires_at && new Date(reservation.precheckin_expires_at).getTime() < Date.now())) return res.status(404).json({ error: 'Online ön giriş bağlantısı geçersiz veya süresi dolmuş.' });
    const data = req.body || {};
    if (!data.first_name || !data.last_name || !data.phone || !data.nationality) return res.status(400).json({ error: 'Ad, soyad, telefon ve uyruk zorunludur.' });
    if (!validateIdentity(data)) return res.status(400).json({ error: data.nationality === 'TR' ? 'T.C. kimlik numarası 11 haneli olmalıdır.' : 'Pasaport numarası zorunludur.' });
    const previous = await req.db.get("SELECT * FROM guest_precheckins WHERE token = ? AND status IN ('submitted','reviewed') ORDER BY created_at DESC", [req.params.token]);
    if (previous?.status === 'reviewed') return res.status(409).json({ error: 'Bu form resepsiyon tarafından işleme alınmış.' });
    const entryId = previous?.id || id('precheckin');
    const payload = { first_name: String(data.first_name).trim(), last_name: String(data.last_name).trim(), phone: String(data.phone).trim(), email: String(data.email || '').trim(), nationality: String(data.nationality).toUpperCase(), identity_number: String(data.identity_number || '').trim(), passport_number: String(data.passport_number || '').trim(), document_type: data.nationality === 'TR' ? 'national_id' : 'passport', date_of_birth: data.date_of_birth || null, address: String(data.address || '').trim(), vehicle_plate: String(data.vehicle_plate || '').trim(), language: String(data.language || 'tr').trim(), special_requests: String(data.special_requests || '').trim(), kvkk_notice_at: new Date().toISOString(), marketing_consent: Boolean(data.marketing_consent) };
    if (previous) await req.db.run("UPDATE guest_precheckins SET status = 'submitted', payload = ?, submitted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [json(payload), previous.id]);
    else await req.db.run("INSERT INTO guest_precheckins (id, reservation_id, token, status, payload, submitted_at, expires_at) VALUES (?, ?, ?, 'submitted', ?, CURRENT_TIMESTAMP, ?)", [entryId, reservation.id, req.params.token, json(payload), reservation.precheckin_expires_at]);
    await eventBus.emit('precheckin_submitted', { tenantId: req.tenantId, id: entryId, reservationId: reservation.id, reservationNumber: reservation.reservation_number, guestName: `${payload.first_name} ${payload.last_name}`, source: 'reservation_qr' });
    res.status(201).json({ success: true, message: 'Bilgileriniz resepsiyon onayına gönderildi.' });
  });

  app.post('/api/guest/precheckin', async (req, res) => {
    const data = req.body || {};
    if (!data.first_name || !data.last_name || !data.phone || !data.nationality) return res.status(400).json({ error: 'Ad, soyad, telefon ve uyruk zorunludur.' });
    if (!data.kvkk_consent) return res.status(400).json({ error: 'Bilgilerinizin resepsiyon tarafından işlenmesine onay vermelisiniz.' });
    if (!validateIdentity(data)) return res.status(400).json({ error: data.nationality === 'TR' ? 'T.C. kimlik numarası 11 haneli olmalıdır.' : 'Pasaport numarası zorunludur.' });
    const payload = { first_name: String(data.first_name).trim(), last_name: String(data.last_name).trim(), phone: String(data.phone).trim(), email: String(data.email || '').trim(), nationality: String(data.nationality).toUpperCase(), identity_number: String(data.identity_number || '').trim(), passport_number: String(data.passport_number || '').trim(), document_type: String(data.nationality).toUpperCase() === 'TR' ? 'national_id' : 'passport', date_of_birth: data.date_of_birth || null, address: String(data.address || '').trim(), vehicle_plate: String(data.vehicle_plate || '').trim(), language: String(data.language || 'tr').trim(), special_requests: String(data.special_requests || '').trim(), kvkk_notice_at: new Date().toISOString(), marketing_consent: Boolean(data.marketing_consent) };
    const submissionId = id('precheckin_submission');
    await req.db.run("INSERT INTO guest_precheckin_submissions (id, status, payload, submitted_at) VALUES (?, 'submitted', ?, CURRENT_TIMESTAMP)", [submissionId, json(payload)]);
    await eventBus.emit('precheckin_submitted', { tenantId: req.tenantId, id: submissionId, guestName: `${payload.first_name} ${payload.last_name}`, source: 'fixed_qr' });
    res.status(201).json({ success: true, id: submissionId, message: 'Bilgileriniz resepsiyona gönderildi. Rezervasyon, oda ve ödeme ayrıntıları sizinle ayrıca teyit edilecektir.' });
  });
}
