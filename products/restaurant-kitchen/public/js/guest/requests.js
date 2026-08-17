import { activeTarget, targetIsRoom } from './portal-state.js';
import { showGuestNotice, showGuestConfirmation } from './notices.js';

function requestTitle(type) {
  return ({ waiter_call: 'Garson çağrısı', bill_call: 'Hesap talebi', room_service_call: 'Oda servisi çağrısı', cleaning_request: 'Oda temizliği', towel_request: 'Ekstra havlu', linen_request: 'Çarşaf / yastık', amenity_request: 'Banyo seti', maintenance_request: 'Teknik servis', water_request: 'Su talebi', transport_request: 'Transfer / taksi' })[type] || 'Misafir talebi';
}

const receptionRequestTypes = new Set(['towel_request', 'cleaning_request', 'linen_request', 'amenity_request', 'maintenance_request', 'water_request', 'transport_request']);

export async function confirmGuestRequest(type, details) {
  const confirmed = await showGuestConfirmation({
    title: requestTitle(type),
    message: `${activeTarget.replace('Room-', 'Oda ')} için bu talep ${receptionRequestTypes.has(type) ? 'doğrudan resepsiyona' : 'ilgili ekibe'} iletilecek.`
  });
  if (confirmed) await sendQuickRequest(type, details);
}

async function sendQuickRequest(type, details) {
  try {
    const res = await fetch('/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        target_identifier: activeTarget,
        details
      })
    });
    const result = await res.json().catch(() => ({}));
    if (res.ok) {
      showGuestNotice({
        title: 'Talebiniz Alındı',
        message: `${requestTitle(type)} ${result.forwardedTo === 'reception' ? 'doğrudan resepsiyona' : 'ilgili ekibe'} iletildi. Talep no: ${result.requestId || '-'}`,
        tone: 'success'
      });
    } else {
      showGuestNotice({
        title: 'İşlem Tamamlanamadı',
        message: result.error || 'Bir hata oluştu, lütfen tekrar deneyin.',
        tone: 'error'
      });
    }
  } catch (err) {
    console.error(err);
    showGuestNotice({
      title: 'Bağlantı Hatası',
      message: 'Talebiniz şu anda gönderilemedi, lütfen tekrar deneyin.',
      tone: 'error'
    });
  }
}

export function renderRoomServiceCatalog() {
  const section = document.getElementById('guest-room-services-section');
  const grid = document.getElementById('guest-room-services-grid');
  if (!section || !grid) return;

  if (!targetIsRoom()) {
    section.style.display = 'none';
    grid.innerHTML = '';
    return;
  }

  section.style.display = 'block';
  const services = [
    { icon: 'fa-broom', title: 'Oda Temizliği', type: 'cleaning_request', details: 'Oda Temizliği Talebi' },
    { icon: 'fa-bath', title: 'Temiz Havlu', type: 'towel_request', details: 'Ekstra Temiz Havlu Talebi' },
    { icon: 'fa-bed', title: 'Çarşaf / Yastık', type: 'linen_request', details: 'Ekstra Çarşaf veya Yastık Talebi' },
    { icon: 'fa-droplet', title: 'Su', type: 'water_request', details: 'Odaya Su Talebi' },
    { icon: 'fa-pump-soap', title: 'Banyo Seti', type: 'amenity_request', details: 'Şampuan, sabun veya banyo seti talebi' },
    { icon: 'fa-screwdriver-wrench', title: 'Teknik Servis', type: 'maintenance_request', details: 'Oda Teknik Servis Talebi' },
    { icon: 'fa-utensils', title: 'Oda Servisi', type: 'room_service_call', details: 'Oda Servisi Görevlisi Çağrısı' },
    { icon: 'fa-car', title: 'Transfer / Taksi', type: 'transport_request', details: 'Transfer veya taksi talebi' }
  ];

  grid.innerHTML = '';
  services.forEach(service => {
    const card = document.createElement('button');
    card.className = 'aeon-card';
    card.style.minHeight = '95px';
    card.style.padding = '10px';
    card.innerHTML = `
      <i class="fa-solid ${service.icon}" style="font-size: 20px; margin-bottom: 6px;"></i>
      <span style="font-size: 12px; font-weight: 700;">${service.title}</span>
    `;
    card.onclick = () => confirmGuestRequest(service.type, service.details);
    grid.appendChild(card);
  });
}
