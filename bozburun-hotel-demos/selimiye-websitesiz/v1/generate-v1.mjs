import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getLuxuryEmblem } from '../generate-logos.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const parent = path.resolve(here, '..');

const researchV2 = JSON.parse(fs.readFileSync(path.join(parent, 'hotel-research-v2.json'), 'utf8'));
const detailedResearch = JSON.parse(fs.readFileSync(path.join(parent, 'hotel-research-detail.json'), 'utf8'));
const detailBySlug = new Map(detailedResearch.hotels.map((h) => [h.slug, h]));

const escapeHtml = (v = '') =>
  String(v).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// ════════════════════════════════════════════════════════════════════════════
// V1 CSS — COASTAL MAGAZINE LAYOUT
// Structure is COMPLETELY different from V2's dark editorial.
// Opening = split-thirds (no hero), pullquote, full-bleed room strips,
// viewport-chapter experiences, horizontal gallery, centered form.
// ════════════════════════════════════════════════════════════════════════════
function generateV1CSS(hotel) {
  const theme = hotel.theme || {};
  const terra = theme.primary || '#b5714a';
  const ink   = theme.dark    || '#1c1209';

  return `
@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Instrument+Sans:wght@400;500;600&display=swap');

:root {
  --terra:  ${terra};
  --terra2: color-mix(in srgb,${terra} 70%,#000);
  --ink:    ${ink};
  --sand:   #f5f0e8;
  --cream:  #ece6db;
  --stone:  #c8bfb2;
  --mist:   rgba(28,18,9,0.45);
  --f-d: 'DM Serif Display', Georgia, serif;
  --f-s: 'Instrument Sans', system-ui, sans-serif;
  --ease: cubic-bezier(.22,1,.36,1);
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{font-size:16px;scroll-behavior:smooth;background:var(--sand)}
body{font-family:var(--f-s);background:var(--sand);color:var(--ink);line-height:1.6;overflow-x:hidden;-webkit-font-smoothing:antialiased}
img{display:block;width:100%;height:100%;object-fit:cover}
a{text-decoration:none;color:inherit}
button{border:none;background:none;cursor:pointer;font-family:inherit}

/* ── FLOATING MINIMAL NAV ─────────────────────────────────────────────────── */
.v1-nav {
  position: fixed;
  top: 0; left: 0; right: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 2rem;
  background: rgba(245,240,232,0.82);
  backdrop-filter: blur(14px);
  border-bottom: 1px solid rgba(200,191,178,0.5);
}
.nav-brand {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.nav-logo-disc {
  width: 36px; height: 36px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  border: 1px solid var(--stone);
}
.nav-logo-disc svg { width:100%;height:100%;display:block }
.nav-name {
  font-family: var(--f-d);
  font-size: 0.95rem;
  color: var(--ink);
}
.nav-right {
  display: flex;
  align-items: center;
  gap: 2rem;
}
.nav-link {
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--mist);
  transition: color .25s;
}
.nav-link:hover { color: var(--terra) }
.nav-cta {
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--sand);
  background: var(--terra);
  padding: 0.6rem 1.4rem;
  transition: background .25s;
}
.nav-cta:hover { background: var(--terra2) }

/* ── SPLIT-THIRDS OPENING — NOT A HERO ────────────────────────────────────── */
.opening {
  display: grid;
  grid-template-columns: 6rem 1fr 22rem;
  height: 100vh;
  min-height: 680px;
  padding-top: 64px; /* nav height */
}
.opening-spine {
  background: var(--terra);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 2.5rem;
  writing-mode: vertical-rl;
  text-orientation: mixed;
}
.spine-text {
  font-size: 0.62rem;
  font-weight: 600;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.7);
  transform: rotate(180deg);
  white-space: nowrap;
}
.opening-image {
  position: relative;
  overflow: hidden;
}
.opening-image img { position:absolute;inset:0;width:100%;height:100%;object-fit:cover }
.opening-image-overlay {
  position:absolute;inset:0;
  background: linear-gradient(to right, rgba(0,0,0,0.18) 0%, transparent 60%);
}
.opening-panel {
  background: var(--sand);
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 3rem 2.5rem 4rem;
  border-left: 1px solid var(--stone);
  overflow: hidden;
}
.opening-eyebrow {
  font-size: 0.62rem;
  font-weight: 600;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: var(--terra);
  margin-bottom: 1.25rem;
  display: block;
}
.opening-hotel-name {
  font-family: var(--f-d);
  font-size: clamp(2rem, 3.2vw, 3rem);
  line-height: 1.08;
  color: var(--ink);
  margin-bottom: 1.5rem;
  overflow-wrap: break-word;
}
.opening-tagline {
  font-family: var(--f-d);
  font-style: italic;
  font-size: 1rem;
  color: var(--mist);
  line-height: 1.6;
  margin-bottom: 2.5rem;
  overflow-wrap: break-word;
}
/* Inline booking widget */
.opening-widget {
  border: 1px solid var(--stone);
  background: var(--cream);
  display: flex;
  flex-direction: column;
}
.widget-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border-bottom: 1px solid var(--stone);
}
.widget-row:last-child { border-bottom: none }
.widget-field {
  padding: 1rem 1.25rem;
  border-right: 1px solid var(--stone);
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  min-width: 0;
}
.widget-field:last-child { border-right: none }
.widget-field.full { grid-column: 1 / -1; border-right: none }
.widget-field label {
  font-size: 0.58rem;
  font-weight: 600;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--stone);
}
.widget-field input,
.widget-field select {
  font-family: var(--f-d);
  font-size: 0.9rem;
  color: var(--ink);
  background: none;
  border: none;
  outline: none;
  width: 100%;
  min-width: 0;
}
.widget-submit {
  width: 100%;
  padding: 1.1rem;
  background: var(--ink);
  color: var(--sand);
  font-size: 0.65rem;
  font-weight: 600;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  border: none;
  cursor: pointer;
  font-family: var(--f-s);
  transition: background .25s;
}
.widget-submit:hover { background: var(--terra) }

/* ── PULLQUOTE ──────────────────────────────────────────────────────────────── */
.pullquote {
  background: var(--cream);
  padding: 7rem 12vw;
  text-align: center;
  border-top: 1px solid var(--stone);
  border-bottom: 1px solid var(--stone);
}
.pullquote-text {
  font-family: var(--f-d);
  font-style: italic;
  font-size: clamp(1.8rem, 3.5vw, 3rem);
  line-height: 1.35;
  color: var(--ink);
  max-width: 800px;
  margin: 0 auto 2rem;
}
.pullquote-attr {
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: var(--stone);
}

/* ── ROOMS: FULL-WIDTH OVERLAY STRIPS ─────────────────────────────────────── */
.rooms-section {
  padding: 0;
}
.rooms-section-head {
  padding: 5rem 5rem 3rem;
  border-bottom: 1px solid var(--stone);
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 2rem;
  flex-wrap: wrap;
  background: var(--sand);
}
.rooms-section-head h2 {
  font-family: var(--f-d);
  font-size: clamp(2.2rem, 4vw, 3.5rem);
  color: var(--ink);
  line-height: 1.08;
}
.rooms-section-head p {
  font-size: 0.95rem;
  color: var(--mist);
  max-width: 340px;
  line-height: 1.75;
}
/* Each room = full-width image with text panel overlaid on the right */
.room-strip {
  position: relative;
  height: 70vh;
  min-height: 480px;
  overflow: hidden;
  border-bottom: 1px solid rgba(0,0,0,0.1);
}
.room-strip-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 6s ease;
}
.room-strip:hover .room-strip-img { transform: scale(1.04) }
.room-strip-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to right, rgba(28,18,9,0.08) 0%, rgba(28,18,9,0.6) 55%, rgba(28,18,9,0.88) 100%);
}
.room-strip:nth-child(even) .room-strip-overlay {
  background: linear-gradient(to left, rgba(28,18,9,0.08) 0%, rgba(28,18,9,0.6) 55%, rgba(28,18,9,0.88) 100%);
}
.room-strip-text {
  position: absolute;
  top: 50%;
  right: 0;
  transform: translateY(-50%);
  width: 46%;
  padding: 3rem 4rem;
  color: #fff;
}
.room-strip:nth-child(even) .room-strip-text {
  right: auto;
  left: 0;
}
.room-strip-badge {
  font-size: 0.6rem;
  font-weight: 600;
  letter-spacing: 0.26em;
  text-transform: uppercase;
  color: var(--terra);
  background: rgba(255,255,255,0.1);
  border: 1px solid rgba(181,113,74,0.5);
  padding: 0.3rem 0.8rem;
  display: inline-block;
  margin-bottom: 1.25rem;
}
.room-strip-name {
  font-family: var(--f-d);
  font-size: clamp(1.5rem, 2.5vw, 2.4rem);
  line-height: 1.15;
  margin-bottom: 1rem;
  overflow-wrap: break-word;
}
.room-strip-desc {
  font-size: 0.93rem;
  color: rgba(255,255,255,0.72);
  line-height: 1.7;
  margin-bottom: 2rem;
  max-width: 360px;
}
.room-strip-specs {
  display: flex;
  gap: 2.5rem;
  flex-wrap: wrap;
  padding: 1.25rem 0;
  border-top: 1px solid rgba(255,255,255,0.2);
  border-bottom: 1px solid rgba(255,255,255,0.2);
  margin-bottom: 1.75rem;
}
.rs-spec { display:flex;flex-direction:column;gap:.2rem }
.rs-label { font-size:.58rem;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,.4) }
.rs-value { font-family:var(--f-d);font-size:.95rem;color:#fff }
.room-strip-btn {
  font-size: 0.65rem;
  font-weight: 600;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: #fff;
  border-bottom: 1px solid rgba(255,255,255,0.5);
  padding-bottom: 2px;
  transition: border-color .25s,color .25s;
  display: inline-block;
  cursor: pointer;
}
.room-strip-btn:hover { color: var(--terra); border-color: var(--terra) }

/* ── EXPERIENCE CHAPTERS ──────────────────────────────────────────────────── */
.experiences-head {
  background: var(--sand);
  padding: 5rem 5rem 3rem;
  border-top: 1px solid var(--stone);
  border-bottom: 1px solid var(--stone);
}
.experiences-head h2 {
  font-family: var(--f-d);
  font-size: clamp(2.2rem, 4vw, 3.5rem);
  color: var(--ink);
}
.exp-chapter {
  display: grid;
  grid-template-columns: 1fr 1fr;
  min-height: 55vh;
  border-bottom: 1px solid var(--stone);
}
.exp-chapter:nth-child(even) { direction: rtl }
.exp-chapter:nth-child(even) > * { direction: ltr }
.exp-chapter-visual {
  position: relative;
  overflow: hidden;
  min-height: 400px;
}
.exp-chapter-visual img { position:absolute;inset:0;width:100%;height:100%;object-fit:cover }
.exp-chapter-text {
  background: var(--cream);
  padding: 6rem 4.5rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.exp-big-num {
  font-family: var(--f-d);
  font-size: 6rem;
  line-height: 1;
  color: var(--stone);
  margin-bottom: 1rem;
  display: block;
}
.exp-chapter-time {
  font-size: 0.62rem;
  font-weight: 600;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--terra);
  margin-bottom: 1rem;
  display: block;
}
.exp-chapter-title {
  font-family: var(--f-d);
  font-size: clamp(1.5rem, 2.5vw, 2.2rem);
  color: var(--ink);
  line-height: 1.2;
  margin-bottom: 1.25rem;
}
.exp-chapter-desc {
  font-size: 0.97rem;
  color: var(--mist);
  line-height: 1.8;
  max-width: 400px;
}

/* ── HORIZONTAL GALLERY STRIP ─────────────────────────────────────────────── */
.gallery-strip {
  display: flex;
  overflow-x: auto;
  scrollbar-width: none;
  border-top: 1px solid var(--stone);
  border-bottom: 1px solid var(--stone);
  cursor: grab;
}
.gallery-strip::-webkit-scrollbar { display: none }
.gallery-strip:active { cursor: grabbing }
.gallery-img {
  flex: 0 0 auto;
  width: 38vw;
  height: 52vh;
  min-height: 320px;
  position: relative;
  overflow: hidden;
  border-right: 1px solid var(--stone);
}
.gallery-img img { position:absolute;inset:0;width:100%;height:100%;object-fit:cover }

/* ── CENTERED CONTACT FORM ────────────────────────────────────────────────── */
.v1-contact {
  background: var(--sand);
  padding: 8rem 2rem;
  border-top: 1px solid var(--stone);
}
.contact-inner {
  max-width: 680px;
  margin: 0 auto;
}
.contact-eyebrow {
  font-size: 0.62rem;
  font-weight: 600;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: var(--terra);
  margin-bottom: 1rem;
  display: block;
}
.contact-headline {
  font-family: var(--f-d);
  font-size: clamp(2.2rem, 4vw, 3.5rem);
  color: var(--ink);
  line-height: 1.08;
  margin-bottom: 0.75rem;
}
.contact-sub {
  font-family: var(--f-d);
  font-style: italic;
  font-size: 1rem;
  color: var(--mist);
  margin-bottom: 3rem;
}
.contact-meta {
  display: flex;
  gap: 3rem;
  flex-wrap: wrap;
  margin-bottom: 3rem;
  padding-bottom: 2rem;
  border-bottom: 1px solid var(--stone);
}
.cm-item { display:flex;flex-direction:column;gap:.3rem }
.cm-label { font-size:.58rem;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:var(--stone) }
.cm-val { font-family:var(--f-d);font-size:1.05rem;color:var(--ink) }
.cm-val a { color:var(--terra) }

/* Form: no border box, just lines */
.v1-form { display:flex;flex-direction:column;gap:0 }
.v1-form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border-bottom: 1px solid var(--stone);
}
.v1-form-row.single { grid-template-columns: 1fr }
.v1-field {
  padding: 1.25rem 0;
  border-right: 1px solid var(--stone);
  display: flex;
  flex-direction: column;
  gap: .35rem;
  padding-right: 1.5rem;
  min-width: 0;
}
.v1-field:last-child { border-right:none;padding-right:0;padding-left:1.5rem }
.v1-form-row.single .v1-field { border-right:none;padding-left:0;padding-right:0 }
.v1-field label {
  font-size:.58rem;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:var(--stone)
}
.v1-field input,.v1-field select,.v1-field textarea {
  font-family:var(--f-d);font-size:1rem;color:var(--ink);
  background:none;border:none;outline:none;width:100%;min-width:0;padding:0
}
.v1-field textarea { resize:none;height:72px }
.v1-field select option { background:var(--sand) }
.v1-submit-row { padding-top:2rem }
.v1-submit-btn {
  background:var(--terra);
  color:var(--sand);
  font-size:.68rem;font-weight:600;letter-spacing:.2em;text-transform:uppercase;
  padding:1.1rem 3rem;
  border:none;cursor:pointer;
  font-family:var(--f-s);
  transition:background .25s;
}
.v1-submit-btn:hover { background:var(--terra2) }

/* ── FOOTER ──────────────────────────────────────────────────────────────────── */
.v1-footer {
  background: var(--cream);
  border-top: 1px solid var(--stone);
  padding: 2.5rem 5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}
.v1-footer-name { font-family:var(--f-d);font-size:1rem;color:var(--mist) }
.v1-footer-loc { font-size:.65rem;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:var(--stone) }

/* ── RESPONSIVE ──────────────────────────────────────────────────────────────── */
@media(max-width:1100px){
  .opening { grid-template-columns: 4rem 1fr 18rem }
}
@media(max-width:900px){
  .opening { grid-template-columns: 1fr; height: auto; min-height: auto }
  .opening-spine { display: none }
  .opening-image { height: 55vw; min-height: 280px }
  .opening-panel { padding: 2.5rem 1.5rem 3rem; border-left: none; border-top: 1px solid var(--stone) }
  .room-strip { height: auto; min-height: 600px }
  .room-strip-overlay { background: linear-gradient(to top, rgba(28,18,9,0.92) 0%, rgba(28,18,9,0.3) 55%, transparent 100%) !important }
  .room-strip-text { position: static; transform: none; width: 100%; padding: 2rem 1.5rem; background: rgba(28,18,9,0.88); color:#fff }
  .exp-chapter { grid-template-columns: 1fr; direction: ltr !important }
  .exp-chapter:nth-child(even) > * { direction: ltr }
  .exp-chapter-visual { min-height: 280px }
  .exp-chapter-text { padding: 3.5rem 2rem }
  .exp-big-num { font-size: 4rem }
  .gallery-img { width: 70vw; height: 42vh }
  .v1-contact { padding: 5rem 1.5rem }
  .pullquote { padding: 4.5rem 8vw }
  .nav-link { display: none }
  .rooms-section-head { padding: 4rem 2rem 2.5rem }
  .experiences-head { padding: 4rem 2rem 2.5rem }
  .v1-footer { padding: 2rem 2rem }
}
@media(max-width:600px){
  .widget-row { grid-template-columns: 1fr }
  .widget-field { border-right: none; border-bottom: 1px solid var(--stone) }
  .v1-form-row { grid-template-columns: 1fr }
  .v1-field { border-right: none; padding-left: 0 !important; padding-right: 0 !important }
  .contact-meta { gap: 1.5rem }
  .room-strip-specs { gap: 1.5rem }
  .gallery-img { width: 85vw }
}
`;
}

// ════════════════════════════════════════════════════════════════════════════
// V1 HTML — COASTAL MAGAZINE
// ════════════════════════════════════════════════════════════════════════════
function generateV1HTML(hotel, detail) {
  const name      = hotel.name;
  const slug      = hotel.slug;
  const phone     = detail?.phone || hotel.phone || '0252 456 23 40';
  const cleanPh   = phone.replace(/\D/g,'') || '902524562340';
  const address   = detail?.address || hotel.location || 'Selimiye Koyu, Marmaris';
  const tagline   = hotel.tagline  || 'Koyun sessizliğinde, kıyının tam önünde';
  const concept   = hotel.concept  || 'Akdeniz kıyısında butik konaklama';
  const seaDist   = hotel.seaDistance || 'Denize sıfır';

  const rooms = hotel.rooms?.length ? hotel.rooms : [
    { title:'Deniz Manzaralı Taş Süit',  size:'36 m²', view:'Panoramik Deniz', bed:'King Size', desc:'Geniş verandası ve taş mimarisiyle sakin bir kıyı deneyimi.', badge:'İmza Süit' },
    { title:'Botanik Bahçe Odası',        size:'28 m²', view:'Zeytinlik', bed:'Queen Size', desc:'Begonviller ve zeytin ağaçlarıyla çevrili ferah bir köşe.', badge:'Doğa Odası' }
  ];

  const rituals = hotel.rituals?.length ? hotel.rituals : [
    { time:'08:30 — 11:00', title:'Yavaş Sabah Kahvaltısı', desc:'Yerel zeytinler ve ev yapımı reçellerle güne acele etmeden başlayın.' },
    { time:'14:00 — 17:30', title:'Koy Yüzüşü', desc:'Kristal koy sularında yüzün, gölgede dinlenin.' },
    { time:'19:30 — 23:00', title:'Gün Batımı Yemeği', desc:'Taze Ege mezeleriyle gökyüzü kızıla bürünürken baş başa bir akşam.' }
  ];

  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="description" content="${escapeHtml(name)} — ${escapeHtml(concept)}">
  <title>${escapeHtml(name)} — Selimiye</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Instrument+Sans:wght@400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="./styles.css?v=${Date.now()}">
  <script defer src="./app.js?v=${Date.now()}"></script>
</head>
<body data-phone="${escapeHtml(cleanPh)}" data-hotel="${escapeHtml(name)}">

<!-- NAV -->
<nav class="v1-nav" id="v1Nav">
  <a href="#top" class="nav-brand">
    <div class="nav-logo-disc">${getLuxuryEmblem(slug, name, true)}</div>
    <span class="nav-name">${escapeHtml(name)}</span>
  </a>
  <div class="nav-right">
    <a href="#rooms" class="nav-link">Odalar</a>
    <a href="#experiences" class="nav-link">Deneyimler</a>
    <a href="#contact" class="nav-link">İletişim</a>
    <a href="#contact" class="nav-cta" data-book>Rezervasyon</a>
  </div>
</nav>

<!-- ── SPLIT-THIRDS OPENING (no hero) ──────────────────────────────────────── -->
<section class="opening" id="top">
  <div class="opening-spine">
    <span class="spine-text">Selimiye · Marmaris · ${new Date().getFullYear()}</span>
  </div>
  <div class="opening-image">
    <img src="./media/hero.jpg" alt="${escapeHtml(name)}" id="heroImg">
    <div class="opening-image-overlay"></div>
  </div>
  <div class="opening-panel">
    <span class="opening-eyebrow">${escapeHtml(seaDist)}</span>
    <h1 class="opening-hotel-name">${escapeHtml(name)}</h1>
    <p class="opening-tagline">${escapeHtml(tagline)}</p>
    <!-- Inline booking widget inside the panel -->
    <div class="opening-widget">
      <div class="widget-row">
        <div class="widget-field">
          <label>Giriş</label>
          <input type="date" id="wCheckin" aria-label="Giriş tarihi">
        </div>
        <div class="widget-field">
          <label>Çıkış</label>
          <input type="date" id="wCheckout" aria-label="Çıkış tarihi">
        </div>
      </div>
      <div class="widget-row">
        <div class="widget-field full">
          <label>Misafir</label>
          <select id="wGuests" aria-label="Misafir sayısı">
            <option>2 Yetişkin</option>
            <option>1 Yetişkin</option>
            <option>3+ Yetişkin</option>
          </select>
        </div>
      </div>
      <button class="widget-submit" id="widgetBtn">Müsaitlik Sorgula</button>
    </div>
  </div>
</section>

<!-- ── PULLQUOTE ──────────────────────────────────────────────────────────── -->
<div class="pullquote">
  <p class="pullquote-text">"${escapeHtml(concept)}"</p>
  <span class="pullquote-attr">Selimiye Koyu · Marmaris</span>
</div>

<!-- ── ROOMS: FULL-WIDTH STRIPS ──────────────────────────────────────────── -->
<section id="rooms">
  <div class="rooms-section-head">
    <h2>Odalar &amp;<br><em style="font-style:italic">Süitler</em></h2>
    <p>Her oda, Selimiye koyunun sessizliğini ve Akdeniz'in sıcaklığını içinize taşıyacak biçimde tasarlandı.</p>
  </div>
  ${rooms.map((r, i) => `
  <div class="room-strip">
    <img class="room-strip-img" src="${i === 0 ? './media/suite.jpg' : './media/room.jpg'}" alt="${escapeHtml(r.title)}">
    <div class="room-strip-overlay"></div>
    <div class="room-strip-text">
      <span class="room-strip-badge">${escapeHtml(r.badge || 'Süit')}</span>
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

<!-- ── EXPERIENCE CHAPTERS ────────────────────────────────────────────────── -->
<section id="experiences">
  <div class="experiences-head">
    <h2>Selimiye'de<br><em style="font-style:italic">Bir Gün</em></h2>
  </div>
  ${rituals.map((r, i) => `
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

<!-- ── HORIZONTAL GALLERY STRIP ───────────────────────────────────────────── -->
<div class="gallery-strip" id="galleryStrip">
  <div class="gallery-img"><img src="./media/hero.jpg"   alt="Konum"></div>
  <div class="gallery-img"><img src="./media/suite.jpg"  alt="Süit"></div>
  <div class="gallery-img"><img src="./media/dining.jpg" alt="Yemek"></div>
  <div class="gallery-img"><img src="./media/room.jpg"   alt="Oda"></div>
  <div class="gallery-img"><img src="./media/hero.jpg"   alt="Koy"></div>
</div>

<!-- ── CENTERED CONTACT FORM ──────────────────────────────────────────────── -->
<section class="v1-contact" id="contact">
  <div class="contact-inner">
    <span class="contact-eyebrow">Rezervasyon Talebi</span>
    <h2 class="contact-headline">${escapeHtml(name)}</h2>
    <p class="contact-sub">Yerinizi bugün ayırtın, ekibimiz size dönüş yapsın.</p>
    <div class="contact-meta">
      <div class="cm-item"><span class="cm-label">Adres</span><span class="cm-val">${escapeHtml(address)}</span></div>
      <div class="cm-item"><span class="cm-label">Telefon</span><span class="cm-val"><a href="tel:${escapeHtml(cleanPh)}">${escapeHtml(phone)}</a></span></div>
      <div class="cm-item"><span class="cm-label">WhatsApp</span><span class="cm-val"><a href="https://wa.me/${escapeHtml(cleanPh)}" target="_blank">Hemen Yaz</a></span></div>
    </div>
    <form class="v1-form" id="v1Form" onsubmit="return false;">
      <div class="v1-form-row">
        <div class="v1-field"><label>Ad Soyad *</label><input type="text" id="fName" placeholder="Adınız" required></div>
        <div class="v1-field"><label>Telefon *</label><input type="tel" id="fPhone" placeholder="05XX XXX XX XX" required></div>
      </div>
      <div class="v1-form-row">
        <div class="v1-field"><label>Giriş *</label><input type="date" id="fCheckin"></div>
        <div class="v1-field"><label>Çıkış *</label><input type="date" id="fCheckout"></div>
      </div>
      <div class="v1-form-row">
        <div class="v1-field"><label>Oda Tercihi</label>
          <select id="fSuite">
            <option>Tüm Odalar</option>
            ${rooms.map(r=>`<option value="${escapeHtml(r.title)}">${escapeHtml(r.title)}</option>`).join('')}
          </select>
        </div>
        <div class="v1-field"><label>Misafir</label>
          <select id="fGuests"><option>2 Yetişkin</option><option>1 Yetişkin</option><option>3+ Yetişkin</option></select>
        </div>
      </div>
      <div class="v1-form-row single">
        <div class="v1-field"><label>Özel Not</label><textarea id="fNotes" placeholder="Balayı, özel karşılama, geç giriş..."></textarea></div>
      </div>
      <div class="v1-submit-row">
        <button type="button" class="v1-submit-btn" id="fSubmit">WhatsApp ile Gönder</button>
      </div>
    </form>
  </div>
</section>

<!-- FOOTER -->
<footer class="v1-footer">
  <span class="v1-footer-name">${escapeHtml(name)}</span>
  <span class="v1-footer-loc">Selimiye Koyu · Marmaris / Muğla · ${new Date().getFullYear()}</span>
</footer>

</body>
</html>`;
}

function generateV1JS() {
  return `document.addEventListener('DOMContentLoaded', () => {
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
      \`Merhaba \${hotel},\\n\` +
      \`Ad: \${name} | Tel: \${uPh}\\n\` +
      \`Giriş: \${ci||'?'} | Çıkış: \${co||'?'}\\n\` +
      \`Oda: \${suite} (\${gst})\` +
      (note ? \`\\nNot: \${note}\` : '') +
      \`\\n\\nMüsaitlik bilgisi alabilir miyim?\`
    );
    window.open(\`https://wa.me/\${phone}?text=\${msg}\`, '_blank');
  });
});
`;
}

function syncMedia(hotel, hotelDir) {
  const mediaDir = path.join(hotelDir, 'media');
  if (!fs.existsSync(mediaDir)) fs.mkdirSync(mediaDir, { recursive: true });
  const m = hotel.media || {};
  const res = (p) => p ? path.resolve(parent, p) : null;
  const cp  = (src, dst) => { if (src && fs.existsSync(src)) fs.copyFileSync(src, dst); };
  cp(res(m.hero),   path.join(mediaDir, 'hero.jpg'));
  cp(res(m.room1),  path.join(mediaDir, 'suite.jpg'));
  cp(res(m.room2),  path.join(mediaDir, 'room.jpg'));
  cp(res(m.dining), path.join(mediaDir, 'dining.jpg'));
}

// ── BUILD ─────────────────────────────────────────────────────────────────────
console.log('🌊 V1 — COASTAL MAGAZINE (split-thirds opening, room strips, chapter experiences, drag gallery)...');
const js = generateV1JS();
for (const hotel of researchV2.hotels) {
  const hotelDir = path.join(here, hotel.slug);
  if (!fs.existsSync(hotelDir)) fs.mkdirSync(hotelDir, { recursive: true });
  syncMedia(hotel, hotelDir);
  fs.writeFileSync(path.join(hotelDir, 'styles.css'), generateV1CSS(hotel), 'utf8');
  fs.writeFileSync(path.join(hotelDir, 'index.html'), generateV1HTML(hotel, detailBySlug.get(hotel.slug)), 'utf8');
  fs.writeFileSync(path.join(hotelDir, 'app.js'), js, 'utf8');
}
console.log(`✅ V1 done — ${researchV2.hotels.length} Coastal Magazine sites built.`);
