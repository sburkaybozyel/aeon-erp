import { activeTarget, trackedOrderIds, orderStatusCache, guestOrderPollTimer, setGuestOrderPollTimer } from './portal-state.js';
import { showGuestNotice } from './notices.js';

function getTrackedOrdersKey() {
  const safeTarget = activeTarget.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `guestTrackedOrders:${safeTarget}`;
}

export function loadTrackedGuestOrders() {
  try {
    return JSON.parse(localStorage.getItem(getTrackedOrdersKey()) || '[]');
  } catch (err) {
    return [];
  }
}

export function saveTrackedGuestOrders() {
  localStorage.setItem(getTrackedOrdersKey(), JSON.stringify(trackedOrderIds));
}

export function startGuestOrderPolling() {
  if (guestOrderPollTimer) return;
  setGuestOrderPollTimer(setInterval(loadGuestOrderTracker, 30000));
}

export async function loadGuestOrderTracker() {
  if (!activeTarget) return;
  const section = document.getElementById('guest-order-tracker-section');
  const list = document.getElementById('guest-order-tracker-list');
  if (!section || !list) return;

  try {
    const res = await fetch(`/api/guest/requests?target=${encodeURIComponent(activeTarget)}`);
    if (!res.ok) return;
    const requests = await res.json();
    const visibleOrders = requests
      .filter(req => req.type === 'order' && req.target_identifier === activeTarget)
      .filter(req => trackedOrderIds.includes(req.id) || req.status !== 'completed')
      .slice(0, 6);

    if (visibleOrders.length === 0) {
      section.style.display = 'none';
      list.innerHTML = '';
      return;
    }

    section.style.display = 'block';
    list.innerHTML = '';
    visibleOrders.forEach(order => {
      if (orderStatusCache[order.id] && orderStatusCache[order.id] !== order.status) {
        showGuestNotice({
          title: 'Sipariş Durumu Güncellendi',
          message: `${formatOrderStatus(order.status)}: ${formatOrderItems(order.details)}`,
          tone: order.status === 'completed' ? 'success' : 'warning'
        });
      }
      orderStatusCache[order.id] = order.status;
      list.appendChild(renderGuestOrderStatusCard(order));
    });
  } catch (err) {
    console.error(err);
  }
}

function renderGuestOrderStatusCard(order) {
  const card = document.createElement('div');
  card.className = `guest-order-status-card status-${order.status}`;
  card.innerHTML = `
    <div class="guest-order-status-top">
      <div>
        <span>${new Date(order.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        <strong>${formatOrderStatus(order.status)}</strong>
      </div>
      <em>${Number(order.total_amount || 0).toFixed(2)} TL</em>
    </div>
    <div class="guest-order-items">${formatOrderItems(order.details)}</div>
    <div class="guest-order-progress">
      ${['pending', 'preparing', 'ready', 'completed'].map(status => `<i class="${isOrderStepActive(order.status, status) ? 'active' : ''}"></i>`).join('')}
    </div>
  `;
  return card;
}

function formatOrderStatus(status) {
  const labels = {
    pending: 'Mutfağa Düştü',
    preparing: 'Hazırlanıyor',
    ready: 'Servise Hazır',
    completed: 'Teslim Edildi'
  };
  return labels[status] || status;
}

function isOrderStepActive(current, step) {
  const order = ['pending', 'preparing', 'ready', 'completed'];
  return order.indexOf(step) <= order.indexOf(current);
}

function formatOrderItems(details) {
  try {
    const items = JSON.parse(details || '[]');
    if (Array.isArray(items)) {
      return items.map(item => `${item.quantity}x ${item.name || item.itemId}`).join(', ');
    }
  } catch (err) {}
  return details || 'Sipariş';
}
