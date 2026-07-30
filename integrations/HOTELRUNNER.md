# HotelRunner server integration

`hotelrunner.js` is a server-only HotelRunner Custom Apps REST API client. It does not persist credentials, expose them to browser code or place them in error/log payloads.

Required production environment variables:

- `HOTELRUNNER_TOKEN`
- `HOTELRUNNER_HR_ID`

Optional runtime controls:

- `HOTELRUNNER_TIMEOUT_MS` defaults to `12000`
- `HOTELRUNNER_MAX_RETRIES` defaults to `2`

HotelRunner must enable Custom Apps API access and reservation-delivery confirmation for the property account.

```js
import { createHotelRunnerClient } from './integrations/hotelrunner.js'

const hotelRunner = createHotelRunnerClient()
const batch = await hotelRunner.retrieveReservations({ undelivered: true, perPage: 10 })

for (const reservation of batch.reservations || []) {
  const pmsNumber = await importReservationAtomically(reservation)
  await hotelRunner.confirmReservationDelivery({
    messageUid: reservation.message_uid,
    pmsNumber
  })
}
```

Confirm delivery only after the reservation, modification or cancellation has been durably and idempotently processed by the PMS.

Public client surface:

- `retrieveReservations(params)`
- `confirmReservationDelivery(params)`
- `updateReservationState(params)`
- `getRooms()`
- `getChannels()`
- `getConnectedChannels()`
- `updateRoomDateRange(params)`
- `updateRoomsDaily(params)`
- `getTransactionDetails(transactionId)`

HotelRunner documents property limits of 250 requests per day, 5 requests per minute per property and 75 requests per minute per app. Polling must therefore run no more frequently than the provider permits, and the calling job should serialize property-level synchronization.

Run the isolated contract suite with:

```sh
node --test integrations/hotelrunner.test.js
```
