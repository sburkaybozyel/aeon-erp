import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataPath = path.join(__dirname, 'hotel-research-v2.json');
const rawData = fs.readFileSync(dataPath, 'utf8');
const detailPath = path.join(__dirname, 'hotel-research-detail.json');
const rawDetailData = fs.readFileSync(detailPath, 'utf8');
const rawV2Data = JSON.parse(rawData);
const detailData = JSON.parse(rawDetailData);

const outBaseDir = path.join(__dirname, 'v2-gemini');
if (!fs.existsSync(outBaseDir)) {
  fs.mkdirSync(outBaseDir, { recursive: true });
}

function singlePhone(value) {
  if (typeof value !== 'string') return '0252 456 23 40';
  const matches = value.match(/0\d{3}[\s\d]{7,}/g) || [];
  return matches.length >= 1 ? matches[0] : '0252 456 23 40';
}

function enrichHotel(hotel) {
  const detail = detailData.hotels.find(item => item.slug === hotel.slug) || {};
  const factualPhone = detail.phone || hotel.phone || '0252 456 23 40';
  return {
    ...hotel,
    phone: factualPhone,
    contactPhone: singlePhone(factualPhone),
    address: detail.address || hotel.location || 'Selimiye Koyu, Marmaris / Muğla',
    conceptRooms: hotel.rooms || [],
    conceptHighlights: hotel.highlights || [],
    conceptRituals: hotel.rituals || [],
    conceptFaq: hotel.faq || []
  };
}

const hotels = rawV2Data.hotels.map(enrichHotel);

function escapeHtml(value='') {
  return String(value).replace(/[&<>"']/g,(char)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}

// Generate Haute Editorial Gazette CSS for V2
function generateV2EditorialCSS(hotel) {
  return `/* ==========================================================================
   SELİMİYE HOTELS — HAUTE EDITORIAL MEDITERRANEAN GAZETTE (V2)
   Design: Editorial Magazine / Travertine Linen / Cypress Green
   Hotel: ${hotel.name}
   ========================================================================== */

:root {
  --font-serif: 'Cormorant Garamond', Georgia, serif;
  --font-display: 'Italiana', 'Cormorant Garamond', Georgia, serif;
  --font-title: 'Playfair Display', Georgia, serif;
  --font-sans: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;

  /* Palette: Warm Alabaster Linen & Cypress Emerald */
  --bg-page: #fdfbf7;
  --bg-surface: #ffffff;
  --bg-sand: #f5f0e6;
  --bg-terracotta-soft: #fcf6f0;

  --text-main: #181d19;
  --text-body: #3c4a41;
  --text-muted: #6e7e75;
  --text-light: #9baaa2;

  --cypress: #143527;
  --cypress-light: #20503c;
  --terracotta: #b85d38;
  --gold-antique: #b38b38;
  --gold-pale: #f3df95;

  --border-light: rgba(20, 53, 39, 0.08);
  --border-medium: rgba(20, 53, 39, 0.16);
  --border-gold: rgba(179, 139, 56, 0.35);

  --shadow-magazine: 0 15px 40px -10px rgba(20, 53, 39, 0.07);
  --shadow-lift: 0 25px 60px -15px rgba(20, 53, 39, 0.14);

  --radius-xs: 4px;
  --radius-sm: 8px;
  --radius-md: 16px;
  --radius-lg: 24px;
  --radius-pill: 9999px;
  --transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  scroll-behavior: smooth;
  font-size: 16px;
  background-color: var(--bg-page);
  color: var(--text-main);
}

body.v2-editorial-gazette {
  font-family: var(--font-sans);
  background-color: var(--bg-page);
  color: var(--text-main);
  line-height: 1.7;
  overflow-x: hidden;
  position: relative;
  -webkit-font-smoothing: antialiased;
}

.container-editorial {
  width: 100%;
  max-width: 1240px;
  margin: 0 auto;
  padding: 0 2rem;
  position: relative;
  z-index: 2;
}

/* Masthead */
.editorial-masthead {
  background: var(--bg-page);
  border-bottom: 1px solid var(--border-light);
  padding: 1.5rem 0 1rem;
  position: sticky;
  top: 0;
  z-index: 100;
  transition: var(--transition);
}
.editorial-masthead.scrolled {
  padding: 0.75rem 0;
  box-shadow: var(--shadow-magazine);
  background: rgba(253, 251, 247, 0.96);
  backdrop-filter: blur(20px);
}

.masthead-center-brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  margin-bottom: 1rem;
  text-decoration: none;
}
.brand-logo-emblem {
  width: 76px;
  height: 76px;
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 0.75rem;
  box-shadow: 0 10px 30px rgba(20, 53, 39, 0.16);
  transition: var(--transition);
}
.brand-logo-emblem img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}
.brand-logo-emblem:hover {
  transform: scale(1.05);
  box-shadow: 0 14px 35px rgba(20, 53, 39, 0.25);
}
.brand-gazette-title {
  font-family: var(--font-display);
  font-size: 1.6rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--cypress);
  line-height: 1;
}
.brand-gazette-sub {
  font-size: 0.65rem;
  letter-spacing: 0.28em;
  color: var(--gold-antique);
  text-transform: uppercase;
  margin-top: 4px;
}

.masthead-split-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid var(--border-light);
  padding-top: 0.75rem;
}
.split-nav-left, .split-nav-right {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}
.e-nav-link {
  font-family: var(--font-serif);
  font-size: 1.05rem;
  color: var(--text-main);
  text-decoration: none;
  font-weight: 500;
  transition: var(--transition);
  position: relative;
}
.e-nav-link:hover {
  color: var(--terracotta);
}

.masthead-quick-cta {
  display: flex;
  align-items: center;
  gap: 1rem;
}
.btn-editorial-book {
  background: var(--cypress);
  color: #ffffff;
  border: none;
  font-family: var(--font-sans);
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 0.6rem 1.3rem;
  border-radius: var(--radius-pill);
  cursor: pointer;
  transition: var(--transition);
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.btn-editorial-book:hover {
  background: var(--terracotta);
  transform: translateY(-2px);
}

/* Hero */
.editorial-hero {
  padding: 4rem 0 5rem;
  border-bottom: 1px solid var(--border-light);
  background: radial-gradient(circle at 50% 0%, rgba(245, 240, 230, 0.8), transparent 70%);
}
.hero-triptych-grid {
  display: grid;
  grid-template-columns: 1fr 1.35fr 1fr;
  gap: 1.75rem;
  align-items: center;
  margin-bottom: 3.5rem;
}
.triptych-frame-side {
  height: 420px;
  border-radius: var(--radius-md);
  overflow: hidden;
  box-shadow: var(--shadow-magazine);
}
.triptych-frame-side img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.triptych-center-hero {
  position: relative;
  height: 540px;
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-lift);
  border: 4px solid #ffffff;
}
.triptych-center-hero img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.triptych-overlay-badge {
  position: absolute;
  bottom: 1.5rem;
  left: 1.5rem;
  right: 1.5rem;
  background: rgba(255, 255, 255, 0.94);
  backdrop-filter: blur(15px);
  padding: 1.25rem 1.5rem;
  border-radius: var(--radius-md);
  text-align: center;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
}
.badge-quote-italic {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 1.15rem;
  color: var(--cypress);
  display: block;
  margin-bottom: 4px;
}
.badge-loc-tag {
  font-size: 0.72rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--gold-antique);
  font-weight: 700;
}

.hero-editorial-titles {
  text-align: center;
  max-width: 860px;
  margin: 0 auto 3rem;
}
.e-kicker {
  font-size: 0.76rem;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: var(--terracotta);
  font-weight: 700;
  margin-bottom: 0.75rem;
}
.e-headline {
  font-family: var(--font-display);
  font-size: clamp(2.4rem, 4.8vw, 4rem);
  font-weight: 400;
  line-height: 1.15;
  color: var(--cypress);
  margin-bottom: 1.25rem;
}
.e-headline em {
  font-family: var(--font-serif);
  font-style: italic;
  color: var(--terracotta);
}
.e-lead {
  font-size: 1.1rem;
  color: var(--text-body);
  line-height: 1.8;
}

/* Concierge Dock */
.concierge-desk-dock {
  background: #ffffff;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  padding: 1.25rem 1.75rem;
  box-shadow: var(--shadow-lift);
  max-width: 1060px;
  margin: 0 auto;
}
.c-desk-form {
  display: grid;
  grid-template-columns: repeat(4, 1fr) auto;
  gap: 1.25rem;
  align-items: end;
}
.c-field-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.c-field-group label {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--cypress);
  text-transform: uppercase;
}
.c-input, .c-select {
  background: var(--bg-sand);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-xs);
  padding: 0.65rem 0.85rem;
  font-family: var(--font-sans);
  font-size: 0.88rem;
  color: var(--text-main);
  outline: none;
  transition: var(--transition);
}
.c-input:focus, .c-select:focus {
  border-color: var(--cypress);
  background: #ffffff;
}

/* Story */
.editorial-section {
  padding: 6.5rem 0;
  border-bottom: 1px solid var(--border-light);
}
.bg-warm-sand {
  background-color: var(--bg-sand);
}

.magazine-story-grid {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 4.5rem;
  align-items: center;
}
.drop-cap-paragraph {
  font-size: 1.15rem;
  line-height: 1.85;
  color: var(--text-body);
  margin-bottom: 1.5rem;
}
.drop-cap-paragraph::first-letter {
  font-family: var(--font-display);
  font-size: 3.8rem;
  float: left;
  line-height: 0.8;
  margin-right: 0.75rem;
  color: var(--cypress);
}

.story-quote-card {
  border-left: 3px solid var(--terracotta);
  padding-left: 1.5rem;
  margin: 2rem 0;
}
.story-quote-card blockquote {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 1.3rem;
  color: var(--cypress);
  line-height: 1.6;
}
.story-quote-card cite {
  display: block;
  font-size: 0.78rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--gold-antique);
  margin-top: 0.5rem;
  font-style: normal;
  font-weight: 700;
}

.polaroid-stack-frame {
  position: relative;
}
.polaroid-img-main {
  border-radius: var(--radius-md);
  overflow: hidden;
  box-shadow: var(--shadow-lift);
  border: 6px solid #ffffff;
  height: 480px;
}
.polaroid-img-main img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.polaroid-caption-tape {
  background: #ffffff;
  padding: 1rem 1.25rem;
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-magazine);
  position: absolute;
  bottom: -1.5rem;
  right: -1.5rem;
  max-width: 260px;
  border: 1px solid var(--border-light);
}
.polaroid-caption-tape strong {
  font-family: var(--font-display);
  font-size: 0.95rem;
  color: var(--cypress);
  display: block;
}
.polaroid-caption-tape small {
  font-size: 0.74rem;
  color: var(--text-muted);
}

/* Lookbook */
.section-editorial-head {
  text-align: center;
  max-width: 760px;
  margin: 0 auto 4rem;
}
.lookbook-vertical-stack {
  display: flex;
  flex-direction: column;
  gap: 3.5rem;
}
.residence-editorial-row {
  display: grid;
  grid-template-columns: 1.25fr 1fr;
  gap: 3.5rem;
  align-items: center;
  background: #ffffff;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-magazine);
  transition: var(--transition);
}
.residence-editorial-row:hover {
  box-shadow: var(--shadow-lift);
  transform: translateY(-4px);
}
.residence-editorial-row.reverse {
  grid-template-columns: 1fr 1.25fr;
}
.residence-editorial-row.reverse .r-visual {
  order: 2;
}

.r-visual {
  height: 380px;
  position: relative;
  overflow: hidden;
}
.r-visual img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.8s ease;
}
.residence-editorial-row:hover .r-visual img {
  transform: scale(1.05);
}
.r-badge {
  position: absolute;
  top: 1.25rem;
  left: 1.25rem;
  background: #ffffff;
  color: var(--cypress);
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 0.85rem;
  font-weight: 600;
  padding: 4px 14px;
  border-radius: var(--radius-pill);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.r-details {
  padding: 3rem;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
.r-serial {
  font-size: 0.72rem;
  letter-spacing: 0.22em;
  color: var(--gold-antique);
  text-transform: uppercase;
  font-weight: 700;
  margin-bottom: 0.35rem;
}
.r-title {
  font-family: var(--font-display);
  font-size: 1.85rem;
  color: var(--cypress);
  margin-bottom: 0.75rem;
}
.r-desc {
  font-size: 0.94rem;
  color: var(--text-body);
  line-height: 1.75;
  margin-bottom: 1.5rem;
}
.r-specs-table {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  border-top: 1px solid var(--border-light);
  border-bottom: 1px solid var(--border-light);
  padding: 0.85rem 0;
  margin-bottom: 1.75rem;
}
.spec-box span {
  display: block;
  font-size: 0.7rem;
  color: var(--text-muted);
  text-transform: uppercase;
}
.spec-box strong {
  font-size: 0.88rem;
  color: var(--cypress);
}

.btn-reserve-gold {
  background: transparent;
  border: 1.5px solid var(--cypress);
  color: var(--cypress);
  font-family: var(--font-sans);
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 0.65rem 1.4rem;
  border-radius: var(--radius-pill);
  cursor: pointer;
  align-self: flex-start;
  transition: var(--transition);
}
.btn-reserve-gold:hover {
  background: var(--cypress);
  color: #ffffff;
}

/* Tasting Menu */
.gastronomy-editorial-box {
  display: grid;
  grid-template-columns: 1fr 1.15fr;
  gap: 4rem;
  align-items: center;
}
.menu-tasting-card {
  background: #ffffff;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-lg);
  padding: 2.75rem;
  box-shadow: var(--shadow-lift);
}
.tasting-header {
  text-align: center;
  border-bottom: 1px solid var(--border-light);
  padding-bottom: 1.5rem;
  margin-bottom: 1.75rem;
}
.tasting-header h3 {
  font-family: var(--font-display);
  font-size: 1.6rem;
  color: var(--cypress);
}
.tasting-course-list {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}
.course-item {
  display: flex;
  gap: 1.25rem;
}
.course-num {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 1.4rem;
  color: var(--terracotta);
  line-height: 1;
}
.course-body strong {
  display: block;
  font-family: var(--font-display);
  font-size: 1.05rem;
  color: var(--cypress);
  margin-bottom: 2px;
}
.course-body p {
  font-size: 0.86rem;
  color: var(--text-muted);
}

.gastro-video-editorial {
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-lift);
  border: 6px solid #ffffff;
}
.gastro-video-editorial video {
  width: 100%;
  height: 380px;
  object-fit: cover;
  display: block;
}

/* Nautical Logbook */
.nautical-logbook-deck {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2rem;
}
.logbook-card {
  background: #ffffff;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  padding: 2rem;
  box-shadow: var(--shadow-magazine);
  transition: var(--transition);
}
.logbook-card:hover {
  transform: translateY(-4px);
  border-color: var(--cypress);
}
.logbook-top {
  display: flex;
  justify-content: space-between;
  font-size: 0.72rem;
  color: var(--gold-antique);
  font-weight: 700;
  letter-spacing: 0.1em;
  margin-bottom: 1rem;
}
.logbook-card h4 {
  font-family: var(--font-display);
  font-size: 1.35rem;
  color: var(--cypress);
  margin-bottom: 0.75rem;
}
.logbook-card p {
  font-size: 0.9rem;
  color: var(--text-body);
  line-height: 1.7;
}

/* Curated Salons */
.salons-editorial-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2rem;
}
.salon-card {
  background: #ffffff;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  padding: 2.25rem;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  box-shadow: var(--shadow-magazine);
  transition: var(--transition);
}
.salon-card:hover {
  transform: translateY(-5px);
  box-shadow: var(--shadow-lift);
}
.salon-badge-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.25rem;
}
.salon-num {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 1.5rem;
  color: var(--gold-antique);
}
.salon-card h4 {
  font-family: var(--font-display);
  font-size: 1.3rem;
  color: var(--cypress);
  margin-bottom: 0.75rem;
}
.salon-card p {
  font-size: 0.9rem;
  color: var(--text-body);
  line-height: 1.7;
  margin-bottom: 1.5rem;
}
.salon-footer {
  border-top: 1px solid var(--border-light);
  padding-top: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.btn-inquire-salon {
  background: transparent;
  border: none;
  color: var(--terracotta);
  font-weight: 700;
  font-size: 0.84rem;
  cursor: pointer;
}

/* Reservation Salon */
.reservation-salon-card {
  background: #ffffff;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-lg);
  padding: 3.5rem;
  box-shadow: var(--shadow-lift);
}
.salon-layout {
  display: grid;
  grid-template-columns: 1fr 1.15fr;
  gap: 4rem;
}
.salon-left h2 {
  font-family: var(--font-display);
  font-size: 2.2rem;
  color: var(--cypress);
  margin-bottom: 1rem;
}
.salon-contacts {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  margin: 2rem 0;
}
.sc-item strong {
  display: block;
  font-size: 0.74rem;
  color: var(--gold-antique);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.sc-item span, .sc-item a {
  color: var(--text-main);
  font-size: 0.95rem;
  text-decoration: none;
}

.salon-form-box {
  background: var(--bg-sand);
  border: 1px solid var(--border-light);
  padding: 2.25rem;
  border-radius: var(--radius-md);
}
.salon-form-box h3 {
  font-family: var(--font-display);
  font-size: 1.45rem;
  color: var(--cypress);
  margin-bottom: 0.35rem;
}
.editorial-form {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
  margin-top: 1.5rem;
}
.form-duo {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}
.ed-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.ed-field label {
  font-size: 0.74rem;
  font-weight: 700;
  color: var(--cypress);
  text-transform: uppercase;
}
.ed-field input, .ed-field select, .ed-field textarea {
  background: #ffffff;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-xs);
  padding: 0.65rem 0.85rem;
  font-family: var(--font-sans);
  font-size: 0.88rem;
  outline: none;
}

.editorial-footer {
  background: #ffffff;
  border-top: 1px solid var(--border-light);
  padding: 4.5rem 0 2rem;
}
.footer-editorial-grid {
  display: grid;
  grid-template-columns: 1.5fr 1fr 1fr 1.2fr;
  gap: 3rem;
  margin-bottom: 3.5rem;
}
.f-brand-title {
  font-family: var(--font-display);
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--cypress);
}

.modal-editorial-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(20, 53, 39, 0.5);
  backdrop-filter: blur(15px);
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  opacity: 0;
  pointer-events: none;
  transition: var(--transition);
}
.modal-editorial-backdrop.active {
  opacity: 1;
  pointer-events: auto;
}
.modal-editorial-window {
  background: #ffffff;
  border-radius: var(--radius-lg);
  max-width: 520px;
  width: 100%;
  padding: 2.5rem;
  position: relative;
  box-shadow: var(--shadow-lift);
}
.modal-close-btn {
  position: absolute;
  top: 1.25rem;
  right: 1.25rem;
  background: var(--bg-sand);
  border: none;
  color: var(--cypress);
  width: 32px;
  height: 32px;
  border-radius: 50%;
  cursor: pointer;
}

@media (max-width: 1024px) {
  .split-nav-left, .split-nav-right, .masthead-quick-cta { display: none; }
  .hero-triptych-grid { grid-template-columns: 1fr; }
  .triptych-frame-side { display: none; }
  .magazine-story-grid, .gastronomy-editorial-box, .salon-layout { grid-template-columns: 1fr; gap: 3rem; }
  .residence-editorial-row, .residence-editorial-row.reverse { grid-template-columns: 1fr; }
  .nautical-logbook-deck, .salons-editorial-grid { grid-template-columns: 1fr; }
  .footer-editorial-grid { grid-template-columns: 1fr 1fr; }
}

@media (max-width: 640px) {
  .c-desk-form { grid-template-columns: 1fr; }
  .reservation-salon-card { padding: 1.75rem; }
  .form-duo { grid-template-columns: 1fr; }
  .footer-editorial-grid { grid-template-columns: 1fr; }
}
`;
}

// Generate HTML for V2 (Haute Editorial Magazine Layout)
function generateV2EditorialHTML(hotel) {
  const name = hotel.name;
  const phone = hotel.phone || '0252 456 23 40';
  const cleanPhone = phone.replace(/\D/g, '') || '902524562340';
  const address = hotel.address || 'Selimiye Koyu, Marmaris / Muğla';
  const tagline = hotel.tagline || 'Selimiye’de Doğaya Yakın, Denize Açık Sakin Bir Konaklama';
  const concept = hotel.concept || 'Kıyı Dinginliği & Butik Konaklama Sanatı';

  const rooms = (hotel.rooms && hotel.rooms.length) ? hotel.rooms : [
    {
      title: "Deluxe Deniz Manzaralı Taş Süit",
      size: "36 m²",
      view: "Panoramik Deniz Manzaralı",
      bed: "King Size Yatak",
      desc: "Geniş verandası, doğal taş dokuları ve sabahın ilk ışıklarını karşılayan ferah yaşam alanı.",
      badge: "İmza Süit"
    },
    {
      title: "Botanik Avlu Bahçe Odası",
      size: "28 m²",
      view: "Zeytinlik & Bahçe Avlusu",
      bed: "Queen Size Yatak",
      desc: "Begonviller ve zeytin ağaçlarıyla çevrili, serin taş mimarisiyle izole bir kaçış köşesi.",
      badge: "Sakin Kaçış"
    }
  ];

  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
  <meta name="description" content="${escapeHtml(name)} — Selimiye Koyu'nda ${escapeHtml(concept)}. Haute Horlogerie & Mediterranean Luxury Gazette.">
  <title>${escapeHtml(name)} — Selimiye | Haute Editorial Gazette (V2)</title>
  
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Italiana&family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  
  <link rel="stylesheet" href="./styles.css">
  <script defer src="./app.js"></script>
</head>
<body class="v2-editorial-gazette" data-phone="${escapeHtml(cleanPhone)}" data-hotel="${escapeHtml(name)}">

  <!-- TOP CENTER CLASSICAL MASTHEAD -->
  <header class="editorial-masthead" id="editorialMasthead">
    <div class="container-editorial">
      
      <a href="#top" class="masthead-center-brand">
        <div class="brand-logo-emblem">
          <img src="./media/logo.svg" alt="${escapeHtml(name)} Logo" width="100%" height="100%">
        </div>
        <span class="brand-gazette-title">${escapeHtml(name).toUpperCase()}</span>
        <span class="brand-gazette-sub">RESORT & PRIVATE PIER · SELİMİYE</span>
      </a>

      <div class="masthead-split-bar">
        <nav class="split-nav-left">
          <a href="#story" class="e-nav-link">Felsefe & Hikaye</a>
          <a href="#residences" class="e-nav-link">Süitler & Rezidanslar</a>
          <a href="#gastronomy" class="e-nav-link">Bağlar & Gastronomi</a>
        </nav>

        <div class="masthead-quick-cta">
          <a href="tel:${escapeHtml(cleanPhone)}" class="e-nav-link" title="Resepsiyon">📞 ${escapeHtml(phone)}</a>
          <button class="btn-editorial-book" data-book>
            <span>Rezervasyon</span>
            <i>↗</i>
          </button>
        </div>

        <nav class="split-nav-right">
          <a href="#nautical" class="e-nav-link">Karia Rotası</a>
          <a href="#salons" class="e-nav-link">Küratörlü Deneyimler</a>
          <a href="#concierge" class="e-nav-link">İletişim</a>
        </nav>
      </div>

    </div>
  </header>

  <main id="top">
    
    <!-- HIGH-FASHION HERO TRIPTYCH -->
    <section class="editorial-hero">
      <div class="container-editorial">
        
        <div class="hero-editorial-titles" data-reveal>
          <div class="e-kicker">HAUTE EDITORIAL EDITION · SELİMİYE</div>
          <h1 class="e-headline">${escapeHtml(name)}:<br><em>${escapeHtml(tagline)}</em></h1>
          <p class="e-lead">Kristal Yeşilova ve Selimiye sularında, masif kestane ve doğal kireçtaşı dokuların sükunetle buluştuğu yüksek Ege konaklama sanatı.</p>
        </div>

        <div class="hero-triptych-grid" data-reveal>
          <div class="triptych-frame-side">
            <img src="./media/room.jpg" alt="Süit Detayı">
          </div>
          <div class="triptych-center-hero">
            <img src="./media/hero.jpg" alt="${escapeHtml(name)} Ana Görsel">
            <div class="triptych-overlay-badge">
              <span class="badge-quote-italic">“Zamanın durduğu, denizin nefes aldığı kıyı.”</span>
              <span class="badge-loc-tag">SELİMİYE KOYU · ÖZEL İSKELE</span>
            </div>
          </div>
          <div class="triptych-frame-side">
            <img src="./media/dining.jpg" alt="İskele Masası">
          </div>
        </div>

        <!-- Concierge Desk Booking Dock -->
        <div class="concierge-desk-dock" data-reveal>
          <form class="c-desk-form" onsubmit="return false;">
            <div class="c-field-group">
              <label>GİRİŞ TARİHİ</label>
              <input type="date" id="heroCheckin" class="c-input" required>
            </div>
            <div class="c-field-group">
              <label>ÇIKIŞ TARİHİ</label>
              <input type="date" id="heroCheckout" class="c-input" required>
            </div>
            <div class="c-field-group">
              <label>MİSAFİR</label>
              <select id="heroGuests" class="c-select">
                <option value="2 Yetişkin">2 Yetişkin</option>
                <option value="1 Yetişkin">1 Yetişkin</option>
                <option value="3 Yetişkin">3 Yetişkin</option>
                <option value="4+ Yetişkin">4+ Yetişkin / Aile</option>
              </select>
            </div>
            <div class="c-field-group">
              <label>SÜİT TERCİHİ</label>
              <select id="heroSuite" class="c-select">
                <option value="all">Tüm Koleksiyon</option>
                ${rooms.map(r => `<option value="${escapeHtml(r.title)}">${escapeHtml(r.title)}</option>`).join('')}
              </select>
            </div>
            <button type="button" class="btn-editorial-book" id="heroSubmitBtn" style="height:42px;">
              <span>Müsaitlik Sorgula →</span>
            </button>
          </form>
        </div>

      </div>
    </section>

    <!-- STORY: LA DOLCE VITA & TAŞIN BELLEĞİ -->
    <section class="editorial-section" id="story">
      <div class="container-editorial">
        <div class="magazine-story-grid">
          
          <div data-reveal>
            <div class="e-kicker">01. FELSEFE & MİMARİ</div>
            <h2 class="e-headline" style="font-size:2.8rem; text-align:left; margin-bottom:1.5rem;">Taşın Serinliğinde,<br><em>Yavaşlayan Bir Ege Hikayesi.</em></h2>
            
            <p class="drop-cap-paragraph">
              ${escapeHtml(name)}, modern telaşlardan arınmış, doğanın kendi ritmine teslim olan bir yaşam alanıdır. Selimiye’nin antik zeytinlikleri ve kristal suları arasına yerleşen taş mimarimiz, Ege’nin bin yıllık taş ustalığını çağdaş bir lüks duygusuyla harmanlar.
            </p>

            <div class="story-quote-card">
              <blockquote>“Burada lüks, altın varaklarda değil; sabah denize açılan kapının sessizliğinde ve dalga seslerinde gizlidir.”</blockquote>
              <cite>— ${escapeHtml(name)} Concierge Felsefesi</cite>
            </div>
          </div>

          <div class="polaroid-stack-frame" data-reveal>
            <div class="polaroid-img-main">
              <img src="./media/suite_hd.jpg" alt="Taş Mimari">
            </div>
            <div class="polaroid-caption-tape">
              <strong>${escapeHtml(name)}</strong>
              <small>Özel Ahşap İskele & Avlu</small>
            </div>
          </div>

        </div>
      </div>
    </section>

    <!-- RESIDENCES LOOKBOOK -->
    <section class="editorial-section bg-warm-sand" id="residences">
      <div class="container-editorial">
        
        <div class="section-editorial-head" data-reveal>
          <div class="e-kicker">02. REZİDANSLAR & SÜİTLER</div>
          <h2 class="e-headline">Koleksiyon Odaları</h2>
          <p class="e-lead">Her biri bağımsız teras, keten tekstiller ve panoramik koy manzarası sunan özel konaklama alanları.</p>
        </div>

        <div class="lookbook-vertical-stack">
          ${rooms.map((room, idx) => `
            <article class="residence-editorial-row ${idx % 2 === 1 ? 'reverse' : ''}" data-reveal>
              <div class="r-visual">
                <img src="${idx === 0 ? './media/suite.jpg' : './media/room.jpg'}" alt="${escapeHtml(room.title)}">
                <span class="r-badge">${escapeHtml(room.badge || 'Özel Seri')}</span>
              </div>
              <div class="r-details">
                <div>
                  <span class="r-serial">REZİDANS N° 0${idx + 1}</span>
                  <h3 class="r-title">${escapeHtml(room.title)}</h3>
                  <p class="r-desc">${escapeHtml(room.desc || 'Ferah banyo, doğal keten dokular ve dingin koy manzarası.')}</p>
                </div>
                <div>
                  <div class="r-specs-table">
                    <div class="spec-box"><span>ALAN</span><strong>${escapeHtml(room.size || '36 m²')}</strong></div>
                    <div class="spec-box"><span>MANZARA</span><strong>${escapeHtml(room.view || 'Deniz & Avlu')}</strong></div>
                    <div class="spec-box"><span>YATAK</span><strong>${escapeHtml(room.bed || 'King Size')}</strong></div>
                  </div>
                  <button class="btn-reserve-gold" data-suite-name="${escapeHtml(room.title)}">
                    <span>Rezerve Et ↗</span>
                  </button>
                </div>
              </div>
            </article>
          `).join('')}
        </div>

      </div>
    </section>

    <!-- GASTRONOMY: TASTING MENU -->
    <section class="editorial-section" id="gastronomy">
      <div class="container-editorial">
        <div class="gastronomy-editorial-box">
          
          <div class="menu-tasting-card" data-reveal>
            <div class="tasting-header">
              <span class="e-kicker">BAHÇEDEN VE DENİZDEN</span>
              <h3>Tadım Sofrası</h3>
            </div>
            <div class="tasting-course-list">
              <div class="course-item">
                <span class="course-num">I.</span>
                <div class="course-body">
                  <strong>Organik Köy Kahvaltısı</strong>
                  <p>Bozburun çam balı, taze keçi peynirleri ve taş fırın ekmekleri.</p>
                </div>
              </div>
              <div class="course-item">
                <span class="course-num">II.</span>
                <div class="course-body">
                  <strong>Erken Hasat Zeytinyağlılar</strong>
                  <p>Bahçemizden toplanan şifalı otlar ve soğuk sıkım zeytinyağı.</p>
                </div>
              </div>
              <div class="course-item">
                <span class="course-num">III.</span>
                <div class="course-body">
                  <strong>Günlük Kıyı Avı & Izgara</strong>
                  <p>Selimiye balıkçılarından günlük taze deniz balıkları ve kalamar.</p>
                </div>
              </div>
            </div>
          </div>

          <div class="gastro-video-editorial" data-reveal>
            <video autoplay muted loop playsinline preload="metadata" poster="./media/dining.jpg">
              <source src="./media/decor.mp4" type="video/mp4">
            </video>
          </div>

        </div>
      </div>
    </section>

    <!-- NAUTICAL LOGBOOK & COVES -->
    <section class="editorial-section bg-warm-sand" id="nautical">
      <div class="container-editorial">
        
        <div class="section-editorial-head" data-reveal>
          <div class="e-kicker">03. DESTİNASYON REHBERİ</div>
          <h2 class="e-headline">Denizcilik & Koylar Seyir Defteri</h2>
        </div>

        <div class="nautical-logbook-deck">
          <div class="logbook-card" data-reveal>
            <div class="logbook-top"><span>KOORDİNAT</span><span>36°42'N 28°05'E</span></div>
            <h4>Sığliman Koyu</h4>
            <p>Durgun göl berraklığında, sığ ve ılık suları ile Selimiye’nin en korunaklı yüzme koyu.</p>
          </div>
          <div class="logbook-card" data-reveal>
            <div class="logbook-top"><span>MESAFE</span><span>15 DK DENİZDEN</span></div>
            <h4>Kamelya & Dişlice</h4>
            <p>Antik manastır kalıntıları ve volkanik kaya dehlizleriyle ünlü turkuaz ada turları.</p>
          </div>
          <div class="logbook-card" data-reveal>
            <div class="logbook-top"><span>PARKUR</span><span>KARİA YOLU</span></div>
            <h4>Antik Karia Patikaları</h4>
            <p>Adaçayı kokuları eşliğinde Selimiye tepelerinden panoramik gün batımı yürüyüş rotaları.</p>
          </div>
        </div>

      </div>
    </section>

    <!-- CURATED SALONS -->
    <section class="editorial-section" id="salons">
      <div class="container-editorial">
        <div class="section-editorial-head" data-reveal>
          <div class="e-kicker">04. KİŞİYE ÖZEL AKTİVİTELER</div>
          <h2 class="e-headline">Küratörlü Deneyimler</h2>
        </div>

        <div class="salons-editorial-grid">
          <div class="salon-card" data-reveal>
            <div>
              <div class="salon-badge-top"><span class="salon-num">01</span><span>⛵</span></div>
              <h4>Özel Gulet ile Mavi Tur</h4>
              <p>Otel iskelesinden kalkan ahşap guletimizle Dirsekbükü ve Bencik koylarına özel seyir.</p>
            </div>
            <div class="salon-footer">
              <button class="btn-inquire-salon" data-exp-title="Özel Gulet Turu">Bilgi Al ↗</button>
            </div>
          </div>

          <div class="salon-card" data-reveal>
            <div>
              <div class="salon-badge-top"><span class="salon-num">02</span><span>🧘</span></div>
              <h4>İskelede Gün Doğumu Yogası</h4>
              <p>Sabahın sessizliğinde deniz üzerinde zihni ve bedeni arındıran nefes seansı.</p>
            </div>
            <div class="salon-footer">
              <button class="btn-inquire-salon" data-exp-title="Gün Doğumu Yogası">Bilgi Al ↗</button>
            </div>
          </div>

          <div class="salon-card" data-reveal>
            <div>
              <div class="salon-badge-top"><span class="salon-num">03</span><span>🫒</span></div>
              <h4>Zeytinyağı & Şarap Eşleşmesi</h4>
              <p>Bozburun Yarımadası’nın asırlık ağaçlarından elde edilen erken hasat tadımları.</p>
            </div>
            <div class="salon-footer">
              <button class="btn-inquire-salon" data-exp-title="Zeytinyağı Tadımı">Bilgi Al ↗</button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- RESERVATION SALON & CONTACT -->
    <section class="editorial-section bg-warm-sand" id="concierge">
      <div class="container-editorial">
        <div class="reservation-salon-card" data-reveal>
          <div class="salon-layout">
            
            <div class="salon-left">
              <div class="e-kicker">REZERVASYON SALONU</div>
              <h2>Sakinliğin Kıyısına<br><em>Davetlisiniz.</em></h2>
              <p class="e-lead">Tarihlerinizi iletin, size en uygun süit seçeneği ve doğrudan rezervasyon teklifiyle anında dönüş yapalım.</p>
              
              <div class="salon-contacts">
                <div class="sc-item">
                  <strong>AÇIK ADRES</strong>
                  <span>${escapeHtml(address)}</span>
                </div>
                <div class="sc-item">
                  <strong>RESEPSİYON TELEFON</strong>
                  <a href="tel:${escapeHtml(cleanPhone)}">${escapeHtml(phone)}</a>
                </div>
                <div class="sc-item">
                  <strong>WHATSAPP CONCIERGE</strong>
                  <a href="https://wa.me/${escapeHtml(cleanPhone)}" target="_blank">${escapeHtml(phone)}</a>
                </div>
              </div>
            </div>

            <div class="salon-right">
              <div class="salon-form-box">
                <h3>Doğrudan Rezervasyon Talebi</h3>
                <form class="editorial-form" id="contactMainForm">
                  <div class="form-duo">
                    <div class="ed-field">
                      <label>Ad Soyad *</label>
                      <input type="text" id="contactName" placeholder="Adınız Soyadınız" required>
                    </div>
                    <div class="ed-field">
                      <label>Telefon / WhatsApp *</label>
                      <input type="tel" id="contactPhone" placeholder="+90 5xx xxx xx xx" required>
                    </div>
                  </div>
                  <div class="form-duo">
                    <div class="ed-field">
                      <label>Giriş Tarihi *</label>
                      <input type="date" id="contactCheckin" required>
                    </div>
                    <div class="ed-field">
                      <label>Çıkış Tarihi *</label>
                      <input type="date" id="contactCheckout" required>
                    </div>
                  </div>
                  <div class="form-duo">
                    <div class="ed-field">
                      <label>Kişi Sayısı</label>
                      <select id="contactGuests">
                        <option value="2 Yetişkin">2 Yetişkin</option>
                        <option value="1 Yetişkin">1 Yetişkin</option>
                        <option value="3 Yetişkin">3 Yetişkin</option>
                        <option value="4+ Yetişkin">4+ Yetişkin</option>
                      </select>
                    </div>
                    <div class="ed-field">
                      <label>Süit Tercihi</label>
                      <select id="contactSuite">
                        ${rooms.map(r => `<option value="${escapeHtml(r.title)}">${escapeHtml(r.title)}</option>`).join('')}
                      </select>
                    </div>
                  </div>
                  <div class="ed-field">
                    <label>Özel Notlar</label>
                    <textarea id="contactNotes" rows="2" placeholder="Özel talepleriniz..."></textarea>
                  </div>
                  <button type="submit" class="btn-editorial-book" style="width:100%; justify-content:center; padding:0.85rem;">
                    <span>WhatsApp ile Talebi İlet ↗</span>
                  </button>
                </form>
              </div>
            </div>

          </div>
        </div>
      </div>
    </section>

  </main>

  <footer class="editorial-footer">
    <div class="container-editorial">
      <div class="footer-editorial-grid">
        <div>
          <span class="f-brand-title">${escapeHtml(name).toUpperCase()}</span>
          <p style="color:var(--text-muted); font-size:0.88rem; margin-top:0.5rem;">${escapeHtml(tagline)}</p>
        </div>
        <div>
          <strong style="color:var(--cypress); font-size:0.9rem; text-transform:uppercase;">Bağlantılar</strong>
          <p style="margin-top:0.5rem;"><a href="#story" style="color:var(--text-muted); text-decoration:none;">Felsefe</a></p>
          <p><a href="#residences" style="color:var(--text-muted); text-decoration:none;">Rezidanslar</a></p>
          <p><a href="#gastronomy" style="color:var(--text-muted); text-decoration:none;">Gastronomi</a></p>
        </div>
        <div>
          <strong style="color:var(--cypress); font-size:0.9rem; text-transform:uppercase;">Selimiye</strong>
          <p style="margin-top:0.5rem;"><a href="#nautical" style="color:var(--text-muted); text-decoration:none;">Sığliman Koyu</a></p>
          <p><a href="#nautical" style="color:var(--text-muted); text-decoration:none;">Kamelya Adası</a></p>
        </div>
        <div>
          <strong style="color:var(--cypress); font-size:0.9rem; text-transform:uppercase;">İletişim</strong>
          <p style="color:var(--text-muted); font-size:0.85rem; margin-top:0.5rem;">${escapeHtml(address)}</p>
          <p><a href="tel:${escapeHtml(cleanPhone)}" style="color:var(--cypress); font-weight:700; text-decoration:none;">${escapeHtml(phone)}</a></p>
        </div>
      </div>
      <div style="border-top:1px solid var(--border-light); padding-top:1.5rem; display:flex; justify-content:space-between; font-size:0.78rem; color:var(--text-muted);">
        <p>© 2026 ${escapeHtml(name)}. Tüm Hakları Saklıdır.</p>
        <span>AEON Haute Hospitality Architecture</span>
      </div>
    </div>
  </footer>

  <!-- Modal -->
  <div class="modal-editorial-backdrop" id="bookingModal">
    <div class="modal-editorial-window">
      <button class="modal-close-btn" id="modalCloseBtn">✕</button>
      <div style="margin-bottom:1.5rem;">
        <span class="e-kicker">DOĞRUDAN REZERVASYON</span>
        <h3 id="modalTitleText" style="font-family:var(--font-display); color:var(--cypress); font-size:1.6rem;">${escapeHtml(name)}</h3>
      </div>
      <form class="editorial-form" id="modalBookingForm">
        <div class="ed-field">
          <label>Seçilen Oda</label>
          <input type="text" id="modalSuiteChoice" readonly>
        </div>
        <div class="form-duo">
          <div class="ed-field">
            <label>Giriş Tarihi</label>
            <input type="date" id="mCheckin" required>
          </div>
          <div class="ed-field">
            <label>Çıkış Tarihi</label>
            <input type="date" id="mCheckout" required>
          </div>
        </div>
        <div class="form-duo">
          <div class="ed-field">
            <label>Misafir</label>
            <select id="mGuests">
              <option value="2 Yetişkin">2 Yetişkin</option>
              <option value="1 Yetişkin">1 Yetişkin</option>
              <option value="3 Yetişkin">3 Yetişkin</option>
              <option value="4+ Yetişkin">4+ Yetişkin</option>
            </select>
          </div>
          <div class="ed-field">
            <label>Telefon / WhatsApp *</label>
            <input type="tel" id="mPhone" placeholder="+90 5xx xxx xx xx" required>
          </div>
        </div>
        <div class="ed-field">
          <label>Özel Notlar</label>
          <input type="text" id="mNotes" placeholder="Özel istekleriniz...">
        </div>
        <button type="submit" class="btn-editorial-book" style="width:100%; justify-content:center; padding:0.85rem;">
          <span>WhatsApp ile Gönder ↗</span>
        </button>
      </form>
    </div>
  </div>

</body>
</html>
`;
}

function generateJS() {
  return `
document.addEventListener('DOMContentLoaded', () => {
  initHeader();
  initRevealAnimations();
  initBookingModals();
  setDefaultDates();
});

function initHeader() {
  const header = document.getElementById('editorialMasthead');
  if (!header) return;
  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) header.classList.add('scrolled');
    else header.classList.remove('scrolled');
  }, { passive: true });
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
    el.style.transition = \`opacity 0.75s cubic-bezier(0.16, 1, 0.3, 1) \${index % 4 * 0.08}s, transform 0.75s cubic-bezier(0.16, 1, 0.3, 1) \${index % 4 * 0.08}s\`;
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
      openModal('Özel Rezervasyon Talebi', \`\${hotelName} Genel Rezervasyon\`);
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
      openModal(\`Deneyim Talebi: \${exp}\`, exp);
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
      const msg = \`Merhaba \${hotelName},%0A%0AWeb sitenizden doğrudan rezervasyon talebinde bulunmak istiyorum:%0A✦ *Kategori:* \${suite}%0A✦ *Tarihler:* \${checkin} - \${checkout}%0A✦ *Misafir Sayısı:* \${guests}%0A✦ *Telefon:* \${phone}%0A✦ *Özel İstek:* \${notes || 'Yok'}\`;
      window.open(\`https://wa.me/\${hotelPhone.replace(/\\D/g, '')}?text=\${msg}\`, '_blank');
      closeModal();
    });
  }

  if (heroSubmitBtn) {
    heroSubmitBtn.addEventListener('click', () => {
      const checkin = document.getElementById('heroCheckin')?.value || '';
      const checkout = document.getElementById('heroCheckout')?.value || '';
      const guests = document.getElementById('heroGuests')?.value || '2';
      const suite = document.getElementById('heroSuite')?.value || 'all';
      const msg = \`Merhaba \${hotelName},%0A%0AWeb siteniz üzerinden \${checkin} - \${checkout} tarihleri için \${guests} misafir için müsaitlik ve fiyat teklifi rica ediyorum. (Tercih: \${suite})\`;
      window.open(\`https://wa.me/\${hotelPhone.replace(/\\D/g, '')}?text=\${msg}\`, '_blank');
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
      const msg = \`Merhaba \${hotelName},%0A%0AAdım \${name}. Web sitenizden rezervasyon talebi iletiyorum:%0A✦ *Tarih:* \${checkin} - \${checkout}%0A✦ *Kişi:* \${guests}%0A✦ *Oda:* \${suite}%0A✦ *Telefon:* \${phone}%0A✦ *Not:* \${notes || 'Yok'}\`;
      window.open(\`https://wa.me/\${hotelPhone.replace(/\\D/g, '')}?text=\${msg}\`, '_blank');
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
`;
}

function buildAll() {
  const jsContent = generateJS();

  for (const hotel of hotels) {
    const hotelDir = path.join(outBaseDir, hotel.slug);
    if (!fs.existsSync(hotelDir)) {
      fs.mkdirSync(hotelDir, { recursive: true });
    }

    const cssContent = generateV2EditorialCSS(hotel);
    const htmlContent = generateV2EditorialHTML(hotel);

    fs.writeFileSync(path.join(hotelDir, 'styles.css'), cssContent, 'utf8');
    fs.writeFileSync(path.join(hotelDir, 'app.js'), jsContent, 'utf8');
    fs.writeFileSync(path.join(hotelDir, 'index.html'), htmlContent, 'utf8');
  }

  console.log(`✅ Generated ${hotels.length} V2 Selimiye Websites with Haute Editorial Gazette architecture!`);
}

buildAll();
