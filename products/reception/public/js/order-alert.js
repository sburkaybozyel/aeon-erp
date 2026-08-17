let toastHost = null;
let sharedAudioContext = null;

// Every other staff screen requests Notification permission itself (see push-notifications.js,
// wired up on kitchen/housekeeping/restaurant/reception/maintenance entry). The bar screen never
// called it anywhere, so Notification.permission stayed stuck on 'default' forever and the
// `Notification.permission === 'granted'` check below could never pass — background/hidden-tab
// alerts were silently dead on this screen. Request it once, up front, same as the other screens.
if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission().catch(() => {});
}

const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);

function getToastHost() {
  if (toastHost && document.body.contains(toastHost)) return toastHost;
  toastHost = document.createElement('div');
  toastHost.id = 'order-alert-host';
  toastHost.style.cssText = 'position:fixed;top:16px;right:16px;z-index:100000;display:flex;flex-direction:column;gap:10px;max-width:340px;';
  document.body.appendChild(toastHost);
  return toastHost;
}

function playAlertSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    // A new order arrives every few seconds during service, and this used to construct a brand
    // new AudioContext on every single alert without ever closing it — browsers cap the number of
    // concurrent AudioContexts (Safari especially), so a busy shift could eventually make alert
    // sounds silently stop working (and leaks audio resources the whole time). Reuse one context.
    if (!sharedAudioContext || sharedAudioContext.state === 'closed') sharedAudioContext = new AudioContext();
    const context = sharedAudioContext;
    if (context.state === 'suspended') context.resume().catch(() => {});
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.frequency.setValueAtTime(740, context.currentTime);
    oscillator.frequency.setValueAtTime(988, context.currentTime + 0.16);
    gain.gain.setValueAtTime(0.2, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.5);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.5);
  } catch (error) {
    console.warn('Order alert sound unavailable:', error);
  }
}

export function showOrderAlert({ title, body, tag }) {
  const host = getToastHost();
  const card = document.createElement('article');
  card.style.cssText = 'background:var(--glass-bg,rgba(255,255,255,.85));backdrop-filter:var(--glass-blur,blur(16px) saturate(180%));-webkit-backdrop-filter:var(--glass-blur,blur(16px) saturate(180%));border:1px solid var(--glass-border-subtle,#d8e7f2);border-left:4px solid var(--color-primary,#078fd0);border-radius:var(--radius-lg,12px);padding:12px 14px;box-shadow:var(--shadow-premium,0 16px 42px rgba(15,37,60,.22));font:14px var(--font-body,system-ui);color:var(--color-text-main,#18324b);animation:order-alert-in .25s ease-out;';
  // title/body ultimately trace back to server data (target_identifier, order type) rather than
  // a free-text field today, but treating anything reaching innerHTML as hostile is the only safe
  // default — escape both instead of trusting the shape stays that way.
  card.innerHTML = `<div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
    <strong style="color:#078fd0;">${escapeHtml(title)}</strong>
    <button type="button" aria-label="Kapat" style="background:none;border:none;color:#667f97;cursor:pointer;font-size:16px;line-height:1;">&times;</button>
  </div>
  <div style="margin-top:4px;">${escapeHtml(body)}</div>`;
  card.querySelector('button').addEventListener('click', () => card.remove());
  host.appendChild(card);
  playAlertSound();

  if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
    // Tag by order id (falling back to a fixed string) instead of Date.now() so a duplicate push
    // for the same order replaces the existing OS notification instead of stacking a second one.
    new Notification(title, { body, tag: tag ? `order-alert-${tag}` : 'order-alert', requireInteraction: true });
  }

  setTimeout(() => card.remove(), 30000);
}

export function notifyNewOrder(event) {
  let data = {};
  try { data = JSON.parse(event.data || '{}'); } catch (error) { data = {}; }
  const title = data.type === 'order' ? 'Yeni Sipariş' : 'Yeni Talep';
  const body = data.target_identifier || 'Genel Talep';
  showOrderAlert({ title, body, tag: data.id });
}

if (!document.getElementById('order-alert-style')) {
  const style = document.createElement('style');
  style.id = 'order-alert-style';
  style.textContent = '@keyframes order-alert-in{from{transform:translateY(-10px);opacity:0}to{transform:translateY(0);opacity:1}}';
  document.head.appendChild(style);
}
