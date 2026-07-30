let toastHost = null;

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
    const context = new AudioContext();
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

export function showOrderAlert({ title, body }) {
  const host = getToastHost();
  const card = document.createElement('article');
  card.style.cssText = 'background:#fff;border:1px solid #d8e7f2;border-left:5px solid #078fd0;border-radius:12px;padding:12px 14px;box-shadow:0 16px 42px rgba(15,37,60,.22);font:14px system-ui;color:#18324b;animation:order-alert-in .25s ease-out;';
  card.innerHTML = `<div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
    <strong style="color:#078fd0;">${title}</strong>
    <button type="button" aria-label="Kapat" style="background:none;border:none;color:#667f97;cursor:pointer;font-size:16px;line-height:1;">&times;</button>
  </div>
  <div style="margin-top:4px;">${body}</div>`;
  card.querySelector('button').addEventListener('click', () => card.remove());
  host.appendChild(card);
  playAlertSound();

  if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body, tag: `order-alert-${Date.now()}`, requireInteraction: true });
  }

  setTimeout(() => card.remove(), 30000);
}

export function notifyNewOrder(event) {
  let data = {};
  try { data = JSON.parse(event.data || '{}'); } catch (error) { data = {}; }
  const title = data.type === 'order' ? 'Yeni Sipariş' : 'Yeni Talep';
  const body = data.target_identifier || 'Genel Talep';
  showOrderAlert({ title, body });
}

if (!document.getElementById('order-alert-style')) {
  const style = document.createElement('style');
  style.id = 'order-alert-style';
  style.textContent = '@keyframes order-alert-in{from{transform:translateY(-10px);opacity:0}to{transform:translateY(0);opacity:1}}';
  document.head.appendChild(style);
}
