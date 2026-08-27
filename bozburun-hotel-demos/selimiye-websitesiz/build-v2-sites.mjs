import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getLuxuryEmblem } from './generate-logos.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataPath = path.join(__dirname, 'hotel-research-v2.json');
const rawData = fs.readFileSync(dataPath, 'utf8');
const detailPath = path.join(__dirname, 'hotel-research-detail.json');
const rawDetailData = fs.readFileSync(detailPath, 'utf8');
const rawV2Data = JSON.parse(rawData);
const detailData = JSON.parse(rawDetailData);
const detailBySlug = new Map(detailData.hotels.map((item) => [item.slug, item]));

const outBaseDir = path.join(__dirname, 'v2-gemini');
if (!fs.existsSync(outBaseDir)) {
  fs.mkdirSync(outBaseDir, { recursive: true });
}

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function syncUniqueMedia(hotel, hotelDir) {
  const mediaDir = path.join(hotelDir, 'media');
  if (!fs.existsSync(mediaDir)) fs.mkdirSync(mediaDir, { recursive: true });

  const mediaConfig = hotel.media || {};
  const sourceHero = mediaConfig.hero ? path.resolve(__dirname, mediaConfig.hero) : null;
  const sourceRoom1 = mediaConfig.room1 ? path.resolve(__dirname, mediaConfig.room1) : null;
  const sourceRoom2 = mediaConfig.room2 ? path.resolve(__dirname, mediaConfig.room2) : null;
  const sourceDining = mediaConfig.dining ? path.resolve(__dirname, mediaConfig.dining) : null;

  if (sourceHero && fs.existsSync(sourceHero)) fs.copyFileSync(sourceHero, path.join(mediaDir, 'hero.jpg'));
  if (sourceRoom1 && fs.existsSync(sourceRoom1)) fs.copyFileSync(sourceRoom1, path.join(mediaDir, 'suite.jpg'));
  if (sourceRoom2 && fs.existsSync(sourceRoom2)) fs.copyFileSync(sourceRoom2, path.join(mediaDir, 'room.jpg'));
  if (sourceDining && fs.existsSync(sourceDining)) fs.copyFileSync(sourceDining, path.join(mediaDir, 'dining.jpg'));
}

// ============================================================================
// EDITORIAL LUXURY CSS — Aman / Six Senses level — NO CARDS, NO GRIDS
// ============================================================================
function generateEditorialCSS(hotel) {
  const theme = hotel.theme || {};
  const primary = theme.primary || '#c5a059';
  const dark = theme.dark || '#0a0a09';

  return `/* ==========================================================================
   ${hotel.name.toUpperCase()} — EDITORIAL LUXURY V2
   Inspired by: Aman Resorts · Six Senses · Alila · Amanjiwo
   Zero glass cards. Zero grids. Pure editorial rhythm.
   ========================================================================== */

@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400;1,500&family=EB+Garamond:ital,wght@0,400;0,500;1,400&family=Plus+Jakarta+Sans:wght@300;400;500&display=swap');

:root {
  --ink: #0a0a09;
  --paper: #f5f2ec;
  --cream: #ede8df;
  --gold: ${primary};
  --gold-light: color-mix(in srgb, ${primary} 60%, #fff);
  --white: #ffffff;
  --muted: rgba(255,255,255,0.55);
  --muted-dark: rgba(10,10,9,0.5);

  --f-serif: 'Cormorant Garamond', 'EB Garamond', Georgia, serif;
  --f-sans: 'Plus Jakarta Sans', system-ui, sans-serif;

  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { font-size: 16px; scroll-behavior: smooth; background: var(--ink); }
body { font-family: var(--f-sans); background: var(--ink); color: var(--white); line-height: 1.6; overflow-x: hidden; -webkit-font-smoothing: antialiased; }
img { display: block; width: 100%; height: 100%; object-fit: cover; }
a { text-decoration: none; color: inherit; }
button { border: none; background: none; cursor: pointer; font-family: inherit; }

/* ─── ULTRA-MINIMAL NAV ───────────────────────────────────────────────────── */
.site-nav {
  position: fixed;
  top: 0; left: 0; right: 0;
  z-index: 100;
  padding: 2rem 3rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  mix-blend-mode: normal;
}
.nav-brand {
  display: flex;
  align-items: center;
  gap: 1rem;
}
.nav-logo-disc {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
}
.nav-logo-disc svg { width: 100%; height: 100%; display: block; }
.nav-brand-name {
  font-family: var(--f-serif);
  font-size: 1.1rem;
  font-weight: 400;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--white);
}
.nav-links-right {
  display: flex;
  align-items: center;
  gap: 2.5rem;
}
.nav-link-item {
  font-size: 0.72rem;
  font-weight: 400;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.75);
  transition: color 0.3s;
}
.nav-link-item:hover { color: var(--white); }
.nav-cta-text {
  font-size: 0.72rem;
  font-weight: 500;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--gold);
  border-bottom: 1px solid var(--gold);
  padding-bottom: 2px;
  transition: opacity 0.3s;
}
.nav-cta-text:hover { opacity: 0.75; }

/* ─── FULL-SCREEN HERO ────────────────────────────────────────────────────── */
.hero-immersive {
  position: relative;
  height: 100vh;
  min-height: 700px;
  overflow: hidden;
}
.hero-bg-image {
  position: absolute;
  inset: 0;
  transform: scale(1.06);
  transition: transform 8s ease-out;
}
.hero-bg-image.loaded { transform: scale(1); }
.hero-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to bottom,
    rgba(10,10,9,0.3) 0%,
    rgba(10,10,9,0.1) 40%,
    rgba(10,10,9,0.65) 85%,
    rgba(10,10,9,0.95) 100%
  );
}
.hero-content {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 0 3rem 5rem;
}
.hero-eyebrow {
  font-size: 0.68rem;
  letter-spacing: 0.32em;
  text-transform: uppercase;
  color: var(--gold);
  display: block;
  margin-bottom: 1.5rem;
}
.hero-title {
  font-family: var(--f-serif);
  font-size: clamp(2.8rem, 6vw, 6rem);
  font-weight: 300;
  line-height: 1.05;
  color: var(--white);
  max-width: 820px;
  margin-bottom: 2rem;
  overflow-wrap: break-word;
  word-break: break-word;
}
.hero-title em {
  font-style: italic;
  font-weight: 300;
}
.hero-bottom-strip {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 2rem;
  flex-wrap: wrap;
}
.hero-tagline {
  font-family: var(--f-serif);
  font-size: 1.1rem;
  font-style: italic;
  color: rgba(255,255,255,0.8);
  max-width: 500px;
  line-height: 1.65;
  overflow-wrap: break-word;
}
.hero-scroll-cue {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.68rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.5);
}
.scroll-line {
  width: 40px;
  height: 1px;
  background: rgba(255,255,255,0.3);
}

/* ─── BOOK STRIP ──────────────────────────────────────────────────────────── */
.book-strip {
  background: var(--paper);
  padding: 0;
  display: grid;
  grid-template-columns: repeat(3, 1fr) auto;
  border-bottom: 1px solid rgba(10,10,9,0.12);
}
.book-strip-cell {
  padding: 2rem 2.5rem;
  border-right: 1px solid rgba(10,10,9,0.12);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.book-strip-cell:last-child { border-right: none; }
.book-strip-label {
  font-size: 0.64rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--muted-dark);
  font-weight: 500;
}
.book-strip-cell input,
.book-strip-cell select {
  font-family: var(--f-serif);
  font-size: 1.05rem;
  color: var(--ink);
  background: none;
  border: none;
  outline: none;
  width: 100%;
  padding: 0;
}
.book-strip-cell select { cursor: pointer; }
.book-strip-action {
  padding: 2rem 3rem;
  background: var(--ink);
  display: flex;
  align-items: center;
  justify-content: center;
}
.book-strip-btn {
  font-size: 0.72rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--white);
  display: flex;
  align-items: center;
  gap: 1rem;
  transition: gap 0.3s var(--ease-out);
}
.book-strip-btn:hover { gap: 1.5rem; }
.book-btn-arrow {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.9rem;
}

/* ─── INTRO EDITORIAL ─────────────────────────────────────────────────────── */
.intro-editorial {
  display: grid;
  grid-template-columns: 1fr 1fr;
  min-height: 80vh;
}
.intro-left {
  background: var(--paper);
  padding: 8rem 5rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.section-number {
  font-size: 0.64rem;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: var(--muted-dark);
  margin-bottom: 3rem;
}
.intro-headline {
  font-family: var(--f-serif);
  font-size: clamp(2.6rem, 4vw, 3.8rem);
  font-weight: 300;
  line-height: 1.18;
  color: var(--ink);
  margin-bottom: 2.5rem;
}
.intro-headline em { font-style: italic; }
.intro-body {
  font-size: 1.05rem;
  color: var(--muted-dark);
  line-height: 1.85;
  max-width: 420px;
  margin-bottom: 3rem;
}
.text-link-gold {
  font-size: 0.72rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--gold);
  border-bottom: 1px solid var(--gold);
  padding-bottom: 2px;
  display: inline-block;
  transition: opacity 0.3s;
}
.text-link-gold:hover { opacity: 0.7; }
.intro-right {
  position: relative;
  overflow: hidden;
  min-height: 600px;
}

/* ─── SUITES: EDITORIAL RHYTHM ────────────────────────────────────────────── */
.suite-editorial-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  min-height: 70vh;
}
.suite-editorial-row:nth-child(even) { direction: rtl; }
.suite-editorial-row:nth-child(even) > * { direction: ltr; }
.suite-visual {
  position: relative;
  overflow: hidden;
  min-height: 560px;
}
.suite-text-panel {
  background: var(--ink);
  padding: 7rem 5rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
  border-top: 1px solid rgba(255,255,255,0.08);
}
.suite-row-num {
  font-size: 0.64rem;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: var(--gold);
  margin-bottom: 2.5rem;
  display: block;
}
.suite-title {
  font-family: var(--f-serif);
  font-size: clamp(2.2rem, 3.5vw, 3rem);
  font-weight: 300;
  line-height: 1.2;
  color: var(--white);
  margin-bottom: 1.8rem;
}
.suite-desc {
  font-size: 1rem;
  color: rgba(255,255,255,0.6);
  line-height: 1.8;
  margin-bottom: 2.5rem;
  max-width: 380px;
}
.suite-specs-row {
  display: flex;
  gap: 3rem;
  padding: 2rem 0;
  border-top: 1px solid rgba(255,255,255,0.1);
  border-bottom: 1px solid rgba(255,255,255,0.1);
  margin-bottom: 2.5rem;
}
.suite-spec {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}
.suite-spec-label {
  font-size: 0.62rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.35);
}
.suite-spec-value {
  font-family: var(--f-serif);
  font-size: 1.1rem;
  color: var(--white);
}
.btn-outline-light {
  font-size: 0.72rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--gold);
  border: 1px solid var(--gold);
  padding: 0.9rem 2rem;
  display: inline-block;
  transition: all 0.3s;
  width: fit-content;
}
.btn-outline-light:hover {
  background: var(--gold);
  color: var(--ink);
}

/* ─── RITUALS: FULL-BLEED DARK SECTION ──────────────────────────────────── */
.rituals-section {
  background: var(--ink);
  padding: 9rem 3rem;
}
.rituals-header {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 4rem;
  margin-bottom: 6rem;
  padding-bottom: 4rem;
  border-bottom: 1px solid rgba(255,255,255,0.1);
  align-items: end;
}
.rituals-header-title {
  font-family: var(--f-serif);
  font-size: clamp(2.8rem, 5vw, 4.5rem);
  font-weight: 300;
  color: var(--white);
  line-height: 1.1;
}
.rituals-header-body {
  font-size: 1.05rem;
  color: rgba(255,255,255,0.55);
  line-height: 1.85;
  max-width: 480px;
  align-self: flex-end;
}
.rituals-list {
  display: flex;
  flex-direction: column;
}
.ritual-item {
  display: grid;
  grid-template-columns: 200px 1fr 1fr;
  gap: 3rem;
  padding: 3rem 0;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  align-items: center;
}
.ritual-time-stamp {
  font-size: 0.7rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--gold);
}
.ritual-name {
  font-family: var(--f-serif);
  font-size: 1.5rem;
  font-weight: 300;
  color: var(--white);
}
.ritual-desc {
  font-size: 0.95rem;
  color: rgba(255,255,255,0.5);
  line-height: 1.75;
}

/* ─── LOCATION SECTION ────────────────────────────────────────────────────── */
.location-split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  min-height: 70vh;
}
.location-map-side {
  position: relative;
  overflow: hidden;
  min-height: 500px;
}
.location-map-side img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.location-info-side {
  background: var(--paper);
  padding: 7rem 5rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.location-info-side h2 {
  font-family: var(--f-serif);
  font-size: clamp(2.4rem, 3.8vw, 3.4rem);
  font-weight: 300;
  color: var(--ink);
  line-height: 1.18;
  margin-bottom: 2.5rem;
}
.location-detail-list {
  display: flex;
  flex-direction: column;
  gap: 1.8rem;
  margin-bottom: 3.5rem;
}
.location-detail-item label {
  display: block;
  font-size: 0.64rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--muted-dark);
  margin-bottom: 0.4rem;
}
.location-detail-item span,
.location-detail-item a {
  font-family: var(--f-serif);
  font-size: 1.15rem;
  color: var(--ink);
}
.location-detail-item a { color: var(--gold); }

/* ─── BOOKING FORM: FULL DARK ─────────────────────────────────────────────── */
.booking-section {
  background: var(--ink);
  padding: 9rem 3rem;
  border-top: 1px solid rgba(255,255,255,0.08);
}
.booking-inner {
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8rem;
  align-items: start;
}
.booking-left-head h2 {
  font-family: var(--f-serif);
  font-size: clamp(2.8rem, 5vw, 4.5rem);
  font-weight: 300;
  color: var(--white);
  line-height: 1.08;
  margin-bottom: 1.8rem;
}
.booking-left-head p {
  font-size: 1rem;
  color: rgba(255,255,255,0.5);
  line-height: 1.8;
}
.booking-contacts {
  margin-top: 3.5rem;
  padding-top: 3rem;
  border-top: 1px solid rgba(255,255,255,0.1);
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}
.contact-item label {
  display: block;
  font-size: 0.64rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.3);
  margin-bottom: 0.35rem;
}
.contact-item span, .contact-item a {
  font-family: var(--f-serif);
  font-size: 1.2rem;
  color: var(--white);
}
.contact-item a { color: var(--gold); }
.booking-form {
  display: flex;
  flex-direction: column;
  gap: 0;
}
.booking-form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border-bottom: 1px solid rgba(255,255,255,0.1);
}
.booking-form-row.single { grid-template-columns: 1fr; }
.form-field-bare {
  padding: 1.75rem 2rem 1.75rem 0;
  border-right: 1px solid rgba(255,255,255,0.1);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 0;
}
.form-field-bare:last-child {
  border-right: none;
  padding-left: 2rem;
  padding-right: 0;
}
.booking-form-row.single .form-field-bare {
  padding-left: 0;
  padding-right: 0;
  border-right: none;
}
.form-field-bare label {
  font-size: 0.64rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.3);
  flex-shrink: 0;
}
.form-field-bare input,
.form-field-bare select,
.form-field-bare textarea {
  background: none;
  border: none;
  outline: none;
  font-family: var(--f-serif);
  font-size: 1.15rem;
  color: var(--white);
  width: 100%;
  padding: 0;
  min-width: 0;
}
.form-field-bare textarea { resize: none; height: 80px; }
.form-field-bare select option { background: var(--ink); color: var(--white); }
.form-submit-row {
  padding-top: 2.5rem;
  display: flex;
  justify-content: flex-end;
}
.btn-submit-editorial {
  font-size: 0.72rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--ink);
  background: var(--gold);
  border: none;
  padding: 1.1rem 3rem;
  cursor: pointer;
  transition: all 0.3s var(--ease-out);
  font-family: var(--f-sans);
  font-weight: 500;
}
.btn-submit-editorial:hover {
  background: var(--white);
  transform: translateY(-2px);
}

/* ─── FOOTER ──────────────────────────────────────────────────────────────── */
.site-footer {
  background: var(--ink);
  padding: 3rem;
  border-top: 1px solid rgba(255,255,255,0.08);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}
.footer-hotel-name {
  font-family: var(--f-serif);
  font-size: 1.1rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.4);
}
.footer-location {
  font-size: 0.68rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.3);
}

@media (max-width: 1024px) {
  .intro-editorial,
  .suite-editorial-row,
  .location-split,
  .booking-inner { grid-template-columns: 1fr; }
  .suite-editorial-row:nth-child(even) { direction: ltr; }
  .rituals-header { grid-template-columns: 1fr; }
  .ritual-item { grid-template-columns: 1fr; gap: 1rem; }
  .book-strip { grid-template-columns: 1fr 1fr; }
  .hero-title { font-size: clamp(2.8rem, 10vw, 5rem); }
  .site-nav { padding: 1.5rem 1.5rem; }
  .nav-links-right .nav-link-item { display: none; }
  .intro-left { padding: 5rem 2rem; }
  .suite-text-panel { padding: 5rem 2rem; }
  .location-info-side { padding: 5rem 2rem; }
  .booking-section { padding: 6rem 1.5rem; }
  .booking-inner { gap: 4rem; }
  .rituals-section { padding: 6rem 1.5rem; }
  .hero-content { padding: 0 1.5rem 4rem; }
}
`;
}

// ============================================================================
// EDITORIAL LUXURY HTML — PURE EDITORIAL RHYTHM
// ============================================================================
function generateEditorialHTML(hotel, detail) {
  const name = hotel.name;
  const slug = hotel.slug;
  const phone = detail?.phone || hotel.phone || '0252 456 23 40';
  const cleanPhone = phone.replace(/\D/g, '') || '902524562340';
  const address = detail?.address || hotel.location || 'Selimiye Koyu, Marmaris / Muğla';
  const tagline = hotel.tagline || 'Koyun sessizliğinde, kıyının tam önünde';
  const concept = hotel.concept || 'Kıyı dinginliği & lüks butik konaklama';
  const audience = hotel.targetAudience || 'Seçkin misafirler & çiftler';
  const seaDist = hotel.seaDistance || 'Denize sıfır & özel ahşap iskele';

  const rooms = (hotel.rooms && hotel.rooms.length) ? hotel.rooms : [
    { title: "Deluxe Deniz Manzaralı Taş Süit", size: "36 m²", view: "Panoramik Deniz Manzaralı", bed: "King Size Yatak", desc: "Geniş verandası, doğal taş dokuları ve sabahın ilk ışıklarını karşılayan ferah yaşam alanı.", badge: "İmza Süit" },
    { title: "Botanik Avlu Bahçe Odası", size: "28 m²", view: "Zeytinlik & Bahçe Avlusu", bed: "Queen Size Yatak", desc: "Begonviller ve zeytin ağaçlarıyla çevrili, serin taş mimarisiyle izole bir kaçış köşesi.", badge: "Sakin Kaçış" }
  ];

  const rituals = (hotel.rituals && hotel.rituals.length) ? hotel.rituals : [
    { time: "08:30 — 11:00", title: "Koyda Yavaş Kahvaltı", desc: "Yerel Selimiye zeytinleri, keçi peyniri ve ev yapımı incir reçeliyle güne acele etmeden başlayın." },
    { time: "14:00 — 17:30", title: "İskelede Tuz & Güneş", desc: "Kristal berraklığındaki koy suyunda yüzün, gölgede kitabınızı okurken dinlenin." },
    { time: "19:30 — 23:00", title: "Gün Batımı & Kıyı Masası", desc: "Gökyüzü kızıla bürünürken taze Ege mezeleri eşliğinde baş başa bir akşam." }
  ];

  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${escapeHtml(name)} — Selimiye Koyu'nda ${escapeHtml(concept)}.">
  <title>${escapeHtml(name)} — Selimiye</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400;1,500&family=EB+Garamond:ital,wght@0,400;0,500;1,400&family=Plus+Jakarta+Sans:wght@300;400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="./styles.css?v=${Date.now()}">
  <script defer src="./app.js?v=${Date.now()}"></script>
</head>
<body data-phone="${escapeHtml(cleanPhone)}" data-hotel="${escapeHtml(name)}">

<!-- ─── MINIMAL NAV ──────────────────────────────────────────────────────── -->
<nav class="site-nav" id="siteNav">
  <a href="#top" class="nav-brand">
    <div class="nav-logo-disc">
      ${getLuxuryEmblem(slug, name, true)}
    </div>
    <span class="nav-brand-name">${escapeHtml(name)}</span>
  </a>

  <div class="nav-links-right">
    <a href="#suites" class="nav-link-item">Süitler</a>
    <a href="#rituals" class="nav-link-item">Ritüeller</a>
    <a href="#location" class="nav-link-item">Konum</a>
    <a href="#booking" class="nav-cta-text" data-book>Rezervasyon ↗</a>
  </div>
</nav>

<main id="top">

<!-- ─── FULL-SCREEN HERO ─────────────────────────────────────────────────── -->
<section class="hero-immersive">
  <div class="hero-bg-image" id="heroBg">
    <img src="./media/hero.jpg" alt="${escapeHtml(name)}" id="heroImg">
  </div>
  <div class="hero-overlay"></div>
  <div class="hero-content">
    <span class="hero-eyebrow">${escapeHtml(seaDist)} · Selimiye, Marmaris</span>
    <h1 class="hero-title">${escapeHtml(name)}</h1>
    <div class="hero-bottom-strip">
      <p class="hero-tagline"><em>${escapeHtml(tagline)}</em></p>
      <div class="hero-scroll-cue">
        <span class="scroll-line"></span>
        <span>Aşağı Kaydır</span>
      </div>
    </div>
  </div>
</section>

<!-- ─── BOOKING STRIP ────────────────────────────────────────────────────── -->
<div class="book-strip" id="bookStrip">
  <div class="book-strip-cell">
    <span class="book-strip-label">Giriş Tarihi</span>
    <input type="date" id="checkin" aria-label="Giriş Tarihi">
  </div>
  <div class="book-strip-cell">
    <span class="book-strip-label">Çıkış Tarihi</span>
    <input type="date" id="checkout" aria-label="Çıkış Tarihi">
  </div>
  <div class="book-strip-cell">
    <span class="book-strip-label">Misafir</span>
    <select id="guests" aria-label="Misafir Sayısı">
      <option value="2 Yetişkin">2 Yetişkin</option>
      <option value="1 Yetişkin">1 Yetişkin</option>
      <option value="3+ Yetişkin">3+ Yetişkin</option>
    </select>
  </div>
  <div class="book-strip-action">
    <button class="book-strip-btn" id="bookStripBtn">
      <span>Müsaitlik Al</span>
      <span class="book-btn-arrow">→</span>
    </button>
  </div>
</div>

<!-- ─── INTRO EDITORIAL ──────────────────────────────────────────────────── -->
<section class="intro-editorial">
  <div class="intro-left">
    <p class="section-number">01 — Hakkımızda</p>
    <h2 class="intro-headline">
      Selimiye'nin<br>
      <em>en sakin köşesi</em>
    </h2>
    <p class="intro-body">
      ${escapeHtml(concept)}. Aşırılıktan kaçıp sadeliğin içinde derinleşen, koyun berrak suyuyla gökyüzünün eridiği o kıyı hattında bulacaksınız bizi.
    </p>
    <a href="#booking" class="text-link-gold" data-book>Rezervasyon Talebi ↗</a>
  </div>
  <div class="intro-right">
    <img src="./media/dining.jpg" alt="${escapeHtml(name)} Yemek & Atmosfer">
  </div>
</section>

<!-- ─── SUITES ───────────────────────────────────────────────────────────── -->
<section id="suites">
  ${rooms.map((room, idx) => `
  <article class="suite-editorial-row">
    <div class="suite-visual">
      <img src="${idx === 0 ? './media/suite.jpg' : './media/room.jpg'}" alt="${escapeHtml(room.title)}">
    </div>
    <div class="suite-text-panel">
      <span class="suite-row-num">0${idx + 2} — ${escapeHtml(room.badge || 'Süit')}</span>
      <h2 class="suite-title">${escapeHtml(room.title)}</h2>
      <p class="suite-desc">${escapeHtml(room.desc)}</p>
      <div class="suite-specs-row">
        <div class="suite-spec">
          <span class="suite-spec-label">Alan</span>
          <span class="suite-spec-value">${escapeHtml(room.size)}</span>
        </div>
        <div class="suite-spec">
          <span class="suite-spec-label">Manzara</span>
          <span class="suite-spec-value">${escapeHtml(room.view)}</span>
        </div>
        <div class="suite-spec">
          <span class="suite-spec-label">Yatak</span>
          <span class="suite-spec-value">${escapeHtml(room.bed)}</span>
        </div>
      </div>
      <a href="#booking" class="btn-outline-light" data-suite-name="${escapeHtml(room.title)}">Bu Odayı Seç ↗</a>
    </div>
  </article>
  `).join('')}
</section>

<!-- ─── RITUALS ──────────────────────────────────────────────────────────── -->
<section class="rituals-section" id="rituals">
  <div class="rituals-header">
    <h2 class="rituals-header-title">
      Koyda<br>
      <em>bir gün</em>
    </h2>
    <p class="rituals-header-body">
      Selimiye'de zaman farklı akar. Sabahın berraklığından gece yıldızlarına, bu takvim size bir rehber değil, bir davet sunuyor.
    </p>
  </div>
  <div class="rituals-list">
    ${rituals.map(r => `
    <div class="ritual-item">
      <span class="ritual-time-stamp">${escapeHtml(r.time)}</span>
      <span class="ritual-name">${escapeHtml(r.title)}</span>
      <p class="ritual-desc">${escapeHtml(r.desc)}</p>
    </div>
    `).join('')}
  </div>
</section>

<!-- ─── LOCATION ─────────────────────────────────────────────────────────── -->
<section class="location-split" id="location">
  <div class="location-map-side">
    <img src="./media/room.jpg" alt="Selimiye Koyu" style="filter: saturate(0.6);">
  </div>
  <div class="location-info-side">
    <p class="section-number">04 — Bize Ulaşın</p>
    <h2>${escapeHtml(name)}</h2>
    <div class="location-detail-list">
      <div class="location-detail-item">
        <label>Adres</label>
        <span>${escapeHtml(address)}</span>
      </div>
      <div class="location-detail-item">
        <label>Telefon</label>
        <a href="tel:${escapeHtml(cleanPhone)}">${escapeHtml(phone)}</a>
      </div>
      <div class="location-detail-item">
        <label>WhatsApp</label>
        <a href="https://wa.me/${escapeHtml(cleanPhone)}?text=Merhaba%20${encodeURIComponent(name)},%20bilgi%20almak%20istiyorum." target="_blank">Mesaj Gönder ↗</a>
      </div>
      <div class="location-detail-item">
        <label>Hedef Kitle</label>
        <span>${escapeHtml(audience)}</span>
      </div>
    </div>
    <a href="#booking" class="text-link-gold" style="color: var(--gold); border-color: var(--gold); font-size: 0.72rem; letter-spacing: 0.22em; text-transform: uppercase;" data-book>Rezervasyon Talebi ↗</a>
  </div>
</section>

<!-- ─── BOOKING FORM ──────────────────────────────────────────────────────── -->
<section class="booking-section" id="booking">
  <div class="booking-inner">
    <div class="booking-left-head">
      <p class="section-number" style="color: rgba(255,255,255,0.3); margin-bottom: 2rem;">05 — Rezervasyon</p>
      <h2>Yerinizi<br><em>ayırtın</em></h2>
      <p>Tarihlerinizi bırakın; ${escapeHtml(name)} ekibi en avantajlı doğrudan fiyatla size dönüş yapsın.</p>
      <div class="booking-contacts">
        <div class="contact-item">
          <label>Resepsiyon</label>
          <a href="tel:${escapeHtml(cleanPhone)}">${escapeHtml(phone)}</a>
        </div>
        <div class="contact-item">
          <label>WhatsApp Canlı Danışma</label>
          <a href="https://wa.me/${escapeHtml(cleanPhone)}" target="_blank">Hemen Yazın ↗</a>
        </div>
      </div>
    </div>

    <form class="booking-form" id="bookingForm" onsubmit="return false;">
      <div class="booking-form-row">
        <div class="form-field-bare">
          <label>Adınız Soyadınız *</label>
          <input type="text" id="v2Name" placeholder="Adınız Soyadınız" required>
        </div>
        <div class="form-field-bare">
          <label>Telefon Numarası *</label>
          <input type="tel" id="v2Phone" placeholder="05XX XXX XX XX" required>
        </div>
      </div>
      <div class="booking-form-row">
        <div class="form-field-bare">
          <label>Giriş Tarihi *</label>
          <input type="date" id="v2Checkin" required>
        </div>
        <div class="form-field-bare">
          <label>Çıkış Tarihi *</label>
          <input type="date" id="v2Checkout" required>
        </div>
      </div>
      <div class="booking-form-row">
        <div class="form-field-bare">
          <label>Oda Tercihi</label>
          <select id="v2Suite">
            <option value="Tüm Odalar">Tüm Odaları Göster</option>
            ${rooms.map(r => `<option value="${escapeHtml(r.title)}">${escapeHtml(r.title)}</option>`).join('')}
          </select>
        </div>
        <div class="form-field-bare">
          <label>Misafir Sayısı</label>
          <select id="v2Guests">
            <option value="2 Yetişkin">2 Yetişkin</option>
            <option value="1 Yetişkin">1 Yetişkin</option>
            <option value="3+ Yetişkin">3+ Yetişkin / Aile</option>
          </select>
        </div>
      </div>
      <div class="booking-form-row single">
        <div class="form-field-bare">
          <label>Özel İstekleriniz</label>
          <textarea id="v2Notes" placeholder="Balayı karşılaması, tekne transferi, geç giriş..."></textarea>
        </div>
      </div>
      <div class="form-submit-row">
        <button type="button" class="btn-submit-editorial" id="v2SubmitBtn">
          Talebi Gönder ↗
        </button>
      </div>
    </form>
  </div>
</section>

</main>

<!-- ─── FOOTER ────────────────────────────────────────────────────────────── -->
<footer class="site-footer">
  <span class="footer-hotel-name">${escapeHtml(name)}</span>
  <span class="footer-location">Selimiye Koyu · Marmaris / Muğla · ${new Date().getFullYear()}</span>
</footer>

</body>
</html>`;
}

function generateEditorialJS() {
  return `document.addEventListener('DOMContentLoaded', () => {
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
        \`Merhaba \${hotel} Ekibi,\\n\\n\` +
        \`👤 \${name} | 📞 \${userPhone}\\n\` +
        \`📅 Giriş: \${checkin || 'Belirtilmedi'} — Çıkış: \${checkout || 'Belirtilmedi'}\\n\` +
        \`🛏️ \${suite} (\${guests})\` +
        (notes ? \`\\n💬 \${notes}\` : '') +
        \`\\n\\nMüsaitlik ve fiyat teklifinizi paylaşabilir misiniz?\`
      );
      window.open(\`https://wa.me/\${phone}?text=\${msg}\`, '_blank');
    });
  }
});
`;
}

function buildAllV2Sites() {
  console.log('💎 Compiling 24 V2 sites — EDITORIAL LUXURY architecture (Aman / Six Senses inspired)...');
  const js = generateEditorialJS();

  for (const hotel of rawV2Data.hotels) {
    const slug = hotel.slug;
    const detail = detailBySlug.get(slug);
    const hotelDir = path.join(outBaseDir, slug);
    if (!fs.existsSync(hotelDir)) fs.mkdirSync(hotelDir, { recursive: true });

    syncUniqueMedia(hotel, hotelDir);

    const css = generateEditorialCSS(hotel);
    const html = generateEditorialHTML(hotel, detail);

    fs.writeFileSync(path.join(hotelDir, 'index.html'), html, 'utf8');
    fs.writeFileSync(path.join(hotelDir, 'styles.css'), css, 'utf8');
    fs.writeFileSync(path.join(hotelDir, 'app.js'), js, 'utf8');
  }

  console.log('✅ Done — 24 sites compiled with true editorial luxury architecture.');
}

buildAllV2Sites();
