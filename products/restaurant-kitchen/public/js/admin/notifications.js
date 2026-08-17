import { esc } from './utils.js';

function playNotificationSound(type) {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    if (type === 'bar' || type === 'kitchen') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
      
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
      gain2.gain.setValueAtTime(0.15, ctx.currentTime + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc2.start(ctx.currentTime + 0.12);
      osc2.stop(ctx.currentTime + 0.35);
    } else if (type === 'hk') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } else if (type === 'tech') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(293.66, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    }
  } catch (e) {
    console.error("Audio Context playback failed:", e);
  }
}

function showNotificationToast(title, message, iconClass, type) {
  let container = document.getElementById('staff-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'staff-toast-container';
    container.style.position = 'fixed';
    container.style.top = '16px';
    container.style.left = '50%';
    container.style.transform = 'translateX(-50%)';
    container.style.width = 'calc(100% - 32px)';
    container.style.maxWidth = '360px';
    container.style.zIndex = '999999';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '10px';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.style.background = 'rgba(15, 23, 42, 0.95)';
  toast.style.backdropFilter = 'blur(10px)';
  toast.style.borderRadius = '14px';
  toast.style.padding = '12px 16px';
  toast.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.25)';
  
  let borderColor = 'rgba(8, 145, 178, 0.3)';
  let iconColor = 'var(--color-primary)';
  if (type === 'bar') {
    borderColor = 'rgba(245, 158, 11, 0.5)';
    iconColor = 'var(--color-accent)';
  } else if (type === 'kitchen') {
    borderColor = 'rgba(5, 150, 105, 0.5)';
    iconColor = 'var(--color-success)';
  } else if (type === 'hk') {
    borderColor = 'rgba(52, 199, 89, 0.5)';
    iconColor = '#34c759';
  } else if (type === 'tech') {
    borderColor = 'rgba(0, 180, 216, 0.5)';
    iconColor = '#00b4d8';
  }

  toast.style.border = `1px solid ${borderColor}`;
  toast.style.display = 'flex';
  toast.style.alignItems = 'center';
  toast.style.gap = '12px';
  toast.style.transition = 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)';
  toast.style.transform = 'translateY(-20px)';
  toast.style.opacity = '0';
  toast.style.textAlign = 'left';

  toast.innerHTML = `
    <div style="font-size: 20px; color: ${iconColor}; flex-shrink: 0;"><i class="fa-solid ${iconClass}"></i></div>
    <div style="flex: 1; min-width: 0;">
      <div style="font-weight: 800; font-size: 13px; color: #f8fafc; font-family: var(--font-title);">${esc(title)}</div>
      <div style="font-size: 11px; color: #94a3b8; margin-top: 2px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${esc(message)}</div>
    </div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.transform = 'translateY(0)';
    toast.style.opacity = '1';
  }, 50);

  setTimeout(() => {
    toast.style.transform = 'translateY(-20px)';
    toast.style.opacity = '0';
    setTimeout(() => {
      toast.remove();
    }, 350);
  }, 4000);
}

export function triggerRequestNotification(req, catalog) {
  let title = "Yeni Bildirim";
  let message = req.details || "";
  let type = "general";
  let icon = "fa-bell";
  
  let parsedDetails = [];
  try {
    if (req.type === 'order') {
      parsedDetails = Array.isArray(req.details) ? req.details : JSON.parse(req.details);
    }
  } catch(e) {}

  if (req.type === 'order') {
    const isDrink = parsedDetails.some(item => {
      const catItem = catalog?.find(c => c.id === item.itemId);
      return catItem && catItem.category === 'drink';
    });
    
    const itemsText = parsedDetails.map(i => `${i.name || 'Ürün'} x ${i.quantity}`).join(', ');

    if (isDrink) {
      title = "Yeni Bar Siparişi! 🍹";
      message = `${req.target_identifier}: ${itemsText}`;
      type = "bar";
      icon = "fa-glass-martini-alt";
    } else {
      title = "Yeni Mutfak Siparişi! 🍳";
      message = `${req.target_identifier}: ${itemsText}`;
      type = "kitchen";
      icon = "fa-utensils";
    }
  } else if (req.type === 'clean') {
    title = "Oda Temizlik Talebi 🧹";
    message = `${req.target_identifier} temizlik bekliyor.`;
    type = "hk";
    icon = "fa-broom";
  } else if (req.type === 'maintenance') {
    title = "Yeni Teknik Arıza Görevi 🛠️";
    message = `${req.target_identifier}: ${req.details}`;
    type = "tech";
    icon = "fa-wrench";
  } else if (req.type === 'bill') {
    title = "Masa Hesap Talebi 💳";
    message = `${req.target_identifier} hesap istiyor.`;
    type = "bar";
    icon = "fa-receipt";
  } else if (req.type === 'service') {
    const detailsLower = (req.details || "").toLowerCase();
    if (detailsLower.includes('havlu') || detailsLower.includes('towel') || detailsLower.includes('çarşaf') || detailsLower.includes('cleaning')) {
      title = "Oda Havlu/HK Talebi 🧺";
      message = `${req.target_identifier}: ${req.details}`;
      type = "hk";
      icon = "fa-soap";
    } else if (detailsLower.includes('resepsiyon') || detailsLower.includes('ön büro') || detailsLower.includes('reception')) {
      title = "Resepsiyon Talebi 🛎️";
      message = `${req.target_identifier}: ${req.details}`;
      type = "tech";
      icon = "fa-concierge-bell";
    } else {
      title = "Masa Garson Çağrısı 🔔";
      message = `${req.target_identifier} garson bekliyor.`;
      type = "bar";
      icon = "fa-bell";
    }
  }

  playNotificationSound(type);
  showNotificationToast(title, message, icon, type);
}
