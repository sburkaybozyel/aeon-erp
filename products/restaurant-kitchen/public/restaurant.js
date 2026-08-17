const list = document.querySelector('#orders');
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
const money = value => `${Number(value || 0).toLocaleString('tr-TR')} TL`;
const next = { pending: 'accepted', accepted: 'preparing', preparing: 'ready', ready: 'delivered' };
async function load() {
  const data = await (await fetch('/api/orders')).json();
  list.innerHTML = data.orders.length ? data.orders.map(order => `<article class="card"><div class="row"><strong>${escape(order.target_label)}</strong><span class="status ${order.status === 'ready' ? 'ready' : order.status === 'cancelled' ? 'cancelled' : ''}">${escape(order.status)}</span></div><div class="muted">${escape(order.id)} · ${money(order.total_amount)}</div><div class="line">${order.items.map(item => `<div class="row"><span>${escape(item.item_name)} × ${item.quantity}</span><span>${money(item.unit_price * item.quantity)}</span></div>`).join('')}</div><div class="actions">${next[order.status] ? `<button class="button primary" data-id="${escape(order.id)}" data-status="${next[order.status]}">${next[order.status] === 'delivered' ? 'Teslim edildi' : 'İleri al'}</button>` : ''}</div></article>`).join('') : '<div class="notice">Henüz sipariş yok.</div>';
  list.querySelectorAll('[data-id]').forEach(button => button.addEventListener('click', async () => { await fetch(`/api/orders/${button.dataset.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: button.dataset.status }) }); load(); }));
}
document.querySelector('#refresh').addEventListener('click', load);
load();
setInterval(load, 8000);
