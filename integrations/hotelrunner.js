const API_BASE_URL = 'https://app.hotelrunner.com/api/v2/apps'
const DEFAULT_TIMEOUT_MS = 12000
const DEFAULT_MAX_RETRIES = 2
const DEFAULT_RETRY_BASE_MS = 750
const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504])
const CANCEL_REASONS = new Set(['customer', 'no_room', 'no_show', 'invalid_price'])

export class HotelRunnerError extends Error {
  constructor(message, { code, status = null, retryable = false, details = null, cause } = {}) {
    super(message, cause ? { cause } : undefined)
    this.name = 'HotelRunnerError'
    this.code = code || 'HOTELRUNNER_ERROR'
    this.status = status
    this.retryable = retryable
    this.details = details
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      status: this.status,
      retryable: this.retryable,
      details: this.details
    }
  }
}

export function getHotelRunnerConfigurationStatus(env = process.env) {
  const missing = []
  if (!cleanCredential(env.HOTELRUNNER_TOKEN)) missing.push('HOTELRUNNER_TOKEN')
  if (!cleanCredential(env.HOTELRUNNER_HR_ID)) missing.push('HOTELRUNNER_HR_ID')
  return Object.freeze({ configured: missing.length === 0, missing: Object.freeze(missing) })
}

export function createHotelRunnerClient(options = {}) {
  assertServerRuntime()
  const env = options.env || process.env
  const token = cleanCredential(env.HOTELRUNNER_TOKEN)
  const hrId = cleanCredential(env.HOTELRUNNER_HR_ID)
  const missing = getHotelRunnerConfigurationStatus(env).missing
  if (missing.length) {
    throw new HotelRunnerError('HotelRunner server credentials are not configured', {
      code: 'HOTELRUNNER_NOT_CONFIGURED',
      details: { missing: [...missing] }
    })
  }

  const fetchImpl = options.fetchImpl || globalThis.fetch
  if (typeof fetchImpl !== 'function') {
    throw new HotelRunnerError('A server-side fetch implementation is required', {
      code: 'HOTELRUNNER_FETCH_UNAVAILABLE'
    })
  }

  const timeoutMs = boundedInteger(options.timeoutMs ?? env.HOTELRUNNER_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, 1000, 60000, 'timeoutMs')
  const maxRetries = boundedInteger(options.maxRetries ?? env.HOTELRUNNER_MAX_RETRIES, DEFAULT_MAX_RETRIES, 0, 4, 'maxRetries')
  const retryBaseMs = boundedInteger(options.retryBaseMs, DEFAULT_RETRY_BASE_MS, 10, 10000, 'retryBaseMs')
  const onEvent = typeof options.onEvent === 'function' ? options.onEvent : null
  const sleep = typeof options.sleep === 'function' ? options.sleep : delay

  const request = createRequestTransport({ token, hrId, fetchImpl, timeoutMs, maxRetries, retryBaseMs, onEvent, sleep })

  return Object.freeze({
    retrieveReservations: params => retrieveReservations(request, params),
    confirmReservationDelivery: params => confirmReservationDelivery(request, params),
    updateReservationState: params => updateReservationState(request, params),
    getRooms: () => request('get_rooms', { path: '/rooms' }),
    getChannels: () => request('get_channels', { path: '/infos/channels' }),
    getConnectedChannels: () => request('get_connected_channels', { path: '/infos/connected_channels' }),
    updateRoomDateRange: params => updateRoomDateRange(request, params),
    updateRoomsDaily: params => updateRoomsDaily(request, params),
    getTransactionDetails: transactionId => getTransactionDetails(request, transactionId)
  })
}

function createRequestTransport({ token, hrId, fetchImpl, timeoutMs, maxRetries, retryBaseMs, onEvent, sleep }) {
  const secrets = [token, hrId]

  return async function request(operation, { path, method = 'GET', query = {}, body } = {}) {
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const startedAt = Date.now()
      emit(onEvent, 'request_started', { operation, attempt: attempt + 1 })
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)

      try {
        const url = buildUrl(path, token, hrId, query)
        const response = await fetchImpl(url, {
          method,
          headers: {
            accept: 'application/json',
            'cache-control': 'no-cache',
            ...(body === undefined ? {} : { 'content-type': 'application/json' })
          },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: controller.signal
        })
        const raw = await response.text()
        const payload = parsePayload(raw, response.status, secrets)

        if (!response.ok) {
          const retryable = RETRYABLE_STATUSES.has(response.status)
          if (retryable && attempt < maxRetries) {
            emit(onEvent, 'request_retry', {
              operation,
              attempt: attempt + 1,
              status: response.status,
              durationMs: Date.now() - startedAt
            })
            await sleep(retryDelay(response.headers.get('retry-after'), attempt, retryBaseMs))
            continue
          }
          const provider = providerError(payload, secrets)
          throw new HotelRunnerError('HotelRunner rejected the request', {
            code: response.status === 429 ? 'HOTELRUNNER_RATE_LIMITED' : 'HOTELRUNNER_HTTP_ERROR',
            status: response.status,
            retryable,
            details: provider
          })
        }

        if (payload && typeof payload === 'object' && String(payload.status || '').toLowerCase() === 'error') {
          throw new HotelRunnerError('HotelRunner could not complete the operation', {
            code: 'HOTELRUNNER_PROVIDER_ERROR',
            status: response.status,
            retryable: false,
            details: providerError(payload, secrets)
          })
        }

        emit(onEvent, 'request_succeeded', {
          operation,
          attempt: attempt + 1,
          status: response.status,
          durationMs: Date.now() - startedAt
        })
        return payload
      } catch (error) {
        if (error instanceof HotelRunnerError) {
          if (error.retryable && attempt < maxRetries) {
            emit(onEvent, 'request_retry', {
              operation,
              attempt: attempt + 1,
              status: error.status,
              code: error.code,
              durationMs: Date.now() - startedAt
            })
            await sleep(retryDelay(null, attempt, retryBaseMs))
            continue
          }
          emit(onEvent, 'request_failed', {
            operation,
            attempt: attempt + 1,
            status: error.status,
            code: error.code,
            retryable: error.retryable,
            durationMs: Date.now() - startedAt
          })
          throw error
        }

        const timedOut = controller.signal.aborted || error?.name === 'AbortError'
        if (attempt < maxRetries) {
          emit(onEvent, 'request_retry', {
            operation,
            attempt: attempt + 1,
            status: null,
            code: timedOut ? 'HOTELRUNNER_TIMEOUT' : 'HOTELRUNNER_NETWORK_ERROR',
            durationMs: Date.now() - startedAt
          })
          await sleep(retryDelay(null, attempt, retryBaseMs))
          continue
        }

        const wrapped = new HotelRunnerError(timedOut ? 'HotelRunner request timed out' : 'HotelRunner is unreachable', {
          code: timedOut ? 'HOTELRUNNER_TIMEOUT' : 'HOTELRUNNER_NETWORK_ERROR',
          retryable: true
        })
        emit(onEvent, 'request_failed', {
          operation,
          attempt: attempt + 1,
          status: null,
          code: wrapped.code,
          retryable: true,
          durationMs: Date.now() - startedAt
        })
        throw wrapped
      } finally {
        clearTimeout(timer)
      }
    }

    throw new HotelRunnerError('HotelRunner request failed', { code: 'HOTELRUNNER_REQUEST_FAILED' })
  }
}

function retrieveReservations(request, params = {}) {
  const query = {}
  setDate(query, 'from_date', params.fromDate)
  setDate(query, 'from_last_update_date', params.fromLastUpdateDate)
  setPositiveInteger(query, 'per_page', params.perPage)
  setPositiveInteger(query, 'page', params.page)
  setOptionalString(query, 'reservation_number', params.reservationNumber, 160)
  setBoolean(query, 'undelivered', params.undelivered)
  setBoolean(query, 'modified', params.modified)
  setBoolean(query, 'booked', params.booked)
  return request('retrieve_reservations', { path: '/reservations', query })
}

function confirmReservationDelivery(request, params = {}) {
  const query = {}
  setRequiredString(query, 'message_uid', params.messageUid, 256)
  setOptionalString(query, 'pms_number', params.pmsNumber, 160)
  return request('confirm_reservation_delivery', {
    path: '/reservations/~',
    method: 'PUT',
    query
  })
}

function updateReservationState(request, params = {}) {
  const query = {}
  setRequiredString(query, 'hr_number', params.hrNumber, 160)
  const event = String(params.event || '').trim().toLowerCase()
  if (!['confirm', 'cancel'].includes(event)) {
    throw validationError('event must be confirm or cancel', 'event')
  }
  query.event = event
  if (event === 'cancel') {
    const cancelReason = String(params.cancelReason || '').trim().toLowerCase()
    if (!CANCEL_REASONS.has(cancelReason)) {
      throw validationError('cancelReason must be customer, no_room, no_show or invalid_price', 'cancelReason')
    }
    query.cancel_reason = cancelReason
  }
  return request('update_reservation_state', {
    path: '/reservations/fire',
    method: 'PUT',
    query
  })
}

function updateRoomDateRange(request, params = {}) {
  const query = {}
  setRoomCode(query, params)
  setDate(query, 'start_date', params.startDate, true)
  setDate(query, 'end_date', params.endDate, true)
  assertDateOrder(params.startDate, params.endDate)
  setRoomMutationFields(query, params)
  setIntegerArray(query, 'days', params.days, 0, 6)
  setStringArray(query, 'channel_codes', params.channelCodes, 100)
  assertMutation(query, ['availability', 'price', 'stop_sale', 'cta', 'ctd', 'min_stay', 'max_stay'])
  return request('update_room_date_range', {
    path: '/rooms/~',
    method: 'PUT',
    query
  })
}

function updateRoomsDaily(request, params = {}) {
  if (!Array.isArray(params.rooms) || params.rooms.length === 0) {
    throw validationError('rooms must be a non-empty array', 'rooms')
  }
  if (params.rooms.length > 100) {
    throw validationError('rooms cannot contain more than 100 entries', 'rooms')
  }

  const rooms = params.rooms.map((room, roomIndex) => {
    if (!room || typeof room !== 'object') {
      throw validationError('each room must be an object', `rooms[${roomIndex}]`)
    }
    const output = {}
    setRoomCode(output, room, `rooms[${roomIndex}]`)
    setStringArray(output, 'channel_codes', room.channelCodes, 100, `rooms[${roomIndex}].channelCodes`)
    if (!Array.isArray(room.dates) || room.dates.length === 0 || room.dates.length > 90) {
      throw validationError('dates must contain between 1 and 90 entries', `rooms[${roomIndex}].dates`)
    }
    const seenDates = new Set()
    output.dates = room.dates.map((entry, dateIndex) => {
      if (!entry || typeof entry !== 'object') {
        throw validationError('each date entry must be an object', `rooms[${roomIndex}].dates[${dateIndex}]`)
      }
      const dateOutput = {}
      setDate(dateOutput, 'date', entry.date, true)
      if (seenDates.has(dateOutput.date)) {
        throw validationError('duplicate dates are not allowed for a room', `rooms[${roomIndex}].dates[${dateIndex}].date`)
      }
      seenDates.add(dateOutput.date)
      setRoomMutationFields(dateOutput, entry)
      assertMutation(dateOutput, ['availability', 'price', 'stop_sale', 'cta', 'ctd', 'min_stay', 'max_stay'], `rooms[${roomIndex}].dates[${dateIndex}]`)
      return dateOutput
    })
    return output
  })

  return request('update_rooms_daily', {
    path: '/rooms/daily',
    method: 'PUT',
    body: { rooms }
  })
}

function getTransactionDetails(request, transactionId) {
  const query = {}
  setRequiredString(query, 'transaction_id', transactionId, 160)
  return request('get_transaction_details', {
    path: '/infos/transaction_details',
    query
  })
}

function buildUrl(path, token, hrId, query) {
  if (!/^\/[a-z0-9_~/-]+$/i.test(path)) {
    throw validationError('Invalid HotelRunner API path', 'path')
  }
  const url = new URL(`${API_BASE_URL}${path}`)
  url.searchParams.set('token', token)
  url.searchParams.set('hr_id', hrId)
  for (const [key, value] of Object.entries(query || {})) {
    if (Array.isArray(value)) {
      value.forEach(item => url.searchParams.append(`${key}[]`, String(item)))
    } else if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value))
    }
  }
  return url
}

function setRoomCode(target, source, prefix = '') {
  const invCode = optionalText(source.invCode, 160, prefix ? `${prefix}.invCode` : 'invCode')
  const rateCode = optionalText(source.rateCode, 160, prefix ? `${prefix}.rateCode` : 'rateCode')
  if (!invCode && !rateCode) {
    throw validationError('invCode or rateCode is required', prefix || 'room')
  }
  if (invCode) target.inv_code = invCode
  else target.rate_code = rateCode
}

function setRoomMutationFields(target, source) {
  setNonNegativeInteger(target, 'availability', source.availability)
  setDecimal(target, 'price', source.price)
  setFlag(target, 'stop_sale', source.stopSale)
  setFlag(target, 'cta', source.cta)
  setFlag(target, 'ctd', source.ctd)
  setPositiveInteger(target, 'min_stay', source.minStay)
  setPositiveInteger(target, 'max_stay', source.maxStay)
}

function assertMutation(target, keys, field = 'update') {
  if (!keys.some(key => target[key] !== undefined)) {
    throw validationError('At least one inventory, price or restriction field is required', field)
  }
}

function setDate(target, key, value, required = false) {
  if (value === undefined || value === null || value === '') {
    if (required) throw validationError(`${key} is required`, key)
    return
  }
  const text = String(value).trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(`${text}T00:00:00Z`))) {
    throw validationError(`${key} must use YYYY-MM-DD format`, key)
  }
  const parsed = new Date(`${text}T00:00:00Z`).toISOString().slice(0, 10)
  if (parsed !== text) throw validationError(`${key} is not a valid calendar date`, key)
  target[key] = text
}

function assertDateOrder(startDate, endDate) {
  if (String(startDate) > String(endDate)) {
    throw validationError('startDate cannot be after endDate', 'dateRange')
  }
}

function setRequiredString(target, key, value, maxLength) {
  const text = optionalText(value, maxLength, key)
  if (!text) throw validationError(`${key} is required`, key)
  target[key] = text
}

function setOptionalString(target, key, value, maxLength) {
  const text = optionalText(value, maxLength, key)
  if (text) target[key] = text
}

function optionalText(value, maxLength, field) {
  if (value === undefined || value === null || value === '') return ''
  const text = String(value).trim()
  if (!text || text.length > maxLength || /[\u0000-\u001f\u007f]/.test(text)) {
    throw validationError(`${field} is invalid`, field)
  }
  return text
}

function setBoolean(target, key, value) {
  if (value === undefined || value === null) return
  if (typeof value !== 'boolean') throw validationError(`${key} must be boolean`, key)
  target[key] = value ? 'true' : 'false'
}

function setFlag(target, key, value) {
  if (value === undefined || value === null) return
  if (value === true || value === 1 || value === '1') target[key] = '1'
  else if (value === false || value === 0 || value === '0') target[key] = '0'
  else throw validationError(`${key} must be boolean, 0 or 1`, key)
}

function setPositiveInteger(target, key, value) {
  if (value === undefined || value === null || value === '') return
  const number = Number(value)
  if (!Number.isInteger(number) || number < 1) throw validationError(`${key} must be a positive integer`, key)
  target[key] = String(number)
}

function setNonNegativeInteger(target, key, value) {
  if (value === undefined || value === null || value === '') return
  const number = Number(value)
  if (!Number.isInteger(number) || number < 0) throw validationError(`${key} must be a non-negative integer`, key)
  target[key] = String(number)
}

function setDecimal(target, key, value) {
  if (value === undefined || value === null || value === '') return
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0) throw validationError(`${key} must be a non-negative number`, key)
  target[key] = String(number)
}

function setIntegerArray(target, key, values, min, max) {
  if (values === undefined || values === null) return
  if (!Array.isArray(values) || values.length === 0) throw validationError(`${key} must be a non-empty array`, key)
  const normalized = [...new Set(values.map(value => Number(value)))]
  if (normalized.some(value => !Number.isInteger(value) || value < min || value > max)) {
    throw validationError(`${key} contains an invalid value`, key)
  }
  target[key] = normalized
}

function setStringArray(target, key, values, maxItems, field = key) {
  if (values === undefined || values === null) return
  if (!Array.isArray(values) || values.length === 0 || values.length > maxItems) {
    throw validationError(`${field} must be a non-empty array`, field)
  }
  const normalized = [...new Set(values.map(value => optionalText(value, 160, field)))]
  if (normalized.some(value => !value)) throw validationError(`${field} contains an invalid value`, field)
  target[key] = normalized
}

function boundedInteger(value, fallback, min, max, field) {
  if (value === undefined || value === null || value === '') return fallback
  const number = Number(value)
  if (!Number.isInteger(number) || number < min || number > max) {
    throw validationError(`${field} must be between ${min} and ${max}`, field)
  }
  return number
}

function cleanCredential(value) {
  if (typeof value !== 'string') return ''
  const text = value.trim()
  if (!text || text.length > 512 || /[\u0000-\u001f\u007f]/.test(text)) return ''
  return text
}

function parsePayload(raw, status, secrets) {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    throw new HotelRunnerError('HotelRunner returned an invalid response', {
      code: 'HOTELRUNNER_INVALID_RESPONSE',
      status,
      retryable: status >= 500,
      details: { responseType: 'non_json', preview: redactText(raw.slice(0, 160), secrets) }
    })
  }
}

function providerError(payload, secrets) {
  if (!payload || typeof payload !== 'object') return null
  const details = {}
  if (payload.status !== undefined) details.providerStatus = redactText(String(payload.status), secrets)
  if (payload.code !== undefined) details.providerCode = redactText(String(payload.code), secrets)
  if (payload.message !== undefined) details.providerMessage = redactText(String(payload.message), secrets)
  if (payload.error !== undefined) details.providerError = redactText(String(payload.error), secrets)
  if (Array.isArray(payload.errors)) details.providerErrors = sanitizeErrorArray(payload.errors, secrets)
  return Object.keys(details).length ? details : null
}

function sanitizeErrorArray(errors, secrets) {
  return errors.slice(0, 25).map(item => sanitizeErrorValue(item, secrets, 0))
}

function sanitizeErrorValue(value, secrets, depth) {
  if (depth > 4) return '[TRUNCATED]'
  if (typeof value === 'string') return redactText(value, secrets)
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return value
  if (Array.isArray(value)) return value.slice(0, 25).map(item => sanitizeErrorValue(item, secrets, depth + 1))
  if (value && typeof value === 'object') {
    const output = {}
    for (const [key, item] of Object.entries(value).slice(0, 25)) {
      if (/token|hr.?id|password|secret|authorization|cookie/i.test(key)) output[key] = '[REDACTED]'
      else output[key] = sanitizeErrorValue(item, secrets, depth + 1)
    }
    return output
  }
  return String(value)
}

function redactText(value, secrets) {
  let text = String(value).slice(0, 1000)
  for (const secret of secrets) {
    if (secret) text = text.split(secret).join('[REDACTED]')
  }
  return text
    .replace(/([?&](?:token|hr_id)=)[^&\s]+/gi, '$1[REDACTED]')
    .replace(/\b(?:token|hr_id)\s*[:=]\s*[^,\s}]+/gi, match => match.replace(/([:=]\s*).+$/, '$1[REDACTED]'))
}

function retryDelay(retryAfter, attempt, retryBaseMs) {
  if (retryAfter) {
    const seconds = Number(retryAfter)
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 60000)
    const at = Date.parse(retryAfter)
    if (!Number.isNaN(at)) return Math.min(Math.max(at - Date.now(), 0), 60000)
  }
  const exponential = retryBaseMs * (2 ** attempt)
  return Math.min(exponential + Math.floor(Math.random() * Math.max(1, retryBaseMs / 4)), 15000)
}

function emit(onEvent, event, details) {
  if (!onEvent) return
  try {
    onEvent(Object.freeze({ integration: 'hotelrunner', event, ...details }))
  } catch {
    return
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function validationError(message, field) {
  return new HotelRunnerError(message, {
    code: 'HOTELRUNNER_VALIDATION_ERROR',
    details: { field }
  })
}

function assertServerRuntime() {
  if (typeof window !== 'undefined' || typeof document !== 'undefined') {
    throw new HotelRunnerError('HotelRunner integration is server-side only', {
      code: 'HOTELRUNNER_SERVER_ONLY'
    })
  }
}
