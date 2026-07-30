import test from 'node:test'
import assert from 'node:assert/strict'
import { rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const tenantId = `acceptance_runs_bar_hotel_${process.pid}_${Date.now()}`
const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const tenantFile = join(projectRoot, 'db', `tenant_${tenantId}_alasql.json`)

Object.assign(process.env, {
  FIREBASE_PROJECT_ID: '',
  FIREBASE_CLIENT_EMAIL: '',
  FIREBASE_PRIVATE_KEY: '',
  FIREBASE_DATABASE_URL: '',
  AEON_DISABLE_LISTEN: 'true',
  AEON_DEFAULT_TENANT: tenantId,
  AEON_TENANT_HOSTS: '',
  ENABLE_STOCK_ALGORITHM: 'true',
  INITIAL_RECEPTION_PIN: '1234',
  INITIAL_ADMIN_PIN: '9999',
  INITIAL_HOUSEKEEPING_PIN: '1111',
  INITIAL_RESTAURANT_PIN: '2222',
  INITIAL_KITCHEN_PIN: '3333',
  INITIAL_MAINTENANCE_PIN: '5555'
})

const [{ default: app }, { getDb, commitDb, hasFirebasePersistence }] = await Promise.all([
  import('../server.js'),
  import('../db.js')
])

let server
let baseUrl
let db
let managerToken
let restaurantToken
let kitchenToken
let tableRequestId
let tableKitchenTicketId

async function api(path, { method = 'GET', token, body, idempotencyKey } = {}) {
  const headers = {}
  if (body !== undefined) headers['content-type'] = 'application/json'
  if (token) headers.authorization = `Bearer ${token}`
  if (idempotencyKey) headers['idempotency-key'] = idempotencyKey
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  })
  const text = await response.text()
  let data = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }
  return { response, data }
}

function assertStatus(result, status) {
  assert.equal(result.response.status, status, JSON.stringify(result.data))
  return result.data
}

async function login(pin) {
  return assertStatus(await api('/api/auth/login', {
    method: 'POST',
    body: { pin }
  }), 200).token
}

async function seedTenant() {
  db = await getDb(tenantId)
  db.suspendSave = true
  try {
    await db.run("INSERT INTO tables (id, table_number, status, section) VALUES ('table_t1', 'T1', 'empty', 'Test')")
    await db.run("INSERT INTO inventory (id, name, unit, stock, par_level, unit_cost, module_type) VALUES ('inventory_shared_drink', 'Test İçecek Hammaddesi', 'ml', 100, 10, 1, 'bar')")
    await db.run("INSERT INTO catalog_items (id, name, price, category, module_type, in_stock, bar_category) VALUES ('food_workflow', 'Test Ana Yemek', 120, 'food', 'dining', 1, 'Yemek')")
    await db.run("INSERT INTO catalog_items (id, name, price, category, module_type, in_stock, bar_category) VALUES ('drink_shared', 'Ortak Test İçeceği', 50, 'drink', 'dining', 1, 'Test İçecekleri')")
    await db.run("INSERT INTO recipes (id, catalog_item_id, inventory_id, amount_needed) VALUES ('recipe_shared_drink', 'drink_shared', 'inventory_shared_drink', 0.5)")
    await db.run("INSERT INTO kitchen_stations (id, name, sort_order, active) VALUES ('station_workflow', 'Test İstasyonu', 10, 1)")
    await db.run("INSERT INTO menu_kitchen_profiles (catalog_item_id, station_id, course, allergens, prep_minutes, active) VALUES ('food_workflow', 'station_workflow', 'main', '', 10, 1)")
    await db.run("INSERT INTO rooms (id, room_number, status, guest_name, room_type) VALUES ('room_101', '101', 'occupied', 'Test Misafiri', 'standard')")
    await db.run("INSERT INTO guest_profiles (id, first_name, last_name, phone) VALUES ('guest_101', 'Test', 'Misafiri', '5550000000')")
    await db.run("INSERT INTO reservations (id, reservation_number, status, arrival_date, departure_date, nights, room_id, main_guest_id, total_amount) VALUES ('reservation_101', 'RES-TEST-101', 'checked_in', '2026-07-26', '2026-07-27', 1, 'room_101', 'guest_101', 1000)")
    await db.run("INSERT INTO folios (id, tenant_id, room_id, total_amount, type, status) VALUES ('folio_101', ?, 'room_101', 0, 'stay', 'open')", [tenantId])
    await db.run("INSERT INTO stays (id, reservation_id, room_id, folio_id, status, checkin_at, business_date, created_by) VALUES ('stay_101', 'reservation_101', 'room_101', 'folio_101', 'checked_in', CURRENT_TIMESTAMP, '2026-07-26', 'Test')")
  } finally {
    db.suspendSave = false
  }
  await commitDb(tenantId)
}

test.before(async () => {
  await rm(tenantFile, { force: true })
  assert.equal(hasFirebasePersistence(), false)
  await seedTenant()
  await new Promise((resolve, reject) => {
    server = app.listen(0, '127.0.0.1', resolve)
    server.once('error', reject)
  })
  const address = server.address()
  baseUrl = `http://127.0.0.1:${address.port}`
  managerToken = await login('9999')
  restaurantToken = await login('2222')
  kitchenToken = await login('3333')
})

test.after(async () => {
  if (server) await new Promise(resolve => server.close(resolve))
  await rm(tenantFile, { force: true })
})

test('ortak içecek menüsü bar panelinde kaynak modülden bağımsız görünür', async () => {
  const dashboard = assertStatus(await api('/api/bar/dashboard', { token: managerToken }), 200)
  const sharedDrink = dashboard.catalog.find(item => item.id === 'drink_shared')
  assert.ok(sharedDrink)
  assert.equal(sharedDrink.name, 'Ortak Test İçeceği')
  assert.equal(sharedDrink.category, 'drink')
  assert.equal(sharedDrink.module_type, 'dining')
  assert.equal(sharedDrink.stock_tracking_status, 'configured')
  assert.equal(dashboard.setup.table_count, 1)
  assert.equal(dashboard.setup.occupied_room_count, 1)
})

test('karma masa siparişi mutfak ve bar üretim biletlerine bir kez ayrılır', async () => {
  const body = {
    type: 'order',
    target_identifier: 'Table-T1',
    payment_method: 'cash',
    details: [
      { itemId: 'food_workflow', quantity: 1 },
      { itemId: 'drink_shared', quantity: 2 }
    ]
  }
  const first = assertStatus(await api('/api/requests', {
    method: 'POST',
    token: restaurantToken,
    idempotencyKey: 'mixed-table-order',
    body
  }), 201)
  const replay = assertStatus(await api('/api/requests', {
    method: 'POST',
    token: restaurantToken,
    idempotencyKey: 'mixed-table-order',
    body
  }), 201)
  tableRequestId = first.requestId
  assert.equal(replay.requestId, tableRequestId)
  assert.equal(first.totalAmount, 220)

  const requests = await db.all('SELECT * FROM requests WHERE id = ?', [tableRequestId])
  assert.equal(requests.length, 1)
  assert.deepEqual(JSON.parse(requests[0].departments).sort(), ['Bar', 'Kitchen', 'Restaurant'].sort())

  const kitchenTickets = assertStatus(await api('/api/kitchen/tickets', { token: kitchenToken }), 200)
  const tableKitchenTickets = kitchenTickets.filter(ticket => ticket.request_id === tableRequestId)
  assert.equal(tableKitchenTickets.length, 1)
  assert.equal(tableKitchenTickets[0].catalog_item_id, 'food_workflow')
  assert.equal(tableKitchenTickets[0].quantity, 1)
  tableKitchenTicketId = tableKitchenTickets[0].id

  const barDashboard = assertStatus(await api('/api/bar/dashboard', { token: managerToken }), 200)
  const barOrder = barDashboard.orders.find(order => order.id === tableRequestId)
  assert.ok(barOrder)
  const barLines = JSON.parse(barOrder.details)
  assert.deepEqual(barLines.map(line => [line.itemId, line.quantity]), [['drink_shared', 2]])

  const barTicketCount = await db.get('SELECT COUNT(*) AS cnt FROM bar_ticket_lines WHERE request_id = ?', [tableRequestId])
  const kitchenTicketCount = await db.get('SELECT COUNT(*) AS cnt FROM kitchen_ticket_lines WHERE request_id = ?', [tableRequestId])
  const printJobs = await db.all("SELECT * FROM print_jobs WHERE request_id = ? ORDER BY station", [tableRequestId])
  const table = await db.get("SELECT status FROM tables WHERE table_number = 'T1'")
  const inventory = await db.get("SELECT stock FROM inventory WHERE id = 'inventory_shared_drink'")
  assert.equal(Number(barTicketCount.cnt), 1)
  assert.equal(Number(kitchenTicketCount.cnt), 1)
  assert.equal(printJobs.length, 2)
  assert.deepEqual(printJobs.map(job => job.station), ['kitchen', 'reception'])
  for (const job of printJobs) {
    assert.deepEqual(JSON.parse(job.payload).lines.map(line => [line.name, line.quantity]), [['Test Ana Yemek', 1], ['Ortak Test İçeceği', 2]])
  }
  assert.equal(table.status, 'occupied')
  assert.ok(Math.abs(Number(inventory.stock) - 98.94) < 0.000001)
})

test('mutfak ve bar yaşam döngüsü tamamlanınca masa tek ve tekrar güvenli işlemle kapatılır', async () => {
  for (const status of ['accepted', 'preparing', 'ready', 'served']) {
    const result = assertStatus(await api(`/api/kitchen/tickets/${tableKitchenTicketId}`, {
      method: 'PATCH',
      token: kitchenToken,
      body: { status }
    }), 200)
    assert.equal(result.success, true)
  }

  for (const status of ['accepted', 'preparing', 'ready', 'served']) {
    const result = assertStatus(await api(`/api/bar/orders/${tableRequestId}/status`, {
      method: 'POST',
      token: managerToken,
      body: { status }
    }), 200)
    assert.equal(result.order.bar_status, status)
  }

  const settleBody = {
    table_number: 'T1',
    payment_method: 'cash',
    completed_by: 'Test Garson'
  }
  const settled = assertStatus(await api('/api/tables/settle', {
    method: 'POST',
    token: restaurantToken,
    idempotencyKey: 'settle-table-t1',
    body: settleBody
  }), 200)
  const replay = assertStatus(await api('/api/tables/settle', {
    method: 'POST',
    token: restaurantToken,
    idempotencyKey: 'settle-table-t1',
    body: settleBody
  }), 200)
  assert.deepEqual(replay, settled)
  assert.equal(settled.totalAmount, 220)
  assert.deepEqual(settled.requestIds, [tableRequestId])

  const request = await db.get('SELECT status, payment_method FROM requests WHERE id = ?', [tableRequestId])
  const table = await db.get("SELECT status FROM tables WHERE table_number = 'T1'")
  const kitchenTicket = await db.get('SELECT status FROM kitchen_ticket_lines WHERE id = ?', [tableKitchenTicketId])
  const barTicket = await db.get('SELECT status FROM bar_ticket_lines WHERE request_id = ?', [tableRequestId])
  assert.deepEqual(request, { status: 'completed', payment_method: 'cash' })
  assert.equal(table.status, 'empty')
  assert.equal(kitchenTicket.status, 'completed')
  assert.equal(barTicket.status, 'completed')
})

test('misafir QR menüsünden gelen masa siparişi mutfak yazdırma kuyruğuna ulaşır', async () => {
  const body = {
    type: 'order',
    target_identifier: 'Table-T1',
    payment_method: 'pay_at_counter',
    details: [{ itemId: 'food_workflow', quantity: 1 }]
  }
  const created = assertStatus(await api('/api/requests', {
    method: 'POST',
    idempotencyKey: 'guest-qr-table-order',
    body
  }), 201)
  const replay = assertStatus(await api('/api/requests', {
    method: 'POST',
    idempotencyKey: 'guest-qr-table-order',
    body
  }), 201)
  assert.equal(replay.requestId, created.requestId)
  const request = await db.get('SELECT created_by, target_identifier FROM requests WHERE id = ?', [created.requestId])
  const printJobs = await db.all("SELECT payload FROM print_jobs WHERE request_id = ? AND station = 'kitchen'", [created.requestId])
  assert.deepEqual(request, { created_by: 'Misafir QR', target_identifier: 'Table-T1' })
  assert.equal(printJobs.length, 1)
  assert.deepEqual(JSON.parse(printJobs[0].payload).lines.map(line => [line.name, line.quantity]), [['Test Ana Yemek', 1]])
})

test('oda hesabı siparişi folyoya bir kez yansır ve tekrar güvenli iptal net bakiyeyi sıfırlar', async () => {
  const inventoryBefore = Number((await db.get("SELECT stock FROM inventory WHERE id = 'inventory_shared_drink'")).stock)
  const orderBody = {
    type: 'order',
    target_identifier: 'Room-101',
    details: [{ itemId: 'drink_shared', quantity: 1 }]
  }
  const created = assertStatus(await api('/api/requests', {
    method: 'POST',
    idempotencyKey: 'room-charge-order',
    body: orderBody
  }), 201)
  const replay = assertStatus(await api('/api/requests', {
    method: 'POST',
    idempotencyKey: 'room-charge-order',
    body: orderBody
  }), 201)
  assert.equal(replay.requestId, created.requestId)
  assert.equal(created.payment_method, 'room_charge')
  assert.equal(created.totalAmount, 50)

  const createdRows = await db.all('SELECT * FROM requests WHERE id = ?', [created.requestId])
  const originalCharges = await db.all("SELECT * FROM folio_transactions WHERE related_reference = ?", [`restaurant-order:${created.requestId}`])
  const inventoryAfterCreate = Number((await db.get("SELECT stock FROM inventory WHERE id = 'inventory_shared_drink'")).stock)
  assert.equal(createdRows.length, 1)
  assert.equal(originalCharges.length, 1)
  assert.equal(Number(originalCharges[0].debit), 50)
  assert.equal(Number(originalCharges[0].credit), 0)
  assert.ok(Math.abs(inventoryAfterCreate - (inventoryBefore - 0.53)) < 0.000001)

  const cancelBody = {
    requestId: created.requestId,
    status: 'cancelled',
    reason: 'Test iptali'
  }
  const cancelled = assertStatus(await api('/api/requests/status', {
    method: 'POST',
    token: restaurantToken,
    idempotencyKey: 'cancel-room-charge-order',
    body: cancelBody
  }), 200)
  const cancelReplay = assertStatus(await api('/api/requests/status', {
    method: 'POST',
    token: restaurantToken,
    idempotencyKey: 'cancel-room-charge-order',
    body: cancelBody
  }), 200)
  assert.deepEqual(cancelReplay, cancelled)

  const request = await db.get('SELECT status FROM requests WHERE id = ?', [created.requestId])
  const reversalRows = await db.all("SELECT * FROM folio_transactions WHERE related_reference = ?", [`reversal:${originalCharges[0].id}`])
  const folioRows = await db.all("SELECT debit, credit FROM folio_transactions WHERE folio_id = 'folio_101'")
  const inventoryAfterCancel = Number((await db.get("SELECT stock FROM inventory WHERE id = 'inventory_shared_drink'")).stock)
  const balance = folioRows.reduce((sum, row) => sum + Number(row.debit || 0) - Number(row.credit || 0), 0)
  assert.equal(request.status, 'cancelled')
  assert.equal(reversalRows.length, 1)
  assert.equal(Number(reversalRows[0].debit), 0)
  assert.equal(Number(reversalRows[0].credit), 50)
  assert.equal(balance, 0)
  assert.ok(Math.abs(inventoryAfterCancel - inventoryBefore) < 0.000001)
})

test('bar stok girişi maliyeti ağırlıklandırır, zayiat stoktan düşer ve hareketler görünür', async () => {
  const before = await db.get("SELECT stock, unit_cost FROM inventory WHERE id = 'inventory_shared_drink'")
  const beforeStock = Number(before.stock)
  const beforeCost = Number(before.unit_cost)
  const receipt = assertStatus(await api('/api/bar/inventory/receipts', {
    method: 'POST',
    token: managerToken,
    body: { inventory_id: 'inventory_shared_drink', quantity: 40, unit_price: 3, vendor: 'Test Tedarikçi', receipt_number: 'IRS-1' }
  }), 201)
  assert.equal(receipt.stock, beforeStock + 40)
  assert.ok(Math.abs(receipt.unit_cost - ((beforeStock * beforeCost + 120) / (beforeStock + 40))) < 0.000001)
  const waste = assertStatus(await api('/api/bar/inventory/inventory_shared_drink/waste', {
    method: 'POST',
    token: managerToken,
    body: { quantity: 10, reason: 'Test zayiatı' }
  }), 200)
  assert.equal(waste.stock, beforeStock + 30)
  const dashboard = assertStatus(await api('/api/bar/dashboard', { token: managerToken }), 200)
  assert.equal(Number(dashboard.inventory.find(item => item.id === 'inventory_shared_drink').stock), beforeStock + 30)
  assert.ok(dashboard.stock_activity.some(item => item.action === 'Bar Stok Girişi'))
  assert.ok(dashboard.stock_activity.some(item => item.action === 'Bar Stok Zayiatı'))
})

test('mutfak tüm stokları tek işlemle hedef seviyeye tamamlayabilir', async () => {
  const result = assertStatus(await api('/api/inventory/fill-stock', {
    method: 'POST',
    token: kitchenToken,
    body: { target_stock: 1000 }
  }), 200)
  assert.equal(result.success, true)
  assert.ok(result.updatedCount > 0)
  const inventory = await db.all('SELECT stock FROM inventory')
  assert.ok(inventory.every(item => Number(item.stock) >= 1000))
})
