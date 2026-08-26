/**
 * SELİMİYE V2 NEXT-GEN LIQUID GLASS ENGINE
 */
document.addEventListener('DOMContentLoaded', () => {
  const header = document.getElementById('v2Header');
  if (header) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 40) header.classList.add('scrolled');
      else header.classList.remove('scrolled');
    }, { passive: true });
  }

  document.querySelectorAll('[data-book]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('concierge')?.scrollIntoView({ behavior: 'smooth' });
    });
  });

  document.querySelectorAll('[data-suite-name]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const name = e.currentTarget.getAttribute('data-suite-name');
      const select = document.getElementById('v2Suite');
      if (select && name) select.value = name;
      document.getElementById('concierge')?.scrollIntoView({ behavior: 'smooth' });
    });
  });

  const heroBtn = document.getElementById('heroSubmitBtn');
  if (heroBtn) {
    heroBtn.addEventListener('click', () => {
      const checkin = document.getElementById('heroCheckin')?.value || '';
      const checkout = document.getElementById('heroCheckout')?.value || '';
      const guests = document.getElementById('heroGuests')?.value || '2 Yetişkin';
      const v2Checkin = document.getElementById('v2Checkin');
      const v2Checkout = document.getElementById('v2Checkout');
      const v2Guests = document.getElementById('v2Guests');
      if (v2Checkin && checkin) v2Checkin.value = checkin;
      if (v2Checkout && checkout) v2Checkout.value = checkout;
      if (v2Guests && guests) v2Guests.value = guests;
      document.getElementById('concierge')?.scrollIntoView({ behavior: 'smooth' });
    });
  }

  const submitBtn = document.getElementById('v2SubmitBtn');
  if (submitBtn) {
    submitBtn.addEventListener('click', () => {
      const hotel = document.body.getAttribute('data-hotel') || 'Otel';
      const phone = document.body.getAttribute('data-phone') || '902524562340';
      const name = document.getElementById('v2Name')?.value.trim() || 'Değerli Misafir';
      const userPhone = document.getElementById('v2Phone')?.value.trim() || '';
      const checkin = document.getElementById('v2Checkin')?.value || 'Belirtilmedi';
      const checkout = document.getElementById('v2Checkout')?.value || 'Belirtilmedi';
      const suite = document.getElementById('v2Suite')?.value || 'Standart';
      const guests = document.getElementById('v2Guests')?.value || '2 Yetişkin';
      const notes = document.getElementById('v2Notes')?.value.trim() || '';

      const msg = encodeURIComponent(
        `Merhaba ${hotel} Ekibi, web sitenizden rezervasyon talebi iletiyorum:\n\n` +
        `👤 Misafir: ${name}\n` +
        `📞 İletişim: ${userPhone}\n` +
        `📅 Giriş: ${checkin} | Çıkış: ${checkout}\n` +
        `🛏️ Tercih: ${suite} (${guests})\n` +
        (notes ? `💬 Not: ${notes}\n\n` : `\n`) +
        `Müsaitlik ve fiyat teklifinizi paylaşabilir misiniz?`
      );

      window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
    });
  }
});
