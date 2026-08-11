const terminalStatuses = new Set(['completed', 'delivered', 'rejected', 'cancelled']);
let knownRequestIds = null;
let requestNotificationTimer = null;

export function startRequestNotifications({ surface = 'staff' } = {}) {
  if (requestNotificationTimer) return;
  requestNotificationTimer = setInterval(() => pollIncomingRequests(surface), 3000);
  pollIncomingRequests(surface);
}

async function pollIncomingRequests(surface) {
  try {
    const params = new URLSearchParams(window.location.search);
    const tenantId = params.get('tenant_id') || 'aeon';
    const response = await fetch(`/api/requests?tenant_id=${encodeURIComponent(tenantId)}`, { cache: 'no-store' });
    if (!response.ok) return;
    const requests = await response.json();
    const activeRequests = requests.filter(request => !terminalStatuses.has(String(request.status || '').toLowerCase()));

    if (knownRequestIds === null) {
      knownRequestIds = new Set(requests.map(request => request.id));
      return;
    }

    activeRequests
      .filter(request => !knownRequestIds.has(request.id))
      .forEach(request => showRequestNotification(request, surface));
    knownRequestIds = new Set([...knownRequestIds, ...activeRequests.map(request => request.id)]);
  } catch (error) {
    console.warn('Request notification polling failed:', error);
  }
}

function showRequestNotification(request, surface) {
  const message = formatRequestMessage(request);
  const title = request.type === 'order' ? 'Yeni Sipariş' : 'Yeni Misafir Talebi';
  const container = getNotificationContainer(surface);
  const card = document.createElement('article');
  card.className = 'request-notification-card';
  card.dataset.requestId = request.id;

  const titleEl = document.createElement('div');
  titleEl.className = 'request-notification-title';
  titleEl.textContent = title;

  const targetEl = document.createElement('div');
  targetEl.className = 'request-notification-target';
  targetEl.textContent = request.target_identifier || 'Genel Talep';

  const bodyEl = document.createElement('div');
  bodyEl.className = 'request-notification-body';
  bodyEl.textContent = message;

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'request-notification-close';
  closeButton.setAttribute('aria-label', 'Bildirimi kapat');
  closeButton.innerHTML = '<i class="fa-solid fa-xmark"></i> Kapat';
  closeButton.addEventListener('click', () => card.remove());

  const actionRow = document.createElement('div');
  actionRow.className = 'request-notification-actions';
  actionRow.append(titleEl, closeButton);
  card.append(actionRow, targetEl, bodyEl);

  if (request.total_amount) {
    const amountEl = document.createElement('div');
    amountEl.className = 'request-notification-amount';
    amountEl.textContent = `${Number(request.total_amount).toLocaleString('tr-TR')} TL`;
    card.appendChild(amountEl);
  }

  container.appendChild(card);
  playRequestSound();

  if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
    new Notification(title, {
      body: `${request.target_identifier || 'Genel Talep'} - ${message}`,
      tag: `request-${request.id}`,
      requireInteraction: true
    });
  }
}

function getNotificationContainer(surface) {
  const id = `request-notifications-${surface}`;
  let container = document.getElementById(id);
  if (container) return container;
  container = document.createElement('section');
  container.id = id;
  container.className = 'request-notification-container';
  container.setAttribute('aria-live', 'assertive');
  document.body.appendChild(container);
  return container;
}

function formatRequestMessage(request) {
  if (request.type === 'order') {
    try {
      const details = Array.isArray(request.details) ? request.details : JSON.parse(request.details || '[]');
      return details.map(item => `${item.quantity || 1}x ${item.name || 'Ürün'}`).join(', ');
    } catch (error) {
      return 'Sipariş detayı alınamadı';
    }
  }
  if (request.details && typeof request.details === 'string') return request.details;
  return request.type || 'Yeni talep';
}

function playRequestSound() {
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
    gain.gain.setValueAtTime(0.18, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.45);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.45);
  } catch (error) {
    console.warn('Request notification sound unavailable:', error);
  }
}
