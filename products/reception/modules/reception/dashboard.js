import { today, folioBalance, roomAvailable, validateDates } from './helpers.js';

// Front-desk overview: KPI dashboard, the room rack (Gantt-style availability grid),
// and ad-hoc availability search.
export function registerDashboardRoutes({ app }) {
  app.get('/api/reception/dashboard', async (req, res) => {
    const businessDate = req.query.date || today();
    const rooms = await req.db.all('SELECT * FROM rooms ORDER BY CAST(room_number AS INT), room_number');
    const reservations = await req.db.all('SELECT * FROM reservations');
    const stays = await req.db.all("SELECT * FROM stays WHERE status = 'checked_in'");
    const notifications = await req.db.all("SELECT * FROM identity_notifications WHERE status IN ('pending','rejected','manual_review')");
    const channelNotifications = await req.db.all("SELECT * FROM channel_notifications WHERE status = 'unread'");
    const tasks = await req.db.all("SELECT * FROM reception_tasks WHERE status <> 'completed'");
    const folios = await req.db.all("SELECT * FROM folios WHERE status = 'open'");
    const balances = await Promise.all(folios.map(async folio => ({ folio, balance: await folioBalance(req.db, folio.id) })));
    const transactions = await req.db.all('SELECT id, transaction_type, related_reference, debit, credit, occurred_at FROM folio_transactions');
    const restaurantOrders = await req.db.all("SELECT status, payment_method, total_amount, created_at, completed_at FROM requests WHERE type = 'order'");
    const reversedTransactionIds = new Set(transactions.filter(transaction => transaction.transaction_type === 'reversal' && String(transaction.related_reference || '').startsWith('reversal:')).map(transaction => String(transaction.related_reference).slice('reversal:'.length)));
    const financialTransactions = transactions.filter(transaction => transaction.transaction_type !== 'reversal' && !reversedTransactionIds.has(transaction.id));
    const sameBusinessDate = transaction => String(transaction.occurred_at || '').slice(0, 10) === businessDate;
    const sumAmount = (rows, field) => rows.reduce((sum, row) => sum + Number(row[field] || 0), 0);
    const todayTransactions = financialTransactions.filter(sameBusinessDate);
    const dailyDirectRestaurantRevenue = restaurantOrders.filter(item => ['completed', 'paid'].includes(String(item.status || '').toLowerCase()) && String(item.payment_method || '') !== 'room_charge' && String(item.completed_at || item.created_at || '').slice(0, 10) === businessDate).reduce((sum, item) => sum + Number(item.total_amount || 0), 0);
    const reservationsFor = status => reservations.filter(item => item.status === status);
    res.json({ business_date: businessDate, metrics: {
      arrivals: reservations.filter(item => item.arrival_date === businessDate && ['confirmed', 'guaranteed', 'option'].includes(item.status)).length,
      departures: stays.filter(item => item.business_date && String(item.business_date) <= businessDate).length,
      in_house: stays.length,
      occupancy: rooms.length ? Math.round(stays.length * 100 / rooms.length) : 0,
      clean_available: rooms.filter(item => item.status === 'clean_vacant').length,
      dirty_vacant: rooms.filter(item => item.status === 'dirty_vacant').length,
      maintenance: rooms.filter(item => item.status === 'maintenance').length,
      unassigned: reservations.filter(item => ['confirmed', 'guaranteed', 'option'].includes(item.status) && !item.room_id).length,
      late_arrivals: reservationsFor('confirmed').filter(item => item.arrival_date < businessDate).length,
      late_checkouts: rooms.filter(item => Number(item.late_checkout) === 1).length,
      no_show_candidates: reservations.filter(item => item.arrival_date < businessDate && ['confirmed', 'guaranteed'].includes(item.status)).length,
      outstanding_balance: balances.reduce((sum, item) => sum + Math.max(0, item.balance), 0),
      total_accrual: sumAmount(financialTransactions, 'debit'),
      total_collection: sumAmount(financialTransactions, 'credit'),
      daily_accrual: sumAmount(todayTransactions, 'debit'),
      daily_collection: sumAmount(todayTransactions, 'credit'),
      daily_revenue: sumAmount(todayTransactions, 'credit') + dailyDirectRestaurantRevenue,
      identity_attention: notifications.length,
      channel_attention: channelNotifications.length,
      open_tasks: tasks.length,
      payment_attention: reservations.filter(item => ['pending', 'partial'].includes(item.payment_status || 'pending') && item.payment_due_date && item.payment_due_date <= businessDate).length,
      vip: rooms.filter(item => Number(item.vip) === 1).length
    } });
  });

  app.get('/api/reception/room-rack', async (req, res) => {
    const from = req.query.from || today();
    const days = Math.min(Math.max(Number(req.query.days || 14), 1), 31);
    const end = new Date(`${from}T00:00:00Z`); end.setUTCDate(end.getUTCDate() + days);
    const to = end.toISOString().slice(0, 10);
    const rooms = await req.db.all('SELECT * FROM rooms ORDER BY floor, CAST(room_number AS INT), room_number');
    const assignments = await req.db.all("SELECT a.*, r.reservation_number, r.status AS reservation_status, r.board_type, g.first_name, g.last_name, g.phone FROM room_assignments a LEFT JOIN reservations r ON r.id = a.reservation_id LEFT JOIN guest_profiles g ON g.id = r.main_guest_id WHERE a.start_date < ? AND a.end_date > ?", [to, from]);
    const blocks = await req.db.all("SELECT * FROM room_blocks WHERE status = 'active' AND start_date < ? AND end_date > ?", [to, from]);
    res.json({ from, to, rooms, assignments: assignments.map(item => ({ ...item, guest_name: `${item.first_name || ''} ${item.last_name || ''}`.trim() })), blocks });
  });

  app.get('/api/reception/availability', async (req, res) => {
    const { arrival_date, departure_date, room_type, exclude_reservation_id } = req.query;
    try { validateDates(arrival_date, departure_date); } catch (error) { return res.status(400).json({ error: error.message }); }
    const rooms = await req.db.all('SELECT * FROM rooms ORDER BY CAST(room_number AS INT), room_number');
    const available = [];
    for (const room of rooms) if ((!room_type || room.room_type === room_type) && await roomAvailable(req.db, room.id, arrival_date, departure_date, exclude_reservation_id || null)) available.push(room);
    res.json({ arrival_date, departure_date, rooms: available });
  });
}
