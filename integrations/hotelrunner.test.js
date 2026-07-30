import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createHotelRunnerClient,
  getHotelRunnerConfigurationStatus,
  HotelRunnerError
} from './hotelrunner.js'

const env = {
  HOTELRUNNER_TOKEN: 'test-token-not-real',
  HOTELRUNNER_HR_ID: 'test-property-not-real'
}

function jsonResponse(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json', ...headers }
  })
}

test('reports missing credentials without exposing values', () => {
  assert.deepEqual(getHotelRunnerConfigurationStatus({}), {
    configured: false,
    missing: ['HOTELRUNNER_TOKEN', 'HOTELRUNNER_HR_ID']
  })
  assert.throws(() => createHotelRunnerClient({ env: {}, fetchImpl: async () => jsonResponse({}) }), error => {
    assert.equal(error.code, 'HOTELRUNNER_NOT_CONFIGURED')
    assert.equal(error.message.includes('test-token'), false)
    return true
  })
})

test('retrieves undelivered reservations with official query parameters', async () => {
  let captured
  const client = createHotelRunnerClient({
    env,
    maxRetries: 0,
    fetchImpl: async (url, options) => {
      captured = { url: new URL(url), options }
      return jsonResponse({ reservations: [{ hr_number: 'R1', message_uid: 'M1' }] })
    }
  })
  const result = await client.retrieveReservations({ undelivered: true, perPage: 10, booked: true })
  assert.equal(captured.url.origin, 'https://app.hotelrunner.com')
  assert.equal(captured.url.pathname, '/api/v2/apps/reservations')
  assert.equal(captured.url.searchParams.get('token'), env.HOTELRUNNER_TOKEN)
  assert.equal(captured.url.searchParams.get('hr_id'), env.HOTELRUNNER_HR_ID)
  assert.equal(captured.url.searchParams.get('undelivered'), 'true')
  assert.equal(captured.url.searchParams.get('booked'), 'true')
  assert.equal(captured.options.method, 'GET')
  assert.equal(result.reservations[0].message_uid, 'M1')
})

test('confirms reservation delivery with PMS number', async () => {
  let captured
  const client = createHotelRunnerClient({
    env,
    maxRetries: 0,
    fetchImpl: async (url, options) => {
      captured = { url: new URL(url), options }
      return jsonResponse({ status: 'ok' })
    }
  })
  const result = await client.confirmReservationDelivery({ messageUid: 'message-1', pmsNumber: 'DOL-42' })
  assert.equal(captured.url.pathname, '/api/v2/apps/reservations/~')
  assert.equal(captured.url.searchParams.get('message_uid'), 'message-1')
  assert.equal(captured.url.searchParams.get('pms_number'), 'DOL-42')
  assert.equal(captured.options.method, 'PUT')
  assert.equal(result.status, 'ok')
})

test('sends daily inventory and rate changes as JSON', async () => {
  let captured
  const client = createHotelRunnerClient({
    env,
    maxRetries: 0,
    fetchImpl: async (url, options) => {
      captured = { url: new URL(url), options }
      return jsonResponse({ status: 'ok', transaction_id: 'TX1', errors: [] })
    }
  })
  const result = await client.updateRoomsDaily({
    rooms: [{
      invCode: 'HR:1903',
      channelCodes: ['online', 'bookingcom'],
      dates: [{ date: '2026-08-01', availability: 4, price: 4500, minStay: 2, stopSale: false }]
    }]
  })
  const body = JSON.parse(captured.options.body)
  assert.equal(captured.url.pathname, '/api/v2/apps/rooms/daily')
  assert.equal(captured.options.method, 'PUT')
  assert.equal(body.rooms[0].inv_code, 'HR:1903')
  assert.deepEqual(body.rooms[0].channel_codes, ['online', 'bookingcom'])
  assert.deepEqual(body.rooms[0].dates[0], {
    date: '2026-08-01',
    availability: '4',
    price: '4500',
    stop_sale: '0',
    min_stay: '2'
  })
  assert.equal(result.transaction_id, 'TX1')
})

test('retries transient failures and emits credential-free events', async () => {
  let calls = 0
  const events = []
  const client = createHotelRunnerClient({
    env,
    maxRetries: 1,
    retryBaseMs: 10,
    sleep: async () => {},
    onEvent: event => events.push(event),
    fetchImpl: async () => {
      calls += 1
      if (calls === 1) return jsonResponse({ status: 'error', message: 'temporary' }, 503)
      return jsonResponse({ rooms: [] })
    }
  })
  const result = await client.getRooms()
  assert.equal(calls, 2)
  assert.deepEqual(result, { rooms: [] })
  const serialized = JSON.stringify(events)
  assert.equal(serialized.includes(env.HOTELRUNNER_TOKEN), false)
  assert.equal(serialized.includes(env.HOTELRUNNER_HR_ID), false)
  assert.equal(events.some(event => event.event === 'request_retry'), true)
})

test('redacts credentials from provider errors', async () => {
  const client = createHotelRunnerClient({
    env,
    maxRetries: 0,
    fetchImpl: async () => jsonResponse({
      status: 'error',
      message: `invalid token ${env.HOTELRUNNER_TOKEN} hr_id=${env.HOTELRUNNER_HR_ID}`
    }, 401)
  })
  await assert.rejects(client.getRooms(), error => {
    assert.equal(error instanceof HotelRunnerError, true)
    const serialized = JSON.stringify(error)
    assert.equal(serialized.includes(env.HOTELRUNNER_TOKEN), false)
    assert.equal(serialized.includes(env.HOTELRUNNER_HR_ID), false)
    assert.equal(serialized.includes('[REDACTED]'), true)
    return true
  })
})

test('validates reservation state and date range inputs before network calls', async () => {
  let calls = 0
  const client = createHotelRunnerClient({
    env,
    fetchImpl: async () => {
      calls += 1
      return jsonResponse({ status: 'ok' })
    }
  })
  assert.throws(() => client.updateReservationState({ hrNumber: 'R1', event: 'cancel' }), /cancelReason/)
  assert.throws(() => client.updateRoomDateRange({
    invCode: 'HR:1',
    startDate: '2026-08-02',
    endDate: '2026-08-01',
    availability: 2
  }), /startDate/)
  assert.equal(calls, 0)
})
