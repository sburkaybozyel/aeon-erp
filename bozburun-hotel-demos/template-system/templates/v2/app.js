(function(){
  'use strict';

  const dialog = document.getElementById('booking');
  const openDialog = (event) => { event.preventDefault(); dialog?.showModal(); };
  document.querySelectorAll('[data-book]').forEach((trigger) => trigger.addEventListener('click', openDialog));
  dialog?.querySelector('.close')?.addEventListener('click', () => dialog.close());
  dialog?.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
  dialog?.querySelector('form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const submit = dialog.querySelector('button[value="send"]');
    if (!submit) return;
    submit.textContent = 'Talebiniz alındı ✓';
    submit.disabled = true;
  });

  const motionAllowed = !matchMedia('(prefers-reduced-motion: reduce)').matches;

  const Loader = {
    init(){
      document.body.classList.add('is-ready');
      const finish = () => document.body.classList.add('is-loaded');
      window.addEventListener('load', () => setTimeout(finish, motionAllowed ? 600 : 0));
      setTimeout(finish, 1800);
    }
  };

  const Reveal = {
    init(){
      const nodes = Array.from(document.querySelectorAll('[data-reveal]'));
      if (!nodes.length) return;
      if (!motionAllowed || !('IntersectionObserver' in window)) {
        nodes.forEach((node) => node.classList.add('is-in'));
        return;
      }
      nodes.forEach((node, index) => { node.style.transitionDelay = `${(index % 5) * 80}ms`; });
      const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('is-in');
          observer.unobserve(entry.target);
        }
      }, { threshold: 0.18, rootMargin: '0px 0px -10% 0px' });
      nodes.forEach((node) => observer.observe(node));
      window.setTimeout(() => nodes.forEach((node) => node.classList.add('is-in')), 4000);
    }
  };

  const HeaderGlass = {
    init(){
      const header = document.querySelector('[data-header]');
      if (!header) return;
      let last = null;
      const sync = () => {
        const scrolled = window.scrollY > 18;
        if (scrolled === last) return;
        last = scrolled;
        header.toggleAttribute('data-scrolled', scrolled);
      };
      sync();
      document.addEventListener('scroll', sync, { passive: true });
    }
  };

  class ScrollDrift {
    constructor(el, strength){
      this.el = el;
      this.strength = strength;
      this.target = el.querySelector('img,video');
    }
    apply(viewportHeight){
      if (!this.target) return;
      const rect = this.el.getBoundingClientRect();
      const center = rect.top + rect.height / 2 - viewportHeight / 2;
      const offset = (center / viewportHeight) * this.strength;
      const scale = 1 + Math.min(0.08, this.strength / 220);
      this.target.style.transform = `translate3d(0, ${offset}px, 0) scale(${scale})`;
    }
  }

  const Drift = {
    init(){
      if (!motionAllowed) return;
      const drifters = [
        ...Array.from(document.querySelectorAll('[data-parallax]')).map((el) => new ScrollDrift(el, 26)),
        ...Array.from(document.querySelectorAll('[data-parallax-soft]')).map((el) => new ScrollDrift(el, 14))
      ];
      if (!drifters.length) return;
      let queued = false;
      const run = () => {
        const vh = window.innerHeight;
        drifters.forEach((drifter) => drifter.apply(vh));
        queued = false;
      };
      const request = () => { if (!queued) { queued = true; requestAnimationFrame(run); } };
      run();
      document.addEventListener('scroll', request, { passive: true });
      window.addEventListener('resize', request);
    }
  };

  const Magnetic = {
    init(){
      if (!motionAllowed) return;
      document.querySelectorAll('.magnetic').forEach((el) => {
        const reset = () => { el.style.transform = ''; };
        el.addEventListener('mousemove', (event) => {
          const box = el.getBoundingClientRect();
          const dx = (event.clientX - box.left - box.width / 2) * 0.2;
          const dy = (event.clientY - box.top - box.height / 2) * 0.3;
          el.style.transform = `translate(${dx}px, ${dy}px)`;
        });
        el.addEventListener('mouseleave', reset);
        el.addEventListener('blur', reset);
      });
    }
  };

  [Loader, Reveal, HeaderGlass, Drift, Magnetic].forEach((module) => module.init());
})();
