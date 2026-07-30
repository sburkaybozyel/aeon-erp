import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { getDb } from './db.js'
import { createHotelRunnerClient, getHotelRunnerConfigurationStatus } from './integrations/hotelrunner.js'

const root = path.dirname(fileURLToPath(import.meta.url))
const tenantId = `hotelrunner_test_${process.pid}_${Date.now()}`
const dbPath = path.join(root, 'db', `tenant_${tenantId}_alasql.json`)
const nativeFetch = globalThis.fetch

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' }
  })
}

async function request(baseUrl, pathname, options = {}) {
  const response = await nativeFetch(`${baseUrl}${pathname}`, {
    ...options,
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  })
  const body = response.status === 204 ? null : await response.json().catch(() => null)
  return { status: response.status, body, headers: response.headers }
}

function start(app) {
  return new Promise(resolve => {
    const server = app.listen(0, '127.0.0.1', () => {
      const address = server.address()
      resolve({ server, baseUrl: `http://127.0.0.1:${address.port}` })
    })
  })
}

function stop(server) {
  return new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
}

async function run() {
  const unconfigured = getHotelRunnerConfigurationStatus({})
  assert.equal(unconfigured.configured, false)
  assert.deepEqual([...unconfigured.missing].sort(), ['HOTELRUNNER_HR_ID', 'HOTELRUNNER_TOKEN'])

  const transportCalls = []
  const transportClient = createHotelRunnerClient({
    env: { HOTELRUNNER_TOKEN: 'test-token', HOTELRUNNER_HR_ID: 'test-property' },
    maxRetries: 0,
    fetchImpl: async (url, options) => {
      transportCalls.push({ url: String(url), options })
      return jsonResponse({ reservations: [] })
    }
  })
  await transportClient.retrieveReservations({ undelivered: true, perPage: 50 })
  assert.equal(transportCalls.length, 1)
  const transportUrl = new URL(transportCalls[0].url)
  assert.equal(transportUrl.pathname, '/api/v2/apps/reservations')
  assert.equal(transportUrl.searchParams.get('token'), 'test-token')
  assert.equal(transportUrl.searchParams.get('hr_id'), 'test-property')
  assert.equal(transportUrl.searchParams.get('undelivered'), 'true')
  assert.equal(transportUrl.searchParams.get('per_page'), '50')
  assert.equal(transportCalls[0].options.headers.authorization, undefined)

  const modulePath = path.join(root, 'modules', 'hotelrunner.js')
  assert.equal(fs.existsSync(modulePath), true, 'modules/hotelrunner.js must exist before integration tests run')
  const { initHotelRunner } = await import('./modules/hotelrunner.js')
  assert.equal(typeof initHotelRunner, 'function')

  const db = await getDb(tenantId)
  const app = express()
  app.use(express.json())
  app.use(express.urlencoded({ extended: false }))
  app.use(async (req, res, next) => {
    req.db = db
    req.tenantId = tenantId
    req.actor = { id: 'test_reception', name: 'Test Resepsiyon', role: 'Reception', department: 'Reception' }
    next()
  })

  const providerState = {
    reservations: [],
    confirmations: [],
    roomUpdates: [],
    dailyUpdates: [],
    channels: [{ code: 'booking', name: 'Booking.com', connected: true, status: 'active' }]
  }
  const providerClient = {
    retrieveReservations: async () => ({ reservations: providerState.reservations }),
    confirmReservationDelivery: async payload => {
      providerState.confirmations.push(payload)
      return { status: 'success' }
    },
    getRooms: async () => ({ rooms: [{ inv_code: 'STD', name: 'Standard Oda' }, { inv_code: 'FAM', name: 'Aile Odası' }] }),
    getChannels: async () => ({ channels: providerState.channels }),
    getConnectedChannels: async () => ({ channels: providerState.channels }),
    updateRoomDateRange: async payload => {
      providerState.roomUpdates.push(payload)
      return { status: 'success', transaction_id: `range-${providerState.roomUpdates.length}` }
    },
    updateRoomsDaily: async payload => {
      providerState.dailyUpdates.push(payload)
      return { status: 'success', transaction_id: `daily-${providerState.dailyUpdates.length}` }
    },
    getTransactionDetails: async transactionId => ({ status: 'success', transaction_id: transactionId })
  }
  const events = []
  await initHotelRunner({
    app,
    eventBus: { emit: async (name, payload) => events.push({ name, payload }) },
    createClient: () => providerClient,
    configurationStatus: () => ({ configured: true, missing: [] })
  })

  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error)
    res.status(500).json({ error: error.message })
  })

  const { server, baseUrl } = await start(app)
  try {
    const status = await request(baseUrl, '/api/integrations/hotelrunner/status')
    assert.equal(status.status, 200)
    assert.equal(status.body.configured, true)

    const connectionTest = await request(baseUrl, '/api/integrations/hotelrunner/connection/test', { method: 'POST', body: '{}' })
    assert.equal(connectionTest.status, 200)

    let room = await db.get("SELECT id, room_type FROM rooms WHERE room_type = 'standard' ORDER BY room_number LIMIT 1")
    if (!room) {
      await db.run("INSERT INTO rooms (id, room_number, room_type, status, eta) VALUES (?, ?, ?, ?, ?)", ['hotelrunner_test_room', 'T-101', 'standard', 'clean_vacant', 'Hazır'])
      room = await db.get("SELECT id, room_type FROM rooms WHERE id = ?", ['hotelrunner_test_room'])
    }
    assert.ok(room)
    const mapping = await request(baseUrl, '/api/integrations/hotelrunner/mappings', {
      method: 'POST',
      body: JSON.stringify({ mapping_type: 'room', local_id: room.id, local_room_id: room.id, local_room_type: room.room_type, external_code: 'STD', external_name: 'Standard Oda' })
    })
    assert.equal(mapping.status, 201)
    const mappings = await request(baseUrl, '/api/integrations/hotelrunner/mappings')
    assert.equal(mappings.status, 200)
    const mappingItems = Array.isArray(mappings.body) ? mappings.body : mappings.body.mappings || mappings.body.rooms || []
    assert.ok(mappingItems.some(item => item.external_inv_code === 'STD' || item.external_code === 'STD'))

    providerState.reservations = [{
      hr_number: 'HR-SINGLE-1',
      reservation_number: 'HR-SINGLE-1',
      message_uid: 'MSG-SINGLE-1',
      state: 'confirmed',
      channel: 'booking',
      checkin_date: '2027-01-10',
      checkout_date: '2027-01-12',
      currency: 'TRY',
      total: 4200,
      guest: { first_name: 'Ada', last_name: 'Lovelace', email: 'ada@example.test', phone: '+905551111111' },
      rooms: [{ hr_id: 'ROOM-SINGLE-1', inv_code: 'STD', name: 'Standard Oda', adults: 2, children: 0, total: 4200 }]
    }]
    const singleSync = await request(baseUrl, '/api/integrations/hotelrunner/sync/reservations', { method: 'POST', body: '{}' })
    assert.equal(singleSync.status, 200)
    const singleLinks = await db.all("SELECT * FROM channel_reservation_links WHERE external_reservation_id = 'HR-SINGLE-1'")
    assert.equal(singleLinks.length, 1)
    const singleReservation = await db.get('SELECT * FROM reservations WHERE id = ?', [singleLinks[0].reservation_id])
    assert.equal(singleReservation.external_provider, 'hotelrunner')
    assert.equal(singleReservation.status, 'confirmed')
    assert.equal(singleReservation.arrival_date, '2027-01-10')
    assert.equal(providerState.confirmations.some(item => item.messageUid === 'MSG-SINGLE-1' || item.message_uid === 'MSG-SINGLE-1'), true)

    const dedupeSync = await request(baseUrl, '/api/integrations/hotelrunner/sync/reservations', { method: 'POST', body: '{}' })
    assert.equal(dedupeSync.status, 200)
    const dedupedLinks = await db.all("SELECT * FROM channel_reservation_links WHERE external_reservation_id = 'HR-SINGLE-1'")
    const dedupedEvents = await db.all("SELECT * FROM channel_reservation_events WHERE message_uid = 'MSG-SINGLE-1'")
    assert.equal(dedupedLinks.length, 1)
    assert.equal(dedupedEvents.length, 1)

    providerState.reservations = [{
      hr_number: 'HR-MULTI-1',
      reservation_number: 'HR-MULTI-1',
      message_uid: 'MSG-MULTI-1',
      state: 'confirmed',
      channel: 'expedia',
      checkin_date: '2027-02-03',
      checkout_date: '2027-02-06',
      currency: 'EUR',
      total: 1200,
      guest: { first_name: 'Grace', last_name: 'Hopper', email: 'grace@example.test', phone: '+905552222222' },
      rooms: [
        { hr_id: 'ROOM-MULTI-A', inv_code: 'STD', name: 'Standard Oda', adults: 2, children: 0, total: 600 },
        { hr_id: 'ROOM-MULTI-B', inv_code: 'STD', name: 'Standard Oda', adults: 1, children: 1, total: 600 }
      ]
    }]
    const multiSync = await request(baseUrl, '/api/integrations/hotelrunner/sync/reservations', { method: 'POST', body: '{}' })
    assert.equal(multiSync.status, 200)
    const multiLinks = await db.all("SELECT * FROM channel_reservation_links WHERE external_reservation_id = 'HR-MULTI-1'")
    assert.equal(multiLinks.length, 2)
    assert.equal(new Set(multiLinks.map(item => item.reservation_id)).size, 2)

    providerState.reservations = [{
      ...providerState.reservations[0],
      message_uid: 'MSG-MULTI-CANCEL-1',
      state: 'canceled'
    }]
    const cancelSync = await request(baseUrl, '/api/integrations/hotelrunner/sync/reservations', { method: 'POST', body: '{}' })
    assert.equal(cancelSync.status, 200)
    const cancelledReservations = await db.all("SELECT status FROM reservations WHERE external_reservation_id = 'HR-MULTI-1'")
    assert.equal(cancelledReservations.length, 2)
    assert.ok(cancelledReservations.every(item => ['cancelled', 'canceled'].includes(String(item.status).toLowerCase())))

    providerState.reservations = [{
      hr_number: 'HR-UNMAPPED-1',
      reservation_number: 'HR-UNMAPPED-1',
      message_uid: 'MSG-UNMAPPED-1',
      state: 'confirmed',
      channel: 'booking',
      checkin_date: '2027-03-01',
      checkout_date: '2027-03-02',
      currency: 'TRY',
      total: 1500,
      guest: { first_name: 'Alan', last_name: 'Turing' },
      rooms: [{ hr_id: 'ROOM-UNMAPPED-1', inv_code: 'UNKNOWN', name: 'Bilinmeyen Oda', adults: 1, children: 0, total: 1500 }]
    }]
    const failureSync = await request(baseUrl, '/api/integrations/hotelrunner/sync/reservations', { method: 'POST', body: '{}' })
    assert.ok([200, 207, 409, 422].includes(failureSync.status))
    const failures = await request(baseUrl, '/api/integrations/hotelrunner/failures?status=open&limit=100')
    assert.equal(failures.status, 200)
    const failureItems = Array.isArray(failures.body) ? failures.body : failures.body.failures || failures.body.items || []
    assert.ok(failureItems.some(item => String(item.entity_reference || item.external_id || item.resource_id || '').includes('HR-UNMAPPED-1') || String(item.error_message || item.message || '').toLowerCase().includes('mapping') || String(item.error_message || item.message || '').toLocaleLowerCase('tr-TR').includes('eşle')))

    const storedUnmapped = await db.get("SELECT processing_status, error_message FROM channel_reservation_events WHERE external_reservation_id = 'HR-UNMAPPED-1'")
    assert.ok(storedUnmapped)
    assert.notEqual(storedUnmapped.processing_status, 'processed')
    assert.ok(events.length >= 1)
  } finally {
    await stop(server)
  }

  process.stdout.write('HotelRunner integration test passed\n')
}

run().catch(error => {
  process.stderr.write(`${error.stack || error.message}\n`)
  process.exitCode = 1
}).finally(() => {
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath)
})
