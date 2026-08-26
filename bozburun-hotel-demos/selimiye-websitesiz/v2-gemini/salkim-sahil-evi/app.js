document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-book]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
    });
  });

  document.querySelectorAll('[data-suite-name]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const name = e.currentTarget.getAttribute('data-suite-name');
      const select = document.getElementById('v2Suite');
      if (select && name) select.value = name;
      document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
    });
  });

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
