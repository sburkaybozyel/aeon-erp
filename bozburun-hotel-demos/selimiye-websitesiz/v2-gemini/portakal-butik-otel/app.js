document.addEventListener('DOMContentLoaded', () => {
  // Hero image load animation
  const heroImg = document.getElementById('heroImg');
  const heroBg = document.getElementById('heroBg');
  if (heroImg && heroBg) {
    heroImg.addEventListener('load', () => heroBg.classList.add('loaded'));
    if (heroImg.complete) heroBg.classList.add('loaded');
  }

  // Scroll nav style
  const nav = document.getElementById('siteNav');
  if (nav) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 80) {
        nav.style.background = 'rgba(10,10,9,0.92)';
        nav.style.backdropFilter = 'blur(20px)';
        nav.style.borderBottom = '1px solid rgba(255,255,255,0.08)';
      } else {
        nav.style.background = '';
        nav.style.backdropFilter = '';
        nav.style.borderBottom = '';
      }
    }, { passive: true });
  }

  // Book strip → form
  const bookStripBtn = document.getElementById('bookStripBtn');
  if (bookStripBtn) {
    bookStripBtn.addEventListener('click', () => {
      const checkin = document.getElementById('checkin')?.value || '';
      const checkout = document.getElementById('checkout')?.value || '';
      const guests = document.getElementById('guests')?.value || '2 Yetişkin';
      const v2Checkin = document.getElementById('v2Checkin');
      const v2Checkout = document.getElementById('v2Checkout');
      const v2Guests = document.getElementById('v2Guests');
      if (v2Checkin && checkin) v2Checkin.value = checkin;
      if (v2Checkout && checkout) v2Checkout.value = checkout;
      if (v2Guests) v2Guests.value = guests;
      document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth' });
    });
  }

  // Suite select
  document.querySelectorAll('[data-suite-name]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const suiteName = e.currentTarget.getAttribute('data-suite-name');
      const select = document.getElementById('v2Suite');
      if (select && suiteName) select.value = suiteName;
      document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth' });
    });
  });

  // Scroll to booking
  document.querySelectorAll('[data-book]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth' });
    });
  });

  // WhatsApp submit
  const submitBtn = document.getElementById('v2SubmitBtn');
  if (submitBtn) {
    submitBtn.addEventListener('click', () => {
      const hotel = document.body.getAttribute('data-hotel') || 'Otel';
      const phone = document.body.getAttribute('data-phone') || '902524562340';
      const name = document.getElementById('v2Name')?.value.trim();
      const userPhone = document.getElementById('v2Phone')?.value.trim();
      const checkin = document.getElementById('v2Checkin')?.value;
      const checkout = document.getElementById('v2Checkout')?.value;
      const suite = document.getElementById('v2Suite')?.value || 'Standart';
      const guests = document.getElementById('v2Guests')?.value || '2 Yetişkin';
      const notes = document.getElementById('v2Notes')?.value.trim() || '';

      if (!name || !userPhone) {
        alert('Lütfen adınızı ve telefonunuzu girin.');
        return;
      }

      const msg = encodeURIComponent(
        `Merhaba ${hotel} Ekibi,\n\n` +
        `👤 ${name} | 📞 ${userPhone}\n` +
        `📅 Giriş: ${checkin || 'Belirtilmedi'} — Çıkış: ${checkout || 'Belirtilmedi'}\n` +
        `🛏️ ${suite} (${guests})` +
        (notes ? `\n💬 ${notes}` : '') +
        `\n\nMüsaitlik ve fiyat teklifinizi paylaşabilir misiniz?`
      );
      window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
    });
  }
});
