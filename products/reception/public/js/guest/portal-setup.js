import { cart, portalMode, trackedOrderIds, setActiveTarget, setPortalMode, setTrackedOrderIds } from './portal-state.js';
import { confirmGuestRequest, renderRoomServiceCatalog } from './requests.js';
import { loadMenuData, submitOrder, clearCart, closeItemDetailModal, updateCartFooter } from './menu.js';
import { loadGuestOrderTracker, startGuestOrderPolling, loadTrackedGuestOrders } from './tracker.js';
import { loadFolioData } from './folio.js';

export async function setupGuestPortal(target, mode = '') {
  setPortalMode(mode);
  const resolvedTarget = await setupTargetSelector(target, mode);
  target = resolvedTarget;
  setActiveTarget(target);
  setTrackedOrderIds(loadTrackedGuestOrders());
  
  const badge = document.getElementById('guest-location-badge');
  if (badge) {
    badge.textContent = target;
    if (target.startsWith('Room-')) {
      badge.className = 'room-badge occupied';
    } else {
      badge.className = 'room-badge clean';
    }
  }

  const welcomeTitle = document.getElementById('welcome-title');
  if (welcomeTitle) {
    welcomeTitle.textContent = target.startsWith('Room-') ? `Oda ${target.replace('Room-', '')}` : `${target.replace('Table-', '')} Restoran Menüsü`;
  }

  // Hide/Show sections based on Room vs Table
  const folioSec = document.getElementById('guest-folio-section');
  const roomServicesSec = document.getElementById('guest-room-services-section');
  const btnClean = document.getElementById('btn-guest-request-clean');
  const btnBill = document.getElementById('btn-guest-call-bill');
  const btnWaiter = document.getElementById('btn-guest-call-service');

  if (target.startsWith('Room-')) {
    if (folioSec) folioSec.style.display = 'block';
    if (roomServicesSec) roomServicesSec.style.display = 'block';
    if (btnClean) btnClean.style.display = 'block';
    if (btnBill) {
      btnBill.querySelector('span').textContent = 'Folyomu Gör';
      btnBill.onclick = () => {
        const el = document.getElementById('guest-folio-section');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      };
    }
    if (btnWaiter) {
      btnWaiter.querySelector('span').textContent = 'Oda Servisi İste';
      btnWaiter.onclick = () => confirmGuestRequest('room_service_call', 'Oda servisi görevlisi çağrısı');
    }
  } else {
    if (folioSec) folioSec.style.display = 'none';
    if (roomServicesSec) roomServicesSec.style.display = 'none';
    if (btnClean) btnClean.style.display = 'none';
    if (btnWaiter) {
      btnWaiter.querySelector('span').textContent = 'Garson Çağır';
      btnWaiter.onclick = () => confirmGuestRequest('waiter_call', 'Garson çağrısı');
    }
    if (btnBill) {
      btnBill.querySelector('span').textContent = 'Hesap İste';
      btnBill.onclick = () => confirmGuestRequest('bill_call', 'Hesap talebi');
    }
  }

  if (btnClean && target.startsWith('Room-')) {
    btnClean.onclick = () => {
      confirmGuestRequest('cleaning_request', 'Oda temizliği talebi');
    };
  }

  const btnSubmit = document.getElementById('btn-guest-submit-order');
  if (btnSubmit) {
    btnSubmit.onclick = submitOrder;
  }
  const btnClearCart = document.getElementById('btn-guest-clear-cart');
  if (btnClearCart) {
    btnClearCart.onclick = clearCart;
  }
  const btnCloseModal = document.getElementById('btn-close-item-modal');
  if (btnCloseModal) {
    btnCloseModal.onclick = closeItemDetailModal;
  }
  const itemModal = document.getElementById('guest-item-modal');
  if (itemModal) {
    itemModal.onclick = (e) => {
      if (e.target === itemModal) closeItemDetailModal();
    };
  }

  renderRoomServiceCatalog();
  loadMenuData();
  loadGuestOrderTracker();
  if (trackedOrderIds.length) startGuestOrderPolling();
  if (target.startsWith('Room-')) {
    loadFolioData();
  }
}

async function setupTargetSelector(initialTarget, mode = '') {
  const select = document.getElementById('guest-target-select');
  const locked = mode === 'restaurant' || mode === 'room';
  const lockedTarget = locked ? await resolveLockedTarget(initialTarget, mode) : initialTarget;
  if (!select) {
    if (lockedTarget) return lockedTarget;
    return mode === 'room' ? 'Room-1' : 'Table-Bahçe 1';
  }

  if (select.options.length === 0) {
    let rooms = [];
    let tables = [];
    if (!locked) {
      // /api/rooms and /api/tables require a staff session and 401 for an anonymous guest;
      // /api/guest/targets is the public, PII-free equivalent for this picker.
      try {
        const targetsRes = await fetch('/api/guest/targets');
        if (targetsRes.ok) {
          const targets = await targetsRes.json();
          rooms = Array.isArray(targets.rooms) ? targets.rooms.map(number => ({ room_number: number })) : [];
          tables = Array.isArray(targets.tables) ? targets.tables : [];
        }
      } catch (err) {
        console.error('Oda/masa listesi alınamadı:', err);
      }
    }

    select.innerHTML = '';

    if (locked) {
      const opt = document.createElement('option');
      opt.value = lockedTarget || (mode === 'room' ? 'Room-1' : 'Table-Bahçe 1');
      opt.textContent = opt.value.replace('Room-', 'Oda ').replace('Table-', '');
      select.appendChild(opt);
    }

    if (rooms.length > 0 && mode !== 'restaurant') {
      const roomGroup = document.createElement('optgroup');
      roomGroup.label = 'Odalar';
      rooms.forEach(room => {
        const opt = document.createElement('option');
        opt.value = `Room-${room.room_number}`;
        opt.textContent = `Oda ${room.room_number}`;
        roomGroup.appendChild(opt);
      });
      select.appendChild(roomGroup);
    }

    if (tables.length > 0 && mode !== 'room') {
      const tableGroup = document.createElement('optgroup');
      tableGroup.label = 'Restoran';
      tables.forEach(table => {
        const opt = document.createElement('option');
        opt.value = `Table-${table.table_number}`;
        opt.textContent = `${table.table_number} (${table.section || ''})`;
        tableGroup.appendChild(opt);
      });
      select.appendChild(tableGroup);
    }

    select.onchange = () => {
      cart.length = 0;
      updateCartFooter();
      setupGuestPortal(select.value, portalMode);
    };
  }

  const values = Array.from(select.options).map(opt => opt.value);
  let fallback = 'Table-Bahçe 1';
  if (mode === 'room') fallback = values.find(v => v === 'Room-1') || values.find(v => v.startsWith('Room-')) || 'Room-1';
  if (mode === 'restaurant') fallback = values.find(v => v === 'Table-Bahçe 1') || values.find(v => v.startsWith('Table-')) || 'Table-Bahçe 1';
  if (!mode) fallback = values.find(v => v.startsWith('Table-')) || values.find(v => v.startsWith('Room-')) || 'Table-Bahçe 1';
  const resolved = values.includes(lockedTarget) ? lockedTarget : fallback;
  select.value = resolved;
  select.style.display = locked ? 'none' : 'block';
  return resolved;
}

async function resolveLockedTarget(initialTarget, mode) {
  if (!initialTarget || mode !== 'room') return initialTarget;
  const raw = initialTarget.replace(/^room_id:/, '').replace(/^Room-/, '').trim();
  try {
    const res = await fetch(`/api/guest/room-context?target=${encodeURIComponent(raw)}`);
    if (!res.ok) return initialTarget.startsWith('Room-') ? initialTarget : `Room-${raw.replace(/^r/i, '')}`;
    const payload = await res.json();
    return payload.target_identifier || `Room-${raw.replace(/^r/i, '')}`;
  } catch (err) {
    return initialTarget.startsWith('Room-') ? initialTarget : `Room-${raw.replace(/^r/i, '')}`;
  }
}
