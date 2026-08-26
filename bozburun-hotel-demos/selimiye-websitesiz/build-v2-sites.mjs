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
// REVOLUTIONARY 2026 LIQUID GLASS CSS (ZERO RESEMBLANCE TO OLD TEMPLATES)
// ============================================================================
function generateNextGenLiquidCSS(hotel) {
  const theme = hotel.theme || {};
  const primary = theme.primary || '#00f2fe';
  const secondary = theme.secondary || '#d4af37';
  const dark = theme.dark || '#02060e';
  const card = theme.card || 'rgba(8, 22, 40, 0.65)';
  const accentLight = theme.accent || '#fff3cf';

  return `/* ==========================================================================
   SELİMİYE HOTELS — 2026 NEXT-GEN LIQUID GLASS ARCHITECTURE
   Hotel: ${hotel.name.toUpperCase()}
   ========================================================================== */

@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700;800;900&family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');

:root {
  --bg-deep: ${dark};
  --bg-liquid-surface: color-mix(in srgb, ${dark} 80%, #ffffff 20%);
  --bg-glass-card: ${card};
  --bg-glass-heavy: color-mix(in srgb, ${dark} 88%, #000000 12%);
  --bg-glass-pill: rgba(255, 255, 255, 0.08);

  --accent-primary: ${primary};
  --accent-secondary: ${secondary};
  --accent-light: ${accentLight};
  --glow-primary: ${primary}55;
  --glow-secondary: ${secondary}55;

  --gradient-neon: linear-gradient(135deg, ${primary} 0%, #4facfe 50%, ${secondary} 100%);
  --gradient-gold: linear-gradient(135deg, #fff3cf 0%, #e2c174 35%, #c59b3f 70%, #8c6721 100%);
  --gradient-liquid-glass: linear-gradient(135deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.02) 100%);

  --font-serif: 'Cormorant Garamond', Georgia, serif;
  --font-heading: 'Cinzel', 'Playfair Display', Georgia, serif;
  --font-sans: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;

  --border-glass: rgba(255, 255, 255, 0.14);
  --border-glass-bright: rgba(255, 255, 255, 0.28);
  --border-accent: ${primary}77;
  --border-gold: rgba(212, 175, 55, 0.5);

  --shadow-liquid-deep: 0 35px 90px -15px rgba(0, 0, 0, 0.95), 0 0 45px var(--glow-primary);
  --shadow-card-gloss: inset 0 1px 1px rgba(255, 255, 255, 0.35), inset 0 -1px 1px rgba(0, 0, 0, 0.5), 0 20px 60px rgba(0, 0, 0, 0.8);
  --shadow-gold-glow: 0 0 45px rgba(212, 175, 55, 0.45);

  --blur-ultra: blur(36px) saturate(220%);
  --blur-medium: blur(20px) saturate(180%);

  --radius-xs: 8px;
  --radius-sm: 14px;
  --radius-md: 24px;
  --radius-lg: 36px;
  --radius-full: 9999px;

  --transition: all 0.45s cubic-bezier(0.16, 1, 0.3, 1);
}

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  scroll-behavior: smooth;
  font-size: 16px;
  background-color: var(--bg-deep);
  color: #f8fafc;
}

body.v2-liquid-nextgen {
  font-family: var(--font-sans);
  background-color: var(--bg-deep);
  color: #f8fafc;
  line-height: 1.7;
  overflow-x: hidden;
  position: relative;
  -webkit-font-smoothing: antialiased;
}

/* Ambient Liquid Plasma Mesh */
.ambient-liquid-plasma {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  overflow: hidden;
}
.plasma-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(140px);
  opacity: 0.48;
  animation: plasmaFloat 24s ease-in-out infinite alternate;
}
.plasma-1 {
  top: -12vh;
  left: 12vw;
  width: 65vw;
  height: 65vw;
  background: radial-gradient(circle, var(--glow-primary) 0%, transparent 70%);
}
.plasma-2 {
  top: 38vh;
  right: -12vw;
  width: 58vw;
  height: 58vw;
  background: radial-gradient(circle, var(--glow-secondary) 0%, transparent 70%);
  animation-delay: -8s;
}
.plasma-3 {
  bottom: -15vh;
  left: 25vw;
  width: 70vw;
  height: 70vw;
  background: radial-gradient(circle, var(--glow-primary) 0%, transparent 70%);
  animation-delay: -16s;
}
@keyframes plasmaFloat {
  0% { transform: translate(0, 0) scale(1) rotate(0deg); }
  50% { transform: translate(70px, -50px) scale(1.1) rotate(180deg); }
  100% { transform: translate(-50px, 70px) scale(0.92) rotate(360deg); }
}

.container-liquid {
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 2.5rem;
  position: relative;
  z-index: 2;
}

/* ============================================================================
   VISIONOS FLOATING GLASS CAPSULE NAVIGATION
   ============================================================================ */
.v2-vision-header {
  position: sticky;
  top: 0;
  z-index: 100;
  padding: 1.25rem 0;
  transition: var(--transition);
}
.v2-vision-header.scrolled {
  padding: 0.65rem 0;
}
.vision-capsule-island {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0.75rem 2.25rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--bg-glass-heavy);
  backdrop-filter: var(--blur-ultra);
  border: 1px solid var(--border-glass-bright);
  border-radius: var(--radius-full);
  box-shadow: var(--shadow-liquid-deep), var(--shadow-card-gloss);
}

.brand-vision-unit {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  text-decoration: none;
}
.brand-vision-medallion {
  width: 62px;
  height: 62px;
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 28px var(--glow-primary), 0 0 15px rgba(212, 175, 55, 0.4);
  transition: var(--transition);
}
.brand-vision-medallion:hover {
  transform: scale(1.1) rotate(5deg);
  box-shadow: 0 0 45px var(--glow-primary);
}
.brand-vision-medallion svg {
  width: 100%;
  height: 100%;
  display: block;
}
.brand-title-stack {
  display: flex;
  flex-direction: column;
}
.brand-title-bold {
  font-family: var(--font-heading);
  font-size: 1.32rem;
  font-weight: 800;
  letter-spacing: 0.14em;
  color: #ffffff;
  line-height: 1.2;
}
.brand-sub-badge {
  font-size: 0.7rem;
  letter-spacing: 0.25em;
  background: var(--gradient-gold);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  text-transform: uppercase;
  font-weight: 800;
}

.vision-nav-links {
  display: flex;
  align-items: center;
  gap: 2.25rem;
}
.v-nav-item {
  font-size: 0.94rem;
  color: #cbd5e1;
  text-decoration: none;
  font-weight: 600;
  letter-spacing: 0.04em;
  transition: var(--transition);
  position: relative;
  padding: 0.4rem 0;
}
.v-nav-item:hover {
  color: #ffffff;
}
.v-nav-item::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  width: 0;
  height: 2px;
  background: var(--gradient-neon);
  transition: width 0.35s ease;
  border-radius: var(--radius-full);
}
.v-nav-item:hover::after {
  width: 100%;
}

.vision-actions-group {
  display: flex;
  align-items: center;
  gap: 1.25rem;
}
.live-weather-capsule {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid var(--border-accent);
  padding: 0.5rem 1.2rem;
  border-radius: var(--radius-full);
  color: var(--accent-primary);
  font-size: 0.82rem;
  font-weight: 800;
}
.live-pulse-beacon {
  width: 8px;
  height: 8px;
  background: var(--accent-primary);
  border-radius: 50%;
  box-shadow: 0 0 14px var(--accent-primary);
  animation: pulseBeacon 2s infinite;
}
@keyframes pulseBeacon {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.35; transform: scale(0.7); }
}

.btn-vision-gold-cta {
  background: var(--gradient-gold);
  color: #040810;
  border: none;
  font-family: var(--font-sans);
  font-size: 0.88rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  padding: 0.75rem 1.8rem;
  border-radius: var(--radius-full);
  cursor: pointer;
  box-shadow: var(--shadow-gold-glow);
  transition: var(--transition);
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.btn-vision-gold-cta:hover {
  transform: translateY(-2px) scale(1.03);
  box-shadow: 0 0 45px rgba(212, 175, 55, 0.65);
}

/* ============================================================================
   HERO: IMMERSIVE FULL-VIEWPORT LIQUID CINEMA
   ============================================================================ */
.hero-nextgen-canvas {
  position: relative;
  min-height: 94vh;
  display: flex;
  align-items: center;
  padding: 6.5rem 0 5.5rem;
  overflow: hidden;
}
.hero-canvas-grid {
  display: grid;
  grid-template-columns: 1.18fr 1fr;
  gap: 5.5rem;
  align-items: center;
}

.hero-editorial-column {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
}
.hero-kicker-glow {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  background: rgba(8, 26, 46, 0.9);
  backdrop-filter: var(--blur-medium);
  border: 1px solid var(--border-accent);
  padding: 0.58rem 1.6rem;
  border-radius: var(--radius-full);
  font-size: 0.82rem;
  font-weight: 800;
  letter-spacing: 0.16em;
  color: #ffffff;
  margin-bottom: 2rem;
  box-shadow: var(--shadow-liquid-deep);
}
.badge-gold-sparkle {
  background: var(--gradient-gold);
  color: #000;
  font-size: 0.72rem;
  font-weight: 900;
  padding: 2px 10px;
  border-radius: var(--radius-full);
}

.hero-monumental-h1 {
  font-family: var(--font-heading);
  font-size: clamp(2.8rem, 5.4vw, 4.8rem);
  font-weight: 800;
  line-height: 1.12;
  color: #ffffff;
  margin-bottom: 1.75rem;
  text-shadow: 0 4px 40px rgba(0, 0, 0, 0.98);
}
.hero-highlight-italic {
  font-family: var(--font-serif);
  font-style: italic;
  font-weight: 400;
  background: var(--gradient-gold);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
.hero-narrative-lead {
  font-size: 1.18rem;
  color: #cbd5e1;
  line-height: 1.85;
  margin-bottom: 2.85rem;
  max-width: 650px;
}

/* Floating Glass Hero Booking Island */
.hero-booking-dock-island {
  width: 100%;
  background: var(--bg-glass-card);
  backdrop-filter: var(--blur-ultra);
  border: 1.5px solid var(--border-accent);
  border-radius: var(--radius-lg);
  padding: 1.85rem 2.25rem;
  box-shadow: var(--shadow-liquid-deep), var(--shadow-card-gloss);
}
.dock-4fields-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr) auto;
  gap: 1.35rem;
  align-items: center;
}
.dock-cell-input {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}
.dock-cell-input label {
  font-size: 0.74rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  color: var(--accent-primary);
  text-transform: uppercase;
}
.dock-cell-input input, .dock-cell-input select {
  background: var(--bg-glass-pill);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: var(--radius-sm);
  padding: 0.8rem 1rem;
  color: #ffffff;
  font-family: var(--font-sans);
  font-size: 0.94rem;
  outline: none;
  transition: var(--transition);
}
.dock-cell-input input:focus, .dock-cell-input select:focus {
  border-color: var(--accent-primary);
  box-shadow: 0 0 25px var(--glow-primary);
}

.btn-dock-find {
  background: var(--gradient-gold);
  color: #040810;
  border: none;
  font-family: var(--font-sans);
  font-size: 0.94rem;
  font-weight: 800;
  padding: 0.9rem 1.8rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  box-shadow: var(--shadow-gold-glow);
  transition: var(--transition);
  height: 52px;
}
.btn-dock-find:hover {
  transform: translateY(-2px);
  box-shadow: 0 0 40px rgba(212, 175, 55, 0.7);
}

/* Hero Right 3D Visual Theater */
.hero-stage-theater {
  position: relative;
}
.theater-frame-main {
  position: relative;
  border-radius: var(--radius-lg);
  overflow: hidden;
  border: 1.5px solid var(--border-accent);
  box-shadow: var(--shadow-liquid-deep), var(--shadow-card-gloss);
  height: 520px;
}
.theater-frame-main img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.badge-theater-floating {
  position: absolute;
  bottom: -1.75rem;
  left: -1.75rem;
  background: rgba(6, 18, 34, 0.94);
  backdrop-filter: var(--blur-ultra);
  border: 1px solid var(--border-glass-bright);
  padding: 1.45rem 2rem;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-liquid-deep);
  max-width: 320px;
}
.badge-theater-floating strong {
  display: block;
  font-family: var(--font-heading);
  font-size: 1.2rem;
  color: #ffffff;
  margin-bottom: 2px;
}
.badge-theater-floating span {
  font-size: 0.85rem;
  color: var(--accent-primary);
}

/* ============================================================================
   SUITES: PANORAMIC LOOKBOOK (EXPANSIVE 3D GLASS CARDS)
   ============================================================================ */
.v2-liquid-section {
  padding: 8.5rem 0;
  position: relative;
  z-index: 2;
}
.section-mast-center {
  text-align: center;
  max-width: 880px;
  margin: 0 auto 5.5rem;
}
.pill-section-kicker {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid var(--border-accent);
  padding: 0.48rem 1.4rem;
  border-radius: var(--radius-full);
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.16em;
  color: var(--accent-primary);
  margin-bottom: 1.5rem;
}
.section-title-monument {
  font-family: var(--font-heading);
  font-size: clamp(2.4rem, 4.6vw, 3.6rem);
  font-weight: 800;
  line-height: 1.18;
  color: #ffffff;
  margin-bottom: 1.4rem;
}
.section-desc-subtle {
  font-size: 1.12rem;
  color: #94a3b8;
  line-height: 1.85;
}

.suites-lookbook-stack {
  display: flex;
  flex-direction: column;
  gap: 3.75rem;
}
.suite-lookbook-card-3d {
  display: grid;
  grid-template-columns: 1.18fr 1fr;
  background: var(--bg-glass-card);
  backdrop-filter: var(--blur-ultra);
  border: 1px solid var(--border-glass-bright);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-liquid-deep), var(--shadow-card-gloss);
  transition: var(--transition);
}
.suite-lookbook-card-3d.reverse {
  grid-template-columns: 1fr 1.18fr;
}
.suite-lookbook-card-3d:hover {
  border-color: var(--accent-primary);
  transform: translateY(-8px);
  box-shadow: 0 40px 100px -15px rgba(0, 0, 0, 0.98), 0 0 55px var(--glow-primary);
}

.suite-photo-wrapper {
  position: relative;
  min-height: 440px;
  overflow: hidden;
}
.suite-photo-wrapper img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.8s ease;
}
.suite-lookbook-card-3d:hover .suite-photo-wrapper img {
  transform: scale(1.06);
}
.suite-floating-ribbon {
  position: absolute;
  top: 1.75rem;
  left: 1.75rem;
  background: rgba(2, 7, 14, 0.9);
  backdrop-filter: var(--blur-medium);
  border: 1px solid var(--border-gold);
  color: var(--accent-light);
  font-size: 0.78rem;
  font-weight: 800;
  padding: 6px 18px;
  border-radius: var(--radius-full);
}

.suite-meta-wrapper {
  padding: 3.75rem;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
.suite-serial-kicker {
  font-size: 0.76rem;
  letter-spacing: 0.22em;
  color: var(--accent-primary);
  text-transform: uppercase;
  font-weight: 800;
  margin-bottom: 0.65rem;
  display: block;
}
.suite-title-large {
  font-family: var(--font-heading);
  font-size: 2.1rem;
  color: #ffffff;
  margin-bottom: 1.2rem;
}
.suite-narrative-desc {
  font-size: 1rem;
  color: #94a3b8;
  line-height: 1.8;
  margin-bottom: 2.4rem;
}

.suite-specs-3capsules {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.35rem;
  margin-bottom: 2.4rem;
  padding: 1.35rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-sm);
}
.capsule-spec-item span {
  display: block;
  font-size: 0.72rem;
  color: #64748b;
  text-transform: uppercase;
  font-weight: 800;
  margin-bottom: 2px;
}
.capsule-spec-item strong {
  font-size: 0.96rem;
  color: #ffffff;
}

.suite-action-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid rgba(255, 255, 255, 0.12);
  padding-top: 1.85rem;
}
.rate-guarantee-tag {
  font-size: 0.86rem;
  color: var(--accent-light);
  font-weight: 700;
}

/* ============================================================================
   24-HOUR RITUALS (DYNAMIC DAY-TO-NIGHT ATMOSPHERE CANVAS)
   ============================================================================ */
.rituals-dynamic-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2.5rem;
}
.ritual-glass-card {
  background: var(--bg-glass-card);
  backdrop-filter: var(--blur-ultra);
  border: 1px solid var(--border-glass-bright);
  border-radius: var(--radius-lg);
  padding: 3rem;
  box-shadow: var(--shadow-liquid-deep), var(--shadow-card-gloss);
  transition: var(--transition);
  position: relative;
  overflow: hidden;
}
.ritual-glass-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3.5px;
  background: var(--gradient-neon);
  opacity: 0.85;
}
.ritual-glass-card:hover {
  border-color: var(--accent-primary);
  transform: translateY(-8px);
  box-shadow: 0 0 50px var(--glow-primary);
}
.ritual-time-badge {
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.14em;
  color: var(--accent-primary);
  text-transform: uppercase;
  margin-bottom: 1rem;
  display: block;
}
.ritual-glass-card h4 {
  font-family: var(--font-heading);
  font-size: 1.5rem;
  color: #ffffff;
  margin-bottom: 0.9rem;
}
.ritual-glass-card p {
  font-size: 0.96rem;
  color: #94a3b8;
  line-height: 1.8;
}

/* ============================================================================
   GASTRONOMY: VIDEO & DEGUSTATION
   ============================================================================ */
.gastronomy-theater-layout {
  display: grid;
  grid-template-columns: 1fr 1.18fr;
  gap: 5rem;
  align-items: center;
}
.degustation-panel-glass {
  background: var(--bg-glass-card);
  backdrop-filter: var(--blur-ultra);
  border: 1px solid var(--border-gold);
  border-radius: var(--radius-lg);
  padding: 3.25rem;
  box-shadow: var(--shadow-liquid-deep), var(--shadow-gold-glow);
}
.degustation-top-header {
  border-bottom: 1px solid rgba(255, 255, 255, 0.14);
  padding-bottom: 1.5rem;
  margin-bottom: 2.25rem;
}
.degustation-top-header h3 {
  font-family: var(--font-heading);
  font-size: 1.85rem;
  color: #ffffff;
}
.degustation-courses-list {
  display: flex;
  flex-direction: column;
  gap: 1.85rem;
}
.course-item-box {
  display: flex;
  gap: 1.6rem;
}
.num-roman-gold {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 1.9rem;
  color: var(--accent-light);
  line-height: 1;
}
.course-info strong {
  display: block;
  font-family: var(--font-heading);
  font-size: 1.12rem;
  color: #ffffff;
  margin-bottom: 3px;
}
.course-info p {
  font-size: 0.92rem;
  color: #94a3b8;
}

.video-theater-frame {
  border-radius: var(--radius-lg);
  overflow: hidden;
  border: 1.5px solid var(--border-accent);
  box-shadow: var(--shadow-liquid-deep), var(--shadow-card-gloss);
}
.video-theater-frame video {
  width: 100%;
  height: 460px;
  object-fit: cover;
  display: block;
}

/* ============================================================================
   VIP CONCIERGE TERMINAL
   ============================================================================ */
.vip-terminal-deck {
  background: var(--bg-glass-heavy);
  backdrop-filter: var(--blur-ultra);
  border: 1.5px solid var(--border-accent);
  border-radius: var(--radius-lg);
  padding: 4.25rem;
  box-shadow: var(--shadow-liquid-deep), var(--shadow-card-gloss);
}
.vip-terminal-split {
  display: grid;
  grid-template-columns: 1fr 1.18fr;
  gap: 5rem;
}
.vip-terminal-left h2 {
  font-family: var(--font-heading);
  font-size: 2.6rem;
  color: #ffffff;
  margin-bottom: 1.2rem;
}
.vip-lines-column {
  display: flex;
  flex-direction: column;
  gap: 1.4rem;
  margin: 2.4rem 0;
}
.vip-line-box strong {
  display: block;
  font-size: 0.78rem;
  color: var(--accent-primary);
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
.vip-line-box span, .vip-line-box a {
  color: #ffffff;
  font-size: 1.05rem;
  text-decoration: none;
}

.vip-form-box {
  background: color-mix(in srgb, var(--bg-deep) 85%, #ffffff 15%);
  border: 1px solid var(--border-glass-bright);
  padding: 2.75rem;
  border-radius: var(--radius-md);
}
.form-2inputs-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.2rem;
  margin-bottom: 1.2rem;
}
.form-input-block {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}
.form-input-block label {
  font-size: 0.78rem;
  font-weight: 800;
  color: #94a3b8;
}
.form-input-block input, .form-input-block select, .form-input-block textarea {
  background: var(--bg-glass-pill);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: var(--radius-sm);
  padding: 0.8rem 1rem;
  color: #ffffff;
  font-family: var(--font-sans);
  font-size: 0.94rem;
  outline: none;
}
.form-input-block input:focus, .form-input-block select:focus, .form-input-block textarea:focus {
  border-color: var(--accent-primary);
  box-shadow: 0 0 20px var(--glow-primary);
}

/* Footer */
.v2-liquid-footer {
  border-top: 1px solid rgba(255, 255, 255, 0.12);
  padding: 5.5rem 0 3.5rem;
  position: relative;
  z-index: 2;
  background: #010408;
}
.footer-panoramic-3col {
  display: grid;
  grid-template-columns: 1.6fr 1fr 1fr;
  gap: 4.5rem;
  margin-bottom: 4.5rem;
}
.footer-brand-title {
  font-family: var(--font-heading);
  font-size: 1.5rem;
  color: #ffffff;
  margin-bottom: 0.9rem;
}
.footer-nav-column {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}
.footer-nav-column strong {
  font-size: 0.82rem;
  letter-spacing: 0.14em;
  color: var(--accent-primary);
  text-transform: uppercase;
  margin-bottom: 0.65rem;
}
.footer-nav-column a {
  color: #94a3b8;
  text-decoration: none;
  font-size: 0.96rem;
  transition: var(--transition);
}
.footer-nav-column a:hover {
  color: #ffffff;
}
.footer-bottom-bar {
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding-top: 2.4rem;
  display: flex;
  justify-content: space-between;
  font-size: 0.86rem;
  color: #64748b;
}

@media (max-width: 1024px) {
  .vision-nav-links, .live-weather-capsule { display: none; }
  .hero-canvas-grid, .gastronomy-theater-layout, .vip-terminal-split { grid-template-columns: 1fr; gap: 4rem; }
  .suite-lookbook-card-3d, .suite-lookbook-card-3d.reverse { grid-template-columns: 1fr; }
  .rituals-dynamic-grid { grid-template-columns: 1fr; }
  .dock-4fields-grid { grid-template-columns: 1fr 1fr; }
  .btn-dock-find { grid-column: span 2; }
  .footer-panoramic-3col { grid-template-columns: 1fr 1fr; }
}

@media (max-width: 640px) {
  .dock-4fields-grid { grid-template-columns: 1fr; }
  .btn-dock-find { grid-column: span 1; }
  .form-2inputs-row { grid-template-columns: 1fr; }
  .vip-terminal-deck { padding: 2rem; }
  .suite-meta-wrapper { padding: 2rem; }
  .footer-panoramic-3col { grid-template-columns: 1fr; }
}
`;
}

// ============================================================================
// REVOLUTIONARY 2026 LIQUID GLASS HTML BUILDER
// ============================================================================
function generateNextGenLiquidHTML(hotel, detail) {
  const name = hotel.name;
  const slug = hotel.slug;
  const phone = detail?.phone || hotel.phone || '0252 456 23 40';
  const cleanPhone = phone.replace(/\D/g, '') || '902524562340';
  const address = detail?.address || hotel.location || 'Selimiye Koyu, Marmaris / Muğla';
  const tagline = hotel.tagline || 'Selimiye’de Kristal Sular & Yüksek Kıyı Konforu';
  const concept = hotel.concept || 'Kıyı Dinginliği & Lüks Butik Deneyim';
  const audience = hotel.targetAudience || 'Seçkin Misafirler & Çiftler';
  const seaDist = hotel.seaDistance || 'Denize Sıfır & Özel Ahşap İskele';

  const rooms = (hotel.rooms && hotel.rooms.length) ? hotel.rooms : [
    { title: "Deluxe Deniz Manzaralı Taş Süit", size: "36 m²", view: "Panoramik Deniz Manzaralı", bed: "King Size Yatak", desc: "Geniş verandası, doğal taş dokuları ve sabahın ilk ışıklarını karşılayan ferah yaşam alanı.", badge: "İmza Süit" },
    { title: "Botanik Avlu Bahçe Odası", size: "28 m²", view: "Zeytinlik & Bahçe Avlusu", bed: "Queen Size Yatak", desc: "Begonviller ve zeytin ağaçlarıyla çevrili, serin taş mimarisiyle izole bir kaçış köşesi.", badge: "Sakin Kaçış" }
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
  <meta name="description" content="${escapeHtml(name)} — Selimiye Koyu'nda ${escapeHtml(concept)}. ${escapeHtml(audience)}.">
  <title>${escapeHtml(name)} — Selimiye | Next-Gen Liquid Glass (V2)</title>
  
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700;800;900&family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  
  <link rel="stylesheet" href="./styles.css?v=${Date.now()}">
  <script defer src="./app.js?v=${Date.now()}"></script>
</head>
<body class="v2-liquid-nextgen" data-phone="${escapeHtml(cleanPhone)}" data-hotel="${escapeHtml(name)}">

  <!-- Ambient Liquid Plasma Mesh -->
  <div class="ambient-liquid-plasma" aria-hidden="true">
    <div class="plasma-orb plasma-1"></div>
    <div class="plasma-orb plasma-2"></div>
    <div class="plasma-orb plasma-3"></div>
  </div>

  <!-- FLOATING VISIONOS GLASS CAPSULE HEADER -->
  <header class="v2-vision-header" id="v2Header">
    <div class="vision-capsule-island">
      
      <a href="#top" class="brand-vision-unit">
        <div class="brand-vision-medallion">
          ${getLuxuryEmblem(slug, name, true)}
        </div>
        <div class="brand-title-stack">
          <span class="brand-title-bold">${escapeHtml(name).toUpperCase()}</span>
          <span class="brand-sub-badge">SELİMİYE · MARMARİS</span>
        </div>
      </a>

      <nav class="vision-nav-links">
        <a href="#suites" class="v-nav-item">Süitler & Odalar</a>
        <a href="#rituals" class="v-nav-item">Koy Ritüelleri</a>
        <a href="#gastronomy" class="v-nav-item">Gastronomi</a>
        <a href="#concierge" class="v-nav-item">VIP Danışma</a>
      </nav>

      <div class="vision-actions-group">
        <div class="live-weather-capsule">
          <span class="live-pulse-beacon"></span>
          <span>☀️ 28°C Selimiye</span>
        </div>
        <button class="btn-vision-gold-cta" data-book>
          <span>Rezervasyon</span>
          <i>↗</i>
        </button>
      </div>

    </div>
  </header>

  <main id="top">
    
    <!-- HERO: FULL-VIEWPORT CINEMATIC CANVAS -->
    <section class="hero-nextgen-canvas">
      <div class="container-liquid">
        <div class="hero-canvas-grid">
          
          <div class="hero-editorial-column">
            <div class="hero-kicker-glow">
              <span class="live-pulse-beacon"></span>
              <span>${escapeHtml(seaDist).toUpperCase()}</span>
              <span class="badge-gold-sparkle">V2 LIQUID GLASS</span>
            </div>

            <h1 class="hero-monumental-h1">
              Akışkan Camın Işığında,<br>
              <em class="hero-highlight-italic">${escapeHtml(tagline)}</em>
            </h1>

            <p class="hero-narrative-lead">
              ${escapeHtml(name)}; Selimiye’nin kristal turkuaz suları üzerinde, ${escapeHtml(concept).toLowerCase()} anlayışıyla tasarlanmış seçkin bir Ege inzivası sunar.
            </p>

            <!-- Hero Floating Booking Dock -->
            <div class="hero-booking-dock-island">
              <form class="dock-4fields-grid" onsubmit="return false;">
                <div class="dock-cell-input">
                  <label>GİRİŞ TARİHİ</label>
                  <input type="date" id="heroCheckin" required>
                </div>
                <div class="dock-cell-input">
                  <label>ÇIKIŞ TARİHİ</label>
                  <input type="date" id="heroCheckout" required>
                </div>
                <div class="dock-cell-input">
                  <label>MİSAFİR</label>
                  <select id="heroGuests">
                    <option value="2 Yetişkin">2 Yetişkin</option>
                    <option value="1 Yetişkin">1 Yetişkin</option>
                    <option value="3 Yetişkin">3 Yetişkin</option>
                    <option value="4+ Yetişkin">4+ Yetişkin / Aile</option>
                  </select>
                </div>
                <button type="button" class="btn-dock-find" id="heroSubmitBtn">
                  <span>Müsaitlik Al →</span>
                </button>
              </form>
            </div>
          </div>

          <div class="hero-stage-theater">
            <div class="theater-frame-main">
              <img src="./media/hero.jpg" alt="${escapeHtml(name)} Ana Görsel">
              <div class="badge-theater-floating">
                <strong>${escapeHtml(name)}</strong>
                <span>${escapeHtml(address)}</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>

    <!-- SUITES: EXPANSIVE 3D LOOKBOOK -->
    <section class="v2-liquid-section" id="suites" style="background: rgba(2, 8, 16, 0.65);">
      <div class="container-liquid">
        
        <div class="section-mast-center">
          <div class="pill-section-kicker">PANORAMİK KONAKLAMA</div>
          <h2 class="section-title-monument">Koleksiyon Süitleri</h2>
          <p class="section-desc-subtle">Doğal kireçtaşı, keten tekstiller ve Ege koyunu kucaklayan geniş özel teraslar.</p>
        </div>

        <div class="suites-lookbook-stack">
          ${rooms.map((room, idx) => `
            <article class="suite-lookbook-card-3d ${idx % 2 === 1 ? 'reverse' : ''}">
              <div class="suite-photo-wrapper">
                <img src="${idx === 0 ? './media/suite.jpg' : './media/room.jpg'}" alt="${escapeHtml(room.title)}">
                <span class="suite-floating-ribbon">${escapeHtml(room.badge || 'Özel Seri')}</span>
              </div>
              <div class="suite-meta-wrapper">
                <div>
                  <span class="suite-serial-kicker">REZİDANS N° 0${idx + 1}</span>
                  <h3 class="suite-title-large">${escapeHtml(room.title)}</h3>
                  <p class="suite-narrative-desc">${escapeHtml(room.desc || 'Ferah banyo, doğal keten dokular ve dingin koy manzarası.')}</p>
                  
                  <div class="suite-specs-3capsules">
                    <div class="capsule-spec-item"><span>ALAN</span><strong>${escapeHtml(room.size || '36 m²')}</strong></div>
                    <div class="capsule-spec-item"><span>MANZARA</span><strong>${escapeHtml(room.view || 'Deniz & Avlu')}</strong></div>
                    <div class="capsule-spec-item"><span>YATAK</span><strong>${escapeHtml(room.bed || 'King Size')}</strong></div>
                  </div>
                </div>

                <div class="suite-action-strip">
                  <span class="rate-guarantee-tag">✦ En İyi Fiyat Garantisi</span>
                  <button class="btn-vision-gold-cta" data-suite-name="${escapeHtml(room.title)}">
                    <span>Hemen Rezerve Et ↗</span>
                  </button>
                </div>
              </div>
            </article>
          `).join('')}
        </div>

      </div>
    </section>

    <!-- 24-HOUR RITUALS (ATMOSPHERE CANVAS) -->
    <section class="v2-liquid-section" id="rituals">
      <div class="container-liquid">
        <div class="section-mast-center">
          <div class="pill-section-kicker">24 SAAT SELİMİYE</div>
          <h2 class="section-title-monument">Koyda Zamanın Akışı</h2>
          <p class="section-desc-subtle">Sabahın durgunluğundan gece yıldızlarına, acele etmeden yaşanan bir kıyı ritmi.</p>
        </div>

        <div class="rituals-dynamic-grid">
          ${rituals.map(r => `
            <div class="ritual-glass-card">
              <span class="ritual-time-badge">${escapeHtml(r.time)}</span>
              <h4>${escapeHtml(r.title)}</h4>
              <p>${escapeHtml(r.desc)}</p>
            </div>
          `).join('')}
        </div>
      </div>
    </section>

    <!-- GASTRONOMY THEATER -->
    <section class="v2-liquid-section" id="gastronomy" style="background: rgba(2, 8, 16, 0.65);">
      <div class="container-liquid">
        <div class="gastronomy-theater-layout">
          
          <div class="degustation-panel-glass">
            <div class="degustation-top-header">
              <span class="pill-section-kicker" style="margin-bottom:0.5rem;">TOPRAKTAN & DENİZDEN</span>
              <h3>Tadım Sofrası & Kıyı Masası</h3>
            </div>
            <div class="degustation-courses-list">
              <div class="course-item-box">
                <span class="num-roman-gold">I.</span>
                <div class="course-info">
                  <strong>Organik Köy Kahvaltısı</strong>
                  <p>Bozburun çam balı, taze keçi peynirleri ve taş fırın sıcak ekmekleri.</p>
                </div>
              </div>
              <div class="course-item-box">
                <span class="num-roman-gold">II.</span>
                <div class="course-info">
                  <strong>Erken Hasat Zeytinyağlılar</strong>
                  <p>Bahçemizden toplanan şifalı Ege otları ve soğuk sıkım zeytinyağı.</p>
                </div>
              </div>
              <div class="course-item-box">
                <span class="num-roman-gold">III.</span>
                <div class="course-info">
                  <strong>Günlük Kıyı Avı & Izgara</strong>
                  <p>Selimiye balıkçılarından günlük taze deniz balıkları ve ızgara kalamar.</p>
                </div>
              </div>
            </div>
          </div>

          <div class="video-theater-frame">
            <video autoplay muted loop playsinline preload="metadata" poster="./media/dining.jpg">
              <source src="./media/decor.mp4" type="video/mp4">
            </video>
          </div>

        </div>
      </div>
    </section>

    <!-- VIP CONCIERGE TERMINAL -->
    <section class="v2-liquid-section" id="concierge">
      <div class="container-liquid">
        <div class="vip-terminal-deck">
          <div class="vip-terminal-split">
            
            <div class="vip-terminal-left">
              <span class="pill-section-kicker">VIP DANIŞMA</span>
              <h2>Doğrudan<br><em class="hero-highlight-italic">Rezervasyon Terminali</em></h2>
              <p style="color:#94a3b8; font-size:0.98rem; line-height:1.85;">
                Tarihlerinizi iletin; en avantajlı doğrudan fiyatlandırma ve kişisel transfer seçenekleriyle size anında dönüş yapalım.
              </p>

              <div class="vip-lines-column">
                <div class="vip-line-box">
                  <strong>KONUM</strong>
                  <span>${escapeHtml(address)}</span>
                </div>
                <div class="vip-line-box">
                  <strong>RESEPSİYON TELEFON</strong>
                  <a href="tel:${escapeHtml(cleanPhone)}">${escapeHtml(phone)}</a>
                </div>
                <div class="vip-line-box">
                  <strong>WHATSAPP CANLI DANIŞMA</strong>
                  <a href="https://wa.me/${escapeHtml(cleanPhone)}?text=Merhaba%20${encodeURIComponent(name)},%20m%C3%BCsaitlik%20bilgisi%20almak%20istiyorum." target="_blank" style="color:var(--accent-primary);">+90 Selimiye VIP Concierge ↗</a>
                </div>
              </div>
            </div>

            <div class="vip-form-box">
              <h3 style="font-family:var(--font-heading); color:#fff; font-size:1.45rem; margin-bottom:1.35rem;">Müsaitlik Talebi Gönder</h3>
              <form id="v2ContactForm" onsubmit="return false;">
                <div class="form-2inputs-row">
                  <div class="form-input-block">
                    <label>Adınız Soyadınız *</label>
                    <input type="text" id="v2Name" placeholder="Adınız Soyadınız" required>
                  </div>
                  <div class="form-input-block">
                    <label>Telefon Numarası *</label>
                    <input type="tel" id="v2Phone" placeholder="05XX XXX XX XX" required>
                  </div>
                </div>

                <div class="form-2inputs-row">
                  <div class="form-input-block">
                    <label>Giriş Tarihi *</label>
                    <input type="date" id="v2Checkin" required>
                  </div>
                  <div class="form-input-block">
                    <label>Çıkış Tarihi *</label>
                    <input type="date" id="v2Checkout" required>
                  </div>
                </div>

                <div class="form-2inputs-row">
                  <div class="form-input-block">
                    <label>Oda Tercihi</label>
                    <select id="v2Suite">
                      <option value="Tüm Koleksiyon">Tüm Odaları Göster</option>
                      ${rooms.map(r => `<option value="${escapeHtml(r.title)}">${escapeHtml(r.title)}</option>`).join('')}
                    </select>
                  </div>
                  <div class="form-input-block">
                    <label>Misafir Sayısı</label>
                    <select id="v2Guests">
                      <option value="2 Yetişkin">2 Yetişkin</option>
                      <option value="1 Yetişkin">1 Yetişkin</option>
                      <option value="3 Yetişkin">3 Yetişkin</option>
                      <option value="4+ Yetişkin">4+ Yetişkin / Aile</option>
                    </select>
                  </div>
                </div>

                <div class="form-input-block" style="margin-bottom:1.6rem;">
                  <label>Özel Talebiniz</label>
                  <textarea id="v2Notes" rows="3" placeholder="Örn: Balayı karşılama ikramı, tekne transferi, geç giriş..."></textarea>
                </div>

                <button type="button" class="btn-dock-find" id="v2SubmitBtn" style="width:100%; justify-content:center; height:50px;">
                  <span>Talebi İlet & Müsaitlik Al ↗</span>
                </button>
              </form>
            </div>

          </div>
        </div>
      </div>
    </section>

  </main>

  <!-- FOOTER -->
  <footer class="v2-liquid-footer">
    <div class="container-liquid">
      <div class="footer-panoramic-3col">
        <div>
          <div class="footer-brand-title">${escapeHtml(name).toUpperCase()}</div>
          <p style="color:#94a3b8; font-size:0.92rem; line-height:1.75; margin-bottom:1.2rem;">
            ${escapeHtml(tagline)}
          </p>
          <small style="color:#64748b; display:block;">${escapeHtml(address)}</small>
        </div>

        <div class="footer-nav-column">
          <strong>Hızlı Bağlantılar</strong>
          <a href="#suites">Koleksiyon Süitleri</a>
          <a href="#rituals">Koy Atmosferi</a>
          <a href="#gastronomy">Gastronomi & İskele</a>
          <a href="#concierge">VIP Danışma</a>
        </div>

        <div class="footer-nav-column">
          <strong>İletişim & Rezervasyon</strong>
          <a href="tel:${escapeHtml(cleanPhone)}">📞 ${escapeHtml(phone)}</a>
          <a href="https://wa.me/${escapeHtml(cleanPhone)}" target="_blank">💬 WhatsApp Canlı Hattı</a>
          <span style="color:#64748b; font-size:0.84rem; margin-top:0.5rem;">7/24 Misafir Karşılama</span>
        </div>
      </div>

      <div class="footer-bottom-bar">
        <span>© ${new Date().getFullYear()} ${escapeHtml(name)}. Tüm Hakları Saklıdır.</span>
        <span>Selimiye Koyu · Marmaris / Muğla</span>
      </div>
    </div>
  </footer>

</body>
</html>`;
}

function generateNextGenLiquidJS() {
  return `/**
 * SELİMİYE V2 NEXT-GEN LIQUID GLASS ENGINE
 */
document.addEventListener('DOMContentLoaded', () => {
  const header = document.getElementById('v2Header');
  if (header) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 40) header.classList.add('scrolled');
      else header.classList.remove('scrolled');
    }, { passive: true });
  }

  document.querySelectorAll('[data-book]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('concierge')?.scrollIntoView({ behavior: 'smooth' });
    });
  });

  document.querySelectorAll('[data-suite-name]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const name = e.currentTarget.getAttribute('data-suite-name');
      const select = document.getElementById('v2Suite');
      if (select && name) select.value = name;
      document.getElementById('concierge')?.scrollIntoView({ behavior: 'smooth' });
    });
  });

  const heroBtn = document.getElementById('heroSubmitBtn');
  if (heroBtn) {
    heroBtn.addEventListener('click', () => {
      const checkin = document.getElementById('heroCheckin')?.value || '';
      const checkout = document.getElementById('heroCheckout')?.value || '';
      const guests = document.getElementById('heroGuests')?.value || '2 Yetişkin';
      const v2Checkin = document.getElementById('v2Checkin');
      const v2Checkout = document.getElementById('v2Checkout');
      const v2Guests = document.getElementById('v2Guests');
      if (v2Checkin && checkin) v2Checkin.value = checkin;
      if (v2Checkout && checkout) v2Checkout.value = checkout;
      if (v2Guests && guests) v2Guests.value = guests;
      document.getElementById('concierge')?.scrollIntoView({ behavior: 'smooth' });
    });
  }

  const submitBtn = document.getElementById('v2SubmitBtn');
  if (submitBtn) {
    submitBtn.addEventListener('click', () => {
      const hotel = document.body.getAttribute('data-hotel') || 'Otel';
      const phone = document.body.getAttribute('data-phone') || '902524562340';
      const name = document.getElementById('v2Name')?.value.trim() || 'Değerli Misafir';
      const userPhone = document.getElementById('v2Phone')?.value.trim() || '';
      const checkin = document.getElementById('v2Checkin')?.value || 'Belirtilmedi';
      const checkout = document.getElementById('v2Checkout')?.value || 'Belirtilmedi';
      const suite = document.getElementById('v2Suite')?.value || 'Standart';
      const guests = document.getElementById('v2Guests')?.value || '2 Yetişkin';
      const notes = document.getElementById('v2Notes')?.value.trim() || '';

      const msg = encodeURIComponent(
        \`Merhaba \${hotel} Ekibi, web sitenizden rezervasyon talebi iletiyorum:\\n\\n\` +
        \`👤 Misafir: \${name}\\n\` +
        \`📞 İletişim: \${userPhone}\\n\` +
        \`📅 Giriş: \${checkin} | Çıkış: \${checkout}\\n\` +
        \`🛏️ Tercih: \${suite} (\${guests})\\n\` +
        (notes ? \`💬 Not: \${notes}\\n\\n\` : \`\\n\`) +
        \`Müsaitlik ve fiyat teklifinizi paylaşabilir misiniz?\`
      );

      window.open(\`https://wa.me/\${phone}?text=\${msg}\`, '_blank');
    });
  }
});
`;
}

function buildAllV2Sites() {
  console.log('💎 Compiling 24 V2 Selimiye Websites with REVOLUTIONARY NEXT-GEN LIQUID GLASS ARCHITECTURE...');
  const js = generateNextGenLiquidJS();

  for (const hotel of rawV2Data.hotels) {
    const slug = hotel.slug;
    const detail = detailBySlug.get(slug);
    const hotelDir = path.join(outBaseDir, slug);
    if (!fs.existsSync(hotelDir)) fs.mkdirSync(hotelDir, { recursive: true });

    syncUniqueMedia(hotel, hotelDir);

    const css = generateNextGenLiquidCSS(hotel);
    const html = generateNextGenLiquidHTML(hotel, detail);

    fs.writeFileSync(path.join(hotelDir, 'index.html'), html, 'utf8');
    fs.writeFileSync(path.join(hotelDir, 'styles.css'), css, 'utf8');
    fs.writeFileSync(path.join(hotelDir, 'app.js'), js, 'utf8');
  }

  console.log('✅ Successfully compiled 24 V2 websites with NEXT-GEN LIQUID GLASS ARCHITECTURE!');
}

buildAllV2Sites();
