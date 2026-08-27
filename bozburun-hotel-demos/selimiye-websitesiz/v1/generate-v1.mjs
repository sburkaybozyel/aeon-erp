import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getLuxuryEmblem } from '../generate-logos.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const parent = path.resolve(here, '..');

const researchV2 = JSON.parse(fs.readFileSync(path.join(parent, 'hotel-research-v2.json'), 'utf8'));
const detailedResearch = JSON.parse(fs.readFileSync(path.join(parent, 'hotel-research-detail.json'), 'utf8'));
const detailBySlug = new Map(detailedResearch.hotels.map((item) => [item.slug, item]));
const outputRoot = here;

const escapeHtml = (v = '') =>
  String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ─────────────────────────────────────────────────────────────────────────────
// MEDITERRANEAN LIGHT — V1 CSS
// Inspired by: Mykonos boutique hotels · Santorini villas · Turkish coastal pensions
// LIGHT background · warm sand · terracotta · olive · zero dark glass · zero emojis
// ─────────────────────────────────────────────────────────────────────────────
function generateV1CSS(hotel) {
  const theme = hotel.theme || {};
  const accent = theme.primary || '#c0674a'; // terracotta default
  const accentDark = theme.dark || '#2c1a12';

  return `/* ==========================================================================
   ${hotel.name.toUpperCase()} — MEDITERRANEAN LIGHT V1
   Style: Mykonos Boutique · Akdeniz Kıyı · Açık & Sıcak
   Zero glass, zero dark, zero emojis.
   ========================================================================== */

@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Lato:ital,wght@0,300;0,400;0,700;1,300;1,400&family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400&display=swap');

:root {
  --sun: #ffffff;
  --sand: #f7f3ee;
  --linen: #ede8df;
  --dune: #d4c9bb;
  --clay: #a8907e;
  --terra: ${accent};
  --terra-dark: color-mix(in srgb, ${accent} 75%, #1a0a00);
  --olive: #6b7a5a;
  --sea: #2e6b8a;
  --ink: ${accentDark};
  --ink-soft: color-mix(in srgb, ${accentDark} 60%, #fff);
  --ink-muted: color-mix(in srgb, ${accentDark} 35%, #fff);

  --f-display: 'DM Serif Display', 'Cormorant Garamond', Georgia, serif;
  --f-body: 'Lato', system-ui, sans-serif;

  --ease: cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { font-size: 16px; scroll-behavior: smooth; background: var(--sun); }
body { font-family: var(--f-body); background: var(--sun); color: var(--ink); line-height: 1.6; overflow-x: hidden; -webkit-font-smoothing: antialiased; }
img { display: block; width: 100%; height: 100%; object-fit: cover; }
a { text-decoration: none; color: inherit; }
button { border: none; background: none; cursor: pointer; font-family: inherit; }

/* ─── NAV ──────────────────────────────────────────────────────────────────── */
.v1-nav {
  position: fixed;
  top: 0; left: 0; right: 0;
  z-index: 100;
  padding: 1.5rem 3rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(247,243,238,0.88);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--dune);
  transition: background 0.4s;
}
.v1-nav.transparent {
  background: rgba(247,243,238,0);
  border-bottom-color: transparent;
  backdrop-filter: none;
}
.nav-logo-wrap {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}
.nav-logo-circle {
  width: 40px; height: 40px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  border: 1px solid var(--dune);
}
.nav-logo-circle svg { width: 100%; height: 100%; display: block; }
.nav-hotel-name {
  font-family: var(--f-display);
  font-size: 1rem;
  color: var(--ink);
  letter-spacing: 0.04em;
}
.nav-menu {
  display: flex;
  align-items: center;
  gap: 2.5rem;
}
.nav-menu a {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--ink-soft);
  transition: color 0.25s;
}
.nav-menu a:hover { color: var(--terra); }
.nav-book-btn {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--sun);
  background: var(--terra);
  padding: 0.65rem 1.5rem;
  transition: background 0.25s;
}
.nav-book-btn:hover { background: var(--terra-dark); }

/* ─── HERO ─────────────────────────────────────────────────────────────────── */
.v1-hero {
  position: relative;
  height: 100vh;
  min-height: 650px;
  overflow: hidden;
  display: flex;
  align-items: flex-end;
}
.v1-hero-img {
  position: absolute;
  inset: 0;
}
.v1-hero-img img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 8s ease-out;
  transform: scale(1.05);
}
.v1-hero-img img.loaded { transform: scale(1); }
.v1-hero-vignette {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    160deg,
    transparent 30%,
    rgba(247,243,238,0.06) 60%,
    rgba(247,243,238,0.75) 90%,
    rgba(247,243,238,1) 100%
  );
}
.v1-hero-content {
  position: relative;
  z-index: 2;
  padding: 0 5rem 5rem;
  max-width: 800px;
}
.v1-hero-pill {
  display: inline-block;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--terra);
  background: rgba(255,255,255,0.9);
  border: 1px solid color-mix(in srgb, var(--terra) 30%, transparent);
  padding: 0.35rem 1rem;
  margin-bottom: 1.5rem;
}
.v1-hero-title {
  font-family: var(--f-display);
  font-size: clamp(3rem, 6vw, 5.5rem);
  font-weight: 400;
  line-height: 1.05;
  color: var(--ink);
  margin-bottom: 1.5rem;
  overflow-wrap: break-word;
  word-break: break-word;
}
.v1-hero-sub {
  font-family: var(--f-display);
  font-style: italic;
  font-size: 1.2rem;
  color: var(--ink-soft);
  margin-bottom: 2.5rem;
  max-width: 520px;
  line-height: 1.6;
}
.v1-hero-actions {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  flex-wrap: wrap;
}
.btn-primary {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--sun);
  background: var(--terra);
  padding: 1rem 2.5rem;
  transition: all 0.3s var(--ease);
  display: inline-block;
}
.btn-primary:hover {
  background: var(--terra-dark);
  transform: translateY(-2px);
}
.btn-ghost {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--ink);
  border-bottom: 1.5px solid var(--clay);
  padding-bottom: 2px;
  transition: border-color 0.25s;
}
.btn-ghost:hover { border-color: var(--terra); color: var(--terra); }

/* ─── BOOKING STRIP ─────────────────────────────────────────────────────────── */
.v1-book-bar {
  background: var(--linen);
  border-top: 1px solid var(--dune);
  border-bottom: 1px solid var(--dune);
  display: grid;
  grid-template-columns: repeat(3,1fr) auto;
}
.book-bar-cell {
  padding: 1.75rem 2rem;
  border-right: 1px solid var(--dune);
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.book-bar-cell:last-child { border-right: none; }
.book-bar-label {
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--clay);
}
.book-bar-cell input,
.book-bar-cell select {
  font-family: var(--f-display);
  font-size: 1rem;
  color: var(--ink);
  background: none;
  border: none;
  outline: none;
  width: 100%;
  min-width: 0;
}
.book-bar-cell select { cursor: pointer; }
.book-bar-action {
  padding: 1.75rem 2.5rem;
  background: var(--terra);
  display: flex;
  align-items: center;
  justify-content: center;
}
.book-bar-cta {
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--sun);
  display: flex;
  align-items: center;
  gap: 0.75rem;
  transition: gap 0.3s;
}
.book-bar-cta:hover { gap: 1.25rem; }

/* ─── STORY SECTION ─────────────────────────────────────────────────────────── */
.v1-story {
  display: grid;
  grid-template-columns: 5fr 4fr;
  gap: 0;
  min-height: 65vh;
}
.story-text-side {
  padding: 8rem 5rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
  background: var(--sand);
}
.story-label {
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.26em;
  text-transform: uppercase;
  color: var(--terra);
  margin-bottom: 2rem;
  display: block;
}
.story-heading {
  font-family: var(--f-display);
  font-size: clamp(2.2rem, 3.5vw, 3.2rem);
  line-height: 1.18;
  color: var(--ink);
  margin-bottom: 2rem;
}
.story-heading em { font-style: italic; }
.story-body {
  font-size: 1rem;
  line-height: 1.85;
  color: var(--ink-soft);
  max-width: 440px;
  margin-bottom: 2.5rem;
}
.story-signature {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding-top: 2rem;
  border-top: 1px solid var(--dune);
}
.sig-line { width: 32px; height: 1px; background: var(--clay); }
.sig-text {
  font-family: var(--f-display);
  font-style: italic;
  font-size: 0.95rem;
  color: var(--clay);
}
.story-visual-side {
  position: relative;
  overflow: hidden;
  min-height: 500px;
}

/* ─── ROOMS ─────────────────────────────────────────────────────────────────── */
.v1-rooms {
  background: var(--sun);
  padding: 8rem 5rem;
}
.rooms-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 4rem;
  padding-bottom: 2.5rem;
  border-bottom: 1px solid var(--dune);
  flex-wrap: wrap;
  gap: 1.5rem;
}
.rooms-header-left h2 {
  font-family: var(--f-display);
  font-size: clamp(2.4rem, 4vw, 3.5rem);
  color: var(--ink);
  line-height: 1.1;
  margin-top: 0.75rem;
}
.rooms-header-right {
  font-size: 0.95rem;
  color: var(--ink-soft);
  max-width: 320px;
  line-height: 1.75;
}
.rooms-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}
.room-row {
  display: grid;
  grid-template-columns: 2fr 3fr;
  min-height: 420px;
  border-top: 1px solid var(--dune);
}
.room-row:last-child { border-bottom: 1px solid var(--dune); }
.room-row:nth-child(even) { direction: rtl; }
.room-row:nth-child(even) > * { direction: ltr; }
.room-visual {
  position: relative;
  overflow: hidden;
}
.room-info {
  padding: 4rem 4.5rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
  background: var(--sand);
}
.room-badge {
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--terra);
  margin-bottom: 1.25rem;
  display: block;
}
.room-name {
  font-family: var(--f-display);
  font-size: clamp(1.6rem, 2.5vw, 2.2rem);
  color: var(--ink);
  line-height: 1.2;
  margin-bottom: 1.25rem;
  overflow-wrap: break-word;
}
.room-desc {
  font-size: 0.97rem;
  color: var(--ink-soft);
  line-height: 1.8;
  margin-bottom: 2rem;
  max-width: 420px;
}
.room-specs {
  display: flex;
  gap: 2rem;
  flex-wrap: wrap;
  margin-bottom: 2.5rem;
  padding: 1.5rem 0;
  border-top: 1px solid var(--dune);
  border-bottom: 1px solid var(--dune);
}
.spec-item {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.spec-label {
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--clay);
}
.spec-value {
  font-family: var(--f-display);
  font-size: 1rem;
  color: var(--ink);
}

/* ─── EXPERIENCES ──────────────────────────────────────────────────────────── */
.v1-experiences {
  background: var(--linen);
  padding: 8rem 5rem;
}
.exp-header {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 4rem;
  margin-bottom: 5rem;
  padding-bottom: 3rem;
  border-bottom: 1px solid var(--dune);
  align-items: end;
}
.exp-header h2 {
  font-family: var(--f-display);
  font-size: clamp(2.4rem, 4vw, 3.5rem);
  color: var(--ink);
  line-height: 1.1;
}
.exp-header p {
  font-size: 1rem;
  color: var(--ink-soft);
  line-height: 1.8;
  max-width: 460px;
  align-self: flex-end;
}
.exp-list {
  display: flex;
  flex-direction: column;
}
.exp-item {
  display: grid;
  grid-template-columns: 160px 1fr 1.2fr;
  gap: 3rem;
  padding: 2.5rem 0;
  border-bottom: 1px solid var(--dune);
  align-items: start;
}
.exp-item:first-child { border-top: 1px solid var(--dune); }
.exp-num {
  font-family: var(--f-display);
  font-size: 2rem;
  color: var(--dune);
  line-height: 1;
}
.exp-title {
  font-family: var(--f-display);
  font-size: 1.4rem;
  color: var(--ink);
  line-height: 1.25;
}
.exp-desc {
  font-size: 0.95rem;
  color: var(--ink-soft);
  line-height: 1.75;
}

/* ─── CONTACT ──────────────────────────────────────────────────────────────── */
.v1-contact {
  display: grid;
  grid-template-columns: 1fr 1fr;
  min-height: 60vh;
}
.contact-visual {
  position: relative;
  overflow: hidden;
  min-height: 500px;
}
.contact-visual img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.contact-panel {
  background: var(--sand);
  padding: 7rem 5rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.contact-panel h2 {
  font-family: var(--f-display);
  font-size: clamp(2rem, 3.5vw, 3rem);
  color: var(--ink);
  line-height: 1.15;
  margin-bottom: 0.75rem;
  margin-top: 1rem;
}
.contact-tagline {
  font-family: var(--f-display);
  font-style: italic;
  font-size: 1rem;
  color: var(--clay);
  margin-bottom: 3rem;
}
.contact-info-list {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  margin-bottom: 3rem;
}
.ci-item label {
  display: block;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--clay);
  margin-bottom: 0.4rem;
}
.ci-item span, .ci-item a {
  font-family: var(--f-display);
  font-size: 1.15rem;
  color: var(--ink);
}
.ci-item a { color: var(--terra); }
.contact-form {
  display: flex;
  flex-direction: column;
  gap: 0;
  border: 1px solid var(--dune);
}
.cf-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border-bottom: 1px solid var(--dune);
}
.cf-row.single { grid-template-columns: 1fr; }
.cf-field {
  padding: 1.5rem 1.75rem;
  border-right: 1px solid var(--dune);
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  min-width: 0;
}
.cf-field:last-child { border-right: none; }
.cf-row.single .cf-field { border-right: none; }
.cf-field label {
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--clay);
}
.cf-field input,
.cf-field select,
.cf-field textarea {
  font-family: var(--f-display);
  font-size: 1rem;
  color: var(--ink);
  background: none;
  border: none;
  outline: none;
  width: 100%;
  min-width: 0;
  padding: 0;
}
.cf-field textarea { resize: none; height: 70px; }
.cf-field select option { background: var(--sand); }
.cf-submit-row {
  padding: 0;
}
.cf-submit-btn {
  width: 100%;
  padding: 1.25rem;
  background: var(--terra);
  color: var(--sun);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  border: none;
  cursor: pointer;
  font-family: var(--f-body);
  transition: background 0.25s;
}
.cf-submit-btn:hover { background: var(--terra-dark); }

/* ─── FOOTER ────────────────────────────────────────────────────────────────── */
.v1-footer {
  background: var(--linen);
  border-top: 1px solid var(--dune);
  padding: 3rem 5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}
.footer-name {
  font-family: var(--f-display);
  font-size: 1rem;
  color: var(--clay);
  letter-spacing: 0.06em;
}
.footer-loc {
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--clay);
}

/* ─── RESPONSIVE ────────────────────────────────────────────────────────────── */
@media (max-width: 1024px) {
  .v1-nav { padding: 1.25rem 2rem; }
  .nav-menu a { display: none; }
  .v1-hero-content { padding: 0 2rem 4rem; }
  .v1-book-bar { grid-template-columns: 1fr 1fr; }
  .book-bar-action { grid-column: 1 / -1; justify-content: flex-start; }
  .v1-story { grid-template-columns: 1fr; }
  .story-text-side { padding: 5rem 2.5rem; }
  .story-visual-side { min-height: 400px; }
  .v1-rooms { padding: 6rem 2.5rem; }
  .room-row { grid-template-columns: 1fr; min-height: auto; direction: ltr !important; }
  .room-visual { min-height: 320px; }
  .room-info { padding: 3rem 2.5rem; }
  .v1-experiences { padding: 6rem 2.5rem; }
  .exp-header { grid-template-columns: 1fr; gap: 2rem; }
  .exp-item { grid-template-columns: 60px 1fr; gap: 1.5rem; }
  .exp-desc { grid-column: 2; }
  .v1-contact { grid-template-columns: 1fr; }
  .contact-visual { min-height: 350px; }
  .contact-panel { padding: 5rem 2.5rem; }
  .rooms-header { flex-direction: column; align-items: flex-start; }
  .v1-footer { padding: 2.5rem 2rem; }
}

@media (max-width: 640px) {
  .v1-book-bar { grid-template-columns: 1fr; }
  .book-bar-cell { border-right: none; border-bottom: 1px solid var(--dune); }
  .book-bar-action { border-bottom: none; }
  .v1-hero-title { font-size: clamp(2.2rem, 9vw, 3.2rem); }
  .cf-row { grid-template-columns: 1fr; }
  .cf-field { border-right: none; }
  .room-specs { gap: 1rem; }
  .exp-item { grid-template-columns: 1fr; }
  .exp-num { font-size: 1.4rem; }
}
`;
}

// ─────────────────────────────────────────────────────────────────────────────
// MEDITERRANEAN LIGHT — V1 HTML
// ─────────────────────────────────────────────────────────────────────────────
function generateV1HTML(hotel, detail) {
  const name = hotel.name;
  const slug = hotel.slug;
  const phone = detail?.phone || hotel.phone || '0252 456 23 40';
  const cleanPhone = phone.replace(/\D/g, '') || '902524562340';
  const address = detail?.address || hotel.location || 'Selimiye Koyu, Marmaris / Muğla';
  const tagline = hotel.tagline || 'Koyun sessizliğinde, kıyının tam önünde';
  const concept = hotel.concept || 'Kıyı dinginliği ve lüks butik konaklama';
  const audience = hotel.targetAudience || 'Seçkin misafirler ve çiftler';
  const seaDist = hotel.seaDistance || 'Denize sıfır';

  const rooms = (hotel.rooms?.length) ? hotel.rooms : [
    { title: 'Deniz Manzaralı Taş Süit', size: '36 m²', view: 'Panoramik Deniz', bed: 'King Size', desc: 'Geniş verandası ve doğal taş dokusuyla sakin bir konaklama deneyimi.', badge: 'Öne Çıkan Süit' },
    { title: 'Botanik Bahçe Odası', size: '28 m²', view: 'Bahçe & Zeytinlik', bed: 'Queen Size', desc: 'Begonviller ve zeytin ağaçlarıyla çevrili, serin ve ferah bir köşe.', badge: 'Doğa Odası' }
  ];

  const rituals = (hotel.rituals?.length) ? hotel.rituals : [
    { time: '08:30', title: 'Yavaş Sabah Kahvaltısı', desc: 'Yerel Selimiye zeytinleri ve ev yapımı reçellerle güne acele etmeden başlayın.' },
    { time: '14:00', title: 'Koy Yüzüşü & Dinlenme', desc: 'Kristal berraklığındaki koy sularında yüzün, gölgede kitabınızı okuyun.' },
    { time: '19:30', title: 'Gün Batımı Yemeği', desc: 'Taze Ege mezeleri eşliğinde gökyüzü kızıla bürünürken baş başa bir akşam.' }
  ];

  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${escapeHtml(name)} — Selimiye'de ${escapeHtml(concept)}.">
  <title>${escapeHtml(name)} — Selimiye</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Lato:ital,wght@0,300;0,400;0,700;1,300;1,400&family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="./styles.css?v=${Date.now()}">
  <script defer src="./app.js?v=${Date.now()}"></script>
</head>
<body data-phone="${escapeHtml(cleanPhone)}" data-hotel="${escapeHtml(name)}">

<!-- NAV -->
<nav class="v1-nav" id="v1Nav">
  <a href="#top" class="nav-logo-wrap">
    <div class="nav-logo-circle">
      ${getLuxuryEmblem(slug, name, true)}
    </div>
    <span class="nav-hotel-name">${escapeHtml(name)}</span>
  </a>
  <div class="nav-menu">
    <a href="#rooms">Odalar</a>
    <a href="#experiences">Deneyimler</a>
    <a href="#contact">İletişim</a>
    <a href="#contact" class="nav-book-btn" data-book>Rezervasyon</a>
  </div>
</nav>

<!-- HERO -->
<section class="v1-hero" id="top">
  <div class="v1-hero-img">
    <img src="./media/hero.jpg" alt="${escapeHtml(name)}" id="heroImg">
  </div>
  <div class="v1-hero-vignette"></div>
  <div class="v1-hero-content">
    <span class="v1-hero-pill">${escapeHtml(seaDist)} · Selimiye, Marmaris</span>
    <h1 class="v1-hero-title">${escapeHtml(name)}</h1>
    <p class="v1-hero-sub">${escapeHtml(tagline)}</p>
    <div class="v1-hero-actions">
      <a href="#contact" class="btn-primary" data-book>Rezervasyon Talebi</a>
      <a href="#rooms" class="btn-ghost">Odaları Keşfet</a>
    </div>
  </div>
</section>

<!-- BOOKING STRIP -->
<div class="v1-book-bar" id="bookBar">
  <div class="book-bar-cell">
    <span class="book-bar-label">Giriş Tarihi</span>
    <input type="date" id="v1Checkin" aria-label="Giriş">
  </div>
  <div class="book-bar-cell">
    <span class="book-bar-label">Çıkış Tarihi</span>
    <input type="date" id="v1Checkout" aria-label="Çıkış">
  </div>
  <div class="book-bar-cell">
    <span class="book-bar-label">Misafir</span>
    <select id="v1Guests" aria-label="Misafir">
      <option>2 Yetişkin</option>
      <option>1 Yetişkin</option>
      <option>3+ Yetişkin</option>
    </select>
  </div>
  <div class="book-bar-action">
    <button class="book-bar-cta" id="bookBarBtn">
      <span>Müsaitlik Sorgula</span>
      <span>→</span>
    </button>
  </div>
</div>

<!-- STORY -->
<section class="v1-story">
  <div class="story-text-side">
    <span class="story-label">Hakkımızda</span>
    <h2 class="story-heading">Selimiye'nin<br><em>en sıcak köşesi</em></h2>
    <p class="story-body">${escapeHtml(concept)}. Kalabalıktan kaçıp Akdeniz'in berrak sularında dinginlik arayan misafirlerimizi, taş mimarisi ve yeşil bahçesiyle karşılıyoruz.</p>
    <div class="story-signature">
      <span class="sig-line"></span>
      <span class="sig-text">${escapeHtml(audience)}</span>
    </div>
  </div>
  <div class="story-visual-side">
    <img src="./media/dining.jpg" alt="${escapeHtml(name)} atmosfer">
  </div>
</section>

<!-- ROOMS -->
<section class="v1-rooms" id="rooms">
  <div class="rooms-header">
    <div class="rooms-header-left">
      <span class="story-label">Konaklamanız</span>
      <h2>Odalar &amp;<br>Süitler</h2>
    </div>
    <p class="rooms-header-right">Her oda, Selimiye koyunun sessizliğini ve Akdeniz'in sıcaklığını içinize taşıyacak biçimde tasarlandı.</p>
  </div>
  <div class="rooms-list">
    ${rooms.map((r, i) => `
    <div class="room-row">
      <div class="room-visual">
        <img src="${i === 0 ? './media/suite.jpg' : './media/room.jpg'}" alt="${escapeHtml(r.title)}">
      </div>
      <div class="room-info">
        <span class="room-badge">${escapeHtml(r.badge || 'Süit')}</span>
        <h3 class="room-name">${escapeHtml(r.title)}</h3>
        <p class="room-desc">${escapeHtml(r.desc)}</p>
        <div class="room-specs">
          <div class="spec-item"><span class="spec-label">Alan</span><span class="spec-value">${escapeHtml(r.size)}</span></div>
          <div class="spec-item"><span class="spec-label">Manzara</span><span class="spec-value">${escapeHtml(r.view)}</span></div>
          <div class="spec-item"><span class="spec-label">Yatak</span><span class="spec-value">${escapeHtml(r.bed)}</span></div>
        </div>
        <a href="#contact" class="btn-ghost" data-suite="${escapeHtml(r.title)}">Bu Odayı Seç</a>
      </div>
    </div>
    `).join('')}
  </div>
</section>

<!-- EXPERIENCES -->
<section class="v1-experiences" id="experiences">
  <div class="exp-header">
    <h2>Selimiye'de<br><em>Bir Gün</em></h2>
    <p>Zaman burada farklı akar. Sabah kahvaltısından gece yıldızlarına uzanan bu takvim, size bir rehber değil bir davet sunuyor.</p>
  </div>
  <div class="exp-list">
    ${rituals.map((r, i) => `
    <div class="exp-item">
      <span class="exp-num">0${i + 1}</span>
      <span class="exp-title">${escapeHtml(r.title)}</span>
      <p class="exp-desc">${escapeHtml(r.desc)}</p>
    </div>
    `).join('')}
  </div>
</section>

<!-- CONTACT -->
<section class="v1-contact" id="contact">
  <div class="contact-visual">
    <img src="./media/room.jpg" alt="Selimiye Koyu">
  </div>
  <div class="contact-panel">
    <span class="story-label">Rezervasyon</span>
    <h2>${escapeHtml(name)}</h2>
    <p class="contact-tagline">Yerinizi bugün ayırtın.</p>
    <div class="contact-info-list">
      <div class="ci-item"><label>Adres</label><span>${escapeHtml(address)}</span></div>
      <div class="ci-item"><label>Telefon</label><a href="tel:${escapeHtml(cleanPhone)}">${escapeHtml(phone)}</a></div>
      <div class="ci-item"><label>WhatsApp</label><a href="https://wa.me/${escapeHtml(cleanPhone)}" target="_blank">Hemen Yaz</a></div>
    </div>
    <form class="contact-form" id="v1Form" onsubmit="return false;">
      <div class="cf-row">
        <div class="cf-field"><label>Ad Soyad *</label><input type="text" id="cfName" placeholder="Adınız" required></div>
        <div class="cf-field"><label>Telefon *</label><input type="tel" id="cfPhone" placeholder="05XX XXX XX XX" required></div>
      </div>
      <div class="cf-row">
        <div class="cf-field"><label>Giriş *</label><input type="date" id="cfCheckin"></div>
        <div class="cf-field"><label>Çıkış *</label><input type="date" id="cfCheckout"></div>
      </div>
      <div class="cf-row">
        <div class="cf-field"><label>Oda Tercihi</label>
          <select id="cfSuite">
            <option>Tüm Odalar</option>
            ${rooms.map(r => `<option value="${escapeHtml(r.title)}">${escapeHtml(r.title)}</option>`).join('')}
          </select>
        </div>
        <div class="cf-field"><label>Misafir</label>
          <select id="cfGuests">
            <option>2 Yetişkin</option>
            <option>1 Yetişkin</option>
            <option>3+ Yetişkin</option>
          </select>
        </div>
      </div>
      <div class="cf-row single">
        <div class="cf-field"><label>Özel Notunuz</label><textarea id="cfNotes" placeholder="Balayı, özel karşılama, geç giriş..."></textarea></div>
      </div>
      <div class="cf-submit-row">
        <button type="button" class="cf-submit-btn" id="cfSubmit">WhatsApp ile Gönder</button>
      </div>
    </form>
  </div>
</section>

<!-- FOOTER -->
<footer class="v1-footer">
  <span class="footer-name">${escapeHtml(name)}</span>
  <span class="footer-loc">Selimiye Koyu · Marmaris / Muğla · ${new Date().getFullYear()}</span>
</footer>

</body>
</html>`;
}

function generateV1JS() {
  return `document.addEventListener('DOMContentLoaded', () => {
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
        \`Merhaba \${hotel} Ekibi,\\n\\n\` +
        \`Ad: \${name} | Tel: \${userPhone}\\n\` +
        \`Giriş: \${checkin || 'Belirtilmedi'} | Çıkış: \${checkout || 'Belirtilmedi'}\\n\` +
        \`Oda: \${suite} (\${guests})\` +
        (notes ? \`\\nNot: \${notes}\` : '') +
        \`\\n\\nMüsaitlik bilgisi alabilir miyim?\`
      );
      window.open(\`https://wa.me/\${phone}?text=\${msg}\`, '_blank');
    });
  }
});
`;
}

function syncMedia(hotel, hotelDir) {
  const mediaDir = path.join(hotelDir, 'media');
  if (!fs.existsSync(mediaDir)) fs.mkdirSync(mediaDir, { recursive: true });
  const m = hotel.media || {};
  const resolve = (p) => p ? path.resolve(parent, p) : null;
  const copy = (src, dest) => { if (src && fs.existsSync(src)) fs.copyFileSync(src, dest); };
  copy(resolve(m.hero), path.join(mediaDir, 'hero.jpg'));
  copy(resolve(m.room1), path.join(mediaDir, 'suite.jpg'));
  copy(resolve(m.room2), path.join(mediaDir, 'room.jpg'));
  copy(resolve(m.dining), path.join(mediaDir, 'dining.jpg'));
}

// ─── BUILD ALL V1 ────────────────────────────────────────────────────────────
console.log('🌊 Building V1 sites — MEDITERRANEAN LIGHT (Mykonos boutique style)...');
const js = generateV1JS();

for (const hotel of researchV2.hotels) {
  const slug = hotel.slug;
  const detail = detailBySlug.get(slug);
  const hotelDir = path.join(outputRoot, slug);
  if (!fs.existsSync(hotelDir)) fs.mkdirSync(hotelDir, { recursive: true });

  syncMedia(hotel, hotelDir);

  fs.writeFileSync(path.join(hotelDir, 'styles.css'), generateV1CSS(hotel), 'utf8');
  fs.writeFileSync(path.join(hotelDir, 'index.html'), generateV1HTML(hotel, detail), 'utf8');
  fs.writeFileSync(path.join(hotelDir, 'app.js'), js, 'utf8');
}

console.log(`✅ V1 done — ${researchV2.hotels.length} sites rebuilt with Mediterranean Light architecture.`);
