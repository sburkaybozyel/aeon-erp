/**
 * build-defne-lorina.mjs
 * Defne Lorina Hotel için V1 (Coastal Magazine) ve V2 (Dark Editorial) sitelerini üretir.
 * Selimiye V1/V2 ile aynı CSS/HTML mimarisi, Defne Lorina verileriyle.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

// ── Defne Lorina hotel data ─────────────────────────────────────────────────
const HOTEL = {
  slug: 'defne-lorina',
  name: 'Defne Lorina',
  tagline: 'Yeşilin içinden denize, koyun sessizliğinde özgün bir kaçış',
  concept: 'Botanik bahçe ve özel iskelesiyle Yeşilova Koyu\'nda taş ev konforu',
  location: 'Yeşilova Koyu Yolu, 48710 Bozburun, Marmaris / Muğla',
  phone: '+90 252 456 23 40',
  cleanPhone: '902524562340',
  seaDist: 'Özel iskele · Botanik bahçe',
  audience: 'Çiftler & doğa arayan misafirler',
  theme: {
    primary: '#5f7c5e',   // botanik yeşil
    dark:    '#111a10',
    terra:   '#7a9678',
  },
  rooms: [
    {
      badge: 'İmza Süit',
      title: 'Defne Taş Ev Master Süit',
      size: '45 m²',
      view: 'Deniz & Doğa Manzarası',
      bed: 'King Size',
      desc: 'Yüksek tavan, veranda, deniz ve botanik bahçe manzarası; şömine hissiyle sakin bir yaşam alanı.'
    },
    {
      badge: 'Koy Odası',
      title: 'Lorina Koy Odası',
      size: '32 m²',
      view: 'Yeşilova Koyu',
      bed: 'Queen Size',
      desc: 'Botanik bahçeye açılan verandası, doğal taş dokuları ve sabah kuş sesleriyle uyanılan ferah bir köşe.'
    }
  ],
  rituals: [
    { time: '08:00 — 11:00', title: 'Bahçeden Gelen Kahvaltı', desc: 'Tazeliği iskelede hazırlanan organik Ege kahvaltısı; denize birkaç adım mesafede uzun bir sabah sofrası.' },
    { time: '14:00 — 18:00', title: 'Özel İskelede Deniz', desc: 'Yeşilova Koyu\'nun berrak sularında yüzün; iskele boyunca uzanıp dinlenin, kitabınızı okuyun.' },
    { time: '19:30 — 23:00', title: 'Botanik Bahçe Akşamı', desc: 'Lavanta ve defne kokuları arasında, yıldızların altında taze mezeleri ve koyun sessizliğini paylaşın.' }
  ]
};

const escapeHtml = (v = '') =>
  String(v).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// ════════════════════════════════════════════════════════════════════════════
// V1: COASTAL MAGAZINE CSS
// ════════════════════════════════════════════════════════════════════════════
function v1CSS() {
  const terra = HOTEL.theme.primary;
  const ink   = HOTEL.theme.dark;
  return `
@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Instrument+Sans:wght@400;500;600&display=swap');
:root{--terra:${terra};--terra2:color-mix(in srgb,${terra} 70%,#000);--ink:${ink};--sand:#f5f0e8;--cream:#ece6db;--stone:#c8bfb2;--mist:rgba(17,26,16,.45);--f-d:'DM Serif Display',Georgia,serif;--f-s:'Instrument Sans',system-ui,sans-serif;--ease:cubic-bezier(.22,1,.36,1)}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{font-size:16px;scroll-behavior:smooth;background:var(--sand)}
body{font-family:var(--f-s);background:var(--sand);color:var(--ink);line-height:1.6;overflow-x:hidden;-webkit-font-smoothing:antialiased}
img{display:block;width:100%;height:100%;object-fit:cover}
a{text-decoration:none;color:inherit}
button{border:none;background:none;cursor:pointer;font-family:inherit}

/* NAV */
.v1-nav{position:fixed;top:0;left:0;right:0;z-index:200;display:flex;align-items:center;justify-content:space-between;padding:1.25rem 2rem;background:rgba(245,240,232,.85);backdrop-filter:blur(14px);border-bottom:1px solid rgba(200,191,178,.5)}
.nav-brand{display:flex;align-items:center;gap:.75rem}
.nav-logo-disc{width:36px;height:36px;border-radius:50%;overflow:hidden;flex-shrink:0;border:1px solid var(--stone);display:flex;align-items:center;justify-content:center;background:var(--terra);color:#fff;font-family:var(--f-d);font-size:1rem}
.nav-name{font-family:var(--f-d);font-size:.95rem;color:var(--ink)}
.nav-right{display:flex;align-items:center;gap:2rem}
.nav-link{font-size:.68rem;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:var(--mist);transition:color .25s}
.nav-link:hover{color:var(--terra)}
.nav-cta{font-size:.68rem;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:var(--sand);background:var(--terra);padding:.6rem 1.4rem;transition:background .25s}
.nav-cta:hover{background:var(--terra2)}

/* OPENING — SPLIT THIRDS */
.opening{display:grid;grid-template-columns:5rem 1fr 22rem;height:100vh;min-height:680px;padding-top:64px}
.opening-spine{background:var(--terra);display:flex;align-items:flex-end;justify-content:center;padding-bottom:2.5rem;writing-mode:vertical-rl;text-orientation:mixed}
.spine-text{font-size:.6rem;font-weight:600;letter-spacing:.3em;text-transform:uppercase;color:rgba(255,255,255,.7);transform:rotate(180deg);white-space:nowrap}
.opening-image{position:relative;overflow:hidden}
.opening-image img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.opening-image-overlay{position:absolute;inset:0;background:linear-gradient(to right,rgba(0,0,0,.15) 0%,transparent 60%)}
.opening-panel{background:var(--sand);display:flex;flex-direction:column;justify-content:flex-end;padding:3rem 2.5rem 4rem;border-left:1px solid var(--stone);overflow:hidden}
.opening-eyebrow{font-size:.62rem;font-weight:600;letter-spacing:.24em;text-transform:uppercase;color:var(--terra);margin-bottom:1.25rem;display:block}
.opening-hotel-name{font-family:var(--f-d);font-size:clamp(1.8rem,2.8vw,2.6rem);line-height:1.08;color:var(--ink);margin-bottom:1.5rem;overflow-wrap:break-word}
.opening-tagline{font-family:var(--f-d);font-style:italic;font-size:.95rem;color:var(--mist);line-height:1.6;margin-bottom:2.5rem;overflow-wrap:break-word}
.opening-widget{border:1px solid var(--stone);background:var(--cream);display:flex;flex-direction:column}
.widget-row{display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid var(--stone)}
.widget-row:last-child{border-bottom:none}
.widget-field{padding:1rem 1.25rem;border-right:1px solid var(--stone);display:flex;flex-direction:column;gap:.3rem;min-width:0}
.widget-field:last-child{border-right:none}
.widget-field.full{grid-column:1/-1;border-right:none}
.widget-field label{font-size:.58rem;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:var(--stone)}
.widget-field input,.widget-field select{font-family:var(--f-d);font-size:.9rem;color:var(--ink);background:none;border:none;outline:none;width:100%;min-width:0}
.widget-submit{width:100%;padding:1.1rem;background:var(--ink);color:var(--sand);font-size:.65rem;font-weight:600;letter-spacing:.2em;text-transform:uppercase;border:none;cursor:pointer;font-family:var(--f-s);transition:background .25s}
.widget-submit:hover{background:var(--terra)}

/* PULLQUOTE */
.pullquote{background:var(--cream);padding:7rem 12vw;text-align:center;border-top:1px solid var(--stone);border-bottom:1px solid var(--stone)}
.pullquote-text{font-family:var(--f-d);font-style:italic;font-size:clamp(1.6rem,3vw,2.6rem);line-height:1.35;color:var(--ink);max-width:780px;margin:0 auto 2rem}
.pullquote-attr{font-size:.68rem;font-weight:600;letter-spacing:.24em;text-transform:uppercase;color:var(--stone)}

/* ROOMS — FULL-WIDTH OVERLAY STRIPS */
.rooms-section-head{padding:5rem 5rem 3rem;border-bottom:1px solid var(--stone);display:flex;align-items:flex-end;justify-content:space-between;gap:2rem;flex-wrap:wrap;background:var(--sand)}
.rooms-section-head h2{font-family:var(--f-d);font-size:clamp(2rem,3.5vw,3.2rem);color:var(--ink);line-height:1.08}
.rooms-section-head p{font-size:.95rem;color:var(--mist);max-width:340px;line-height:1.75}
.room-strip{position:relative;height:70vh;min-height:480px;overflow:hidden;border-bottom:1px solid rgba(0,0,0,.1)}
.room-strip-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:transform 6s ease}
.room-strip:hover .room-strip-img{transform:scale(1.04)}
.room-strip-overlay{position:absolute;inset:0;background:linear-gradient(to right,rgba(17,26,16,.06) 0%,rgba(17,26,16,.55) 55%,rgba(17,26,16,.88) 100%)}
.room-strip:nth-child(even) .room-strip-overlay{background:linear-gradient(to left,rgba(17,26,16,.06) 0%,rgba(17,26,16,.55) 55%,rgba(17,26,16,.88) 100%)}
.room-strip-text{position:absolute;top:50%;right:0;transform:translateY(-50%);width:46%;padding:3rem 4rem;color:#fff}
.room-strip:nth-child(even) .room-strip-text{right:auto;left:0}
.room-strip-badge{font-size:.6rem;font-weight:600;letter-spacing:.26em;text-transform:uppercase;color:var(--terra);background:rgba(255,255,255,.1);border:1px solid rgba(95,124,94,.5);padding:.3rem .8rem;display:inline-block;margin-bottom:1.25rem}
.room-strip-name{font-family:var(--f-d);font-size:clamp(1.4rem,2.2vw,2.2rem);line-height:1.15;margin-bottom:1rem;overflow-wrap:break-word}
.room-strip-desc{font-size:.93rem;color:rgba(255,255,255,.72);line-height:1.7;margin-bottom:2rem;max-width:360px}
.room-strip-specs{display:flex;gap:2.5rem;flex-wrap:wrap;padding:1.25rem 0;border-top:1px solid rgba(255,255,255,.2);border-bottom:1px solid rgba(255,255,255,.2);margin-bottom:1.75rem}
.rs-spec{display:flex;flex-direction:column;gap:.2rem}
.rs-label{font-size:.58rem;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,.4)}
.rs-value{font-family:var(--f-d);font-size:.95rem;color:#fff}
.room-strip-btn{font-size:.65rem;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:#fff;border-bottom:1px solid rgba(255,255,255,.5);padding-bottom:2px;transition:border-color .25s,color .25s;display:inline-block;cursor:pointer}
.room-strip-btn:hover{color:var(--terra);border-color:var(--terra)}

/* EXPERIENCE CHAPTERS */
.experiences-head{background:var(--sand);padding:5rem 5rem 3rem;border-top:1px solid var(--stone);border-bottom:1px solid var(--stone)}
.experiences-head h2{font-family:var(--f-d);font-size:clamp(2rem,3.5vw,3.2rem);color:var(--ink);line-height:1.08}
.exp-chapter{display:grid;grid-template-columns:1fr 1fr;min-height:55vh;border-bottom:1px solid var(--stone)}
.exp-chapter:nth-child(even){direction:rtl}
.exp-chapter:nth-child(even)>*{direction:ltr}
.exp-chapter-visual{position:relative;overflow:hidden;min-height:400px}
.exp-chapter-visual img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.exp-chapter-text{background:var(--cream);padding:6rem 4.5rem;display:flex;flex-direction:column;justify-content:center}
.exp-big-num{font-family:var(--f-d);font-size:6rem;line-height:1;color:var(--stone);margin-bottom:1rem;display:block}
.exp-chapter-time{font-size:.62rem;font-weight:600;letter-spacing:.22em;text-transform:uppercase;color:var(--terra);margin-bottom:1rem;display:block}
.exp-chapter-title{font-family:var(--f-d);font-size:clamp(1.4rem,2.2vw,2rem);color:var(--ink);line-height:1.2;margin-bottom:1.25rem}
.exp-chapter-desc{font-size:.97rem;color:var(--mist);line-height:1.8;max-width:400px}

/* GALLERY STRIP */
.gallery-strip{display:flex;overflow-x:auto;scrollbar-width:none;border-top:1px solid var(--stone);border-bottom:1px solid var(--stone);cursor:grab}
.gallery-strip::-webkit-scrollbar{display:none}
.gallery-strip:active{cursor:grabbing}
.gallery-img{flex:0 0 auto;width:38vw;height:52vh;min-height:300px;position:relative;overflow:hidden;border-right:1px solid var(--stone)}
.gallery-img img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}

/* CONTACT — CENTERED */
.v1-contact{background:var(--sand);padding:8rem 2rem;border-top:1px solid var(--stone)}
.contact-inner{max-width:680px;margin:0 auto}
.contact-eyebrow{font-size:.62rem;font-weight:600;letter-spacing:.24em;text-transform:uppercase;color:var(--terra);margin-bottom:1rem;display:block}
.contact-headline{font-family:var(--f-d);font-size:clamp(2rem,3.5vw,3.2rem);color:var(--ink);line-height:1.08;margin-bottom:.75rem}
.contact-sub{font-family:var(--f-d);font-style:italic;font-size:1rem;color:var(--mist);margin-bottom:3rem}
.contact-meta{display:flex;gap:3rem;flex-wrap:wrap;margin-bottom:3rem;padding-bottom:2rem;border-bottom:1px solid var(--stone)}
.cm-item{display:flex;flex-direction:column;gap:.3rem}
.cm-label{font-size:.58rem;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:var(--stone)}
.cm-val{font-family:var(--f-d);font-size:1.05rem;color:var(--ink)}
.cm-val a{color:var(--terra)}
.v1-form{display:flex;flex-direction:column;gap:0}
.v1-form-row{display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid var(--stone)}
.v1-form-row.single{grid-template-columns:1fr}
.v1-field{padding:1.25rem 0;border-right:1px solid var(--stone);display:flex;flex-direction:column;gap:.35rem;padding-right:1.5rem;min-width:0}
.v1-field:last-child{border-right:none;padding-right:0;padding-left:1.5rem}
.v1-form-row.single .v1-field{border-right:none;padding-left:0;padding-right:0}
.v1-field label{font-size:.58rem;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:var(--stone)}
.v1-field input,.v1-field select,.v1-field textarea{font-family:var(--f-d);font-size:1rem;color:var(--ink);background:none;border:none;outline:none;width:100%;min-width:0;padding:0}
.v1-field textarea{resize:none;height:72px}
.v1-field select option{background:var(--sand)}
.v1-submit-row{padding-top:2rem}
.v1-submit-btn{background:var(--terra);color:var(--sand);font-size:.68rem;font-weight:600;letter-spacing:.2em;text-transform:uppercase;padding:1.1rem 3rem;border:none;cursor:pointer;font-family:var(--f-s);transition:background .25s}
.v1-submit-btn:hover{background:var(--terra2)}

/* FOOTER */
.v1-footer{background:var(--cream);border-top:1px solid var(--stone);padding:2.5rem 5rem;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:1rem}
.v1-footer-name{font-family:var(--f-d);font-size:1rem;color:var(--mist)}
.v1-footer-loc{font-size:.65rem;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:var(--stone)}

/* RESPONSIVE */
@media(max-width:900px){
  .opening{grid-template-columns:1fr;height:auto;min-height:auto}
  .opening-spine{display:none}
  .opening-image{height:55vw;min-height:260px}
  .opening-panel{padding:2.5rem 1.5rem 3rem;border-left:none;border-top:1px solid var(--stone)}
  .room-strip{height:auto;min-height:560px}
  .room-strip-overlay{background:linear-gradient(to top,rgba(17,26,16,.92) 0%,rgba(17,26,16,.3) 55%,transparent 100%) !important}
  .room-strip-text{position:static;transform:none;width:100%;padding:2rem 1.5rem;background:rgba(17,26,16,.88)}
  .exp-chapter{grid-template-columns:1fr;direction:ltr !important}
  .exp-chapter:nth-child(even)>*{direction:ltr}
  .exp-chapter-visual{min-height:260px}
  .exp-chapter-text{padding:3.5rem 2rem}
  .exp-big-num{font-size:4rem}
  .gallery-img{width:70vw;height:40vh}
  .v1-contact{padding:5rem 1.5rem}
  .pullquote{padding:4.5rem 8vw}
  .rooms-section-head,.experiences-head{padding:4rem 2rem 2.5rem}
  .v1-footer{padding:2rem 2rem}
  .nav-link{display:none}
}
@media(max-width:600px){
  .widget-row{grid-template-columns:1fr}
  .widget-field{border-right:none;border-bottom:1px solid var(--stone)}
  .v1-form-row{grid-template-columns:1fr}
  .v1-field{border-right:none;padding-left:0!important;padding-right:0!important}
  .gallery-img{width:85vw}
}
`;
}

// ════════════════════════════════════════════════════════════════════════════
// V2: DARK EDITORIAL CSS
// ════════════════════════════════════════════════════════════════════════════
function v2CSS() {
  const primary = HOTEL.theme.primary;
  const dark    = HOTEL.theme.dark;
  return `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400;1,500&family=Plus+Jakarta+Sans:wght@300;400;500&display=swap');
:root{--ink:#0a0a09;--paper:#f5f2ec;--cream:#ede8df;--gold:${primary};--gold-light:color-mix(in srgb,${primary} 60%,#fff);--white:#ffffff;--muted:rgba(255,255,255,.55);--muted-dark:rgba(10,10,9,.5);--f-serif:'Cormorant Garamond','EB Garamond',Georgia,serif;--f-sans:'Plus Jakarta Sans',system-ui,sans-serif;--ease-out:cubic-bezier(.16,1,.3,1)}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{font-size:16px;scroll-behavior:smooth;background:var(--ink)}
body{font-family:var(--f-sans);background:var(--ink);color:var(--white);line-height:1.6;overflow-x:hidden;-webkit-font-smoothing:antialiased}
img{display:block;width:100%;height:100%;object-fit:cover}
a{text-decoration:none;color:inherit}
button{border:none;background:none;cursor:pointer;font-family:inherit}

/* NAV */
.site-nav{position:fixed;top:0;left:0;right:0;z-index:100;padding:2rem 3rem;display:flex;align-items:center;justify-content:space-between;transition:background .4s,backdrop-filter .4s}
.nav-brand{display:flex;align-items:center;gap:1rem}
.nav-logo-disc{width:44px;height:44px;border-radius:50%;overflow:hidden;flex-shrink:0;background:var(--gold);display:flex;align-items:center;justify-content:center;color:var(--ink);font-family:var(--f-serif);font-size:1.2rem}
.nav-brand-name{font-family:var(--f-serif);font-size:1.1rem;font-weight:400;letter-spacing:.18em;text-transform:uppercase;color:var(--white)}
.nav-links-right{display:flex;align-items:center;gap:2.5rem}
.nav-link-item{font-size:.72rem;font-weight:400;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.75);transition:color .3s}
.nav-link-item:hover{color:var(--white)}
.nav-cta-text{font-size:.72rem;font-weight:500;letter-spacing:.2em;text-transform:uppercase;color:var(--gold);border-bottom:1px solid var(--gold);padding-bottom:2px;transition:opacity .3s}
.nav-cta-text:hover{opacity:.75}

/* HERO */
.hero-immersive{position:relative;height:100vh;min-height:700px;overflow:hidden}
.hero-bg-image{position:absolute;inset:0;transform:scale(1.06);transition:transform 8s ease-out}
.hero-bg-image.loaded{transform:scale(1)}
.hero-overlay{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(10,10,9,.3) 0%,rgba(10,10,9,.1) 40%,rgba(10,10,9,.65) 85%,rgba(10,10,9,.95) 100%)}
.hero-content{position:absolute;bottom:0;left:0;right:0;padding:0 3rem 5rem}
.hero-eyebrow{font-size:.68rem;letter-spacing:.32em;text-transform:uppercase;color:var(--gold);display:block;margin-bottom:1.5rem}
.hero-title{font-family:var(--f-serif);font-size:clamp(2.8rem,6vw,6rem);font-weight:300;line-height:1.05;color:var(--white);max-width:820px;margin-bottom:2rem;overflow-wrap:break-word;word-break:break-word}
.hero-title em{font-style:italic;font-weight:300}
.hero-bottom-strip{display:flex;align-items:flex-end;justify-content:space-between;gap:2rem;flex-wrap:wrap}
.hero-tagline{font-family:var(--f-serif);font-size:1.1rem;font-style:italic;color:rgba(255,255,255,.8);max-width:500px;line-height:1.65;overflow-wrap:break-word}
.hero-scroll-cue{display:flex;align-items:center;gap:.75rem;font-size:.68rem;letter-spacing:.22em;text-transform:uppercase;color:rgba(255,255,255,.5)}
.scroll-line{width:40px;height:1px;background:rgba(255,255,255,.3)}

/* BOOK STRIP */
.book-strip{background:var(--paper);padding:0;display:grid;grid-template-columns:repeat(3,1fr) auto;border-bottom:1px solid rgba(10,10,9,.12)}
.book-strip-cell{padding:2rem 2.5rem;border-right:1px solid rgba(10,10,9,.12);display:flex;flex-direction:column;gap:.5rem}
.book-strip-cell:last-child{border-right:none}
.book-strip-label{font-size:.64rem;letter-spacing:.22em;text-transform:uppercase;color:var(--muted-dark);font-weight:500}
.book-strip-cell input,.book-strip-cell select{font-family:var(--f-serif);font-size:1.05rem;color:var(--ink);background:none;border:none;outline:none;width:100%;padding:0;min-width:0}
.book-strip-action{padding:2rem 3rem;background:var(--ink);display:flex;align-items:center;justify-content:center}
.book-strip-btn{font-size:.72rem;letter-spacing:.22em;text-transform:uppercase;color:var(--white);display:flex;align-items:center;gap:1rem;transition:gap .3s var(--ease-out)}
.book-strip-btn:hover{gap:1.5rem}
.book-btn-arrow{width:36px;height:36px;border-radius:50%;border:1px solid rgba(255,255,255,.3);display:flex;align-items:center;justify-content:center;font-size:.9rem}

/* INTRO */
.intro-editorial{display:grid;grid-template-columns:1fr 1fr;min-height:80vh}
.intro-left{background:var(--paper);padding:8rem 5rem;display:flex;flex-direction:column;justify-content:center}
.section-number{font-size:.64rem;letter-spacing:.28em;text-transform:uppercase;color:var(--muted-dark);margin-bottom:3rem}
.intro-headline{font-family:var(--f-serif);font-size:clamp(2.4rem,3.8vw,3.6rem);font-weight:300;line-height:1.18;color:var(--ink);margin-bottom:2.5rem}
.intro-headline em{font-style:italic}
.intro-body{font-size:1.05rem;color:var(--muted-dark);line-height:1.85;max-width:420px;margin-bottom:3rem}
.text-link-gold{font-size:.72rem;letter-spacing:.22em;text-transform:uppercase;color:var(--gold);border-bottom:1px solid var(--gold);padding-bottom:2px;display:inline-block;transition:opacity .3s}
.text-link-gold:hover{opacity:.7}
.intro-right{position:relative;overflow:hidden;min-height:600px}

/* SUITES */
.suite-editorial-row{display:grid;grid-template-columns:1fr 1fr;min-height:70vh}
.suite-editorial-row:nth-child(even){direction:rtl}
.suite-editorial-row:nth-child(even)>*{direction:ltr}
.suite-visual{position:relative;overflow:hidden;min-height:560px}
.suite-text-panel{background:var(--ink);padding:7rem 5rem;display:flex;flex-direction:column;justify-content:center;border-top:1px solid rgba(255,255,255,.08)}
.suite-row-num{font-size:.64rem;letter-spacing:.28em;text-transform:uppercase;color:var(--gold);margin-bottom:2.5rem;display:block}
.suite-title{font-family:var(--f-serif);font-size:clamp(2rem,3.2vw,2.8rem);font-weight:300;line-height:1.2;color:var(--white);margin-bottom:1.8rem;overflow-wrap:break-word}
.suite-desc{font-size:1rem;color:rgba(255,255,255,.6);line-height:1.8;margin-bottom:2.5rem;max-width:380px}
.suite-specs-row{display:flex;gap:2.5rem;padding:2rem 0;border-top:1px solid rgba(255,255,255,.1);border-bottom:1px solid rgba(255,255,255,.1);margin-bottom:2.5rem;flex-wrap:wrap}
.suite-spec{display:flex;flex-direction:column;gap:.3rem}
.suite-spec-label{font-size:.62rem;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.35)}
.suite-spec-value{font-family:var(--f-serif);font-size:1.1rem;color:var(--white)}
.btn-outline-light{font-size:.72rem;letter-spacing:.2em;text-transform:uppercase;color:var(--gold);border:1px solid var(--gold);padding:.9rem 2rem;display:inline-block;transition:all .3s;width:fit-content}
.btn-outline-light:hover{background:var(--gold);color:var(--ink)}

/* RITUALS */
.rituals-section{background:var(--ink);padding:9rem 3rem}
.rituals-header{display:grid;grid-template-columns:1fr 2fr;gap:4rem;margin-bottom:6rem;padding-bottom:4rem;border-bottom:1px solid rgba(255,255,255,.1);align-items:end}
.rituals-header-title{font-family:var(--f-serif);font-size:clamp(2.6rem,4.5vw,4rem);font-weight:300;color:var(--white);line-height:1.1}
.rituals-header-body{font-size:1.05rem;color:rgba(255,255,255,.55);line-height:1.85;max-width:480px;align-self:flex-end}
.rituals-list{display:flex;flex-direction:column}
.ritual-item{display:grid;grid-template-columns:200px 1fr 1fr;gap:3rem;padding:3rem 0;border-bottom:1px solid rgba(255,255,255,.08);align-items:center}
.ritual-time-stamp{font-size:.7rem;letter-spacing:.2em;text-transform:uppercase;color:var(--gold)}
.ritual-name{font-family:var(--f-serif);font-size:1.5rem;font-weight:300;color:var(--white)}
.ritual-desc{font-size:.95rem;color:rgba(255,255,255,.5);line-height:1.75}

/* LOCATION */
.location-split{display:grid;grid-template-columns:1fr 1fr;min-height:70vh}
.location-map-side{position:relative;overflow:hidden;min-height:500px}
.location-map-side img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.location-info-side{background:var(--paper);padding:7rem 5rem;display:flex;flex-direction:column;justify-content:center}
.location-info-side h2{font-family:var(--f-serif);font-size:clamp(2.2rem,3.5vw,3.2rem);font-weight:300;color:var(--ink);line-height:1.18;margin-bottom:2.5rem}
.location-detail-list{display:flex;flex-direction:column;gap:1.8rem;margin-bottom:3.5rem}
.location-detail-item label{display:block;font-size:.64rem;letter-spacing:.22em;text-transform:uppercase;color:var(--muted-dark);margin-bottom:.4rem}
.location-detail-item span,.location-detail-item a{font-family:var(--f-serif);font-size:1.15rem;color:var(--ink)}
.location-detail-item a{color:var(--gold)}

/* BOOKING FORM */
.booking-section{background:var(--ink);padding:9rem 3rem;border-top:1px solid rgba(255,255,255,.08)}
.booking-inner{max-width:1200px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:8rem;align-items:start}
.booking-left-head h2{font-family:var(--f-serif);font-size:clamp(2.6rem,4.5vw,4rem);font-weight:300;color:var(--white);line-height:1.08;margin-bottom:1.8rem}
.booking-left-head p{font-size:1rem;color:rgba(255,255,255,.5);line-height:1.8}
.booking-contacts{margin-top:3.5rem;padding-top:3rem;border-top:1px solid rgba(255,255,255,.1);display:flex;flex-direction:column;gap:1.5rem}
.contact-item label{display:block;font-size:.64rem;letter-spacing:.22em;text-transform:uppercase;color:rgba(255,255,255,.3);margin-bottom:.35rem}
.contact-item span,.contact-item a{font-family:var(--f-serif);font-size:1.2rem;color:var(--white)}
.contact-item a{color:var(--gold)}
.booking-form{display:flex;flex-direction:column;gap:0}
.booking-form-row{display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid rgba(255,255,255,.1)}
.booking-form-row.single{grid-template-columns:1fr}
.form-field-bare{padding:1.75rem 2rem 1.75rem 0;border-right:1px solid rgba(255,255,255,.1);display:flex;flex-direction:column;gap:.5rem;min-width:0}
.form-field-bare:last-child{border-right:none;padding-left:2rem;padding-right:0}
.booking-form-row.single .form-field-bare{padding-left:0;padding-right:0;border-right:none}
.form-field-bare label{font-size:.64rem;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.3);flex-shrink:0}
.form-field-bare input,.form-field-bare select,.form-field-bare textarea{background:none;border:none;outline:none;font-family:var(--f-serif);font-size:1.15rem;color:var(--white);width:100%;padding:0;min-width:0}
.form-field-bare textarea{resize:none;height:80px}
.form-field-bare select option{background:var(--ink);color:var(--white)}
.form-submit-row{padding-top:2.5rem;display:flex;justify-content:flex-end}
.btn-submit-editorial{font-size:.72rem;letter-spacing:.22em;text-transform:uppercase;color:var(--ink);background:var(--gold);border:none;padding:1.1rem 3rem;cursor:pointer;transition:all .3s var(--ease-out);font-family:var(--f-sans);font-weight:500}
.btn-submit-editorial:hover{background:var(--white);transform:translateY(-2px)}

/* FOOTER */
.site-footer{background:var(--ink);padding:3rem;border-top:1px solid rgba(255,255,255,.08);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:1rem}
.footer-hotel-name{font-family:var(--f-serif);font-size:1.1rem;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.4)}
.footer-location{font-size:.68rem;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.3)}

/* RESPONSIVE */
@media(max-width:1024px){
  .intro-editorial,.suite-editorial-row,.location-split,.booking-inner{grid-template-columns:1fr}
  .suite-editorial-row:nth-child(even){direction:ltr}
  .rituals-header{grid-template-columns:1fr;gap:2rem}
  .ritual-item{grid-template-columns:1fr;gap:1rem}
  .book-strip{grid-template-columns:1fr 1fr}
  .book-strip-action{grid-column:1/-1;justify-content:flex-start}
  .hero-content{padding:0 1.5rem 4rem}
  .intro-left{padding:5rem 2rem}
  .suite-text-panel{padding:5rem 2rem}
  .location-info-side{padding:5rem 2rem}
  .booking-section{padding:6rem 1.5rem}
  .booking-inner{gap:4rem}
  .rituals-section{padding:6rem 1.5rem}
  .location-map-side{min-height:350px}
  .suite-specs-row{gap:1.5rem;flex-wrap:wrap}
  .site-nav{padding:1.5rem 1.5rem}
  .nav-links-right .nav-link-item{display:none}
}
@media(max-width:640px){
  .book-strip{grid-template-columns:1fr}
  .book-strip-cell{border-right:none;border-bottom:1px solid rgba(10,10,9,.12);padding:1.5rem}
  .book-strip-action{padding:1.5rem}
  .booking-form-row{grid-template-columns:1fr}
  .form-field-bare{border-right:none;padding-left:0!important;padding-right:0!important}
  .suite-specs-row{flex-direction:column;gap:1rem}
}
`;
}

// ════════════════════════════════════════════════════════════════════════════
// V1 HTML
// ════════════════════════════════════════════════════════════════════════════
function v1HTML() {
  const h = HOTEL;
  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="description" content="${escapeHtml(h.name)} — ${escapeHtml(h.concept)}">
  <title>${escapeHtml(h.name)} — Bozburun</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Instrument+Sans:wght@400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="./styles.css?v=${Date.now()}">
  <script defer src="./app.js?v=${Date.now()}"></script>
</head>
<body data-phone="${escapeHtml(h.cleanPhone)}" data-hotel="${escapeHtml(h.name)}">

<nav class="v1-nav" id="v1Nav">
  <a href="#top" class="nav-brand">
    <div class="nav-logo-disc">D</div>
    <span class="nav-name">${escapeHtml(h.name)}</span>
  </a>
  <div class="nav-right">
    <a href="#rooms" class="nav-link">Odalar</a>
    <a href="#experiences" class="nav-link">Deneyimler</a>
    <a href="#contact" class="nav-link">İletişim</a>
    <a href="#contact" class="nav-cta" data-book>Rezervasyon</a>
  </div>
</nav>

<section class="opening" id="top">
  <div class="opening-spine">
    <span class="spine-text">Bozburun · Marmaris · ${new Date().getFullYear()}</span>
  </div>
  <div class="opening-image">
    <img src="./media/hero.jpg" alt="${escapeHtml(h.name)}" id="heroImg">
    <div class="opening-image-overlay"></div>
  </div>
  <div class="opening-panel">
    <span class="opening-eyebrow">${escapeHtml(h.seaDist)}</span>
    <h1 class="opening-hotel-name">${escapeHtml(h.name)}</h1>
    <p class="opening-tagline">${escapeHtml(h.tagline)}</p>
    <div class="opening-widget">
      <div class="widget-row">
        <div class="widget-field"><label>Giriş</label><input type="date" id="wCheckin"></div>
        <div class="widget-field"><label>Çıkış</label><input type="date" id="wCheckout"></div>
      </div>
      <div class="widget-row">
        <div class="widget-field full"><label>Misafir</label>
          <select id="wGuests"><option>2 Yetişkin</option><option>1 Yetişkin</option><option>3+ Yetişkin</option></select>
        </div>
      </div>
      <button class="widget-submit" id="widgetBtn">Müsaitlik Sorgula</button>
    </div>
  </div>
</section>

<div class="pullquote">
  <p class="pullquote-text">"${escapeHtml(h.concept)}"</p>
  <span class="pullquote-attr">Yeşilova Koyu · Bozburun · Marmaris</span>
</div>

<section id="rooms">
  <div class="rooms-section-head">
    <h2>Odalar &amp;<br><em style="font-style:italic">Süitler</em></h2>
    <p>Her oda, Yeşilova Koyu'nun botanik dokusunu ve kıyı sessizliğini içinize taşır.</p>
  </div>
  ${h.rooms.map((r, i) => `
  <div class="room-strip">
    <img class="room-strip-img" src="${i === 0 ? './media/suite.jpg' : './media/room.jpg'}" alt="${escapeHtml(r.title)}">
    <div class="room-strip-overlay"></div>
    <div class="room-strip-text">
      <span class="room-strip-badge">${escapeHtml(r.badge)}</span>
      <h2 class="room-strip-name">${escapeHtml(r.title)}</h2>
      <p class="room-strip-desc">${escapeHtml(r.desc)}</p>
      <div class="room-strip-specs">
        <div class="rs-spec"><span class="rs-label">Alan</span><span class="rs-value">${escapeHtml(r.size)}</span></div>
        <div class="rs-spec"><span class="rs-label">Manzara</span><span class="rs-value">${escapeHtml(r.view)}</span></div>
        <div class="rs-spec"><span class="rs-label">Yatak</span><span class="rs-value">${escapeHtml(r.bed)}</span></div>
      </div>
      <span class="room-strip-btn" data-suite="${escapeHtml(r.title)}">Bu Odayı Seç →</span>
    </div>
  </div>
  `).join('')}
</section>

<section id="experiences">
  <div class="experiences-head">
    <h2>Defne Lorina'da<br><em style="font-style:italic">Bir Gün</em></h2>
  </div>
  ${h.rituals.map((r, i) => `
  <div class="exp-chapter">
    <div class="exp-chapter-visual">
      <img src="${['./media/hero.jpg','./media/dining.jpg','./media/room.jpg'][i % 3]}" alt="${escapeHtml(r.title)}">
    </div>
    <div class="exp-chapter-text">
      <span class="exp-big-num">0${i + 1}</span>
      <span class="exp-chapter-time">${escapeHtml(r.time)}</span>
      <h3 class="exp-chapter-title">${escapeHtml(r.title)}</h3>
      <p class="exp-chapter-desc">${escapeHtml(r.desc)}</p>
    </div>
  </div>
  `).join('')}
</section>

<div class="gallery-strip" id="galleryStrip">
  <div class="gallery-img"><img src="./media/hero.jpg"   alt="Koy"></div>
  <div class="gallery-img"><img src="./media/suite.jpg"  alt="Süit"></div>
  <div class="gallery-img"><img src="./media/dining.jpg" alt="Yemek"></div>
  <div class="gallery-img"><img src="./media/room.jpg"   alt="Oda"></div>
  <div class="gallery-img"><img src="./media/hero.jpg"   alt="İskele"></div>
</div>

<section class="v1-contact" id="contact">
  <div class="contact-inner">
    <span class="contact-eyebrow">Rezervasyon Talebi</span>
    <h2 class="contact-headline">${escapeHtml(h.name)}</h2>
    <p class="contact-sub">Yerinizi bugün ayırtın, ekibimiz size dönüş yapsın.</p>
    <div class="contact-meta">
      <div class="cm-item"><span class="cm-label">Adres</span><span class="cm-val">${escapeHtml(h.location)}</span></div>
      <div class="cm-item"><span class="cm-label">Telefon</span><span class="cm-val"><a href="tel:${escapeHtml(h.cleanPhone)}">${escapeHtml(h.phone)}</a></span></div>
      <div class="cm-item"><span class="cm-label">WhatsApp</span><span class="cm-val"><a href="https://wa.me/${escapeHtml(h.cleanPhone)}" target="_blank">Hemen Yaz</a></span></div>
    </div>
    <form class="v1-form" id="v1Form" onsubmit="return false;">
      <div class="v1-form-row">
        <div class="v1-field"><label>Ad Soyad *</label><input type="text" id="fName" placeholder="Adınız" required></div>
        <div class="v1-field"><label>Telefon *</label><input type="tel" id="fPhone" placeholder="05XX XXX XX XX" required></div>
      </div>
      <div class="v1-form-row">
        <div class="v1-field"><label>Giriş</label><input type="date" id="fCheckin"></div>
        <div class="v1-field"><label>Çıkış</label><input type="date" id="fCheckout"></div>
      </div>
      <div class="v1-form-row">
        <div class="v1-field"><label>Oda Tercihi</label>
          <select id="fSuite">
            <option>Tüm Odalar</option>
            ${h.rooms.map(r=>`<option value="${escapeHtml(r.title)}">${escapeHtml(r.title)}</option>`).join('')}
          </select>
        </div>
        <div class="v1-field"><label>Misafir</label>
          <select id="fGuests"><option>2 Yetişkin</option><option>1 Yetişkin</option><option>3+ Yetişkin</option></select>
        </div>
      </div>
      <div class="v1-form-row single">
        <div class="v1-field"><label>Özel Not</label><textarea id="fNotes" placeholder="Balayı, botanik bahçe turu, özel karşılama..."></textarea></div>
      </div>
      <div class="v1-submit-row"><button type="button" class="v1-submit-btn" id="fSubmit">WhatsApp ile Gönder</button></div>
    </form>
  </div>
</section>

<footer class="v1-footer">
  <span class="v1-footer-name">${escapeHtml(h.name)}</span>
  <span class="v1-footer-loc">Yeşilova Koyu · Bozburun / Marmaris · ${new Date().getFullYear()}</span>
</footer>
</body></html>`;
}

// ════════════════════════════════════════════════════════════════════════════
// V2 HTML
// ════════════════════════════════════════════════════════════════════════════
function v2HTML() {
  const h = HOTEL;
  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="description" content="${escapeHtml(h.name)} — ${escapeHtml(h.concept)}">
  <title>${escapeHtml(h.name)} — Bozburun</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400;1,500&family=Plus+Jakarta+Sans:wght@300;400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="./styles.css?v=${Date.now()}">
  <script defer src="./app.js?v=${Date.now()}"></script>
</head>
<body data-phone="${escapeHtml(h.cleanPhone)}" data-hotel="${escapeHtml(h.name)}">

<nav class="site-nav" id="siteNav">
  <a href="#top" class="nav-brand">
    <div class="nav-logo-disc">D</div>
    <span class="nav-brand-name">${escapeHtml(h.name)}</span>
  </a>
  <div class="nav-links-right">
    <a href="#suites" class="nav-link-item">Süitler</a>
    <a href="#rituals" class="nav-link-item">Ritüeller</a>
    <a href="#location" class="nav-link-item">Konum</a>
    <a href="#booking" class="nav-cta-text" data-book>Rezervasyon ↗</a>
  </div>
</nav>

<section class="hero-immersive" id="top">
  <div class="hero-bg-image" id="heroBg">
    <img src="./media/hero.jpg" alt="${escapeHtml(h.name)}" id="heroImg">
  </div>
  <div class="hero-overlay"></div>
  <div class="hero-content">
    <span class="hero-eyebrow">${escapeHtml(h.seaDist)} · Bozburun, Marmaris</span>
    <h1 class="hero-title">${escapeHtml(h.name)}</h1>
    <div class="hero-bottom-strip">
      <p class="hero-tagline"><em>${escapeHtml(h.tagline)}</em></p>
      <div class="hero-scroll-cue"><span class="scroll-line"></span><span>Aşağı Kaydır</span></div>
    </div>
  </div>
</section>

<div class="book-strip" id="bookStrip">
  <div class="book-strip-cell"><span class="book-strip-label">Giriş Tarihi</span><input type="date" id="checkin"></div>
  <div class="book-strip-cell"><span class="book-strip-label">Çıkış Tarihi</span><input type="date" id="checkout"></div>
  <div class="book-strip-cell"><span class="book-strip-label">Misafir</span>
    <select id="guests"><option>2 Yetişkin</option><option>1 Yetişkin</option><option>3+ Yetişkin</option></select>
  </div>
  <div class="book-strip-action">
    <button class="book-strip-btn" id="bookStripBtn">
      <span>Müsaitlik Al</span><span class="book-btn-arrow">→</span>
    </button>
  </div>
</div>

<section class="intro-editorial">
  <div class="intro-left">
    <p class="section-number">01 — Hakkımızda</p>
    <h2 class="intro-headline">Botanik koyun<br><em>en sessiz noktası</em></h2>
    <p class="intro-body">${escapeHtml(h.concept)}. Taş mimarisi, botanik bahçesi ve özel iskelesiyle Yeşilova Koyu'nda zamanın yavaşladığı bir konaklama.</p>
    <a href="#booking" class="text-link-gold" data-book>Rezervasyon Talebi ↗</a>
  </div>
  <div class="intro-right">
    <img src="./media/dining.jpg" alt="${escapeHtml(h.name)} Atmosfer">
  </div>
</section>

<section id="suites">
  ${h.rooms.map((r, i) => `
  <article class="suite-editorial-row">
    <div class="suite-visual">
      <img src="${i === 0 ? './media/suite.jpg' : './media/room.jpg'}" alt="${escapeHtml(r.title)}">
    </div>
    <div class="suite-text-panel">
      <span class="suite-row-num">0${i + 2} — ${escapeHtml(r.badge)}</span>
      <h2 class="suite-title">${escapeHtml(r.title)}</h2>
      <p class="suite-desc">${escapeHtml(r.desc)}</p>
      <div class="suite-specs-row">
        <div class="suite-spec"><span class="suite-spec-label">Alan</span><span class="suite-spec-value">${escapeHtml(r.size)}</span></div>
        <div class="suite-spec"><span class="suite-spec-label">Manzara</span><span class="suite-spec-value">${escapeHtml(r.view)}</span></div>
        <div class="suite-spec"><span class="suite-spec-label">Yatak</span><span class="suite-spec-value">${escapeHtml(r.bed)}</span></div>
      </div>
      <a href="#booking" class="btn-outline-light" data-suite-name="${escapeHtml(r.title)}">Bu Odayı Seç ↗</a>
    </div>
  </article>
  `).join('')}
</section>

<section class="rituals-section" id="rituals">
  <div class="rituals-header">
    <h2 class="rituals-header-title">Koyda<br><em style="font-style:italic">bir gün</em></h2>
    <p class="rituals-header-body">Defne Lorina'da zaman farklı akar. Botanik bahçeden özel iskeleye uzanan bu takvim, size bir rehber değil, bir davet sunuyor.</p>
  </div>
  <div class="rituals-list">
    ${h.rituals.map(r => `
    <div class="ritual-item">
      <span class="ritual-time-stamp">${escapeHtml(r.time)}</span>
      <span class="ritual-name">${escapeHtml(r.title)}</span>
      <p class="ritual-desc">${escapeHtml(r.desc)}</p>
    </div>
    `).join('')}
  </div>
</section>

<section class="location-split" id="location">
  <div class="location-map-side">
    <img src="./media/room.jpg" alt="Yeşilova Koyu" style="filter:saturate(.6)">
  </div>
  <div class="location-info-side">
    <p class="section-number">04 — Bize Ulaşın</p>
    <h2>${escapeHtml(h.name)}</h2>
    <div class="location-detail-list">
      <div class="location-detail-item"><label>Adres</label><span>${escapeHtml(h.location)}</span></div>
      <div class="location-detail-item"><label>Telefon</label><a href="tel:${escapeHtml(h.cleanPhone)}">${escapeHtml(h.phone)}</a></div>
      <div class="location-detail-item"><label>WhatsApp</label><a href="https://wa.me/${escapeHtml(h.cleanPhone)}" target="_blank">Mesaj Gönder ↗</a></div>
    </div>
    <a href="#booking" class="text-link-gold" data-book>Rezervasyon Talebi ↗</a>
  </div>
</section>

<section class="booking-section" id="booking">
  <div class="booking-inner">
    <div class="booking-left-head">
      <p class="section-number" style="color:rgba(255,255,255,.3);margin-bottom:2rem">05 — Rezervasyon</p>
      <h2>Yerinizi<br><em style="font-style:italic">ayırtın</em></h2>
      <p>Tarihlerinizi bırakın; ${escapeHtml(h.name)} ekibi en avantajlı doğrudan fiyatla size dönüş yapsın.</p>
      <div class="booking-contacts">
        <div class="contact-item"><label>Resepsiyon</label><a href="tel:${escapeHtml(h.cleanPhone)}">${escapeHtml(h.phone)}</a></div>
        <div class="contact-item"><label>WhatsApp</label><a href="https://wa.me/${escapeHtml(h.cleanPhone)}" target="_blank">Hemen Yazın ↗</a></div>
      </div>
    </div>
    <form class="booking-form" id="bookingForm" onsubmit="return false;">
      <div class="booking-form-row">
        <div class="form-field-bare"><label>Ad Soyad *</label><input type="text" id="v2Name" placeholder="Adınız" required></div>
        <div class="form-field-bare"><label>Telefon *</label><input type="tel" id="v2Phone" placeholder="05XX XXX XX XX" required></div>
      </div>
      <div class="booking-form-row">
        <div class="form-field-bare"><label>Giriş *</label><input type="date" id="v2Checkin"></div>
        <div class="form-field-bare"><label>Çıkış *</label><input type="date" id="v2Checkout"></div>
      </div>
      <div class="booking-form-row">
        <div class="form-field-bare"><label>Oda Tercihi</label>
          <select id="v2Suite">
            <option>Tüm Odalar</option>
            ${h.rooms.map(r=>`<option value="${escapeHtml(r.title)}">${escapeHtml(r.title)}</option>`).join('')}
          </select>
        </div>
        <div class="form-field-bare"><label>Misafir</label>
          <select id="v2Guests"><option>2 Yetişkin</option><option>1 Yetişkin</option><option>3+ Yetişkin</option></select>
        </div>
      </div>
      <div class="booking-form-row single">
        <div class="form-field-bare"><label>Özel İstekleriniz</label><textarea id="v2Notes" placeholder="Balayı karşılaması, botanik bahçe turu, tekne transferi..."></textarea></div>
      </div>
      <div class="form-submit-row"><button type="button" class="btn-submit-editorial" id="v2SubmitBtn">Talebi Gönder ↗</button></div>
    </form>
  </div>
</section>

<footer class="site-footer">
  <span class="footer-hotel-name">${escapeHtml(h.name)}</span>
  <span class="footer-location">Yeşilova Koyu · Bozburun / Marmaris · ${new Date().getFullYear()}</span>
</footer>
</body></html>`;
}

// ════════════════════════════════════════════════════════════════════════════
// SHARED JS (works for both V1 and V2 with appropriate IDs)
// ════════════════════════════════════════════════════════════════════════════
function sharedJS(version) {
  if (version === 'v1') {
    return `document.addEventListener('DOMContentLoaded', () => {
  const heroImg = document.getElementById('heroImg');
  if (heroImg) { heroImg.addEventListener('load', () => heroImg.classList.add('loaded')); if (heroImg.complete) heroImg.classList.add('loaded'); }
  const fill = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  document.getElementById('widgetBtn')?.addEventListener('click', () => {
    fill('fCheckin', document.getElementById('wCheckin')?.value);
    fill('fCheckout', document.getElementById('wCheckout')?.value);
    fill('fGuests', document.getElementById('wGuests')?.value);
    scrollTo('contact');
  });
  document.querySelectorAll('[data-suite]').forEach(el => el.addEventListener('click', () => { fill('fSuite', el.getAttribute('data-suite')); scrollTo('contact'); }));
  document.querySelectorAll('[data-book]').forEach(el => el.addEventListener('click', (e) => { e.preventDefault(); scrollTo('contact'); }));
  const gallery = document.getElementById('galleryStrip');
  if (gallery) {
    let isDown = false, startX, scrollLeft;
    gallery.addEventListener('mousedown', e => { isDown = true; startX = e.pageX - gallery.offsetLeft; scrollLeft = gallery.scrollLeft; });
    gallery.addEventListener('mouseleave', () => isDown = false);
    gallery.addEventListener('mouseup', () => isDown = false);
    gallery.addEventListener('mousemove', e => { if (!isDown) return; e.preventDefault(); gallery.scrollLeft = scrollLeft - (e.pageX - gallery.offsetLeft - startX); });
  }
  document.getElementById('fSubmit')?.addEventListener('click', () => {
    const hotel = document.body.getAttribute('data-hotel') || 'Defne Lorina';
    const phone = document.body.getAttribute('data-phone') || '902524562340';
    const name = document.getElementById('fName')?.value.trim();
    const uPh = document.getElementById('fPhone')?.value.trim();
    const ci = document.getElementById('fCheckin')?.value || '';
    const co = document.getElementById('fCheckout')?.value || '';
    const suite = document.getElementById('fSuite')?.value || 'Standart';
    const gst = document.getElementById('fGuests')?.value || '2 Yetişkin';
    const note = document.getElementById('fNotes')?.value.trim() || '';
    if (!name || !uPh) { alert('Lütfen adınızı ve telefonunuzu girin.'); return; }
    const msg = encodeURIComponent(\`Merhaba \${hotel},\\nAd: \${name} | Tel: \${uPh}\\nGiriş: \${ci||'?'} | Çıkış: \${co||'?'}\\nOda: \${suite} (\${gst})\${note ? '\\nNot: ' + note : ''}\\n\\nMüsaitlik bilgisi alabilir miyim?\`);
    window.open(\`https://wa.me/\${phone}?text=\${msg}\`, '_blank');
  });
});`;
  }
  // v2
  return `document.addEventListener('DOMContentLoaded', () => {
  const heroImg = document.getElementById('heroImg');
  const heroBg = document.getElementById('heroBg');
  if (heroImg && heroBg) { heroImg.addEventListener('load', () => heroBg.classList.add('loaded')); if (heroImg.complete) heroBg.classList.add('loaded'); }
  const nav = document.getElementById('siteNav');
  if (nav) { window.addEventListener('scroll', () => { if (window.scrollY > 80) { nav.style.background = 'rgba(10,10,9,0.92)'; nav.style.backdropFilter = 'blur(20px)'; nav.style.borderBottom = '1px solid rgba(255,255,255,0.08)'; } else { nav.style.background = ''; nav.style.backdropFilter = ''; nav.style.borderBottom = ''; } }, { passive: true }); }
  document.getElementById('bookStripBtn')?.addEventListener('click', () => {
    const ci = document.getElementById('checkin')?.value || '';
    const co = document.getElementById('checkout')?.value || '';
    const g = document.getElementById('guests')?.value || '2 Yetişkin';
    const v2ci = document.getElementById('v2Checkin'); const v2co = document.getElementById('v2Checkout'); const v2g = document.getElementById('v2Guests');
    if (v2ci && ci) v2ci.value = ci; if (v2co && co) v2co.value = co; if (v2g) v2g.value = g;
    document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth' });
  });
  document.querySelectorAll('[data-suite-name]').forEach(el => el.addEventListener('click', (e) => { e.preventDefault(); const s = e.currentTarget.getAttribute('data-suite-name'); const sel = document.getElementById('v2Suite'); if (sel && s) sel.value = s; document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth' }); }));
  document.querySelectorAll('[data-book]').forEach(el => el.addEventListener('click', (e) => { e.preventDefault(); document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth' }); }));
  document.getElementById('v2SubmitBtn')?.addEventListener('click', () => {
    const hotel = document.body.getAttribute('data-hotel') || 'Defne Lorina';
    const phone = document.body.getAttribute('data-phone') || '902524562340';
    const name = document.getElementById('v2Name')?.value.trim();
    const uPh = document.getElementById('v2Phone')?.value.trim();
    const ci = document.getElementById('v2Checkin')?.value || ''; const co = document.getElementById('v2Checkout')?.value || '';
    const suite = document.getElementById('v2Suite')?.value || 'Standart'; const gst = document.getElementById('v2Guests')?.value || '2 Yetişkin';
    const note = document.getElementById('v2Notes')?.value.trim() || '';
    if (!name || !uPh) { alert('Lütfen adınızı ve telefonunuzu girin.'); return; }
    const msg = encodeURIComponent(\`Merhaba \${hotel},\\nAd: \${name} | Tel: \${uPh}\\nGiriş: \${ci||'?'} | Çıkış: \${co||'?'}\\nOda: \${suite} (\${gst})\${note ? '\\nNot: ' + note : ''}\\n\\nMüsaitlik ve fiyat teklifinizi paylaşabilir misiniz?\`);
    window.open(\`https://wa.me/\${phone}?text=\${msg}\`, '_blank');
  });
});`;
}

// ════════════════════════════════════════════════════════════════════════════
// BUILD
// ════════════════════════════════════════════════════════════════════════════
const TEMPLATE_ROOT = path.join(here, '..', 'template-system', 'generated-sites');
const VISUAL_SRC    = path.join(here, '..', 'template-system', 'visual-assets', 'defne-lorina');

function copyMedia(destDir) {
  const mediaDir = path.join(destDir, 'media');
  if (!fs.existsSync(mediaDir)) fs.mkdirSync(mediaDir, { recursive: true });
  const srcFiles = { 'hero.jpg': 'hero.jpg', 'room.jpg': 'suite.jpg', 'room.jpg': 'room.jpg', 'dining.jpg': 'dining.jpg' };
  // visual-assets has: hero.jpg, room.jpg, dining.jpg, logo.jpg
  for (const [src, dst] of [['hero.jpg','hero.jpg'],['room.jpg','suite.jpg'],['room.jpg','room.jpg'],['dining.jpg','dining.jpg']]) {
    const srcPath = path.join(VISUAL_SRC, src);
    if (fs.existsSync(srcPath)) fs.copyFileSync(srcPath, path.join(mediaDir, dst));
  }
}

for (const version of ['v1', 'v2']) {
  const outDir = path.join(TEMPLATE_ROOT, `defne-lorina-${version}`);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  copyMedia(outDir);
  if (version === 'v1') {
    fs.writeFileSync(path.join(outDir, 'styles.css'), v1CSS(), 'utf8');
    fs.writeFileSync(path.join(outDir, 'index.html'), v1HTML(), 'utf8');
  } else {
    fs.writeFileSync(path.join(outDir, 'styles.css'), v2CSS(), 'utf8');
    fs.writeFileSync(path.join(outDir, 'index.html'), v2HTML(), 'utf8');
  }
  fs.writeFileSync(path.join(outDir, 'app.js'), sharedJS(version), 'utf8');
  console.log(`✅ defne-lorina-${version} built → ${outDir}`);
}
console.log('🌿 Defne Lorina V1 + V2 done.');
