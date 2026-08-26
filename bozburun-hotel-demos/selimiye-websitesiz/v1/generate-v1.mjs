import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const parent = path.resolve(here, '..');
const researchV2 = JSON.parse(fs.readFileSync(path.join(parent, 'hotel-research-v2.json'), 'utf8'));
const detailedResearch = JSON.parse(fs.readFileSync(path.join(parent, 'hotel-research-detail.json'), 'utf8'));
const detailBySlug = new Map(detailedResearch.hotels.map((item) => [item.slug, item]));
const outputRoot = here;

const escapeHtml = (value='') => String(value).replace(/[&<>"']/g,(char)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

// High-End Liquid Glass CSS for V1
const sharedV1CSS = `/* ==========================================================================
   SELİMİYE HOTELS — OBSIDIAN GOLD LIQUID GLASS LUXURY (V1)
   ========================================================================== */

:root {
  --font-serif: 'Cormorant Garamond', Georgia, serif;
  --font-heading: 'Cinzel', 'Cormorant Garamond', serif;
  --font-sans: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;

  --bg-deep: #060a10;
  --bg-dark: #0b131e;
  --bg-card: rgba(14, 24, 36, 0.75);
  --bg-card-heavy: rgba(9, 16, 26, 0.9);
  --bg-glass-input: rgba(255, 255, 255, 0.06);

  --text-main: #f8fafc;
  --text-muted: #94a3b8;
  --text-dim: #64748b;

  --gold-primary: #d4af37;
  --gold-light: #f3df95;
  --gold-glow: rgba(212, 175, 55, 0.3);
  --gold-gradient: linear-gradient(135deg, #f3df95 0%, #c59f42 50%, #9a7322 100%);
  
  --border-glass: rgba(255, 255, 255, 0.12);
  --border-gold: rgba(212, 175, 55, 0.35);

  --blur-heavy: blur(28px) saturate(190%);
  --blur-medium: blur(16px);

  --shadow-liquid: 0 20px 50px -10px rgba(0, 0, 0, 0.75), inset 0 1px 1px rgba(255, 255, 255, 0.12);
  --shadow-gold: 0 10px 30px rgba(212, 175, 55, 0.3);

  --radius-sm: 8px;
  --radius-md: 16px;
  --radius-lg: 24px;
  --radius-full: 9999px;
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
  color-scheme: dark;
}

body.selimiye-v1-liquid {
  font-family: var(--font-sans);
  background-color: var(--bg-deep);
  color: var(--text-main);
  line-height: 1.65;
  overflow-x: hidden;
  position: relative;
  -webkit-font-smoothing: antialiased;
}

.ambient-glow {
  position: fixed;
  border-radius: 50%;
  filter: blur(140px);
  pointer-events: none;
  z-index: 0;
  opacity: 0.35;
}
.glow-1 {
  top: -10vw;
  left: 20vw;
  width: 55vw;
  height: 55vw;
  background: radial-gradient(circle, rgba(212, 175, 55, 0.25) 0%, rgba(56, 189, 248, 0.08) 100%);
}
.glow-2 {
  top: 45vh;
  right: -10vw;
  width: 55vw;
  height: 55vw;
  background: radial-gradient(circle, rgba(56, 189, 248, 0.18) 0%, rgba(212, 175, 55, 0.08) 100%);
}

.container {
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 2rem;
  position: relative;
  z-index: 2;
}

/* Header */
.v1-header {
  position: sticky;
  top: 0;
  z-index: 99;
  padding: 0.85rem 0;
  transition: var(--transition);
}
.v1-header.scrolled {
  padding: 0.45rem 0;
}
.header-island {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0.6rem 1.75rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--bg-card-heavy);
  backdrop-filter: var(--blur-heavy);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-full);
  box-shadow: var(--shadow-liquid);
}

.brand-link {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  text-decoration: none;
}
.brand-logo-frame {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  overflow: hidden;
  border: 1.5px solid var(--gold-primary);
  box-shadow: 0 0 15px var(--gold-glow);
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
}
.brand-logo-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.brand-names {
  display: flex;
  flex-direction: column;
}
.brand-main-title {
  font-family: var(--font-heading);
  font-size: 1.15rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: #ffffff;
}
.brand-sub-title {
  font-size: 0.62rem;
  letter-spacing: 0.22em;
  color: var(--gold-light);
  font-weight: 600;
}

.v1-nav {
  display: flex;
  align-items: center;
  gap: 1.4rem;
}
.nav-link {
  color: var(--text-muted);
  text-decoration: none;
  font-size: 0.84rem;
  font-weight: 500;
  letter-spacing: 0.02em;
  transition: var(--transition);
  position: relative;
  padding: 0.25rem 0;
}
.nav-link::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 2px;
  background: var(--gold-gradient);
  transition: var(--transition);
  border-radius: 2px;
}
.nav-link:hover {
  color: #fff;
}
.nav-link:hover::after {
  width: 100%;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.9rem;
}
.currency-dock select {
  background: transparent;
  border: none;
  color: var(--gold-light);
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
  outline: none;
}
.currency-dock select option {
  background: #0d1722;
  color: #fff;
}
.lang-capsule {
  display: flex;
  gap: 2px;
}
.lang-btn {
  background: transparent;
  border: none;
  color: var(--text-dim);
  font-size: 0.72rem;
  cursor: pointer;
  padding: 2px 4px;
}
.lang-btn.active, .lang-btn:hover {
  color: var(--gold-primary);
  font-weight: 700;
}

.btn-phone-direct {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text-muted);
  text-decoration: none;
  font-size: 0.82rem;
  font-weight: 600;
  padding: 0.45rem 0.85rem;
  border-radius: var(--radius-full);
  border: 1px solid rgba(255, 255, 255, 0.08);
  transition: var(--transition);
}
.btn-phone-direct:hover {
  color: var(--gold-light);
  border-color: var(--gold-primary);
}

.btn-gold-cta {
  background: var(--gold-gradient);
  color: #080f18;
  border: none;
  font-family: var(--font-sans);
  font-weight: 700;
  font-size: 0.84rem;
  padding: 0.65rem 1.4rem;
  border-radius: var(--radius-full);
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  cursor: pointer;
  box-shadow: var(--shadow-gold);
  transition: var(--transition);
}
.btn-gold-cta:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 35px rgba(212, 175, 55, 0.45);
}

.mobile-toggle-btn {
  display: none;
  background: transparent;
  border: none;
  cursor: pointer;
  flex-direction: column;
  gap: 5px;
  padding: 4px;
}
.mobile-toggle-btn span {
  width: 22px;
  height: 2px;
  background: var(--gold-primary);
  transition: var(--transition);
}

/* Mobile Drawer */
.mobile-drawer {
  position: fixed;
  inset: 0;
  background: rgba(5, 10, 16, 0.96);
  backdrop-filter: blur(35px);
  z-index: 98;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  pointer-events: none;
  transition: var(--transition);
}
.mobile-drawer.active {
  opacity: 1;
  pointer-events: auto;
}
.drawer-panel {
  text-align: center;
  max-width: 320px;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}
.drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.drawer-title {
  font-family: var(--font-heading);
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--gold-primary);
}
.drawer-close-btn {
  background: rgba(255, 255, 255, 0.08);
  border: none;
  color: #fff;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  cursor: pointer;
}
.drawer-nav {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  text-align: left;
}
.drawer-link {
  color: #fff;
  text-decoration: none;
  font-family: var(--font-heading);
  font-size: 1.15rem;
  transition: var(--transition);
}
.drawer-link:hover {
  color: var(--gold-primary);
}
.drawer-footer {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.btn-wa-pill {
  background: rgba(37, 211, 102, 0.15);
  border: 1px solid rgba(37, 211, 102, 0.4);
  color: #25d366;
  padding: 0.75rem;
  border-radius: var(--radius-full);
  text-decoration: none;
  font-weight: 600;
  font-size: 0.9rem;
}
.w-full {
  width: 100%;
}

/* Hero */
.hero-v1 {
  position: relative;
  min-height: 92vh;
  display: flex;
  align-items: center;
  padding: 6.5rem 0 5rem;
  overflow: hidden;
}
.hero-bg-wrap {
  position: absolute;
  inset: 0;
  z-index: 0;
}
.hero-bg-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  animation: hero-kenburns 22s ease-out infinite alternate;
}
@keyframes hero-kenburns {
  0% { transform: scale(1.02); }
  100% { transform: scale(1.08); }
}

.hero-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(7, 13, 20, 0.35) 0%, rgba(7, 13, 20, 0.85) 75%, var(--bg-deep) 100%);
}

.hero-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  z-index: 2;
}

.hero-pill-badge {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  background: rgba(15, 26, 38, 0.75);
  backdrop-filter: var(--blur-medium);
  border: 1px solid var(--border-gold);
  padding: 0.5rem 1.4rem;
  border-radius: var(--radius-full);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.15em;
  color: #fff;
  margin-bottom: 1.75rem;
  box-shadow: var(--shadow-gold);
}
.badge-dot {
  width: 8px;
  height: 8px;
  background: var(--gold-primary);
  border-radius: 50%;
  box-shadow: 0 0 10px var(--gold-primary);
}
.badge-tag {
  background: var(--gold-gradient);
  color: #000;
  font-size: 0.68rem;
  font-weight: 800;
  padding: 2px 8px;
  border-radius: var(--radius-full);
}

.hero-title {
  font-family: var(--font-heading);
  font-size: clamp(2.4rem, 5.5vw, 4.4rem);
  font-weight: 700;
  line-height: 1.15;
  color: #ffffff;
  margin-bottom: 1.5rem;
  text-shadow: 0 4px 30px rgba(0, 0, 0, 0.9);
}
.serif-highlight {
  font-family: var(--font-serif);
  font-style: italic;
  font-weight: 400;
  background: var(--gold-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.hero-lead {
  max-width: 820px;
  font-size: 1.12rem;
  color: #cbd5e1;
  line-height: 1.75;
  margin-bottom: 3rem;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.8);
}

/* Liquid Glass Booking Dock */
.liquid-booking-dock {
  width: 100%;
  max-width: 1120px;
  background: var(--bg-card-heavy);
  backdrop-filter: var(--blur-heavy);
  border: 1px solid var(--border-gold);
  padding: 1.25rem 1.75rem;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-liquid), var(--shadow-gold);
  margin-bottom: 3.5rem;
}
.dock-form {
  display: grid;
  grid-template-columns: repeat(4, 1fr) auto;
  gap: 1.25rem;
  align-items: end;
}
.dock-input-group {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  text-align: left;
}
.input-label-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.input-label-row label {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--gold-light);
  letter-spacing: 0.08em;
}
.dock-input, .dock-select {
  background: var(--bg-glass-input);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: var(--radius-sm);
  padding: 0.65rem 0.85rem;
  color: #ffffff;
  font-family: var(--font-sans);
  font-size: 0.9rem;
  outline: none;
  transition: var(--transition);
}
.dock-input:focus, .dock-select:focus {
  border-color: var(--gold-primary);
  box-shadow: 0 0 15px rgba(212, 175, 55, 0.35);
  background: rgba(255, 255, 255, 0.08);
}
.dock-select option {
  background: #0d1722;
  color: #fff;
}

.btn-dock-submit {
  background: var(--gold-gradient);
  color: #050b10;
  border: none;
  padding: 0.75rem 1.6rem;
  border-radius: var(--radius-sm);
  font-family: var(--font-sans);
  font-weight: 700;
  font-size: 0.9rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  cursor: pointer;
  height: 42px;
  white-space: nowrap;
  box-shadow: var(--shadow-gold);
  transition: var(--transition);
}
.btn-dock-submit:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 35px rgba(212, 175, 55, 0.55);
}

.hero-strip-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1.5rem;
  width: 100%;
  max-width: 1120px;
}
.hero-strip-card {
  background: var(--bg-card);
  backdrop-filter: var(--blur-medium);
  border: 1px solid var(--border-glass);
  padding: 1.25rem 1.5rem;
  border-radius: var(--radius-md);
  text-align: left;
  display: flex;
  gap: 1rem;
  align-items: center;
  box-shadow: var(--shadow-liquid);
  transition: var(--transition);
}
.hero-strip-card:hover {
  border-color: var(--border-gold);
  transform: translateY(-3px);
}
.strip-icon {
  font-size: 1.8rem;
}
.strip-text strong {
  display: block;
  font-size: 0.88rem;
  color: #fff;
  margin-bottom: 2px;
}
.strip-text small {
  font-size: 0.74rem;
  color: var(--text-muted);
}

/* Sections */
.v1-section {
  padding: 6.5rem 0;
  position: relative;
  z-index: 2;
}
.bg-v1-dark {
  background-color: var(--bg-dark);
}

.section-eyebrow-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.22em;
  color: var(--gold-light);
  text-transform: uppercase;
  margin-bottom: 0.75rem;
}
.eyebrow-dot {
  width: 6px;
  height: 6px;
  background: var(--gold-primary);
  border-radius: 50%;
}

.section-title {
  font-family: var(--font-heading);
  font-size: clamp(2rem, 3.8vw, 3.2rem);
  font-weight: 700;
  line-height: 1.2;
  color: #ffffff;
  margin-bottom: 1.25rem;
}

.section-subtitle {
  max-width: 680px;
  color: var(--text-muted);
  font-size: 1.05rem;
  line-height: 1.7;
}

.section-center-head {
  text-align: center;
  max-width: 780px;
  margin: 0 auto 3.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.glass-card {
  background: var(--bg-card);
  backdrop-filter: var(--blur-heavy);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-liquid);
}

/* Story */
.story-grid {
  display: grid;
  grid-template-columns: 1.15fr 1fr;
  gap: 4rem;
  align-items: center;
}
.story-glass-card {
  padding: 2.25rem;
}
.story-lead {
  font-size: 1.15rem;
  color: #ffffff;
  line-height: 1.75;
  margin-bottom: 1.25rem;
}
.story-body {
  color: var(--text-muted);
  font-size: 0.96rem;
  line-height: 1.8;
  margin-bottom: 1.75rem;
}
.story-pillars {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding-top: 1.5rem;
}
.pillar-item {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
}
.pillar-num {
  background: rgba(212, 175, 55, 0.15);
  color: var(--gold-light);
  font-family: var(--font-heading);
  font-weight: 700;
  font-size: 0.8rem;
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid rgba(212, 175, 55, 0.3);
}

.mosaic-main-card {
  position: relative;
  border-radius: var(--radius-lg);
  overflow: hidden;
  border: 1px solid var(--border-glass);
  box-shadow: var(--shadow-liquid);
}
.mosaic-main-card img {
  width: 100%;
  height: 460px;
  object-fit: cover;
  display: block;
}
.mosaic-glass-badge {
  position: absolute;
  bottom: 1.5rem;
  left: 1.5rem;
  right: 1.5rem;
  background: rgba(10, 18, 28, 0.85);
  backdrop-filter: var(--blur-medium);
  border: 1px solid var(--border-gold);
  padding: 0.85rem 1.25rem;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-gold);
}

/* Suites */
.suites-glass-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 2.5rem;
}
.suite-card {
  background: var(--bg-card);
  backdrop-filter: var(--blur-heavy);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-liquid);
  transition: var(--transition);
  display: flex;
  flex-direction: column;
}
.suite-card:hover {
  border-color: var(--border-gold);
  transform: translateY(-6px);
  box-shadow: 0 30px 70px -15px rgba(0, 0, 0, 0.9), var(--shadow-gold);
}
.suite-visual {
  position: relative;
  height: 280px;
  overflow: hidden;
}
.suite-visual img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.7s ease;
}
.suite-card:hover .suite-visual img {
  transform: scale(1.06);
}
.suite-tag {
  position: absolute;
  top: 1.25rem;
  left: 1.25rem;
  background: var(--gold-gradient);
  color: #050b10;
  font-weight: 800;
  font-size: 0.72rem;
  padding: 4px 12px;
  border-radius: var(--radius-full);
}
.suite-specs-bar {
  position: absolute;
  bottom: 1rem;
  left: 1.25rem;
  right: 1.25rem;
  display: flex;
  justify-content: space-between;
  background: rgba(7, 13, 20, 0.85);
  backdrop-filter: var(--blur-medium);
  border: 1px solid var(--border-glass);
  padding: 0.4rem 0.9rem;
  border-radius: var(--radius-sm);
  font-size: 0.78rem;
  color: #fff;
  font-weight: 600;
}
.suite-body {
  padding: 2.25rem;
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  justify-content: space-between;
}
.suite-name {
  font-family: var(--font-heading);
  font-size: 1.55rem;
  font-weight: 700;
  color: #ffffff;
  margin-bottom: 0.75rem;
}
.suite-desc {
  color: var(--text-muted);
  font-size: 0.92rem;
  line-height: 1.65;
  margin-bottom: 1.5rem;
}
.suite-amenities {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-bottom: 1.75rem;
}
.suite-amenities span {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 0.75rem;
  color: #d8e5f0;
  padding: 3px 9px;
  border-radius: var(--radius-full);
}
.btn-suite-reserve {
  background: var(--bg-card-heavy);
  border: 1px solid var(--border-gold);
  color: var(--gold-light);
  padding: 0.6rem 1.35rem;
  border-radius: var(--radius-full);
  font-size: 0.84rem;
  font-weight: 700;
  cursor: pointer;
  transition: var(--transition);
}
.btn-suite-reserve:hover {
  background: var(--gold-gradient);
  color: #050b10;
  border-color: transparent;
  box-shadow: var(--shadow-gold);
}

/* Günün Ritmi (Rituals) */
.rituals-deck {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2rem;
  margin-top: 3.5rem;
}
.ritual-card {
  padding: 2.25rem;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-md);
  background: var(--bg-card);
  transition: var(--transition);
}
.ritual-card:hover {
  border-color: var(--gold-primary);
  transform: translateY(-4px);
}
.ritual-time {
  font-family: var(--font-heading);
  font-size: 1.1rem;
  color: var(--gold-light);
  margin-bottom: 0.75rem;
}
.ritual-card h4 {
  font-family: var(--font-heading);
  font-size: 1.3rem;
  color: #fff;
  margin-bottom: 0.5rem;
}
.ritual-card p {
  color: var(--text-muted);
  font-size: 0.9rem;
}

/* Gastronomy & Coves */
.gastro-grid {
  display: grid;
  grid-template-columns: 1.15fr 1fr;
  gap: 4rem;
  align-items: center;
}
.gastro-stack {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  margin-top: 2rem;
}
.gastro-item {
  padding: 1.5rem;
  display: flex;
  gap: 1.25rem;
  border-radius: var(--radius-md);
  transition: var(--transition);
}
.gastro-item:hover {
  border-color: var(--border-gold);
  transform: translateX(6px);
}
.g-icon {
  font-size: 2rem;
}
.g-body h4 {
  font-family: var(--font-heading);
  font-size: 1.15rem;
  font-weight: 700;
  color: #fff;
  margin-bottom: 0.35rem;
}
.g-body p {
  color: var(--text-muted);
  font-size: 0.88rem;
  line-height: 1.65;
}

.gastro-video-box {
  border-radius: var(--radius-lg);
  overflow: hidden;
  border: 1px solid var(--border-glass);
  box-shadow: var(--shadow-liquid);
}
.gastro-video-box video {
  width: 100%;
  height: 340px;
  object-fit: cover;
  display: block;
}

.dest-grid-3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2rem;
  margin-bottom: 3.5rem;
}
.dest-card {
  background: var(--bg-card);
  backdrop-filter: var(--blur-heavy);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-liquid);
  transition: var(--transition);
}
.dest-card:hover {
  border-color: var(--border-gold);
  transform: translateY(-6px);
}
.dest-img-box {
  position: relative;
  height: 220px;
}
.dest-img-box img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.dest-pill {
  position: absolute;
  top: 1rem;
  left: 1rem;
  background: rgba(10, 18, 28, 0.85);
  backdrop-filter: var(--blur-medium);
  border: 1px solid var(--border-gold);
  color: var(--gold-light);
  font-size: 0.72rem;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: var(--radius-full);
}
.dest-body {
  padding: 1.75rem;
}
.dest-body h3 {
  font-family: var(--font-heading);
  font-size: 1.3rem;
  font-weight: 700;
  color: #fff;
  margin-bottom: 0.75rem;
}
.dest-body p {
  color: var(--text-muted);
  font-size: 0.88rem;
  line-height: 1.65;
}

/* Experiences & Amenities */
.exp-grid-6 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2rem;
}
.exp-card {
  padding: 2.25rem;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  transition: var(--transition);
}
.exp-card:hover {
  border-color: var(--border-gold);
  transform: translateY(-6px);
}
.exp-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.25rem;
}
.exp-num {
  font-family: var(--font-heading);
  font-size: 1.5rem;
  font-weight: 700;
  color: rgba(212, 175, 55, 0.3);
}
.exp-card h3 {
  font-family: var(--font-heading);
  font-size: 1.25rem;
  font-weight: 700;
  color: #fff;
  margin-bottom: 0.75rem;
}
.exp-card p {
  color: var(--text-muted);
  font-size: 0.88rem;
  line-height: 1.65;
  margin-bottom: 1.5rem;
}
.btn-exp-link {
  background: transparent;
  border: none;
  color: var(--gold-light);
  font-weight: 700;
  font-size: 0.84rem;
  cursor: pointer;
}

.amenities-card {
  padding: 4rem;
}
.amenities-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2.5rem;
}
.am-item h4 {
  font-family: var(--font-heading);
  font-size: 1.1rem;
  font-weight: 700;
  color: #fff;
  margin-bottom: 0.25rem;
}
.am-item p {
  color: var(--text-muted);
  font-size: 0.86rem;
}

/* Hub & Footer */
.hub-layout {
  display: grid;
  grid-template-columns: 1fr 1.15fr;
  gap: 4rem;
  padding: 3.5rem;
}
.hub-brand-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.85rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border-glass);
  padding: 0.4rem 1rem;
  border-radius: var(--radius-full);
  margin-bottom: 1.5rem;
}
.hub-brand-badge img {
  width: 32px;
  height: 32px;
  border-radius: 50%;
}
.hub-title {
  font-family: var(--font-heading);
  font-size: 2.3rem;
  font-weight: 700;
  line-height: 1.2;
  color: #fff;
  margin-bottom: 1rem;
}
.hub-contacts {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  margin: 2rem 0;
}
.h-item strong {
  display: block;
  font-size: 0.78rem;
  color: var(--gold-light);
  text-transform: uppercase;
}
.h-item span, .h-item a {
  color: #fff;
  font-size: 0.92rem;
  text-decoration: none;
}

.form-box {
  background: rgba(10, 18, 28, 0.85);
  backdrop-filter: var(--blur-heavy);
  border: 1px solid var(--border-gold);
  padding: 2.25rem;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-gold);
}
.form-box h3 {
  font-family: var(--font-heading);
  font-size: 1.55rem;
  color: #fff;
  margin-bottom: 0.35rem;
}
.real-form {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
  margin-top: 1.5rem;
}
.form-row-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}
.f-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.f-field label {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-muted);
}
.f-field input, .f-field select, .f-field textarea {
  background: var(--bg-glass-input);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: var(--radius-sm);
  padding: 0.65rem 0.85rem;
  color: #fff;
  font-family: var(--font-sans);
  font-size: 0.88rem;
  outline: none;
}

.v1-footer {
  background: #04070a;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  padding: 5rem 0 2rem;
  position: relative;
  z-index: 2;
}
.footer-grid {
  display: grid;
  grid-template-columns: 1.5fr 1fr 1fr 1.2fr;
  gap: 3rem;
  margin-bottom: 3.5rem;
}
.footer-avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: 1.5px solid var(--gold-primary);
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(3, 6, 10, 0.85);
  backdrop-filter: blur(25px);
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  opacity: 0;
  pointer-events: none;
  transition: var(--transition);
}
.modal-backdrop.active {
  opacity: 1;
  pointer-events: auto;
}
.modal-window {
  background: var(--bg-card-heavy);
  backdrop-filter: var(--blur-heavy);
  border: 1px solid var(--border-gold);
  border-radius: var(--radius-lg);
  max-width: 520px;
  width: 100%;
  padding: 2.5rem;
  position: relative;
}
.modal-close {
  position: absolute;
  top: 1.25rem;
  right: 1.25rem;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid var(--border-glass);
  color: #fff;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  cursor: pointer;
}

@media (max-width: 1024px) {
  .v1-nav, .btn-phone-direct { display: none; }
  .mobile-toggle-btn { display: flex; }
  .dock-form { grid-template-columns: repeat(2, 1fr); }
  .btn-dock-submit { grid-column: span 2; }
  .hero-strip-grid { grid-template-columns: repeat(2, 1fr); }
  .story-grid, .gastro-grid, .hub-layout { grid-template-columns: 1fr; gap: 3rem; }
  .suites-glass-grid, .dest-grid-3, .exp-grid-6, .rituals-deck, .amenities-grid { grid-template-columns: 1fr; }
  .footer-grid { grid-template-columns: 1fr 1fr; }
}

@media (max-width: 640px) {
  .hide-mobile { display: none !important; }
  .container { padding: 0 1.25rem; }
  .hero-v1 { padding: 4.5rem 0 3.5rem; }
  .dock-form { grid-template-columns: 1fr; }
  .btn-dock-submit { grid-column: span 1; }
  .hero-strip-grid { grid-template-columns: 1fr; }
  .hub-layout, .amenities-card { padding: 1.75rem; }
  .form-row-2 { grid-template-columns: 1fr; }
  .footer-grid { grid-template-columns: 1fr; }
}
`;

function generateV1Page(hotel, detail) {
  const name = hotel.name;
  const slug = hotel.slug;
  const phone = detail?.phone || hotel.phone || '0252 456 23 40';
  const cleanPhone = phone.replace(/\D/g, '') || '902524562340';
  const address = detail?.address || hotel.location || 'Selimiye Koyu, Marmaris / Muğla';
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

  const rituals = (hotel.rituals && hotel.rituals.length) ? hotel.rituals : [
    { time: "08:30 - 11:00", title: "Koyda Yavaş Kahvaltı", desc: "Yerel Selimiye zeytinleri, keçi peyniri ve ev yapımı incir reçeliyle güne acele etmeden başlayın." },
    { time: "14:00 - 17:30", title: "İskelede Tuz & Güneş", desc: "Kristal berraklığındaki koy suyunda yüzün, gölgede kitabınızı okurken dinlenin." },
    { time: "19:30 - 23:00", title: "Gün Batımı & Kıyı Masası", desc: "Gökyüzü kızıla bürünürken taze Ege mezeleri eşliğinde baş başa bir akşam." }
  ];

  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
  <meta name="description" content="${escapeHtml(name)} — Selimiye Koyu'nda ${escapeHtml(concept)}. Özel iskele, taş mimari ve Ege konukseverliği.">
  <title>${escapeHtml(name)} — Selimiye | Obsidian Gold Liquid Glass (V1)</title>
  
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700;800&family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400;1,600&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  
  <link rel="stylesheet" href="./styles.css">
  <script defer src="./app.js"></script>
</head>
<body class="selimiye-v1-liquid" data-phone="${escapeHtml(cleanPhone)}" data-hotel="${escapeHtml(name)}">
  
  <div class="ambient-glow glow-1" aria-hidden="true"></div>
  <div class="ambient-glow glow-2" aria-hidden="true"></div>

  <!-- Header -->
  <header class="v1-header" id="v1Header">
    <div class="header-island">
      <a href="#top" class="brand-link" aria-label="${escapeHtml(name)} Ana Sayfa">
        <div class="brand-logo-frame">
          <img src="./media/logo.svg" alt="${escapeHtml(name)} Logo" class="brand-logo-img">
        </div>
        <div class="brand-names">
          <span class="brand-main-title">${escapeHtml(name).toUpperCase()}</span>
          <span class="brand-sub-title">SELİMİYE · MARMARİS</span>
        </div>
      </a>

      <nav class="v1-nav">
        <a href="#about" class="nav-link">Felsefe</a>
        <a href="#suites" class="nav-link">Süitler & Odalar</a>
        <a href="#rituals" class="nav-link">Günün Ritmi</a>
        <a href="#gastronomy" class="nav-link">Gastronomi</a>
        <a href="#coves" class="nav-link">Koylar Rehberi</a>
        <a href="#experiences" class="nav-link">Deneyimler</a>
        <a href="#contact" class="nav-link">İletişim</a>
      </nav>

      <div class="header-actions">
        <div class="currency-dock hide-mobile">
          <select id="currencySelect">
            <option value="TRY">₺ TRY</option>
            <option value="EUR">€ EUR</option>
            <option value="USD">$ USD</option>
            <option value="GBP">£ GBP</option>
          </select>
        </div>
        <a href="tel:${escapeHtml(cleanPhone)}" class="btn-phone-direct hide-mobile" title="Resepsiyon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
          <span>${escapeHtml(phone)}</span>
        </a>
        <button class="btn-gold-cta" data-book>
          <span>Rezervasyon Talebi</span>
          <i>↗</i>
        </button>
        <button class="mobile-toggle-btn" id="mobileMenuToggle" aria-label="Menüyü Aç">
          <span></span><span></span><span></span>
        </button>
      </div>
    </div>
  </header>

  <!-- Mobile Drawer -->
  <div class="mobile-drawer" id="mobileDrawer">
    <div class="drawer-panel">
      <div class="drawer-header">
        <span class="drawer-title">${escapeHtml(name).toUpperCase()}</span>
        <button class="drawer-close-btn" id="drawerClose">✕</button>
      </div>
      <nav class="drawer-nav">
        <a href="#about" class="drawer-link">01. Felsefe & Taş Mimari</a>
        <a href="#suites" class="drawer-link">02. Süitler & Odalar</a>
        <a href="#rituals" class="drawer-link">03. Günün Ritmi</a>
        <a href="#gastronomy" class="drawer-link">04. Gastronomi & İskele</a>
        <a href="#coves" class="drawer-link">05. Selimiye & Saklı Koylar</a>
        <a href="#experiences" class="drawer-link">06. Özel Aktiviteler</a>
        <a href="#contact" class="drawer-link">07. İletişim</a>
      </nav>
      <div class="drawer-footer">
        <button class="btn-gold-cta w-full" data-book>Online Rezervasyon Yap ↗</button>
        <a href="https://wa.me/${escapeHtml(cleanPhone)}?text=Merhaba%20${encodeURIComponent(name)},%20m%C3%BCsaitlik%20bilgisi%20almak%20istiyorum." target="_blank" class="btn-wa-pill w-full">WhatsApp Canlı Danışma 💬</a>
      </div>
    </div>
  </div>

  <main id="top">
    
    <!-- HERO SECTION -->
    <section class="hero-v1">
      <div class="hero-bg-wrap">
        <img src="./media/hero.jpg" alt="${escapeHtml(name)} Selimiye Panoraması" class="hero-bg-img">
        <div class="hero-overlay"></div>
      </div>

      <div class="container hero-content">
        <div class="hero-pill-badge" data-reveal>
          <span class="badge-dot"></span>
          <span>SELİMİYE KOYU · MARMARİS</span>
          <span class="badge-tag">ÖZEL İSKELE & DİNGİNLİK</span>
        </div>

        <h1 class="hero-title" data-reveal>
          Zamanın Ağırlaştığı,<br>
          <em class="serif-highlight">${escapeHtml(tagline)}</em>
        </h1>

        <p class="hero-lead" data-reveal>
          ${escapeHtml(name)}; Selimiye’nin kristal turkuaz sularında, asırlık zeytin ağaçları ve begonvillerle sarılı taş mimarisiyle ruhu dinlendiren seçkin bir Ege inzivası sunar.
        </p>

        <!-- Booking Dock -->
        <div class="liquid-booking-dock" data-reveal>
          <form class="dock-form" onsubmit="return false;">
            <div class="dock-input-group">
              <div class="input-label-row">
                <span>📅</span>
                <label for="heroCheckin">GİRİŞ TARİHİ</label>
              </div>
              <input type="date" id="heroCheckin" class="dock-input" required>
            </div>

            <div class="dock-input-group">
              <div class="input-label-row">
                <span>📅</span>
                <label for="heroCheckout">ÇIKIŞ TARİHİ</label>
              </div>
              <input type="date" id="heroCheckout" class="dock-input" required>
            </div>

            <div class="dock-input-group">
              <div class="input-label-row">
                <span>👥</span>
                <label for="heroGuests">MİSAFİR SAYISI</label>
              </div>
              <select id="heroGuests" class="dock-select">
                <option value="2 Yetişkin">2 Yetişkin</option>
                <option value="1 Yetişkin">1 Yetişkin</option>
                <option value="3 Yetişkin">3 Yetişkin</option>
                <option value="4+ Yetişkin">4+ Yetişkin / Aile</option>
              </select>
            </div>

            <div class="dock-input-group">
              <div class="input-label-row">
                <span>✨</span>
                <label for="heroSuite">ODA SEÇİMİ</label>
              </div>
              <select id="heroSuite" class="dock-select">
                <option value="all">Tüm Odaları Göster</option>
                ${rooms.map(r => `<option value="${escapeHtml(r.title)}">${escapeHtml(r.title)}</option>`).join('')}
              </select>
            </div>

            <div class="dock-action-group">
              <button type="button" class="btn-dock-submit" id="heroSubmitBtn">
                <span>Müsaitlik & Fiyat Gör</span>
                <i>→</i>
              </button>
            </div>
          </form>
        </div>

        <!-- Strip Highlights -->
        <div class="hero-strip-grid" data-reveal>
          <div class="hero-strip-card">
            <span class="strip-icon">⚓</span>
            <div class="strip-text">
              <strong>Özel İskele & Plaj</strong>
              <small>Tekne bağlama & berrak koy suyu</small>
            </div>
          </div>
          <div class="hero-strip-card">
            <span class="strip-icon">🌿</span>
            <div class="strip-text">
              <strong>Doğal Taş & Avlu</strong>
              <small>Begonvil ve zeytin gölgeleri</small>
            </div>
          </div>
          <div class="hero-strip-card">
            <span class="strip-icon">🍳</span>
            <div class="strip-text">
              <strong>Organik Ege Sofrası</strong>
              <small>Köy balı, zeytin & günlük deniz mahsulleri</small>
            </div>
          </div>
          <div class="hero-strip-card">
            <span class="strip-icon">⛵</span>
            <div class="strip-text">
              <strong>Özel Tekne & Ada Turları</strong>
              <small>Kamelya Adası & Dişlice Koyu rotası</small>
            </div>
          </div>
        </div>

      </div>
    </section>

    <!-- STORY & PHILOSOPHY -->
    <section class="v1-section" id="about">
      <div class="container">
        <div class="story-grid">
          <div class="story-left" data-reveal>
            <div class="section-eyebrow-pill">
              <span class="eyebrow-dot"></span>
              <span>HİKAYEMİZ & FELSEFEMİZ</span>
            </div>
            <h2 class="section-title">
              Sessizliğin Kıyısında,<br>
              <em class="serif-highlight">Kendinizi Dinleyeceğiniz Bir Sığınak.</em>
            </h2>
            <div class="glass-card story-glass-card">
              <p class="story-lead">
                ${escapeHtml(name)}, Selimiye Koyu’nun dingin atmosferinde, Ege’nin yavaşlayan ritmini doğal taş ve ahşap dokularla buluşturuyor.
              </p>
              <p class="story-body">
                Kalabalıktan uzakta, yalnızca dalga sesleri ve zeytin ağaçlarının fısıltısıyla başlayan sabahlar; gün boyu iskelede denizle iç içe devam edip, akşam yerel lezzetlerle donatılmış bir kıyı masasında noktalanır.
              </p>
              <div class="story-pillars">
                <div class="pillar-item">
                  <span class="pillar-num">01</span>
                  <div>
                    <strong>Sınırlı Sayıda Butik Oda:</strong>
                    <span>Mahremiyet ve kişiselleştirilmiş sıcak Ege konukseverliği.</span>
                  </div>
                </div>
                <div class="pillar-item">
                  <span class="pillar-num">02</span>
                  <div>
                    <strong>Kıyıya Açılan İskele:</strong>
                    <span>Doğrudan denize girilebilen berrak ve korunaklı koy platformu.</span>
                  </div>
                </div>
                <div class="pillar-item">
                  <span class="pillar-num">03</span>
            <div class="story-mosaic" data-reveal>
            <div class="mosaic-main-card">
              <img src="./media/room.jpg" alt="${escapeHtml(name)} Yaşam Alanı">
              <div class="mosaic-glass-badge">
                <div class="badge-live-tag">✦ SELİMİYE KIYISI</div>
                <strong>${escapeHtml(name)}</strong>
                <small>${escapeHtml(address)}</small>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- SUITES & ROOMS -->
    <section class="v1-section bg-v1-dark" id="suites">
      <div class="container">
        <div class="section-center-head" data-reveal>
          <div class="section-eyebrow-pill">
            <span class="eyebrow-dot"></span>
            <span>KONAKLAMA SEÇENEKLERİ</span>
            <span class="eyebrow-dot"></span>
          </div>
          <h2 class="section-title">
            Huzurla Tasarlanmış<br>
            <em class="serif-highlight">Seçkin Odalar & Süitler</em>
          </h2>
          <p class="section-subtitle">
            Doğal taş mimari, pamuklu keten kumaşlar ve Selimiye’nin hafif esintisini içeri alan geniş pencereler.
          </p>
        </div>

        <div class="suites-glass-grid">
          ${rooms.map((room, idx) => `
            <article class="suite-card" data-reveal>
              <div class="suite-visual">
                <img src="${idx === 0 ? './media/suite_hd.jpg' : './media/room.jpg'}" alt="${escapeHtml(room.title)}">
                <span class="suite-tag">${escapeHtml(room.badge || 'Özel Oda')}</span>
                <div class="suite-specs-bar">
                  <span>📐 ${escapeHtml(room.size || '32 m²')}</span>
                  <span>🌊 ${escapeHtml(room.view || 'Deniz & Bahçe')}</span>
                  <span>🛏️ ${escapeHtml(room.bed || 'Geniş Yatak')}</span>
                </div>
              </div>
              <div class="suite-body">
                <h3 class="suite-name">${escapeHtml(room.title)}</h3>
                <p class="suite-desc">${escapeHtml(room.desc || 'Ferah banyo, doğal keten dokular ve dingin koy manzarası.')}</p>
                <div class="suite-amenities">
                  <span>✦ Özel Balkon/Veranda</span>
                  <span>✦ Yağmur Duşu</span>
                  <span>✦ Sessiz İklimlendirme</span>
                  <span>✦ Organik Buklet</span>
                  <span>✦ Yüksek Hızlı Wi-Fi</span>
                </div>
                <div class="suite-footer">
                  <button class="btn-suite-reserve" data-suite-name="${escapeHtml(room.title)}">
                    <span>Rezerve Et</span> <i>↗</i>
                  </button>
                </div>
              </div>
            </article>
          `).join('')}
        </div>
      </div>
    </section>

    <!-- GÜNÜN RİTMİ (RITUALS) -->
    <section class="v1-section" id="rituals">
      <div class="container">
        <div class="section-center-head" data-reveal>
          <div class="section-eyebrow-pill"><span class="eyebrow-dot"></span><span>GÜNÜN RİTMİ</span><span class="eyebrow-dot"></span></div>
          <h2 class="section-title">Selimiye’de Zamanın Akışı</h2>
          <p class="section-subtitle">Acele etmeden, her saatin tadını çıkararak yaşanan bir tatil deneyimi.</p>
        </div>
        <div class="rituals-deck">
          ${rituals.map(r => `
            <div class="ritual-card" data-reveal>
              <span class="ritual-time">${escapeHtml(r.time)}</span>
              <h4>${escapeHtml(r.title)}</h4>
              <p>${escapeHtml(r.desc)}</p>
            </div>
          `).join('')}
        </div>
      </div>
    </section>

    <!-- GASTRONOMY -->
    <section class="v1-section bg-v1-dark" id="gastronomy">
      <div class="container">
        <div class="gastro-grid">
          <div class="gastro-text" data-reveal>
            <div class="section-eyebrow-pill">
              <span class="eyebrow-dot"></span>
              <span>BAHÇEDEN KIYIYA GASTRONOMİ</span>
            </div>
            <h2 class="section-title">
              Toprağın Bereketi,<br>
              <em class="serif-highlight">Denizin Tazeliğiyle Sofrada.</em>
            </h2>
            <div class="gastro-stack">
              <div class="glass-card gastro-item">
                <span class="g-icon">🫒</span>
                <div class="g-body">
                  <h4>Geleneksel Serpme Ege Kahvaltısı</h4>
                  <p>Yerel Selimiye zeytinleri, kekikli keçi peynirleri, ev yapımı incir ve turunç reçelleri, sıcacık taş fırın ekmekleri ile iskelede uzayan sabahlar.</p>
                </div>
              </div>
              <div class="glass-card gastro-item">
                <span class="g-icon">🦞</span>
                <div class="g-body">
                  <h4>Gün Batımı Kıyı Masası & Günlük Av</h4>
                  <p>Bozburunlu balıkçıların taze lahoz ve çipuraları, taş baskı erken hasat zeytinyağı ile hazırlanan mevsim mezeleri eşliğinde sunulur.</p>
                </div>
              </div>
            </div>
          </div>

          <div class="gastro-media" data-reveal>
            <div class="gastro-video-box">
              <video autoplay muted loop playsinline preload="metadata" poster="./media/dining.jpg">
                <source src="./media/decor.mp4" type="video/mp4">
              </video>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- SELİMİYE DESTINATION & COVES -->
    <section class="v1-section" id="coves">
      <div class="container">
        <div class="section-center-head" data-reveal>
          <div class="section-eyebrow-pill">
            <span class="eyebrow-dot"></span>
            <span>DESTİNASYON & SAKLI KOYLAR</span>
            <span class="eyebrow-dot"></span>
          </div>
          <h2 class="section-title">
            Selimiye’nin Büyüleyici Coğrafyası
          </h2>
          <p class="section-subtitle">
            Durgun bir gölü andıran korunaklı koylar, tarihi Kamelya Adası ve kristal turkuaz sular.
          </p>
        </div>

        <div class="dest-grid-3">
          <div class="dest-card" data-reveal>
            <div class="dest-img-box">
              <img src="./media/jetty_hd.jpg" alt="Sığliman Koyu">
              <span class="dest-pill">Sığliman Koyu</span>
            </div>
            <div class="dest-body">
              <h3>Sığliman & Kıyı Yolu</h3>
              <p>Selimiye’nin en sakin koylarından Sığliman, çarşaf gibi denizi ve sığ sularıyla huzurlu yüzme molaları sunar.</p>
            </div>
          </div>

          <div class="dest-card" data-reveal>
            <div class="dest-img-box">
              <img src="./media/boat-arrival.jpg" alt="Kamelya Adası">
              <span class="dest-pill">Tarihi Miras</span>
            </div>
            <div class="dest-body">
              <h3>Kamelya & Dişlice Adası</h3>
              <p>Tekneyle 15 dakikada ulaşılabilen antik manastır kalıntıları ve volkanik kaya oluşumlarıyla ünlü Dişlice Koyu.</p>
            </div>
          </div>

          <div class="dest-card" data-reveal>
            <div class="dest-img-box">
              <img src="./media/terrace-view.jpg" alt="Karia Yolu">
              <span class="dest-pill">Doğa Yürüyüşü</span>
            </div>
            <div class="dest-body">
              <h3>Antik Karia Yolu Parkuru</h3>
              <p>Selimiye’den başlayan patikalar eşliğinde adaçayı kokulu tepelerden panoramik Ege manzarası.</p>
            </div>
          </div>
        </div>
      </div>
    </section>           <div class="dest-img-box">
              <img src="../_shared/media/terrace-view.jpg" alt="Karia Yolu">
              <span class="dest-pill">Doğa Yürüyüşü</span>
            </div>
            <div class="dest-body">
              <h3>Antik Karia Yolu Parkuru</h3>
              <p>Selimiye’den başlayan patikalar eşliğinde adaçayı kokulu tepelerden panoramik Ege manzarası.</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- EXPERIENCES -->
    <section class="v1-section bg-v1-dark" id="experiences">
      <div class="container">
        <div class="section-center-head" data-reveal>
          <div class="section-eyebrow-pill">
            <span class="eyebrow-dot"></span>
            <span>KÜRATÖRLÜ DENEYİMLER</span>
            <span class="eyebrow-dot"></span>
          </div>
          <h2 class="section-title">
            Unutulmaz Selimiye Hatıraları
          </h2>
        </div>

        <div class="exp-grid-6">
          <div class="glass-card exp-card" data-reveal>
            <div class="exp-top"><span class="exp-num">01</span><span style="font-size:2rem;">⛵</span></div>
            <h3>Özel Gulet ile Saklı Koylar Turu</h3>
            <p>Otel iskelesinden hareketle Bencik, Kameriye ve Aşk Adası’na gün boyu özel mavi tur.</p>
            <div>
              <button class="btn-exp-link" data-exp-title="Özel Gulet Turu">Bilgi Al ↗</button>
            </div>
          </div>

          <div class="glass-card exp-card" data-reveal>
            <div class="exp-top"><span class="exp-num">02</span><span style="font-size:2rem;">🧘</span></div>
            <h3>İskelede Gün Doğumu Yogası</h3>
            <p>Sabahın erken saatlerinde sakin deniz üzerinde zihni dinlendiren nefes ve esneme seansı.</p>
            <div>
              <button class="btn-exp-link" data-exp-title="Gün Doğumu Yogası">Bilgi Al ↗</button>
            </div>
          </div>

          <div class="glass-card exp-card" data-reveal>
            <div class="exp-top"><span class="exp-num">03</span><span style="font-size:2rem;">🫒</span></div>
            <h3>Zeytinyağı & Şarap Tadımı</h3>
            <p>Bozburun Yarımadası’nın asırlık ağaçlarından elde edilen soğuk sıkım erken hasat zeytinyağları.</p>
            <div>
              <button class="btn-exp-link" data-exp-title="Zeytinyağı Tadımı">Bilgi Al ↗</button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- AMENITIES -->
    <section class="v1-section" id="amenities">
      <div class="container">
        <div class="glass-card amenities-card" data-reveal>
          <div class="section-center-head">
            <div class="section-eyebrow-pill"><span class="eyebrow-dot"></span><span>AYRICALIKLAR</span></div>
            <h2 class="section-title">Konforunuz İçin Her Detay</h2>
          </div>
          <div class="amenities-grid">
            <div class="am-item">
              <h4>⚓ Özel İskele & Bağlama</h4>
              <p>Denizden gelen misafirler için güvenli tonoz ve yanaşma desteği.</p>
            </div>
            <div class="am-item">
              <h4>🛎️ Kişisel Concierge</h4>
              <p>Tekne kiralama, restoran rezervasyonu ve VIP transfer koordinasyonu.</p>
            </div>
            <div class="am-item">
              <h4>🌿 Botanik Avlu</h4>
              <p>Asırlık zeytin ağaçları ve begonviller altında dinlenme köşeleri.</p>
            </div>
            <div class="am-item">
              <h4>📶 Hızlı Wi-Fi 6</h4>
              <p>Tüm odalarda ve iskelede kesintisiz yüksek hızlı internet.</p>
            </div>
            <div class="am-item">
              <h4>🚗 Otopark Alanı</h4>
              <p>Tesis misafirlerine özel güvenli otopark imkanı.</p>
            </div>
            <div class="am-item">
              <h4>🧴 Organik Buklet</h4>
              <p>Doğal zeytinyağlı bakım ürünleri ve yastık seçenekleri.</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- CONTACT & RESERVATION HUB -->
    <section class="v1-section bg-v1-dark" id="contact">
      <div class="container">
        <div class="glass-card hub-layout" data-reveal>
          <div class="hub-left">
            <div class="hub-brand-badge">
              <img src="./media/logo.svg" alt="${escapeHtml(name)} Logo">
              <div>
                <strong>${escapeHtml(name).toUpperCase()}</strong>
                <small>SELİMİYE / MARMARİS</small>
              </div>
            </div>
            <h2 class="hub-title">Sakin Bir Mola İçin<br><em class="serif-highlight">Bize Ulaşın.</em></h2>
            <p class="story-body">Tarihlerinizi iletin, en avantajlı doğrudan rezervasyon teklifiyle anında dönüş yapalım.</p>
            
            <div class="hub-contacts">
              <div class="h-item">
                <span>📍</span>
                <div>
                  <strong>Adres</strong>
                  <span>${escapeHtml(address)}</span>
                </div>
              </div>
              <div class="h-item">
                <span>📞</span>
                <div>
                  <strong>Telefon</strong>
                  <a href="tel:${escapeHtml(cleanPhone)}">${escapeHtml(phone)}</a>
                </div>
              </div>
              <div class="h-item">
                <span>💬</span>
                <div>
                  <strong>WhatsApp</strong>
                  <a href="https://wa.me/${escapeHtml(cleanPhone)}" target="_blank">${escapeHtml(phone)}</a>
                </div>
              </div>
            </div>
          </div>

          <div class="hub-right">
            <div class="form-box">
              <h3>Müsaitlik & Rezervasyon Talebi</h3>
              <form class="real-form" id="contactMainForm">
                <div class="form-row-2">
                  <div class="f-field">
                    <label>Adınız Soyadınız *</label>
                    <input type="text" id="contactName" placeholder="Ad Soyad" required>
                  </div>
                  <div class="f-field">
                    <label>Telefon / WhatsApp *</label>
                    <input type="tel" id="contactPhone" placeholder="+90 5xx xxx xx xx" required>
                  </div>
                </div>
                <div class="form-row-2">
                  <div class="f-field">
                    <label>Giriş Tarihi *</label>
                    <input type="date" id="contactCheckin" required>
                  </div>
                  <div class="f-field">
                    <label>Çıkış Tarihi *</label>
                    <input type="date" id="contactCheckout" required>
                  </div>
                </div>
                <div class="form-row-2">
                  <div class="f-field">
                    <label>Kişi Sayısı</label>
                    <select id="contactGuests">
                      <option value="2 Yetişkin">2 Yetişkin</option>
                      <option value="1 Yetişkin">1 Yetişkin</option>
                      <option value="3 Yetişkin">3 Yetişkin</option>
                      <option value="4+ Yetişkin">4+ Yetişkin / Aile</option>
                    </select>
                  </div>
                  <div class="f-field">
                    <label>Oda Tercihi</label>
                    <select id="contactSuite">
                      ${rooms.map(r => `<option value="${escapeHtml(r.title)}">${escapeHtml(r.title)}</option>`).join('')}
                    </select>
                  </div>
                </div>
                <div class="f-field">
                  <label>Özel Notlar</label>
                  <textarea id="contactNotes" rows="2" placeholder="Özel talepleriniz veya transfer isteğiniz..."></textarea>
                </div>
                <button type="submit" class="btn-gold-cta w-full">WhatsApp ile Rezervasyon İlet ↗</button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>

  </main>

  <footer class="v1-footer">
    <div class="container">
      <div class="footer-grid">
        <div class="footer-col">
          <div class="footer-logo-row">
            <img src="./media/logo.svg" alt="${escapeHtml(name)}" class="footer-avatar">
            <span>${escapeHtml(name).toUpperCase()}</span>
          </div>
          <p>${escapeHtml(tagline)}</p>
        </div>
        <div class="footer-col">
          <strong>Hızlı Bağlantılar</strong>
          <a href="#about">Felsefe</a>
          <a href="#suites">Odalar & Süitler</a>
          <a href="#gastronomy">Gastronomi</a>
          <a href="#experiences">Aktiviteler</a>
        </div>
        <div class="footer-col">
          <strong>Selimiye Rehberi</strong>
          <a href="#coves">Sığliman Koyu</a>
          <a href="#coves">Kamelya Adası</a>
          <a href="#coves">Karia Yolu</a>
          <a href="#contact">Ulaşım</a>
        </div>
        <div class="footer-col">
          <strong>İletişim</strong>
          <p>${escapeHtml(address)}</p>
          <a href="tel:${escapeHtml(cleanPhone)}">${escapeHtml(phone)}</a>
        </div>
      </div>
      <div class="footer-bottom">
        <p>© 2026 ${escapeHtml(name)}. Tüm Hakları Saklıdır.</p>
        <span>Powered by AEON Luxury Hospitality Engine</span>
      </div>
    </div>
  </footer>

  <!-- Modal -->
  <div class="modal-backdrop" id="bookingModal">
    <div class="modal-window">
      <button class="modal-close" id="modalCloseBtn">✕</button>
      <div class="modal-head">
        <span class="section-eyebrow-pill">✦ DOĞRUDAN REZERVASYON</span>
        <h3 id="modalTitleText">${escapeHtml(name)} Rezervasyon</h3>
      </div>
      <form class="real-form" id="modalBookingForm">
        <div class="f-field">
          <label>Seçilen Oda / Deneyim</label>
          <input type="text" id="modalSuiteChoice" readonly>
        </div>
        <div class="form-row-2">
          <div class="f-field">
            <label>Giriş Tarihi</label>
            <input type="date" id="mCheckin" required>
          </div>
          <div class="f-field">
            <label>Çıkış Tarihi</label>
            <input type="date" id="mCheckout" required>
          </div>
        </div>
        <div class="form-row-2">
          <div class="f-field">
            <label>Misafir Sayısı</label>
            <select id="mGuests">
              <option value="2 Yetişkin">2 Yetişkin</option>
              <option value="1 Yetişkin">1 Yetişkin</option>
              <option value="3 Yetişkin">3 Yetişkin</option>
              <option value="4+ Yetişkin">4+ Yetişkin</option>
            </select>
          </div>
          <div class="f-field">
            <label>Telefon / WhatsApp *</label>
            <input type="tel" id="mPhone" placeholder="+90 5xx xxx xx xx" required>
          </div>
        </div>
        <div class="f-field">
          <label>Notlar</label>
          <input type="text" id="mNotes" placeholder="Özel istekleriniz...">
        </div>
        <button type="submit" class="btn-gold-cta w-full">WhatsApp ile Gönder ↗</button>
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

function main() {
  const hotels = researchV2.hotels;
  const manifest = [];
  const jsContent = generateJS();

  for (const hotel of hotels) {
    const slug = hotel.slug;
    const detail = detailBySlug.get(slug);
    const hotelDir = path.join(outputRoot, slug);
    if (!fs.existsSync(hotelDir)) fs.mkdirSync(hotelDir, { recursive: true });

    const pageHtml = generateV1Page(hotel, detail);
    fs.writeFileSync(path.join(hotelDir, 'index.html'), pageHtml, 'utf8');
    fs.writeFileSync(path.join(hotelDir, 'styles.css'), sharedV1CSS, 'utf8');
    fs.writeFileSync(path.join(hotelDir, 'app.js'), jsContent, 'utf8');

    manifest.push({
      slug,
      name: hotel.name,
      version: 'v1',
      phone: detail?.phone || hotel.phone || null
    });
  }

  fs.writeFileSync(path.join(outputRoot, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`✅ Generated ${manifest.length} V1 Selimiye Websites with Obsidian Gold Liquid Glass & Günün Ritmi!`);
}

main();
