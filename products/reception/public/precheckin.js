const form = document.querySelector('#form');
const notice = document.querySelector('#notice');
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
form.addEventListener('submit', async event => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form).entries());
  const response = await fetch('/api/precheckins', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  const result = await response.json();
  notice.innerHTML = `<div class="notice">${escape(response.ok ? `Bilgiler alındı. Takip numarası: ${result.id}` : result.error)}</div>`;
  if (response.ok) form.reset();
});
