document.addEventListener('DOMContentLoaded', () => {
  // Hero img load
  const heroImg = document.getElementById('heroImg');
  if (heroImg) {
    heroImg.addEventListener('load', () => heroImg.classList.add('loaded'));
    if (heroImg.complete) heroImg.classList.add('loaded');
  }

  // Widget → form
  const fill = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  document.getElementById('widgetBtn')?.addEventListener('click', () => {
    fill('fCheckin',  document.getElementById('wCheckin')?.value);
    fill('fCheckout', document.getElementById('wCheckout')?.value);
    fill('fGuests',   document.getElementById('wGuests')?.value);
    scrollTo('contact');
  });

  // Suite buttons
  document.querySelectorAll('[data-suite]').forEach(el => {
    el.addEventListener('click', () => {
      fill('fSuite', el.getAttribute('data-suite'));
      scrollTo('contact');
    });
  });

  // Nav book links
  document.querySelectorAll('[data-book]').forEach(el => {
    el.addEventListener('click', (e) => { e.preventDefault(); scrollTo('contact'); });
  });

  // Horizontal gallery drag scroll
  const gallery = document.getElementById('galleryStrip');
  if (gallery) {
    let isDown = false, startX, scrollLeft;
    gallery.addEventListener('mousedown',  e => { isDown = true; startX = e.pageX - gallery.offsetLeft; scrollLeft = gallery.scrollLeft; });
    gallery.addEventListener('mouseleave', () => isDown = false);
    gallery.addEventListener('mouseup',    () => isDown = false);
    gallery.addEventListener('mousemove',  e => { if (!isDown) return; e.preventDefault(); gallery.scrollLeft = scrollLeft - (e.pageX - gallery.offsetLeft - startX); });
  }

  // WhatsApp submit
  document.getElementById('fSubmit')?.addEventListener('click', () => {
    const hotel = document.body.getAttribute('data-hotel') || 'Otel';
    const phone = document.body.getAttribute('data-phone') || '902524562340';
    const name  = document.getElementById('fName')?.value.trim();
    const uPh   = document.getElementById('fPhone')?.value.trim();
    const ci    = document.getElementById('fCheckin')?.value  || '';
    const co    = document.getElementById('fCheckout')?.value || '';
    const suite = document.getElementById('fSuite')?.value    || 'Standart';
    const gst   = document.getElementById('fGuests')?.value   || '2 Yetişkin';
    const note  = document.getElementById('fNotes')?.value.trim() || '';
    if (!name || !uPh) { alert('Lütfen adınızı ve telefonunuzu girin.'); return; }
    const msg = encodeURIComponent(
      `Merhaba ${hotel},\n` +
      `Ad: ${name} | Tel: ${uPh}\n` +
      `Giriş: ${ci||'?'} | Çıkış: ${co||'?'}\n` +
      `Oda: ${suite} (${gst})` +
      (note ? `\nNot: ${note}` : '') +
      `\n\nMüsaitlik bilgisi alabilir miyim?`
    );
    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
  });
});
