import crypto from 'crypto';
import { id, actor, audit, today, json, parse, paymentLabels, folioBalance } from './helpers.js';

// The authoritative billing system: folio transactions, payments, reversals, and invoicing.
// SQL and transaction logic here must stay byte-identical to the pre-split version — this
// is what the night audit, checkout balance, and printed invoices all read from.
export function registerFolioRoutes({ app, eventBus }) {
  app.get('/api/reception/folios/:id', async (req, res) => {
    const folio = await req.db.get('SELECT * FROM folios WHERE id = ?', [req.params.id]); if (!folio) return res.status(404).json({ error: 'Folyo bulunamadı.' });
    const transactions = await req.db.all('SELECT * FROM folio_transactions WHERE folio_id = ? ORDER BY occurred_at DESC', [folio.id]);
    const payments = await req.db.all('SELECT * FROM payments WHERE folio_id = ? ORDER BY received_at DESC', [folio.id]);
    res.json({ folio, transactions, payments, balance: await folioBalance(req.db, folio.id) });
  });

  app.post('/api/reception/folios/:id/transactions', async (req, res) => {
    try {
      const folio = await req.db.get("SELECT * FROM folios WHERE id = ? AND status = 'open'", [req.params.id]); if (!folio) return res.status(404).json({ error: 'Açık folyo bulunamadı.' });
      const data = req.body || {}; const amount = Number(data.amount || 0); if (!(amount > 0) || !data.description) return res.status(400).json({ error: 'Açıklama ve pozitif tutar zorunludur.' });
      const user = actor(req); const transactionId = id('ftx');
      const minibarCatalogId = data.transaction_type === 'minibar' && String(data.related_reference || '').startsWith('minibar:')
        ? String(data.related_reference).slice('minibar:'.length)
        : null;
      await req.db.transaction(async tx => {
        await tx.run('INSERT INTO folio_transactions (id, folio_id, transaction_type, description, quantity, unit_amount, tax_amount, currency, exchange_rate, debit, credit, payment_method, department, related_reference, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)', [transactionId, folio.id, data.transaction_type || 'charge', data.description, Number(data.quantity || 1), amount, Number(data.tax_amount || 0), data.currency || 'TRY', Number(data.exchange_rate || 1), amount * Number(data.quantity || 1) + Number(data.tax_amount || 0), data.payment_method || null, data.department || 'Reception', data.related_reference || null, user.name], {
          undoSql: 'DELETE FROM folio_transactions WHERE id = ?', undoParams: [transactionId]
        });
        // Minibar charges deduct the linked physical stock (via recipes) so the
        // guest-facing sale and the housekeeping stock count never drift apart.
        if (minibarCatalogId) {
          const recipeLines = await tx.all('SELECT * FROM recipes WHERE catalog_item_id = ?', [minibarCatalogId]);
          for (const line of recipeLines) {
            const deduction = Number(line.amount_needed) * Number(data.quantity || 1);
            await tx.run('UPDATE inventory SET stock = MAX(0, stock - ?) WHERE id = ?', [deduction, line.inventory_id]);
          }
        }
        await audit(tx, req, 'folio_transaction', transactionId, 'posted', null, { folio_id: folio.id, amount });
      });
      await eventBus?.emit('folio_transaction_created', { tenantId: req.tenantId, folioId: folio.id, transactionId, amount, currency: data.currency || 'TRY', description: data.description, reservationId: (await req.db.get('SELECT r.id FROM stays s JOIN reservations r ON r.id = s.reservation_id WHERE s.folio_id = ? LIMIT 1', [folio.id]))?.id });
      res.status(201).json({ id: transactionId, balance: await folioBalance(req.db, folio.id) });
    } catch (error) { res.status(500).json({ error: error.message || 'İşlem kaydedilemedi.' }); }
  });

  app.post('/api/reception/folios/:id/payments', async (req, res) => {
    try {
      const folio = await req.db.get("SELECT * FROM folios WHERE id = ? AND status = 'open'", [req.params.id]); if (!folio) return res.status(404).json({ error: 'Açık folyo bulunamadı.' });
      const data = req.body || {}; const amount = Number(data.amount || 0); if (!(amount > 0) || !data.payment_method) return res.status(400).json({ error: 'Tutar ve ödeme yöntemi zorunludur.' });
      const balance = Math.round((await folioBalance(req.db, folio.id)) * 100) / 100;
      if (!(balance > 0)) return res.status(400).json({ error: 'Tahsil edilecek açık bakiye bulunmuyor.' });
      if (amount > balance + 0.001) return res.status(400).json({ error: `Tahsilat açık bakiyeyi aşamaz. En fazla ${balance.toFixed(2)} TL girilebilir.` });
      const user = actor(req); const paymentId = id('payment'); const transactionId = id('ftx');
      await req.db.transaction(async tx => {
        await tx.run('INSERT INTO payments (id, folio_id, amount, currency, payment_method, exchange_rate, reference, split_group, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [paymentId, folio.id, amount, data.currency || 'TRY', data.payment_method, Number(data.exchange_rate || 1), data.reference || null, data.split_group || null, user.name], {
          undoSql: 'DELETE FROM payments WHERE id = ?', undoParams: [paymentId]
        });
        await tx.run('INSERT INTO folio_transactions (id, folio_id, transaction_type, description, currency, exchange_rate, debit, credit, payment_method, related_reference, created_by) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)', [transactionId, folio.id, 'payment', `Ödeme: ${data.payment_method}`, data.currency || 'TRY', Number(data.exchange_rate || 1), amount, data.payment_method, paymentId, user.name], {
          undoSql: 'DELETE FROM folio_transactions WHERE id = ?', undoParams: [transactionId]
        });
        await audit(tx, req, 'payment', paymentId, 'received', null, { folio_id: folio.id, amount, payment_method: data.payment_method });
      });
      await eventBus?.emit('payment_recorded', { tenantId: req.tenantId, folioId: folio.id, paymentId, amount, currency: data.currency || 'TRY', payment_method: data.payment_method, reservationId: (await req.db.get('SELECT r.id FROM stays s JOIN reservations r ON r.id = s.reservation_id WHERE s.folio_id = ? LIMIT 1', [folio.id]))?.id });
      res.status(201).json({ id: paymentId, balance: await folioBalance(req.db, folio.id) });
    } catch (error) { res.status(500).json({ error: error.message || 'Tahsilat kaydedilemedi.' }); }
  });

  app.post('/api/reception/folios/:id/transactions/:transactionId/reverse', async (req, res) => {
    try {
      const folio = await req.db.get("SELECT * FROM folios WHERE id = ? AND status = 'open'", [req.params.id]); if (!folio) return res.status(404).json({ error: 'Açık folyo bulunamadı.' });
      const original = await req.db.get('SELECT * FROM folio_transactions WHERE id = ? AND folio_id = ?', [req.params.transactionId, folio.id]); if (!original) return res.status(404).json({ error: 'Folyo satırı bulunamadı.' });
      if (String(original.transaction_type) === 'reversal') return res.status(409).json({ error: 'İptal satırı tekrar iptal edilemez.' });
      const marker = `reversal:${original.id}`; const prior = await req.db.get('SELECT id FROM folio_transactions WHERE related_reference = ?', [marker]); if (prior) return res.status(409).json({ error: 'Bu folyo satırı daha önce iptal edildi.' });
      const user = actor(req); const transactionId = id('ftx');
      await req.db.transaction(async tx => {
        await tx.run('INSERT INTO folio_transactions (id, folio_id, transaction_type, description, currency, exchange_rate, debit, credit, payment_method, department, related_reference, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [transactionId, folio.id, 'reversal', `İptal: ${original.description}`, original.currency || 'TRY', Number(original.exchange_rate || 1), Number(original.credit || 0), Number(original.debit || 0), original.payment_method || null, original.department || 'Resepsiyon', marker, user.name], {
          undoSql: 'DELETE FROM folio_transactions WHERE id = ?', undoParams: [transactionId]
        });
        await audit(tx, req, 'folio_transaction', transactionId, 'reversed', original, { folio_id: folio.id, original_transaction_id: original.id });
      });
      await eventBus?.emit('folio_transaction_reversed', { tenantId: req.tenantId, folioId: folio.id, transactionId, originalTransactionId: original.id, amount: Number(original.debit || original.credit || 0), currency: original.currency || 'TRY', reservationId: (await req.db.get('SELECT r.id FROM stays s JOIN reservations r ON r.id = s.reservation_id WHERE s.folio_id = ? LIMIT 1', [folio.id]))?.id });
      res.status(201).json({ id: transactionId, balance: await folioBalance(req.db, folio.id) });
    } catch (error) { res.status(500).json({ error: error.message || 'İptal işlemi tamamlanamadı.' }); }
  });

  app.get('/api/reception/invoices', async (req, res) => {
    const invoices = await req.db.all('SELECT i.*, r.reservation_number, g.first_name, g.last_name FROM invoices i LEFT JOIN reservations r ON r.id = i.reservation_id LEFT JOIN guest_profiles g ON g.id = i.guest_id ORDER BY i.created_at DESC');
    res.json(invoices);
  });

  app.get('/api/reception/invoices/candidates', async (req, res) => {
    const folios = await req.db.all("SELECT f.id, f.status, f.details, r.reservation_number, r.payment_method, g.first_name, g.last_name FROM folios f LEFT JOIN stays s ON s.folio_id = f.id LEFT JOIN reservations r ON r.id = s.reservation_id LEFT JOIN guest_profiles g ON g.id = r.main_guest_id WHERE NOT EXISTS (SELECT 1 FROM invoices i WHERE i.folio_id = f.id AND i.status = 'issued') ORDER BY f.created_at DESC");
    const result = [];
    for (const folio of folios) {
      const total = await req.db.get("SELECT SUM(t.debit) AS debit FROM folio_transactions t WHERE t.folio_id = ? AND t.debit > 0 AND t.transaction_type <> 'reversal' AND NOT EXISTS (SELECT 1 FROM folio_transactions r WHERE r.folio_id = t.folio_id AND r.transaction_type = 'reversal' AND r.related_reference = 'reversal:' || t.id)", [folio.id]);
      if (Number(total?.debit || 0) > 0) result.push({ ...folio, total_amount: Number(total.debit || 0) });
    }
    res.json(result);
  });

  app.get('/api/reception/invoices/:id', async (req, res) => {
    const invoice = await req.db.get('SELECT * FROM invoices WHERE id = ?', [req.params.id]);
    if (!invoice) return res.status(404).json({ error: 'Fatura bulunamadı.' });
    const items = await req.db.all('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY description', [invoice.id]);
    res.json({ invoice, items, snapshot: parse(invoice.snapshot) });
  });

  app.post('/api/reception/folios/:id/invoices', async (req, res) => {
    try {
      const folio = await req.db.get('SELECT * FROM folios WHERE id = ?', [req.params.id]);
      if (!folio) return res.status(404).json({ error: 'Folyo bulunamadı.' });
      const existing = await req.db.get("SELECT id FROM invoices WHERE folio_id = ? AND status = 'issued'", [folio.id]);
      if (existing) return res.status(409).json({ error: 'Bu folyo için zaten kesilmiş bir fatura var.' });
      const data = req.body || {};
      const customerName = String(data.customer_name || '').trim();
      if (!customerName) return res.status(400).json({ error: 'Fatura ünvanı veya misafir adı zorunludur.' });
      const transactions = await req.db.all("SELECT t.* FROM folio_transactions t WHERE t.folio_id = ? AND t.debit > 0 AND t.transaction_type <> 'reversal' AND NOT EXISTS (SELECT 1 FROM folio_transactions r WHERE r.folio_id = t.folio_id AND r.transaction_type = 'reversal' AND r.related_reference = 'reversal:' || t.id) ORDER BY t.occurred_at ASC", [folio.id]);
      if (!transactions.length) return res.status(409).json({ error: 'Faturalandırılacak folyo kalemi yok.' });
      const taxRate = Math.max(0, Number(data.tax_rate ?? 20));
      const rate = taxRate / 100;
      const items = transactions.map(transaction => {
        const gross = Number(transaction.debit || 0);
        const knownTax = Number(transaction.tax_amount || 0);
        const taxAmount = knownTax > 0 ? knownTax : Math.round((gross - gross / (1 + rate)) * 100) / 100;
        const net = Math.round((gross - taxAmount) * 100) / 100;
        return { id: id('invoiceitem'), description: transaction.description, quantity: Number(transaction.quantity || 1), unit_amount: net, tax_rate: taxRate, tax_amount: taxAmount, total_amount: gross, source_transaction_id: transaction.id };
      });
      const subtotal = Math.round(items.reduce((sum, item) => sum + item.unit_amount, 0) * 100) / 100;
      const taxAmount = Math.round(items.reduce((sum, item) => sum + item.tax_amount, 0) * 100) / 100;
      const totalAmount = Math.round(items.reduce((sum, item) => sum + item.total_amount, 0) * 100) / 100;
      const reservation = await req.db.get('SELECT r.*, g.first_name, g.last_name FROM stays s JOIN reservations r ON r.id = s.reservation_id LEFT JOIN guest_profiles g ON g.id = r.main_guest_id WHERE s.folio_id = ?', [folio.id]);
      const invoiceId = id('invoice');
      const invoiceNumber = `DLF-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      const user = actor(req);
      const snapshot = { hotel_name: 'Aeon Boutique Hotel', reservation_number: reservation?.reservation_number || null, customer_name: customerName, customer_tax_number: String(data.customer_tax_number || '').trim(), customer_tax_office: String(data.customer_tax_office || '').trim(), customer_address: String(data.customer_address || '').trim(), customer_email: String(data.customer_email || '').trim(), payment_method: paymentLabels[data.payment_method] || data.payment_method || null, notes: String(data.notes || '').trim(), generated_at: new Date().toISOString() };
      await req.db.transaction(async tx => {
        await tx.run('INSERT INTO invoices (id, invoice_number, folio_id, reservation_id, guest_id, status, issue_date, customer_name, customer_tax_number, customer_tax_office, customer_address, customer_email, currency, subtotal, tax_amount, total_amount, notes, snapshot, created_by) VALUES (?, ?, ?, ?, ?, \'issued\', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [invoiceId, invoiceNumber, folio.id, reservation?.id || null, reservation?.main_guest_id || null, today(), snapshot.customer_name, snapshot.customer_tax_number || null, snapshot.customer_tax_office || null, snapshot.customer_address || null, snapshot.customer_email || null, data.currency || 'TRY', subtotal, taxAmount, totalAmount, snapshot.notes || null, json(snapshot), user.name], {
          undoSql: 'DELETE FROM invoices WHERE id = ?', undoParams: [invoiceId]
        });
        for (const item of items) {
          await tx.run('INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_amount, tax_rate, tax_amount, total_amount, source_transaction_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [item.id, invoiceId, item.description, item.quantity, item.unit_amount, item.tax_rate, item.tax_amount, item.total_amount, item.source_transaction_id], {
            undoSql: 'DELETE FROM invoice_items WHERE id = ?', undoParams: [item.id]
          });
        }
        await audit(tx, req, 'invoice', invoiceId, 'issued', null, { invoice_number: invoiceNumber, folio_id: folio.id, total_amount: totalAmount });
      });
      await eventBus?.emit('invoice_issued', { tenantId: req.tenantId, folioId: folio.id, invoiceId, invoiceNumber, amount: totalAmount, currency: data.currency || 'TRY', reservationId: reservation?.id || null });
      res.status(201).json({ id: invoiceId, invoice_number: invoiceNumber, total_amount: totalAmount });
    } catch (error) { res.status(500).json({ error: error.message || 'Fatura kesilemedi.' }); }
  });

  app.post('/api/reception/invoices/:id/cancel', async (req, res) => {
    try {
      const invoice = await req.db.get("SELECT * FROM invoices WHERE id = ? AND status = 'issued'", [req.params.id]);
      if (!invoice) return res.status(404).json({ error: 'İptal edilebilecek fatura bulunamadı.' });
      const reason = String(req.body?.reason || '').trim();
      if (!reason) return res.status(400).json({ error: 'İptal gerekçesi zorunludur.' });
      const user = actor(req);
      await req.db.transaction(async tx => {
        await tx.run("UPDATE invoices SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP, cancelled_by = ?, cancellation_reason = ? WHERE id = ?", [user.name, reason, invoice.id], {
          undoSql: "UPDATE invoices SET status = 'issued', cancelled_at = NULL, cancelled_by = NULL, cancellation_reason = NULL WHERE id = ?", undoParams: [invoice.id]
        });
        await audit(tx, req, 'invoice', invoice.id, 'cancelled', invoice, { reason });
      });
      await eventBus?.emit('invoice_cancelled', { tenantId: req.tenantId, folioId: invoice.folio_id, invoiceId: invoice.id, reservationId: invoice.reservation_id || null });
      res.json({ success: true });
    } catch (error) { res.status(500).json({ error: error.message || 'Fatura iptal edilemedi.' }); }
  });
}
