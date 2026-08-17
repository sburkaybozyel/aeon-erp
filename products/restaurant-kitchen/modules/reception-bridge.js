const OUTBOX_SCHEMA = `
  CREATE TABLE IF NOT EXISTS module_outbox (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    source_id TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_module_outbox_status ON module_outbox (status, created_at);
`;

async function ensureOutbox(db) {
  for (const statement of OUTBOX_SCHEMA.split(';').map(value => value.trim()).filter(Boolean)) await db.run(statement);
}

function bridgeConfigured() {
  return Boolean((globalThis.__RECEPTION_SERVICE || process.env.RECEPTION_MODULE_URL) && String(process.env.RECEPTION_MODULE_TOKEN || '').trim());
}

async function sendToReception(eventType, payload) {
  if (!bridgeConfigured()) throw new Error('Resepsiyon modül köprüsü yapılandırılmamış.');
  const init = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-aeon-module-token': String(process.env.RECEPTION_MODULE_TOKEN || '') },
    body: JSON.stringify({ event_type: eventType, ...payload })
  };
  const service = globalThis.__RECEPTION_SERVICE;
  const url = service ? 'https://aeon-reception.internal/api/module/dining/events' : `${String(process.env.RECEPTION_MODULE_URL || '').replace(/\/$/, '')}/api/module/dining/events`;
  const response = service ? await service.fetch(new Request(url, init)) : await fetch(url, init);
  const text = await response.text();
  let body = null;
  try { body = JSON.parse(text); } catch {}
  if (!response.ok) throw new Error(body?.error || `Resepsiyon köprüsü HTTP ${response.status}`);
  return body || { success: true };
}

export async function flushOutbox(db) {
  if (!bridgeConfigured()) return { sent: 0, pending: true, configured: false };
  const rows = await db.all("SELECT * FROM module_outbox WHERE status = 'pending' ORDER BY created_at ASC LIMIT 20");
  let sent = 0;
  for (const row of rows) {
    try {
      await sendToReception(row.event_type, { event_id: row.id, ...JSON.parse(row.payload_json) });
      await db.run("UPDATE module_outbox SET status = 'sent', sent_at = CURRENT_TIMESTAMP, last_error = NULL WHERE id = ?", [row.id]);
      sent += 1;
    } catch (error) {
      await db.run('UPDATE module_outbox SET attempts = attempts + 1, last_error = ? WHERE id = ?', [String(error.message || error).slice(0, 500), row.id]);
    }
  }
  return { sent, pending: rows.length - sent, configured: true };
}

async function enqueue(db, eventType, payload) {
  await ensureOutbox(db);
  const sourceId = String(payload.source_id || payload.requestId || payload.request_id || '').trim();
  if (!sourceId) return { queued: false, reason: 'source_id_missing' };
  const eventId = String(payload.event_id || `${eventType}:${sourceId}:${payload.status || ''}:${Date.now()}`);
  await db.run('INSERT OR IGNORE INTO module_outbox (id, event_type, source_id, payload_json) VALUES (?, ?, ?, ?)', [eventId, eventType, sourceId, JSON.stringify(payload)]);
  const flush = await flushOutbox(db);
  return { queued: true, event_id: eventId, ...flush };
}

function requestPayload(data = {}) {
  return {
    source_id: data.requestId || data.request_id,
    type: data.type || (data.requestId ? 'order' : null),
    target_identifier: data.targetIdentifier || data.target_identifier,
    status: data.status || 'pending',
    total_amount: Number(data.amount ?? data.total_amount ?? 0),
    payment_method: data.payment_method || null,
    details: data.details || null,
    departments: data.departments || [],
    created_by: data.createdBy || data.created_by || 'Restaurant / Kitchen'
  };
}

export function registerReceptionBridge({ eventBus, getDb }) {
  if (!eventBus || !getDb) return;
  const queueFromEvent = (eventType, data) => getDb(data?.tenantId || process.env.MODULE_DEFAULT_TENANT || 'restaurant_kitchen').then(db => enqueue(db, eventType, requestPayload(data))).catch(error => {
    console.error(`[restaurant→reception] ${eventType}:`, error.message);
    return { queued: false, error: error.message };
  });
  eventBus.on('dining_request_created', data => queueFromEvent(data?.type === 'order' ? 'order_created' : 'request_created', data));
  eventBus.on('dining_request_updated', data => queueFromEvent(data?.type === 'order' ? 'order_updated' : 'request_updated', data));
  eventBus.on('room_charge_request', data => queueFromEvent('charge', data));
  eventBus.on('room_charge_reversal_request', data => queueFromEvent('reversal', data));
  eventBus.on('room_charge_adjustment_request', data => queueFromEvent('adjustment', data));
  eventBus.on('order_delivered_to_room', data => queueFromEvent('order_delivered', data));
}

export async function getBridgeOutboxSummary(db) {
  await ensureOutbox(db);
  const [pending, failed, sent] = await Promise.all([
    db.get("SELECT COUNT(*) AS count FROM module_outbox WHERE status = 'pending'"),
    db.get("SELECT COUNT(*) AS count FROM module_outbox WHERE status = 'pending' AND attempts > 0"),
    db.get("SELECT COUNT(*) AS count FROM module_outbox WHERE status = 'sent'")
  ]);
  return { configured: bridgeConfigured(), pending: Number(pending?.count || 0), failed: Number(failed?.count || 0), sent: Number(sent?.count || 0) };
}
