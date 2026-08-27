const booking=document.querySelector('#booking');document.querySelectorAll('[data-book]').forEach((b)=>b.addEventListener('click',(e)=>{e.preventDefault();booking?.showModal()}));booking?.querySelector('.close')?.addEventListener('click',()=>booking.close());booking?.addEventListener('click',(e)=>{if(e.target===booking)booking.close()});booking?.querySelector('form')?.addEventListener('submit',(e)=>{e.preventDefault();const b=booking.querySelector('button[value="send"]');b.textContent='Talebiniz alındı ✓';b.disabled=true});

const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;

document.body.classList.add('is-ready');
window.addEventListener('load',()=>setTimeout(()=>document.body.classList.add('is-loaded'),reduced?0:650));
setTimeout(()=>document.body.classList.add('is-loaded'),1800);

if(!reduced && 'IntersectionObserver' in window){
  const items=[...document.querySelectorAll('[data-reveal]')];
  items.forEach((el,i)=>{el.style.transitionDelay=(i%4)*90+'ms'});
  const io=new IntersectionObserver((entries)=>{
    entries.forEach((entry)=>{if(entry.isIntersecting){entry.target.classList.add('is-in');io.unobserve(entry.target)}});
  },{threshold:.15,rootMargin:'0px 0px -8% 0px'});
  items.forEach((el)=>io.observe(el));
  setTimeout(()=>items.forEach((el)=>el.classList.add('is-in')),4000);
}else{
  document.querySelectorAll('[data-reveal]').forEach((el)=>el.classList.add('is-in'));
}

const header=document.querySelector('[data-header]');
if(header){
  const onScroll=()=>{if(window.scrollY>18)header.setAttribute('data-scrolled','');else header.removeAttribute('data-scrolled')};
  onScroll();
  document.addEventListener('scroll',onScroll,{passive:true});
}

if(!reduced){
  const parallaxEls=[...document.querySelectorAll('[data-parallax]')];
  const softEls=[...document.querySelectorAll('[data-parallax-soft]')];
  let ticking=false;
  const apply=()=>{
    const vh=window.innerHeight;
    parallaxEls.forEach((el)=>{
      const r=el.getBoundingClientRect();
      const progress=(r.top+r.height/2-vh/2)/vh;
      const img=el.querySelector('img,video');
      if(img)img.style.transform=`translate3d(0, ${progress*-26}px, 0) scale(1.08)`;
    });
    softEls.forEach((el)=>{
      const r=el.getBoundingClientRect();
      const progress=(r.top+r.height/2-vh/2)/vh;
      const img=el.querySelector('img');
      if(img)img.style.transform=`translate3d(0, ${progress*-14}px, 0) scale(1.04)`;
    });
    ticking=false;
  };
  const onParallax=()=>{if(!ticking){requestAnimationFrame(apply);ticking=true}};
  if(parallaxEls.length||softEls.length){apply();document.addEventListener('scroll',onParallax,{passive:true});window.addEventListener('resize',onParallax)}

  document.querySelectorAll('.magnetic').forEach((btn)=>{
    btn.addEventListener('mousemove',(e)=>{
      const r=btn.getBoundingClientRect();
      const x=(e.clientX-r.left-r.width/2)*.18;
      const y=(e.clientY-r.top-r.height/2)*.28;
      btn.style.transform=`translate(${x}px, ${y}px)`;
    });
    btn.addEventListener('mouseleave',()=>{btn.style.transform=''});
  });
}
