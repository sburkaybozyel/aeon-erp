const list = document.querySelector('#orders');
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
const next = { pending: 'accepted', accepted: 'preparing', preparing: 'ready' };
async function load() {
  const data = await (await fetch('/api/orders')).json();
  const orders = data.orders.filter(order => !['delivered', 'cancelled'].includes(order.status));
  list.innerHTML = orders.length ? orders.map(order => `<article class="card"><div class="row"><strong>${escape(order.target_label)}</strong><span class="status ${order.status === 'ready' ? 'ready' : ''}">${escape(order.status)}</span></div><div class="muted">${escape(order.id)}</div><div class="line">${order.items.map(item => `<div><strong>${item.quantity} × ${escape(item.item_name)}</strong><div class="muted">${escape(item.note || '')}</div></div>`).join('')}</div><div class="actions">${next[order.status] ? `<button class="button primary" data-id="${escape(order.id)}" data-status="${next[order.status]}">${next[order.status] === 'ready' ? 'Hazır işaretle' : 'Hazırlamaya al'}</button>` : ''}</div></article>`).join('') : '<div class="notice">Mutfak kuyruğu boş.</div>';
  list.querySelectorAll('[data-id]').forEach(button => button.addEventListener('click', async () => { await fetch(`/api/orders/${button.dataset.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: button.dataset.status }) }); load(); }));
}
document.querySelector('#refresh').addEventListener('click', load);
load();
setInterval(load, 8000);
