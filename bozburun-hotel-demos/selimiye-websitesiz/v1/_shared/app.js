
document.addEventListener('DOMContentLoaded', () => {
  initHeader();
  initMobileDrawer();
  initRevealAnimations();
  initBookingModals();
  setDefaultDates();
});

function initHeader() {
  const header = document.getElementById('v1Header');
  if (!header) return;
  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) header.classList.add('scrolled');
    else header.classList.remove('scrolled');
  }, { passive: true });
}

function initMobileDrawer() {
  const btn = document.getElementById('mobileMenuToggle');
  const drawer = document.getElementById('mobileDrawer');
  const close = document.getElementById('drawerClose');
  const links = document.querySelectorAll('.drawer-link');
  if (!btn || !drawer) return;
  const openDrawer = () => drawer.classList.add('active');
  const closeDrawer = () => drawer.classList.remove('active');
  btn.addEventListener('click', openDrawer);
  if (close) close.addEventListener('click', closeDrawer);
  links.forEach(l => l.addEventListener('click', closeDrawer));
}

function initRevealAnimations() {
  const elements = document.querySelectorAll('[data-reveal]');
  if (!elements.length) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  elements.forEach((el, index) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(24px)';
    el.style.transition = `opacity 0.75s cubic-bezier(0.16, 1, 0.3, 1) ${index % 4 * 0.08}s, transform 0.75s cubic-bezier(0.16, 1, 0.3, 1) ${index % 4 * 0.08}s`;
    observer.observe(el);
  });
}

function initBookingModals() {
  const modal = document.getElementById('bookingModal');
  const modalClose = document.getElementById('modalCloseBtn');
  const modalSuite = document.getElementById('modalSuiteChoice');
  const modalTitle = document.getElementById('modalTitleText');
  const modalForm = document.getElementById('modalBookingForm');
  const heroSubmitBtn = document.getElementById('heroSubmitBtn');
  const contactForm = document.getElementById('contactMainForm');
  const hotelPhone = document.body.getAttribute('data-phone') || '902524562340';
  const hotelName = document.body.getAttribute('data-hotel') || 'Otel';

  document.querySelectorAll('[data-book]').forEach(btn => {
    btn.addEventListener('click', () => {
      openModal('Özel Rezervasyon Talebi', `${hotelName} Genel Rezervasyon`);
    });
  });

  document.querySelectorAll('[data-suite-name]').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.getAttribute('data-suite-name');
      openModal(name, name);
    });
  });

  document.querySelectorAll('[data-exp-title]').forEach(btn => {
    btn.addEventListener('click', () => {
      const exp = btn.getAttribute('data-exp-title');
      openModal(`Deneyim Talebi: ${exp}`, exp);
    });
  });

  function openModal(title, suite) {
    if (!modal) return;
    if (modalTitle) modalTitle.textContent = title;
    if (modalSuite) modalSuite.value = suite;
    modal.classList.add('active');
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove('active');
  }

  if (modalClose) modalClose.addEventListener('click', closeModal);
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  if (modalForm) {
    modalForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const suite = document.getElementById('modalSuiteChoice')?.value || 'Süit';
      const checkin = document.getElementById('mCheckin')?.value || '';
      const checkout = document.getElementById('mCheckout')?.value || '';
      const guests = document.getElementById('mGuests')?.value || '2 Yetişkin';
      const phone = document.getElementById('mPhone')?.value || '';
      const notes = document.getElementById('mNotes')?.value || '';
      const msg = `Merhaba ${hotelName},%0A%0AWeb sitenizden doğrudan rezervasyon talebinde bulunmak istiyorum:%0A✦ *Kategori:* ${suite}%0A✦ *Tarihler:* ${checkin} - ${checkout}%0A✦ *Misafir Sayısı:* ${guests}%0A✦ *Telefon:* ${phone}%0A✦ *Özel İstek:* ${notes || 'Yok'}`;
      window.open(`https://wa.me/${hotelPhone.replace(/\D/g, '')}?text=${msg}`, '_blank');
      closeModal();
    });
  }

  if (heroSubmitBtn) {
    heroSubmitBtn.addEventListener('click', () => {
      const checkin = document.getElementById('heroCheckin')?.value || '';
      const checkout = document.getElementById('heroCheckout')?.value || '';
      const guests = document.getElementById('heroGuests')?.value || '2';
      const suite = document.getElementById('heroSuite')?.value || 'all';
      const msg = `Merhaba ${hotelName},%0A%0AWeb siteniz üzerinden ${checkin} - ${checkout} tarihleri için ${guests} misafir için müsaitlik ve fiyat teklifi rica ediyorum. (Tercih: ${suite})`;
      window.open(`https://wa.me/${hotelPhone.replace(/\D/g, '')}?text=${msg}`, '_blank');
    });
  }

  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('contactName')?.value || '';
      const phone = document.getElementById('contactPhone')?.value || '';
      const checkin = document.getElementById('contactCheckin')?.value || '';
      const checkout = document.getElementById('contactCheckout')?.value || '';
      const guests = document.getElementById('contactGuests')?.value || '';
      const suite = document.getElementById('contactSuite')?.value || '';
      const notes = document.getElementById('contactNotes')?.value || '';
      const msg = `Merhaba ${hotelName},%0A%0AAdım ${name}. Web sitenizden rezervasyon talebi iletiyorum:%0A✦ *Tarih:* ${checkin} - ${checkout}%0A✦ *Kişi:* ${guests}%0A✦ *Oda:* ${suite}%0A✦ *Telefon:* ${phone}%0A✦ *Not:* ${notes || 'Yok'}`;
      window.open(`https://wa.me/${hotelPhone.replace(/\D/g, '')}?text=${msg}`, '_blank');
    });
  }
}

function setDefaultDates() {
  const today = new Date();
  const nextWeek = new Date();
  nextWeek.setDate(today.getDate() + 4);
  const formatDate = (d) => d.toISOString().split('T')[0];
  const checkins = [document.getElementById('heroCheckin'), document.getElementById('contactCheckin'), document.getElementById('mCheckin')];
  const checkouts = [document.getElementById('heroCheckout'), document.getElementById('contactCheckout'), document.getElementById('mCheckout')];
  checkins.forEach(el => { if (el) el.value = formatDate(today); });
  checkouts.forEach(el => { if (el) el.value = formatDate(nextWeek); });
}
