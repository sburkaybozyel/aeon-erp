const rooms = document.querySelector('#rooms');
const reservations = document.querySelector('#reservations');
const notice = document.querySelector('#notice');
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
const show = message => { notice.innerHTML = `<div class="notice">${escape(message)}</div>`; };
async function load() {
  const [roomData, reservationData] = await Promise.all([fetch('/api/rooms').then(response => response.json()), fetch('/api/reservations').then(response => response.json())]);
  rooms.innerHTML = roomData.rooms.map(room => `<article class="card"><div class="row"><strong>${escape(room.room_number)}</strong><span class="status ${escape(room.status)}">${escape(room.status)}</span></div><div class="muted">${escape(room.room_type)}</div><div class="line">${escape(room.guest_name || 'Boş')}</div><div class="actions"><button class="button" data-room="${escape(room.id)}" data-status="clean_vacant">Temiz</button><button class="button" data-room="${escape(room.id)}" data-status="dirty_vacant">Kirli</button><button class="button" data-room="${escape(room.id)}" data-status="maintenance">Bakım</button></div></article>`).join('');
  reservations.innerHTML = reservationData.reservations.length ? reservationData.reservations.map(item => `<article class="card"><strong>${escape(item.guest_name)}</strong><div class="muted">Oda ${escape(item.room_number || '-')}</div><div class="line">${escape(item.arrival_date)} → ${escape(item.departure_date)}</div><span class="status">${escape(item.status)}</span></article>`).join('') : '<div class="notice">Rezervasyon yok.</div>';
  rooms.querySelectorAll('[data-room]').forEach(button => button.addEventListener('click', async () => { const response = await fetch(`/api/rooms/${button.dataset.room}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: button.dataset.status }) }); if (!response.ok) show('Oda durumu güncellenemedi.'); load(); }));
}
document.querySelector('#refresh').addEventListener('click', load);
load().catch(() => show('Resepsiyon verileri yüklenemedi.'));
setInterval(load, 10000);
