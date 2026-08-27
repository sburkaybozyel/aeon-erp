document.addEventListener('DOMContentLoaded', () => {
  // Nav transparency on hero
  const nav = document.getElementById('v1Nav');
  const heroSection = document.querySelector('.v1-hero');
  if (nav && heroSection) {
    nav.classList.add('transparent');
    const obs = new IntersectionObserver(([e]) => {
      nav.classList.toggle('transparent', e.isIntersecting);
    }, { threshold: 0.1 });
    obs.observe(heroSection);
  }

  // Hero img load animation
  const heroImg = document.getElementById('heroImg');
  if (heroImg) {
    heroImg.addEventListener('load', () => heroImg.classList.add('loaded'));
    if (heroImg.complete) heroImg.classList.add('loaded');
  }

  // Book bar → form
  const bookBarBtn = document.getElementById('bookBarBtn');
  if (bookBarBtn) {
    bookBarBtn.addEventListener('click', () => {
      const checkin = document.getElementById('v1Checkin')?.value || '';
      const checkout = document.getElementById('v1Checkout')?.value || '';
      const guests = document.getElementById('v1Guests')?.value || '2 Yetişkin';
      const cfCheckin = document.getElementById('cfCheckin');
      const cfCheckout = document.getElementById('cfCheckout');
      const cfGuests = document.getElementById('cfGuests');
      if (cfCheckin && checkin) cfCheckin.value = checkin;
      if (cfCheckout && checkout) cfCheckout.value = checkout;
      if (cfGuests) cfGuests.value = guests;
      document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
    });
  }

  // Suite select buttons
  document.querySelectorAll('[data-suite]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const suite = e.currentTarget.getAttribute('data-suite');
      const sel = document.getElementById('cfSuite');
      if (sel && suite) sel.value = suite;
      document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
    });
  });

  // Any [data-book] link scrolls to contact
  document.querySelectorAll('[data-book]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
    });
  });

  // WhatsApp form submit
  const submitBtn = document.getElementById('cfSubmit');
  if (submitBtn) {
    submitBtn.addEventListener('click', () => {
      const hotel = document.body.getAttribute('data-hotel') || 'Otel';
      const phone = document.body.getAttribute('data-phone') || '902524562340';
      const name = document.getElementById('cfName')?.value.trim();
      const userPhone = document.getElementById('cfPhone')?.value.trim();
      const checkin = document.getElementById('cfCheckin')?.value || '';
      const checkout = document.getElementById('cfCheckout')?.value || '';
      const suite = document.getElementById('cfSuite')?.value || 'Standart';
      const guests = document.getElementById('cfGuests')?.value || '2 Yetişkin';
      const notes = document.getElementById('cfNotes')?.value.trim() || '';

      if (!name || !userPhone) {
        alert('Lütfen adınızı ve telefonunuzu girin.');
        return;
      }

      const msg = encodeURIComponent(
        `Merhaba ${hotel} Ekibi,\n\n` +
        `Ad: ${name} | Tel: ${userPhone}\n` +
        `Giriş: ${checkin || 'Belirtilmedi'} | Çıkış: ${checkout || 'Belirtilmedi'}\n` +
        `Oda: ${suite} (${guests})` +
        (notes ? `\nNot: ${notes}` : '') +
        `\n\nMüsaitlik bilgisi alabilir miyim?`
      );
      window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
    });
  }
});
