import crypto from 'crypto';

// Hook + event-bus registrations for the Stay module: folio charge/reversal/adjustment
// requests coming from other modules (bar/dining) and room-service delivery notices.
export function registerStayEvents({ eventBus, hookRegistry, getDb }) {
  // Register Hook: payment_methods
  hookRegistry.register('payment_methods', async (context) => {
    const { db } = context;
    const stayActive = await db.get("SELECT value FROM config WHERE key = 'MODULE_STAY'");
    if (stayActive && stayActive.value === 'true') {
      return [{ id: 'room_charge', name: 'Oda Hesabına Yaz' }];
    }
    return [];
  });

  // Register Event: room_charge_request
  eventBus.on('room_charge_request', async (data) => {
    const { tenantId, targetIdentifier, amount, requestId, createdBy, department, description } = data;
    try {
      const db = await getDb(tenantId);
      const roomNumber = targetIdentifier.replace('Room-', '').trim();
      const room = await db.get("SELECT * FROM rooms WHERE room_number = ?", [roomNumber]);
      if (room && room.status === 'occupied') {
        const stay = await db.get("SELECT folio_id FROM stays WHERE room_id = ? AND status = 'checked_in' ORDER BY checkin_at DESC LIMIT 1", [room.id]);
        if (!stay?.folio_id) throw new Error(`Room ${roomNumber} has no active folio`);
        const sourceDepartment = ['Bar', 'Restaurant'].includes(String(department || '')) ? String(department) : 'Restaurant';
        const sourceLabel = String(description || (sourceDepartment === 'Bar' ? 'Bar siparişi' : 'Restoran siparişi')).trim();
        const marker = `restaurant-order:${requestId}`;
        const existing = await db.get('SELECT id FROM folio_transactions WHERE related_reference = ?', [marker]);
        if (existing) return;
        await db.run("INSERT INTO folio_transactions (id, folio_id, transaction_type, description, quantity, unit_amount, debit, currency, related_reference, department, created_by) VALUES (?, ?, 'restaurant', ?, 1, ?, ?, 'TRY', ?, ?, ?)", [`ftx_${crypto.randomUUID()}`, stay.folio_id, `${sourceLabel}: #${requestId}`, Number(amount || 0), Number(amount || 0), marker, sourceDepartment, createdBy || sourceDepartment]);
        await db.run("INSERT INTO audit_logs (id, staff_name, action, details) VALUES (?, ?, ?, ?)", [`log_${crypto.randomUUID()}`, createdBy || sourceDepartment, `${sourceDepartment} Folyo Masrafı`, `Oda: ${roomNumber}, Sipariş: #${requestId}, Tutar: ${Number(amount || 0)} TL`]);
      } else {
        throw new Error(`Room ${roomNumber} is not occupied`);
      }
    } catch (err) {
      console.error('[Stay Module] Error charging room:', err);
      throw err;
    }
  });

  eventBus.on('room_charge_reversal_request', async (data) => {
    const { tenantId, requestId, createdBy, reason } = data;
    try {
      const db = await getDb(tenantId);
      const original = await db.get('SELECT * FROM folio_transactions WHERE related_reference = ?', [`restaurant-order:${requestId}`]);
      if (!original) return;
      const marker = `reversal:${original.id}`;
      const existing = await db.get('SELECT id FROM folio_transactions WHERE related_reference = ?', [marker]);
      if (existing) return;
      // Earlier per-ticket cancellations on this same order may already have posted partial
      // 'adjustment:{original.id}:*' credits (see room_charge_adjustment_request below). A full
      // reversal must only credit what's left of the original debit, or a partial-then-full
      // cancellation sequence over-credits the guest by whatever was already adjusted.
      // alasql treats bare `total` as a reserved keyword and fails to parse it as an alias
      // (confirmed: `SELECT ... AS total` throws "got 'TOTAL'"), so use a non-reserved name.
      const priorAdjustments = await db.get("SELECT COALESCE(SUM(credit), 0) AS credited_total FROM folio_transactions WHERE related_reference LIKE ?", [`adjustment:${original.id}:%`]);
      const remainingAmount = Math.max(0, Number(original.debit || 0) - Number(priorAdjustments?.credited_total || 0));
      const sourceDepartment = ['Bar', 'Restaurant'].includes(String(original.department || '')) ? String(original.department) : 'Restaurant';
      await db.run("INSERT INTO folio_transactions (id, folio_id, transaction_type, description, currency, debit, credit, related_reference, department, created_by) VALUES (?, ?, 'reversal', ?, ?, ?, ?, ?, ?, ?)", [`ftx_${crypto.randomUUID()}`, original.folio_id, `İptal: ${original.description}`, original.currency || 'TRY', Number(original.credit || 0), remainingAmount, marker, sourceDepartment, createdBy || sourceDepartment]);
      await db.run("INSERT INTO audit_logs (id, staff_name, action, details) VALUES (?, ?, ?, ?)", [`log_${crypto.randomUUID()}`, createdBy || sourceDepartment, `${sourceDepartment} Folyo İptali`, `Sipariş: #${requestId}, Sebep: ${reason || 'iptal'}`]);
    } catch (err) {
      console.error('[Stay Module] Error reversing room charge:', err);
      throw err;
    }
  });

  eventBus.on('room_charge_adjustment_request', async (data) => {
    const { tenantId, requestId, ticketId, adjustmentAmount, createdBy, reason } = data;
    try {
      const amount = Math.abs(Number(adjustmentAmount || 0));
      if (!(amount > 0)) return;
      const db = await getDb(tenantId);
      const original = await db.get('SELECT * FROM folio_transactions WHERE related_reference = ?', [`restaurant-order:${requestId}`]);
      if (!original) return;
      const marker = `adjustment:${original.id}:${ticketId}`;
      const existing = await db.get('SELECT id FROM folio_transactions WHERE related_reference = ?', [marker]);
      if (existing) return;
      const sourceDepartment = ['Bar', 'Restaurant'].includes(String(original.department || '')) ? String(original.department) : 'Restaurant';
      await db.run("INSERT INTO folio_transactions (id, folio_id, transaction_type, description, quantity, unit_amount, currency, debit, credit, related_reference, department, created_by) VALUES (?, ?, 'adjustment', ?, 1, ?, ?, 0, ?, ?, ?, ?)", [`ftx_${crypto.randomUUID()}`, original.folio_id, `İptal düzeltmesi: ${original.description}`, amount, original.currency || 'TRY', amount, marker, sourceDepartment, createdBy || sourceDepartment]);
      await db.run("INSERT INTO audit_logs (id, staff_name, action, details) VALUES (?, ?, ?, ?)", [`log_${crypto.randomUUID()}`, createdBy || sourceDepartment, `${sourceDepartment} Folyo Düzeltmesi`, `Sipariş: #${requestId}, Tutar: ${amount} TL, Sebep: ${reason || 'iptal'}`]);
    } catch (err) {
      console.error('[Stay Module] Error adjusting room charge:', err);
      throw err;
    }
  });

  // Register Event: order_delivered_to_room
  eventBus.on('order_delivered_to_room', async (data) => {
    const { tenantId, targetIdentifier, requestId } = data;
    try {
      const db = await getDb(tenantId);
      const roomNumber = targetIdentifier.replace('Room-', '').trim();
      await db.run(
        "UPDATE rooms SET eta = 'Servis Teslim Edildi ✓', updated_at = CURRENT_TIMESTAMP WHERE room_number = ?",
        [roomNumber]
      );
      const logId = 'log_' + Math.random().toString(36).substr(2, 9);
      await db.run(
        "INSERT INTO audit_logs (id, staff_name, action, details) VALUES (?, ?, ?, ?)",
        [logId, 'Mutfak / Servis', 'Oda Servisi Teslim Edildi', `Oda: ${roomNumber}, Sipariş: #${requestId}`]
      );
    } catch (err) {
      console.error('[Stay Module] Error updating room after delivery:', err);
      throw err;
    }
  });
}
