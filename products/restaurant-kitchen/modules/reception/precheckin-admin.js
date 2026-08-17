import crypto from 'crypto';
import { actor, audit, parse, profileFor } from './helpers.js';

// Reception-side review/approval of guest-submitted precheckin forms (both the
// reservation-linked token flow and the fixed-QR submission flow).
export function registerPrecheckinAdminRoutes({ app }) {
  app.get('/api/reception/precheckins', async (req, res) => {
    const rows = await req.db.all('SELECT * FROM guest_precheckin_submissions ORDER BY submitted_at DESC');
    for (const row of rows.filter(item => item.status === 'reviewed' && !item.reservation_id && item.created_guest_id)) {
      const reservation = await req.db.get("SELECT id FROM reservations WHERE main_guest_id = ? AND status = 'inquiry' AND created_at >= ? ORDER BY created_at DESC LIMIT 1", [row.created_guest_id, row.submitted_at]);
      if (reservation) {
        await req.db.run("UPDATE guest_precheckin_submissions SET status = 'converted', reservation_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [reservation.id, row.id]);
        await req.db.run("UPDATE reservations SET status = 'confirmed', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [reservation.id]);
        row.status = 'converted'; row.reservation_id = reservation.id;
      }
    }
    const reservationNumbers = await req.db.all('SELECT id, reservation_number FROM reservations');
    res.json(rows.map(row => ({ ...row, reservation_number: reservationNumbers.find(item => item.id === row.reservation_id)?.reservation_number || null, payload: parse(row.payload) || {} })));
  });

  app.post('/api/reception/precheckins/:id/approve', async (req, res) => {
    const entry = await req.db.get("SELECT * FROM guest_precheckin_submissions WHERE id = ? AND status = 'submitted'", [req.params.id]);
    if (!entry) return res.status(404).json({ error: 'Bekleyen online ön giriş kaydı bulunamadı.' });
    const payload = parse(entry.payload) || {};
    const guestId = await profileFor(req.db, payload, req);
    const user = actor(req);
    await req.db.run("UPDATE guest_precheckin_submissions SET status = 'reviewed', reviewed_at = CURRENT_TIMESTAMP, reviewed_by = ?, created_guest_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [user.name, guestId, entry.id]);
    await audit(req.db, req, 'guest_precheckin_submission', entry.id, 'reviewed', null, { guest_id: guestId });
    res.json({ success: true, guest_id: guestId, payload });
  });

  app.delete('/api/reception/precheckins/:id', async (req, res) => {
    const entry = await req.db.get('SELECT * FROM guest_precheckin_submissions WHERE id = ?', [req.params.id]);
    if (!entry) return res.status(404).json({ error: 'Ön giriş kaydı bulunamadı.' });
    if (entry.status === 'converted') return res.status(409).json({ error: 'Rezervasyona dönüşen kayıt silinemez.' });
    await req.db.run('DELETE FROM guest_precheckin_submissions WHERE id = ?', [entry.id]);
    await audit(req.db, req, 'guest_precheckin_submission', entry.id, 'deleted', entry, null);
    res.status(204).end();
  });

  app.get('/api/reception/reservations/:id/precheckin', async (req, res) => {
    const reservation = await req.db.get('SELECT id, reservation_number, precheckin_token, precheckin_expires_at FROM reservations WHERE id = ?', [req.params.id]);
    if (!reservation) return res.status(404).json({ error: 'Rezervasyon bulunamadı.' });
    // Reservations created through the reception form (as opposed to HotelRunner channel
    // sync) never get a precheckin_token — this endpoint previously just 409'd for every one
    // of them, and no frontend called it anyway, so there was no way at all to generate a
    // per-reservation online precheckin link for an existing booking (e.g. the imported
    // reservations that are missing guest ID data). Generate one on demand instead.
    let token = reservation.precheckin_token;
    let expiresAt = reservation.precheckin_expires_at;
    if (!token || !expiresAt || new Date(expiresAt) < new Date()) {
      token = crypto.randomBytes(24).toString('base64url');
      expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await req.db.run('UPDATE reservations SET precheckin_token = ?, precheckin_expires_at = ? WHERE id = ?', [token, expiresAt, reservation.id]);
    }
    const entry = await req.db.get('SELECT status, submitted_at FROM guest_precheckins WHERE reservation_id = ? ORDER BY created_at DESC', [reservation.id]);
    res.json({ reservation_number: reservation.reservation_number, url: `/precheckin.html?token=${token}`, expires_at: expiresAt, status: entry?.status || 'not_started', submitted_at: entry?.submitted_at || null });
  });

  app.get('/api/reception/reservation-precheckins', async (req, res) => {
    const rows = await req.db.all("SELECT p.*, r.reservation_number, r.arrival_date, r.departure_date FROM guest_precheckins p JOIN reservations r ON r.id = p.reservation_id WHERE p.status IN ('submitted', 'reviewed') ORDER BY p.submitted_at DESC");
    res.json(rows.map(row => ({ ...row, payload: parse(row.payload) || {} })));
  });

  app.post('/api/reception/reservations/:id/precheckin/review', async (req, res) => {
    const reservation = await req.db.get('SELECT * FROM reservations WHERE id = ?', [req.params.id]);
    if (!reservation) return res.status(404).json({ error: 'Rezervasyon bulunamadı.' });
    const entry = await req.db.get("SELECT * FROM guest_precheckins WHERE reservation_id = ? AND status = 'submitted' ORDER BY submitted_at DESC", [reservation.id]);
    if (!entry) return res.status(409).json({ error: 'İncelenecek online ön giriş formu yok.' });
    const data = parse(entry.payload); if (!data?.first_name || !data?.last_name) return res.status(400).json({ error: 'Online form eksik.' });
    const guestId = await profileFor(req.db, data, req); const user = actor(req);
    await req.db.run('UPDATE reservations SET main_guest_id = ?, contact_phone = ?, contact_email = ?, special_requests = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ? WHERE id = ?', [guestId, data.phone || reservation.contact_phone, data.email || reservation.contact_email, data.special_requests || reservation.special_requests, user.name, reservation.id]);
    await req.db.run("UPDATE guest_precheckins SET status = 'reviewed', reviewed_at = CURRENT_TIMESTAMP, reviewed_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [user.name, entry.id]);
    await audit(req.db, req, 'reservation', reservation.id, 'precheckin_reviewed', null, { precheckin_id: entry.id, guest_id: guestId });
    res.json({ success: true, guest_id: guestId });
  });
}
