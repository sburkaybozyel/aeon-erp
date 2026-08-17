const menu = document.querySelector('#menu');
const notice = document.querySelector('#notice');
const cart = new Map();
const money = value => `${Number(value || 0).toLocaleString('tr-TR')} TL`;
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
const show = message => { notice.innerHTML = `<div class="notice">${escape(message)}</div>`; };
async function load() {
  const response = await fetch('/api/menu');
  const data = await response.json();
  menu.innerHTML = data.items.map(item => `<article class="card menu-card"><div><h3>${escape(item.name)}</h3><p class="muted">${escape(item.description)}</p><div class="price">${money(item.price)}</div></div><button class="button" data-add="${escape(item.id)}">Ekle</button></article>`).join('');
  menu.querySelectorAll('[data-add]').forEach(button => button.addEventListener('click', () => { cart.set(button.dataset.add, (cart.get(button.dataset.add) || 0) + 1); button.textContent = `Eklendi (${cart.get(button.dataset.add)})`; }));
}
document.querySelector('#submit').addEventListener('click', async () => {
  const target = document.querySelector('#target').value.trim();
  const items = [...cart.entries()].map(([id, quantity]) => ({ id, quantity }));
  if (!target || !items.length) return show('Hedef ve en az bir ürün seçin.');
  const response = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target_label: target, target_type: target.toLocaleLowerCase('tr-TR').startsWith('oda') ? 'room' : 'table', note: document.querySelector('#note').value, items }) });
  const data = await response.json();
  if (!response.ok) return show(data.error || 'Sipariş oluşturulamadı.');
  cart.clear();
  show(`Sipariş alındı. Sipariş numarası: ${data.order_id}. Toplam: ${money(data.total_amount)}`);
});
load().catch(() => show('Menü yüklenemedi.'));
