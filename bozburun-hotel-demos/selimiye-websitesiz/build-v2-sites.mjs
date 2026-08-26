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

const outBaseDir = path.join(__dirname, 'v2-gemini');
if (!fs.existsSync(outBaseDir)) {
  fs.mkdirSync(outBaseDir, { recursive: true });
}

function singlePhone(value) {
  if (!value) return '0252 456 23 40';
  const parts = String(value).split(/[\/,]/);
  return parts[0].trim();
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

// ============================================================================
// AWWWARDS-CALIBER 2026 LUMINOUS LIQUID GLASS CSS (V2)
// ============================================================================
function generateV2LiquidCSS() {
  return `/* ==========================================================================
   SELİMİYE HOTELS — V2 LUMINOUS LIQUID GLASS & AWWWARDS-CALIBER LUXURY
   ========================================================================== */

@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700;800;900&family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');

:root {
  --bg-deep: #02060d;
  --bg-surface: #05101d;
  --bg-glass: rgba(8, 20, 36, 0.55);
  --bg-glass-heavy: rgba(4, 12, 24, 0.82);
  --bg-glass-card: linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.02) 100%);
  --bg-glass-input: rgba(10, 26, 46, 0.7);

  --font-serif: 'Cormorant Garamond', Georgia, serif;
  --font-heading: 'Cinzel', 'Playfair Display', Georgia, serif;
  --font-sans: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;

  --cyan-neon: #00f2fe;
  --cyan-emerald: #10b981;
  --cyan-glow: rgba(0, 242, 254, 0.35);
  --cyan-gradient: linear-gradient(135deg, #00f2fe 0%, #4facfe 50%, #00c6ff 100%);
  
  --gold-primary: #d4af37;
  --gold-light: #fff3cf;
  --gold-gradient: linear-gradient(135deg, #fff3cf 0%, #e2c174 35%, #c59b3f 70%, #8c6721 100%);
  --gold-glow: rgba(212, 175, 55, 0.35);

  --border-glass: rgba(255, 255, 255, 0.14);
  --border-glass-light: rgba(255, 255, 255, 0.22);
  --border-cyan: rgba(0, 242, 254, 0.38);
  --border-gold: rgba(212, 175, 55, 0.4);

  --text-main: #f8fafc;
  --text-muted: #94a3b8;
  --text-dim: #64748b;

  --shadow-liquid: 0 30px 80px -15px rgba(0, 0, 0, 0.85), 0 0 40px rgba(0, 242, 254, 0.08);
  --shadow-glow: 0 0 50px rgba(0, 242, 254, 0.25);
  --shadow-gold: 0 0 45px rgba(212, 175, 55, 0.35);

  --blur-heavy: blur(32px) saturate(210%);
  --blur-medium: blur(20px) saturate(180%);

  --radius-xs: 8px;
  --radius-sm: 14px;
  --radius-md: 22px;
  --radius-lg: 32px;
  --radius-full: 9999px;

  --transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
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
  color: var(--text-main);
}

body.v2-liquid-luminous {
  font-family: var(--font-sans);
  background-color: var(--bg-deep);
  color: var(--text-main);
  line-height: 1.7;
  overflow-x: hidden;
  position: relative;
  -webkit-font-smoothing: antialiased;
}

/* Ambient Liquid Aurora Mesh */
.ambient-aurora-mesh {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  overflow: hidden;
}
.aurora-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(140px);
  opacity: 0.4;
  animation: auroraFloat 22s ease-in-out infinite alternate;
}
.aurora-1 {
  top: -10vh;
  left: 10vw;
  width: 60vw;
  height: 60vw;
  background: radial-gradient(circle, rgba(0, 242, 254, 0.28) 0%, rgba(79, 172, 254, 0.08) 70%, transparent 100%);
}
.aurora-2 {
  top: 40vh;
  right: -10vw;
  width: 55vw;
  height: 55vw;
  background: radial-gradient(circle, rgba(212, 175, 55, 0.24) 0%, rgba(180, 130, 30, 0.05) 70%, transparent 100%);
  animation-delay: -7s;
}
.aurora-3 {
  bottom: -15vh;
  left: 20vw;
  width: 65vw;
  height: 65vw;
  background: radial-gradient(circle, rgba(16, 185, 129, 0.2) 0%, rgba(14, 165, 233, 0.05) 70%, transparent 100%);
  animation-delay: -14s;
}
@keyframes auroraFloat {
  0% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(60px, -40px) scale(1.08); }
  100% { transform: translate(-40px, 60px) scale(0.94); }
}

.container-liquid-v2 {
  width: 100%;
  max-width: 1380px;
  margin: 0 auto;
  padding: 0 2.25rem;
  position: relative;
  z-index: 2;
}

/* ============================================================================
   FLOATING GLASS CAPSULE HEADER
   ============================================================================ */
.v2-glass-header {
  position: sticky;
  top: 0;
  z-index: 100;
  padding: 1.25rem 0;
  transition: var(--transition);
}
.v2-glass-header.scrolled {
  padding: 0.65rem 0;
}
.header-capsule-bar {
  max-width: 1380px;
  margin: 0 auto;
  padding: 0.75rem 2rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--bg-glass-heavy);
  backdrop-filter: var(--blur-heavy);
  border: 1px solid var(--border-glass-light);
  border-radius: var(--radius-full);
  box-shadow: var(--shadow-liquid);
}

.brand-capsule-island {
  display: flex;
  align-items: center;
  gap: 1.2rem;
  text-decoration: none;
}
.brand-logo-disc {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 25px rgba(0, 242, 254, 0.35), 0 0 15px rgba(212, 175, 55, 0.35);
  transition: var(--transition);
}
.brand-logo-disc:hover {
  transform: scale(1.08) rotate(4deg);
  box-shadow: 0 0 40px rgba(0, 242, 254, 0.55);
}
.brand-logo-disc svg {
  width: 100%;
  height: 100%;
  display: block;
}

.brand-titles-column {
  display: flex;
  flex-direction: column;
}
.brand-h-name {
  font-family: var(--font-heading);
  font-size: 1.3rem;
  font-weight: 800;
  letter-spacing: 0.14em;
  color: #ffffff;
  line-height: 1.2;
}
.brand-h-sub {
  font-size: 0.7rem;
  letter-spacing: 0.25em;
  background: var(--gold-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  text-transform: uppercase;
  font-weight: 700;
}

.nav-glass-links {
  display: flex;
  align-items: center;
  gap: 2rem;
}
.nav-g-item {
  font-size: 0.92rem;
  color: #cbd5e1;
  text-decoration: none;
  font-weight: 600;
  letter-spacing: 0.04em;
  transition: var(--transition);
  position: relative;
  padding: 0.4rem 0;
}
.nav-g-item:hover {
  color: #ffffff;
}
.nav-g-item::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  width: 0;
  height: 2px;
  background: var(--cyan-gradient);
  transition: width 0.3s ease;
  border-radius: var(--radius-full);
}
.nav-g-item:hover::after {
  width: 100%;
}

.header-action-cluster {
  display: flex;
  align-items: center;
  gap: 1.2rem;
}
.live-beacon-capsule {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(0, 242, 254, 0.08);
  border: 1px solid var(--border-cyan);
  padding: 0.5rem 1.1rem;
  border-radius: var(--radius-full);
  color: var(--cyan-neon);
  font-size: 0.8rem;
  font-weight: 700;
  text-decoration: none;
}
.pulsing-dot {
  width: 8px;
  height: 8px;
  background: var(--cyan-neon);
  border-radius: 50%;
  box-shadow: 0 0 12px var(--cyan-neon);
  animation: pulseBeacon 2s infinite;
}
@keyframes pulseBeacon {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.35; transform: scale(0.7); }
}

.btn-liquid-gold-cta {
  background: var(--gold-gradient);
  color: #040810;
  border: none;
  font-family: var(--font-sans);
  font-size: 0.86rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  padding: 0.72rem 1.6rem;
  border-radius: var(--radius-full);
  cursor: pointer;
  box-shadow: var(--shadow-gold);
  transition: var(--transition);
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.btn-liquid-gold-cta:hover {
  transform: translateY(-2px) scale(1.02);
  box-shadow: 0 0 40px rgba(212, 175, 55, 0.55);
}

/* ============================================================================
   HERO: SPLIT CINEMATIC PANORAMA & 3D GLASS DOCK
   ============================================================================ */
.hero-v2-luminous {
  position: relative;
  min-height: 92vh;
  display: flex;
  align-items: center;
  padding: 6rem 0 5rem;
  overflow: hidden;
}
.hero-v2-split-grid {
  display: grid;
  grid-template-columns: 1.15fr 1fr;
  gap: 5rem;
  align-items: center;
}

.hero-v2-text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
}
.hero-glow-badge {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  background: rgba(8, 26, 46, 0.88);
  backdrop-filter: var(--blur-medium);
  border: 1px solid var(--border-cyan);
  padding: 0.55rem 1.5rem;
  border-radius: var(--radius-full);
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.16em;
  color: #ffffff;
  margin-bottom: 2rem;
  box-shadow: var(--shadow-glow);
}
.tag-gold-sparkle {
  background: var(--gold-gradient);
  color: #000;
  font-size: 0.7rem;
  font-weight: 900;
  padding: 2px 9px;
  border-radius: var(--radius-full);
}

.hero-v2-h1 {
  font-family: var(--font-heading);
  font-size: clamp(2.6rem, 5vw, 4.4rem);
  font-weight: 800;
  line-height: 1.14;
  color: #ffffff;
  margin-bottom: 1.6rem;
  text-shadow: 0 4px 35px rgba(0, 0, 0, 0.95);
}
.hero-serif-italic-gold {
  font-family: var(--font-serif);
  font-style: italic;
  font-weight: 400;
  background: var(--gold-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
.hero-v2-lead-para {
  font-size: 1.16rem;
  color: #cbd5e1;
  line-height: 1.85;
  margin-bottom: 2.75rem;
  max-width: 640px;
}

/* Floating Glass Hero Booking Dock */
.hero-booking-dock-glass {
  width: 100%;
  background: var(--bg-glass);
  backdrop-filter: var(--blur-heavy);
  border: 1px solid var(--border-cyan);
  border-radius: var(--radius-lg);
  padding: 1.75rem 2rem;
  box-shadow: var(--shadow-liquid), var(--shadow-glow);
}
.dock-fields-4col {
  display: grid;
  grid-template-columns: repeat(3, 1fr) auto;
  gap: 1.25rem;
  align-items: center;
}
.dock-cell-block {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.dock-cell-block label {
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  color: var(--cyan-neon);
  text-transform: uppercase;
}
.dock-cell-block input, .dock-cell-block select {
  background: var(--bg-glass-input);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: var(--radius-sm);
  padding: 0.75rem 0.95rem;
  color: #ffffff;
  font-family: var(--font-sans);
  font-size: 0.92rem;
  outline: none;
  transition: var(--transition);
}
.dock-cell-block input:focus, .dock-cell-block select:focus {
  border-color: var(--cyan-neon);
  box-shadow: 0 0 20px rgba(0, 242, 254, 0.35);
}

.btn-dock-search {
  background: var(--gold-gradient);
  color: #040810;
  border: none;
  font-family: var(--font-sans);
  font-size: 0.92rem;
  font-weight: 800;
  padding: 0.85rem 1.6rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  box-shadow: var(--shadow-gold);
  transition: var(--transition);
  height: 48px;
}
.btn-dock-search:hover {
  transform: translateY(-2px);
  box-shadow: 0 0 35px rgba(212, 175, 55, 0.6);
}

/* Hero Right 3D Visual Composition */
.hero-v2-visual-stage {
  position: relative;
}
.stage-main-card {
  position: relative;
  border-radius: var(--radius-lg);
  overflow: hidden;
  border: 1.5px solid var(--border-cyan);
  box-shadow: var(--shadow-liquid), var(--shadow-glow);
  height: 500px;
}
.stage-main-card img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.badge-glass-floating-top {
  position: absolute;
  top: 1.5rem;
  right: 1.5rem;
  background: rgba(2, 7, 14, 0.88);
  backdrop-filter: var(--blur-medium);
  border: 1px solid var(--border-gold);
  padding: 0.65rem 1.3rem;
  border-radius: var(--radius-full);
  color: var(--gold-light);
  font-size: 0.8rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  gap: 8px;
}
.badge-glass-floating-bot {
  position: absolute;
  bottom: -1.5rem;
  left: -1.5rem;
  background: rgba(6, 18, 32, 0.92);
  backdrop-filter: var(--blur-heavy);
  border: 1px solid var(--border-glass-light);
  padding: 1.35rem 1.8rem;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-liquid);
  max-width: 300px;
}
.badge-glass-floating-bot strong {
  display: block;
  font-family: var(--font-heading);
  font-size: 1.15rem;
  color: #ffffff;
  margin-bottom: 2px;
}
.badge-glass-floating-bot span {
  font-size: 0.82rem;
  color: var(--cyan-neon);
}

/* ============================================================================
   SECTIONS COMMON
   ============================================================================ */
.v2-fluid-section {
  padding: 8rem 0;
  position: relative;
  z-index: 2;
}
.section-masthead-center {
  text-align: center;
  max-width: 860px;
  margin: 0 auto 5rem;
}
.pill-eyebrow-cyan {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(0, 242, 254, 0.08);
  border: 1px solid var(--border-cyan);
  padding: 0.45rem 1.3rem;
  border-radius: var(--radius-full);
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.16em;
  color: var(--cyan-neon);
  margin-bottom: 1.4rem;
}
.section-headline-xl {
  font-family: var(--font-heading);
  font-size: clamp(2.2rem, 4.4vw, 3.4rem);
  font-weight: 800;
  line-height: 1.18;
  color: #ffffff;
  margin-bottom: 1.35rem;
}
.section-lead-para {
  font-size: 1.1rem;
  color: var(--text-muted);
  line-height: 1.85;
}

/* ============================================================================
   SUITES: EXPANSIVE HORIZONTAL PANORAMIC LOOKBOOK
   ============================================================================ */
.suites-panoramic-stack {
  display: flex;
  flex-direction: column;
  gap: 3.5rem;
}
.suite-panoramic-card {
  display: grid;
  grid-template-columns: 1.15fr 1fr;
  background: var(--bg-glass);
  backdrop-filter: var(--blur-heavy);
  border: 1px solid var(--border-glass-light);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-liquid);
  transition: var(--transition);
}
.suite-panoramic-card.reverse {
  grid-template-columns: 1fr 1.15fr;
}
.suite-panoramic-card:hover {
  border-color: var(--cyan-neon);
  transform: translateY(-8px);
  box-shadow: 0 35px 90px -15px rgba(0, 0, 0, 0.95), var(--shadow-glow);
}

.suite-photo-side {
  position: relative;
  min-height: 420px;
  overflow: hidden;
}
.suite-photo-side img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.8s ease;
}
.suite-panoramic-card:hover .suite-photo-side img {
  transform: scale(1.06);
}
.suite-tag-ribbon {
  position: absolute;
  top: 1.6rem;
  left: 1.6rem;
  background: rgba(2, 7, 14, 0.88);
  backdrop-filter: var(--blur-medium);
  border: 1px solid var(--border-gold);
  color: var(--gold-light);
  font-size: 0.76rem;
  font-weight: 800;
  padding: 6px 16px;
  border-radius: var(--radius-full);
}

.suite-details-side {
  padding: 3.5rem;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
.suite-index-kicker {
  font-size: 0.74rem;
  letter-spacing: 0.22em;
  color: var(--cyan-neon);
  text-transform: uppercase;
  font-weight: 800;
  margin-bottom: 0.6rem;
  display: block;
}
.suite-name-title {
  font-family: var(--font-heading);
  font-size: 1.95rem;
  color: #ffffff;
  margin-bottom: 1.1rem;
}
.suite-desc-body {
  font-size: 0.98rem;
  color: var(--text-muted);
  line-height: 1.8;
  margin-bottom: 2.25rem;
}

.suite-specs-3box {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.25rem;
  margin-bottom: 2.25rem;
  padding: 1.2rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-sm);
}
.spec-box-unit span {
  display: block;
  font-size: 0.7rem;
  color: var(--text-dim);
  text-transform: uppercase;
  font-weight: 800;
  margin-bottom: 2px;
}
.spec-box-unit strong {
  font-size: 0.94rem;
  color: #ffffff;
}

.suite-action-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding-top: 1.75rem;
}
.price-tag-gold {
  font-size: 0.84rem;
  color: var(--gold-light);
  font-weight: 700;
}

/* ============================================================================
   24-HOUR RITUALS (DYNAMIC ATMOSPHERE DECK)
   ============================================================================ */
.rituals-3deck-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2.25rem;
}
.ritual-fluid-card {
  background: var(--bg-glass);
  backdrop-filter: var(--blur-heavy);
  border: 1px solid var(--border-glass-light);
  border-radius: var(--radius-lg);
  padding: 2.75rem;
  box-shadow: var(--shadow-liquid);
  transition: var(--transition);
  position: relative;
  overflow: hidden;
}
.ritual-fluid-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3.5px;
  background: var(--cyan-gradient);
  opacity: 0.8;
}
.ritual-fluid-card:hover {
  border-color: var(--cyan-neon);
  transform: translateY(-8px);
  box-shadow: var(--shadow-glow);
}
.time-slot-pill {
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.14em;
  color: var(--cyan-neon);
  text-transform: uppercase;
  margin-bottom: 0.9rem;
  display: block;
}
.ritual-fluid-card h4 {
  font-family: var(--font-heading);
  font-size: 1.45rem;
  color: #ffffff;
  margin-bottom: 0.85rem;
}
.ritual-fluid-card p {
  font-size: 0.95rem;
  color: var(--text-muted);
  line-height: 1.8;
}

/* ============================================================================
   GASTRONOMY: VIDEO & DEGUSTATION
   ============================================================================ */
.gastronomy-split-deck {
  display: grid;
  grid-template-columns: 1fr 1.15fr;
  gap: 4.5rem;
  align-items: center;
}
.degustation-glass-panel {
  background: var(--bg-glass);
  backdrop-filter: var(--blur-heavy);
  border: 1px solid var(--border-gold);
  border-radius: var(--radius-lg);
  padding: 3rem;
  box-shadow: var(--shadow-liquid), var(--shadow-gold);
}
.degustation-masthead {
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  padding-bottom: 1.4rem;
  margin-bottom: 2rem;
}
.degustation-masthead h3 {
  font-family: var(--font-heading);
  font-size: 1.8rem;
  color: #ffffff;
}
.courses-vertical-list {
  display: flex;
  flex-direction: column;
  gap: 1.8rem;
}
.course-entry-row {
  display: flex;
  gap: 1.5rem;
}
.num-roman-gold {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 1.8rem;
  color: var(--gold-light);
  line-height: 1;
}
.entry-body strong {
  display: block;
  font-family: var(--font-heading);
  font-size: 1.1rem;
  color: #ffffff;
  margin-bottom: 3px;
}
.entry-body p {
  font-size: 0.9rem;
  color: var(--text-muted);
}

.video-frame-showcase {
  border-radius: var(--radius-lg);
  overflow: hidden;
  border: 1.5px solid var(--border-cyan);
  box-shadow: var(--shadow-liquid), var(--shadow-glow);
}
.video-frame-showcase video {
  width: 100%;
  height: 440px;
  object-fit: cover;
  display: block;
}

/* ============================================================================
   NAUTICAL COVES: BENTO RADAR
   ============================================================================ */
.coves-bento-3card {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2.25rem;
}
.cove-radar-card {
  background: var(--bg-glass);
  backdrop-filter: var(--blur-heavy);
  border: 1px solid var(--border-glass-light);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-liquid);
  transition: var(--transition);
}
.cove-radar-card:hover {
  border-color: var(--cyan-neon);
  transform: translateY(-8px);
  box-shadow: var(--shadow-glow);
}
.cove-visual-top {
  position: relative;
  height: 240px;
}
.cove-visual-top img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.cove-gps-pill {
  position: absolute;
  top: 1.2rem;
  left: 1.2rem;
  background: rgba(2, 7, 14, 0.88);
  backdrop-filter: var(--blur-medium);
  border: 1px solid var(--border-cyan);
  color: var(--cyan-neon);
  font-size: 0.74rem;
  font-weight: 800;
  padding: 5px 12px;
  border-radius: var(--radius-full);
}
.cove-info-bot {
  padding: 2rem;
}
.cove-info-bot h3 {
  font-family: var(--font-heading);
  font-size: 1.35rem;
  color: #ffffff;
  margin-bottom: 0.6rem;
}
.cove-info-bot p {
  font-size: 0.92rem;
  color: var(--text-muted);
}

/* ============================================================================
   VIP CONCIERGE TERMINAL
   ============================================================================ */
.vip-terminal-capsule {
  background: var(--bg-glass-heavy);
  backdrop-filter: var(--blur-heavy);
  border: 1.5px solid var(--border-cyan);
  border-radius: var(--radius-lg);
  padding: 4rem;
  box-shadow: var(--shadow-liquid), var(--shadow-glow);
}
.vip-terminal-grid {
  display: grid;
  grid-template-columns: 1fr 1.15fr;
  gap: 4.5rem;
}
.vip-left-copy h2 {
  font-family: var(--font-heading);
  font-size: 2.5rem;
  color: #ffffff;
  margin-bottom: 1.1rem;
}
.vip-lines-stack {
  display: flex;
  flex-direction: column;
  gap: 1.35rem;
  margin: 2.25rem 0;
}
.vip-line-cell strong {
  display: block;
  font-size: 0.76rem;
  color: var(--cyan-neon);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.vip-line-cell span, .vip-line-cell a {
  color: #ffffff;
  font-size: 1rem;
  text-decoration: none;
}

.vip-form-box-glass {
  background: rgba(8, 24, 44, 0.82);
  border: 1px solid var(--border-glass-light);
  padding: 2.5rem;
  border-radius: var(--radius-md);
}
.form-2col-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.1rem;
  margin-bottom: 1.1rem;
}
.form-input-cell {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.form-input-cell label {
  font-size: 0.76rem;
  font-weight: 800;
  color: var(--text-muted);
}
.form-input-cell input, .form-input-cell select, .form-input-cell textarea {
  background: var(--bg-glass-input);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: var(--radius-sm);
  padding: 0.75rem 0.95rem;
  color: #ffffff;
  font-family: var(--font-sans);
  font-size: 0.92rem;
  outline: none;
}
.form-input-cell input:focus, .form-input-cell select:focus, .form-input-cell textarea:focus {
  border-color: var(--cyan-neon);
  box-shadow: 0 0 18px rgba(0, 242, 254, 0.3);
}

/* Footer */
.v2-fluid-footer {
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding: 5rem 0 3.5rem;
  position: relative;
  z-index: 2;
  background: #010408;
}
.footer-panoramic-layout {
  display: grid;
  grid-template-columns: 1.6fr 1fr 1fr;
  gap: 4rem;
  margin-bottom: 4rem;
}
.footer-brand-h {
  font-family: var(--font-heading);
  font-size: 1.45rem;
  color: #ffffff;
  margin-bottom: 0.85rem;
}
.footer-nav-col {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.footer-nav-col strong {
  font-size: 0.8rem;
  letter-spacing: 0.12em;
  color: var(--cyan-neon);
  text-transform: uppercase;
  margin-bottom: 0.6rem;
}
.footer-nav-col a {
  color: var(--text-muted);
  text-decoration: none;
  font-size: 0.94rem;
  transition: var(--transition);
}
.footer-nav-col a:hover {
  color: #ffffff;
}
.footer-bottom-copyright {
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding-top: 2.25rem;
  display: flex;
  justify-content: space-between;
  font-size: 0.84rem;
  color: var(--text-dim);
}

@media (max-width: 1024px) {
  .nav-glass-links, .live-beacon-capsule { display: none; }
  .hero-v2-split-grid, .gastronomy-split-deck, .vip-terminal-grid { grid-template-columns: 1fr; gap: 4rem; }
  .suite-panoramic-card, .suite-panoramic-card.reverse { grid-template-columns: 1fr; }
  .rituals-3deck-grid, .coves-bento-3card { grid-template-columns: 1fr; }
  .dock-fields-4col { grid-template-columns: 1fr 1fr; }
  .btn-dock-search { grid-column: span 2; }
  .footer-panoramic-layout { grid-template-columns: 1fr 1fr; }
}

@media (max-width: 640px) {
  .dock-fields-4col { grid-template-columns: 1fr; }
  .btn-dock-search { grid-column: span 1; }
  .form-2col-row { grid-template-columns: 1fr; }
  .vip-terminal-capsule { padding: 2rem; }
  .suite-details-side { padding: 2rem; }
  .footer-panoramic-layout { grid-template-columns: 1fr; }
}
`;
}

// ============================================================================
// V2 HTML GENERATOR (AWWWARDS LUMINOUS LIQUID GLASS)
// ============================================================================
function generateV2LiquidHTML(hotel) {
  const name = hotel.name;
  const slug = hotel.slug;
  const phone = hotel.phone || '0252 456 23 40';
  const cleanPhone = phone.replace(/\D/g, '') || '902524562340';
  const address = hotel.address || 'Selimiye Koyu, Marmaris / Muğla';
  const tagline = hotel.tagline || 'Selimiye’de Kristal Sular & Yüksek Kıyı Konforu';
  const concept = hotel.concept || 'Kıyı Dinginliği & Lüks Butik Deneyim';

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
  <meta name="description" content="${escapeHtml(name)} — Selimiye Koyu'nda ${escapeHtml(concept)}. Luminous Liquid Glass & Modern Kıyı Lüksü.">
  <title>${escapeHtml(name)} — Selimiye | Luminous Liquid Glass (V2)</title>
  
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700;800;900&family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  
  <link rel="stylesheet" href="./styles.css?v=20260827">
  <script defer src="./app.js?v=20260827"></script>
</head>
<body class="v2-liquid-luminous" data-phone="${escapeHtml(cleanPhone)}" data-hotel="${escapeHtml(name)}">

  <!-- Ambient Liquid Aurora Mesh -->
  <div class="ambient-aurora-mesh" aria-hidden="true">
    <div class="aurora-orb aurora-1"></div>
    <div class="aurora-orb aurora-2"></div>
    <div class="aurora-orb aurora-3"></div>
  </div>

  <!-- FLOATING GLASS CAPSULE HEADER -->
  <header class="v2-glass-header" id="v2Header">
    <div class="header-capsule-bar">
      
      <a href="#top" class="brand-capsule-island">
        <div class="brand-logo-disc">
          ${getLuxuryEmblem(slug, name, true)}
        </div>
        <div class="brand-titles-column">
          <span class="brand-h-name">${escapeHtml(name).toUpperCase()}</span>
          <span class="brand-h-sub">SELİMİYE · MARMARİS</span>
        </div>
      </a>

      <nav class="nav-glass-links">
        <a href="#suites" class="nav-g-item">Süitler & Odalar</a>
        <a href="#rituals" class="nav-g-item">Koy Atmosferi</a>
        <a href="#gastronomy" class="nav-g-item">Gastronomi</a>
        <a href="#coves" class="nav-g-item">Koylar</a>
        <a href="#concierge" class="nav-g-item">VIP Danışma</a>
      </nav>

      <div class="header-action-cluster">
        <div class="live-beacon-capsule">
          <span class="pulsing-dot"></span>
          <span>☀️ 28°C Selimiye</span>
        </div>
        <button class="btn-liquid-gold-cta" data-book>
          <span>Rezervasyon</span>
          <i>↗</i>
        </button>
      </div>

    </div>
  </header>

  <main id="top">
    
    <!-- HERO: SPLIT CINEMATIC PANORAMA -->
    <section class="hero-v2-luminous">
      <div class="container-liquid-v2">
        <div class="hero-v2-split-grid">
          
          <div class="hero-v2-text" data-reveal>
            <div class="hero-glow-badge">
              <span class="pulsing-dot"></span>
              <span>SELİMİYE KOYU · ÖZEL İSKELE</span>
              <span class="tag-gold-sparkle">V2 LIQUID GLASS</span>
            </div>

            <h1 class="hero-v2-h1">
              Akışkan Camın Işığında,<br>
              <em class="hero-serif-italic-gold">${escapeHtml(tagline)}</em>
            </h1>

            <p class="hero-v2-lead-para">
              ${escapeHtml(name)}; Selimiye’nin kristal turkuaz suları üzerinde, akışkan cam mimari ve masif ahşap iskele konforuyla tasarlanmış seçkin bir Ege inzivası sunar.
            </p>

            <!-- Hero Floating Booking Dock -->
            <div class="hero-booking-dock-glass">
              <form class="dock-fields-4col" onsubmit="return false;">
                <div class="dock-cell-block">
                  <label>GİRİŞ TARİHİ</label>
                  <input type="date" id="heroCheckin" required>
                </div>
                <div class="dock-cell-block">
                  <label>ÇIKIŞ TARİHİ</label>
                  <input type="date" id="heroCheckout" required>
                </div>
                <div class="dock-cell-block">
                  <label>MİSAFİR</label>
                  <select id="heroGuests">
                    <option value="2 Yetişkin">2 Yetişkin</option>
                    <option value="1 Yetişkin">1 Yetişkin</option>
                    <option value="3 Yetişkin">3 Yetişkin</option>
                    <option value="4+ Yetişkin">4+ Yetişkin / Aile</option>
                  </select>
                </div>
                <button type="button" class="btn-dock-search" id="heroSubmitBtn">
                  <span>Müsaitlik Al →</span>
                </button>
              </form>
            </div>
          </div>

          <div class="hero-v2-visual-stage" data-reveal>
            <div class="stage-main-card">
              <img src="./media/hero.jpg" alt="${escapeHtml(name)} Ana Görsel">
              <div class="badge-glass-floating-top">
                <span>✦ DOĞRUDAN REZERVASYON</span>
              </div>
              <div class="badge-glass-floating-bot">
                <strong>${escapeHtml(name)}</strong>
                <span>${escapeHtml(address)}</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>

    <!-- SUITES: HORIZONTAL LOOKBOOK -->
    <section class="v2-fluid-section" id="suites" style="background: rgba(3, 10, 18, 0.55);">
      <div class="container-liquid-v2">
        
        <div class="section-masthead-center" data-reveal>
          <div class="pill-eyebrow-cyan">PANORAMİK KONAKLAMA</div>
          <h2 class="section-headline-xl">Koleksiyon Süitleri</h2>
          <p class="section-lead-para">Doğal kireçtaşı, keten tekstiller ve Ege koyunu kucaklayan geniş özel teraslar.</p>
        </div>

        <div class="suites-panoramic-stack">
          ${rooms.map((room, idx) => `
            <article class="suite-panoramic-card ${idx % 2 === 1 ? 'reverse' : ''}" data-reveal>
              <div class="suite-photo-side">
                <img src="${idx === 0 ? './media/suite.jpg' : './media/room.jpg'}" alt="${escapeHtml(room.title)}">
                <span class="suite-tag-ribbon">${escapeHtml(room.badge || 'Özel Seri')}</span>
              </div>
              <div class="suite-details-side">
                <div>
                  <span class="suite-index-kicker">REZİDANS N° 0${idx + 1}</span>
                  <h3 class="suite-name-title">${escapeHtml(room.title)}</h3>
                  <p class="suite-desc-body">${escapeHtml(room.desc || 'Ferah banyo, doğal keten dokular ve dingin koy manzarası.')}</p>
                  
                  <div class="suite-specs-3box">
                    <div class="spec-box-unit"><span>ALAN</span><strong>${escapeHtml(room.size || '36 m²')}</strong></div>
                    <div class="spec-box-unit"><span>MANZARA</span><strong>${escapeHtml(room.view || 'Deniz & Avlu')}</strong></div>
                    <div class="spec-box-unit"><span>YATAK</span><strong>${escapeHtml(room.bed || 'King Size')}</strong></div>
                  </div>
                </div>

                <div class="suite-action-strip">
                  <span class="price-tag-gold">✦ En İyi Fiyat Garantisi</span>
                  <button class="btn-liquid-gold-cta" data-suite-name="${escapeHtml(room.title)}">
                    <span>Hemen Rezerve Et ↗</span>
                  </button>
                </div>
              </div>
            </article>
          `).join('')}
        </div>

      </div>
    </section>

    <!-- 24-HOUR RITUALS (ATMOSPHERE) -->
    <section class="v2-fluid-section" id="rituals">
      <div class="container-liquid-v2">
        <div class="section-masthead-center" data-reveal>
          <div class="pill-eyebrow-cyan">24 SAAT SELİMİYE</div>
          <h2 class="section-headline-xl">Koyda Zamanın Akışı</h2>
          <p class="section-lead-para">Sabahın durgunluğundan gece yıldızlarına, acele etmeden yaşanan bir kıyı ritmi.</p>
        </div>

        <div class="rituals-3deck-grid">
          ${rituals.map(r => `
            <div class="ritual-fluid-card" data-reveal>
              <span class="time-slot-pill">${escapeHtml(r.time)}</span>
              <h4>${escapeHtml(r.title)}</h4>
              <p>${escapeHtml(r.desc)}</p>
            </div>
          `).join('')}
        </div>
      </div>
    </section>

    <!-- GASTRONOMY: VIDEO & DEGUSTATION -->
    <section class="v2-fluid-section" id="gastronomy" style="background: rgba(3, 10, 18, 0.55);">
      <div class="container-liquid-v2">
        <div class="gastronomy-split-deck">
          
          <div class="degustation-glass-panel" data-reveal>
            <div class="degustation-masthead">
              <span class="pill-eyebrow-cyan" style="margin-bottom:0.5rem;">TOPRAKTAN & DENİZDEN</span>
              <h3>Tadım Sofrası & Kıyı Masası</h3>
            </div>
            <div class="courses-vertical-list">
              <div class="course-entry-row">
                <span class="num-roman-gold">I.</span>
                <div class="entry-body">
                  <strong>Organik Köy Kahvaltısı</strong>
                  <p>Bozburun çam balı, taze keçi peynirleri ve taş fırın sıcak ekmekleri.</p>
                </div>
              </div>
              <div class="course-entry-row">
                <span class="num-roman-gold">II.</span>
                <div class="entry-body">
                  <strong>Erken Hasat Zeytinyağlılar</strong>
                  <p>Bahçemizden toplanan şifalı Ege otları ve soğuk sıkım zeytinyağı.</p>
                </div>
              </div>
              <div class="course-entry-row">
                <span class="num-roman-gold">III.</span>
                <div class="entry-body">
                  <strong>Günlük Kıyı Avı & Izgara</strong>
                  <p>Selimiye balıkçılarından günlük taze deniz balıkları ve ızgara kalamar.</p>
                </div>
              </div>
            </div>
          </div>

          <div class="video-frame-showcase" data-reveal>
            <video autoplay muted loop playsinline preload="metadata" poster="./media/dining.jpg">
              <source src="./media/decor.mp4" type="video/mp4">
            </video>
          </div>

        </div>
      </div>
    </section>

    <!-- NAUTICAL COVES: BENTO RADAR -->
    <section class="v2-fluid-section" id="coves">
      <div class="container-liquid-v2">
        <div class="section-masthead-center" data-reveal>
          <div class="pill-eyebrow-cyan">DESTİNASYON RADARI</div>
          <h2 class="section-headline-xl">Denizcilik & Saklı Koylar</h2>
        </div>

        <div class="coves-bento-3card">
          <div class="cove-radar-card" data-reveal>
            <div class="cove-visual-top">
              <img src="./media/jetty_hd.jpg" alt="Sığliman">
              <span class="cove-gps-pill">36°42'N 28°05'E</span>
            </div>
            <div class="cove-info-bot">
              <h3>Sığliman Koyu</h3>
              <p>Durgun göl berraklığında, sığ ve ılık suları ile Selimiye’nin en korunaklı yüzme koyu.</p>
            </div>
          </div>

          <div class="cove-radar-card" data-reveal>
            <div class="cove-visual-top">
              <img src="./media/boat-arrival.jpg" alt="Kamelya Adası">
              <span class="cove-gps-pill">15 DK TEKNEYLE</span>
            </div>
            <div class="cove-info-bot">
              <h3>Kamelya & Dişlice</h3>
              <p>Antik manastır kalıntıları ve volkanik kaya dehlizleriyle ünlü turkuaz ada rotası.</p>
            </div>
          </div>

          <div class="cove-radar-card" data-reveal>
            <div class="cove-visual-top">
              <img src="./media/terrace-view.jpg" alt="Karia Parkuru">
              <span class="cove-gps-pill">KARİA YOLU</span>
            </div>
            <div class="cove-info-bot">
              <h3>Antik Karia Patikaları</h3>
              <p>Adaçayı kokulu dağ yamaçlarından Selimiye Koyu’nu kuşbakışı izleyen yürüyüş rotaları.</p>
            </div>
          </div>
        </div>

      </div>
    </section>

    <!-- VIP CONCIERGE TERMINAL -->
    <section class="v2-fluid-section" id="concierge">
      <div class="container-liquid-v2">
        <div class="vip-terminal-capsule" data-reveal>
          <div class="vip-terminal-grid">
            
            <div class="vip-left-copy">
              <span class="pill-eyebrow-cyan">VIP DANIŞMA</span>
              <h2>Doğrudan<br><em class="hero-serif-italic-gold">Rezervasyon Terminali</em></h2>
              <p style="color:var(--text-muted); font-size:0.98rem; line-height:1.85;">
                Tarihlerinizi iletin; en avantajlı doğrudan fiyatlandırma ve kişisel transfer seçenekleriyle size anında dönüş yapalım.
              </p>

              <div class="vip-lines-stack">
                <div class="vip-line-cell">
                  <strong>KONUM</strong>
                  <span>${escapeHtml(address)}</span>
                </div>
                <div class="vip-line-cell">
                  <strong>RESEPSİYON TELEFON</strong>
                  <a href="tel:${escapeHtml(cleanPhone)}">${escapeHtml(phone)}</a>
                </div>
                <div class="vip-line-cell">
                  <strong>WHATSAPP CANLI DANIŞMA</strong>
                  <a href="https://wa.me/${escapeHtml(cleanPhone)}?text=Merhaba%20${encodeURIComponent(name)},%20m%C3%BCsaitlik%20bilgisi%20almak%20istiyorum." target="_blank" style="color:var(--cyan-neon);">+90 Selimiye VIP Concierge ↗</a>
                </div>
              </div>
            </div>

            <div class="vip-form-box-glass">
              <h3 style="font-family:var(--font-heading); color:#fff; font-size:1.45rem; margin-bottom:1.35rem;">Müsaitlik Talebi Gönder</h3>
              <form id="v2ContactForm" onsubmit="return false;">
                <div class="form-2col-row">
                  <div class="form-input-cell">
                    <label>Adınız Soyadınız *</label>
                    <input type="text" id="v2Name" placeholder="Adınız Soyadınız" required>
                  </div>
                  <div class="form-input-cell">
                    <label>Telefon Numarası *</label>
                    <input type="tel" id="v2Phone" placeholder="05XX XXX XX XX" required>
                  </div>
                </div>

                <div class="form-2col-row">
                  <div class="form-input-cell">
                    <label>Giriş Tarihi *</label>
                    <input type="date" id="v2Checkin" required>
                  </div>
                  <div class="form-input-cell">
                    <label>Çıkış Tarihi *</label>
                    <input type="date" id="v2Checkout" required>
                  </div>
                </div>

                <div class="form-2col-row">
                  <div class="form-input-cell">
                    <label>Oda Tercihi</label>
                    <select id="v2Suite">
                      <option value="Tüm Koleksiyon">Tüm Odaları Göster</option>
                      ${rooms.map(r => `<option value="${escapeHtml(r.title)}">${escapeHtml(r.title)}</option>`).join('')}
                    </select>
                  </div>
                  <div class="form-input-cell">
                    <label>Misafir Sayısı</label>
                    <select id="v2Guests">
                      <option value="2 Yetişkin">2 Yetişkin</option>
                      <option value="1 Yetişkin">1 Yetişkin</option>
                      <option value="3 Yetişkin">3 Yetişkin</option>
                      <option value="4+ Yetişkin">4+ Yetişkin / Aile</option>
                    </select>
                  </div>
                </div>

                <div class="form-input-cell" style="margin-bottom:1.6rem;">
                  <label>Özel Talebiniz</label>
                  <textarea id="v2Notes" rows="3" placeholder="Örn: Balayı karşılama ikramı, tekne transferi, geç giriş..."></textarea>
                </div>

                <button type="button" class="btn-dock-search" id="v2SubmitBtn" style="width:100%; justify-content:center; height:50px;">
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
  <footer class="v2-fluid-footer">
    <div class="container-liquid-v2">
      <div class="footer-panoramic-layout">
        <div>
          <div class="footer-brand-h">${escapeHtml(name).toUpperCase()}</div>
          <p style="color:var(--text-muted); font-size:0.92rem; line-height:1.75; margin-bottom:1.2rem;">
            ${escapeHtml(tagline)}
          </p>
          <small style="color:var(--text-dim); display:block;">${escapeHtml(address)}</small>
        </div>

        <div class="footer-nav-col">
          <strong>Hızlı Bağlantılar</strong>
          <a href="#suites">Koleksiyon Süitleri</a>
          <a href="#rituals">Koy Atmosferi</a>
          <a href="#gastronomy">Gastronomi & İskele</a>
          <a href="#coves">Koylar Rehberi</a>
          <a href="#concierge">VIP Danışma</a>
        </div>

        <div class="footer-nav-col">
          <strong>İletişim & Rezervasyon</strong>
          <a href="tel:${escapeHtml(cleanPhone)}">📞 ${escapeHtml(phone)}</a>
          <a href="https://wa.me/${escapeHtml(cleanPhone)}" target="_blank">💬 WhatsApp Canlı Hattı</a>
          <span style="color:var(--text-dim); font-size:0.84rem; margin-top:0.5rem;">7/24 Misafir Karşılama</span>
        </div>
      </div>

      <div class="footer-bottom-copyright">
        <span>© ${new Date().getFullYear()} ${escapeHtml(name)}. Tüm Hakları Saklıdır.</span>
        <span>Selimiye Koyu · Marmaris / Muğla</span>
      </div>
    </div>
  </footer>

</body>
</html>`;
}

// ============================================================================
// V2 JAVASCRIPT APP (INTERACTIVE LIQUID FLOW)
// ============================================================================
function generateV2LiquidJS() {
  return `/**
 * SELİMİYE V2 — LUMINOUS LIQUID GLASS ENGINE
 */
document.addEventListener('DOMContentLoaded', () => {
  // Sticky header on scroll
  const header = document.getElementById('v2Header');
  if (header) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 40) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    }, { passive: true });
  }

  // Scroll reveal animation
  const reveals = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });

    reveals.forEach(el => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(24px)';
      el.style.transition = 'opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1), transform 0.7s cubic-bezier(0.16, 1, 0.3, 1)';
      observer.observe(el);
    });
  }

  // Book buttons scroll to concierge
  document.querySelectorAll('[data-book]').forEach(btn => {
    btn.addEventListener('click', () => {
      const section = document.getElementById('concierge');
      if (section) {
        section.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  // Suite Reserve buttons
  document.querySelectorAll('[data-suite-name]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const name = e.currentTarget.getAttribute('data-suite-name');
      const select = document.getElementById('v2Suite');
      if (select) {
        select.value = name;
      }
      const section = document.getElementById('concierge');
      if (section) {
        section.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  // Hero Dock Submit Button
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

      const section = document.getElementById('concierge');
      if (section) {
        section.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  // WhatsApp Routing Form
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

// Build all 24 V2 sites
function buildAllV2Sites() {
  console.log('💎 Compiling 24 V2 Selimiye Websites with Luminous Aegean Liquid Glass Architecture...');
  
  const css = generateV2LiquidCSS();
  const js = generateV2LiquidJS();

  for (const hotel of rawV2Data.hotels) {
    const slug = hotel.slug;
    const hotelDir = path.join(outBaseDir, slug);
    if (!fs.existsSync(hotelDir)) {
      fs.mkdirSync(hotelDir, { recursive: true });
    }

    const html = generateV2LiquidHTML(hotel);

    fs.writeFileSync(path.join(hotelDir, 'index.html'), html, 'utf8');
    fs.writeFileSync(path.join(hotelDir, 'styles.css'), css, 'utf8');
    fs.writeFileSync(path.join(hotelDir, 'app.js'), js, 'utf8');
  }

  console.log('✅ Successfully compiled and deployed all 24 V2 Luminous Liquid Glass Websites!');
}

buildAllV2Sites();
