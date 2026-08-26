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
// ULTRA-RICH LUMINOUS LIQUID GLASS CSS FOR V2
// ============================================================================
function generateV2LiquidCSS() {
  return `/* ==========================================================================
   SELİMİYE HOTELS — V2 LUMINOUS LIQUID GLASS & HAUTE PANORAMIC RESORT
   ========================================================================== */

:root {
  --bg-deep: #01060e;
  --bg-surface: #051222;
  --bg-card: rgba(8, 24, 44, 0.6);
  --bg-card-hover: rgba(12, 34, 60, 0.75);
  --bg-card-heavy: rgba(4, 14, 26, 0.88);
  --bg-glass-input: rgba(14, 36, 64, 0.7);

  --font-serif: 'Cormorant Garamond', Georgia, serif;
  --font-heading: 'Cinzel', 'Playfair Display', Georgia, serif;
  --font-sans: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;

  --cyan-neon: #00f2fe;
  --cyan-glow: rgba(0, 242, 254, 0.35);
  --cyan-gradient: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  
  --gold-primary: #d4af37;
  --gold-light: #fff3cf;
  --gold-gradient: linear-gradient(135deg, #fff3cf 0%, #e2c174 40%, #c59b3f 75%, #8c6721 100%);
  --gold-glow: rgba(212, 175, 55, 0.35);

  --border-glass: rgba(255, 255, 255, 0.12);
  --border-cyan: rgba(0, 242, 254, 0.35);
  --border-gold: rgba(212, 175, 55, 0.35);

  --text-main: #f8fafc;
  --text-muted: #94a3b8;
  --text-dim: #64748b;

  --shadow-liquid: 0 30px 70px -15px rgba(0, 0, 0, 0.8), 0 0 35px rgba(0, 242, 254, 0.08);
  --shadow-glow: 0 0 45px rgba(0, 242, 254, 0.22);
  --shadow-gold: 0 0 40px rgba(212, 175, 55, 0.3);

  --blur-heavy: blur(30px) saturate(200%);
  --blur-medium: blur(18px) saturate(170%);

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

/* Ambient Fluid Glow Orbs */
.ambient-glow-orb {
  position: fixed;
  border-radius: 50%;
  pointer-events: none;
  z-index: 0;
  filter: blur(130px);
  opacity: 0.38;
  animation: orbKinetic 22s ease-in-out infinite alternate;
}
.glow-cyan-top {
  top: -15vh;
  left: 15vw;
  width: 60vw;
  height: 60vw;
  background: radial-gradient(circle, rgba(0, 242, 254, 0.28) 0%, rgba(79, 172, 254, 0.06) 70%, transparent 100%);
}
.glow-gold-mid {
  top: 45vh;
  right: -12vw;
  width: 55vw;
  height: 55vw;
  background: radial-gradient(circle, rgba(212, 175, 55, 0.22) 0%, rgba(180, 130, 30, 0.04) 70%, transparent 100%);
  animation-delay: -8s;
}
.glow-deep-bot {
  bottom: -20vh;
  left: 25vw;
  width: 65vw;
  height: 65vw;
  background: radial-gradient(circle, rgba(14, 165, 233, 0.2) 0%, transparent 70%);
  animation-delay: -14s;
}
@keyframes orbKinetic {
  0% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(50px, -40px) scale(1.08); }
  100% { transform: translate(-40px, 50px) scale(0.94); }
}

.container-v2 {
  width: 100%;
  max-width: 1360px;
  margin: 0 auto;
  padding: 0 2rem;
  position: relative;
  z-index: 2;
}

/* Floating Glass Island Header */
.v2-floating-header {
  position: sticky;
  top: 0;
  z-index: 100;
  padding: 1.2rem 0;
  transition: var(--transition);
}
.v2-floating-header.scrolled {
  padding: 0.6rem 0;
}
.header-glass-capsule {
  max-width: 1360px;
  margin: 0 auto;
  padding: 0.7rem 1.8rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--bg-card-heavy);
  backdrop-filter: var(--blur-heavy);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-full);
  box-shadow: var(--shadow-liquid);
}

.brand-unit {
  display: flex;
  align-items: center;
  gap: 1.1rem;
  text-decoration: none;
}
.brand-emblem-frame {
  width: 62px;
  height: 62px;
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 25px rgba(0, 242, 254, 0.3), 0 0 15px rgba(212, 175, 55, 0.3);
  transition: var(--transition);
}
.brand-emblem-frame:hover {
  transform: scale(1.08) rotate(4deg);
  box-shadow: 0 0 35px rgba(0, 242, 254, 0.5);
}
.brand-emblem-frame svg {
  width: 100%;
  height: 100%;
  display: block;
}

.brand-meta {
  display: flex;
  flex-direction: column;
}
.brand-name-h {
  font-family: var(--font-heading);
  font-size: 1.25rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: #ffffff;
  line-height: 1.2;
}
.brand-sub-h {
  font-size: 0.68rem;
  letter-spacing: 0.24em;
  background: var(--gold-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  text-transform: uppercase;
  font-weight: 700;
}

.v2-nav-menu {
  display: flex;
  align-items: center;
  gap: 1.8rem;
}
.v2-menu-item {
  font-size: 0.9rem;
  color: #cbd5e1;
  text-decoration: none;
  font-weight: 500;
  letter-spacing: 0.04em;
  transition: var(--transition);
  position: relative;
  padding: 0.4rem 0;
}
.v2-menu-item:hover {
  color: #ffffff;
}
.v2-menu-item::after {
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
.v2-menu-item:hover::after {
  width: 100%;
}

.header-action-group {
  display: flex;
  align-items: center;
  gap: 1rem;
}
.weather-status-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(0, 242, 254, 0.08);
  border: 1px solid var(--border-cyan);
  padding: 0.45rem 1rem;
  border-radius: var(--radius-full);
  color: var(--cyan-neon);
  font-size: 0.78rem;
  font-weight: 600;
  text-decoration: none;
}
.status-beacon-pulse {
  width: 8px;
  height: 8px;
  background: var(--cyan-neon);
  border-radius: 50%;
  box-shadow: 0 0 10px var(--cyan-neon);
  animation: beaconFlash 2s infinite;
}
@keyframes beaconFlash {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.35; transform: scale(0.75); }
}

.btn-gold-capsule {
  background: var(--gold-gradient);
  color: #040810;
  border: none;
  font-family: var(--font-sans);
  font-size: 0.84rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  padding: 0.68rem 1.5rem;
  border-radius: var(--radius-full);
  cursor: pointer;
  box-shadow: var(--shadow-gold);
  transition: var(--transition);
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.btn-gold-capsule:hover {
  transform: translateY(-2px) scale(1.02);
  box-shadow: 0 0 35px rgba(212, 175, 55, 0.5);
}

/* ============================================================================
   HERO: SPLIT CINEMATIC PANORAMA & 3D GLASS STACK
   ============================================================================ */
.hero-v2-split {
  position: relative;
  min-height: 90vh;
  display: flex;
  align-items: center;
  padding: 5rem 0 4rem;
  overflow: hidden;
}
.hero-v2-grid {
  display: grid;
  grid-template-columns: 1.15fr 1fr;
  gap: 4.5rem;
  align-items: center;
}

.hero-left-intro {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
}
.hero-eyebrow-glow {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  background: rgba(8, 26, 46, 0.85);
  backdrop-filter: var(--blur-medium);
  border: 1px solid var(--border-cyan);
  padding: 0.5rem 1.4rem;
  border-radius: var(--radius-full);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.15em;
  color: #ffffff;
  margin-bottom: 1.75rem;
  box-shadow: var(--shadow-glow);
}
.badge-gold-tag {
  background: var(--gold-gradient);
  color: #000;
  font-size: 0.68rem;
  font-weight: 800;
  padding: 2px 8px;
  border-radius: var(--radius-full);
}

.hero-main-heading {
  font-family: var(--font-heading);
  font-size: clamp(2.4rem, 4.6vw, 4.2rem);
  font-weight: 700;
  line-height: 1.15;
  color: #ffffff;
  margin-bottom: 1.5rem;
  text-shadow: 0 4px 30px rgba(0, 0, 0, 0.9);
}
.hero-highlight-italics {
  font-family: var(--font-serif);
  font-style: italic;
  font-weight: 400;
  background: var(--gold-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
.hero-lead-desc {
  font-size: 1.12rem;
  color: #cbd5e1;
  line-height: 1.8;
  margin-bottom: 2.5rem;
  max-width: 620px;
}

/* Floating Glass Hero Booking Dock */
.hero-dock-glass {
  width: 100%;
  background: var(--bg-card);
  backdrop-filter: var(--blur-heavy);
  border: 1px solid var(--border-cyan);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  box-shadow: var(--shadow-liquid), var(--shadow-glow);
}
.dock-form-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr) auto;
  gap: 1rem;
  align-items: center;
}
.dock-field-col {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.dock-field-col label {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--cyan-neon);
  text-transform: uppercase;
}
.dock-field-col input, .dock-field-col select {
  background: var(--bg-glass-input);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: var(--radius-sm);
  padding: 0.65rem 0.85rem;
  color: #ffffff;
  font-family: var(--font-sans);
  font-size: 0.88rem;
  outline: none;
}
.dock-field-col input:focus, .dock-field-col select:focus {
  border-color: var(--cyan-neon);
  box-shadow: 0 0 15px rgba(0, 242, 254, 0.25);
}

.btn-dock-cta {
  background: var(--gold-gradient);
  color: #040810;
  border: none;
  font-family: var(--font-sans);
  font-size: 0.88rem;
  font-weight: 700;
  padding: 0.85rem 1.5rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  box-shadow: var(--shadow-gold);
  transition: var(--transition);
  height: 44px;
}
.btn-dock-cta:hover {
  transform: translateY(-2px);
  box-shadow: 0 0 30px rgba(212, 175, 55, 0.5);
}

/* Hero Right 3D Visual Composition */
.hero-right-visuals {
  position: relative;
}
.visual-stack-main {
  position: relative;
  border-radius: var(--radius-lg);
  overflow: hidden;
  border: 1.5px solid var(--border-cyan);
  box-shadow: var(--shadow-liquid), var(--shadow-glow);
  height: 480px;
}
.visual-stack-main img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.floating-glass-badge-top {
  position: absolute;
  top: 1.5rem;
  right: 1.5rem;
  background: rgba(2, 7, 14, 0.85);
  backdrop-filter: var(--blur-medium);
  border: 1px solid var(--border-gold);
  padding: 0.6rem 1.2rem;
  border-radius: var(--radius-full);
  color: var(--gold-light);
  font-size: 0.78rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 8px;
}
.floating-glass-card-bot {
  position: absolute;
  bottom: -1.5rem;
  left: -1.5rem;
  background: rgba(6, 18, 32, 0.88);
  backdrop-filter: var(--blur-heavy);
  border: 1px solid var(--border-glass);
  padding: 1.25rem 1.6rem;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-liquid);
  max-width: 280px;
}
.floating-glass-card-bot strong {
  display: block;
  font-family: var(--font-heading);
  font-size: 1.05rem;
  color: #ffffff;
  margin-bottom: 2px;
}
.floating-glass-card-bot span {
  font-size: 0.8rem;
  color: var(--cyan-neon);
}

/* ============================================================================
   SECTIONS COMMON
   ============================================================================ */
.v2-section {
  padding: 7.5rem 0;
  position: relative;
  z-index: 2;
}
.section-headline-center {
  text-align: center;
  max-width: 820px;
  margin: 0 auto 4.5rem;
}
.eyebrow-pill-cyan {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(0, 242, 254, 0.08);
  border: 1px solid var(--border-cyan);
  padding: 0.4rem 1.2rem;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.15em;
  color: var(--cyan-neon);
  margin-bottom: 1.25rem;
}
.section-title-lg {
  font-family: var(--font-heading);
  font-size: clamp(2rem, 4vw, 3.2rem);
  font-weight: 700;
  line-height: 1.2;
  color: #ffffff;
  margin-bottom: 1.25rem;
}
.section-desc-sub {
  font-size: 1.05rem;
  color: var(--text-muted);
  line-height: 1.8;
}

/* ============================================================================
   SUITES: HORIZONTAL PANORAMIC LOOKBOOK
   ============================================================================ */
.suites-lookbook-stack {
  display: flex;
  flex-direction: column;
  gap: 3rem;
}
.suite-lookbook-card {
  display: grid;
  grid-template-columns: 1.15fr 1fr;
  background: var(--bg-card);
  backdrop-filter: var(--blur-heavy);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-liquid);
  transition: var(--transition);
}
.suite-lookbook-card.reverse {
  grid-template-columns: 1fr 1.15fr;
}
.suite-lookbook-card:hover {
  border-color: var(--cyan-neon);
  transform: translateY(-6px);
  box-shadow: 0 30px 80px -15px rgba(0, 0, 0, 0.9), var(--shadow-glow);
}

.suite-visual-side {
  position: relative;
  min-height: 380px;
  overflow: hidden;
}
.suite-visual-side img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.8s ease;
}
.suite-lookbook-card:hover .suite-visual-side img {
  transform: scale(1.05);
}
.suite-badge-tag {
  position: absolute;
  top: 1.5rem;
  left: 1.5rem;
  background: rgba(2, 7, 14, 0.85);
  backdrop-filter: var(--blur-medium);
  border: 1px solid var(--border-gold);
  color: var(--gold-light);
  font-size: 0.74rem;
  font-weight: 700;
  padding: 5px 14px;
  border-radius: var(--radius-full);
}

.suite-info-side {
  padding: 3rem;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
.suite-serial-tag {
  font-size: 0.72rem;
  letter-spacing: 0.2em;
  color: var(--cyan-neon);
  text-transform: uppercase;
  font-weight: 700;
  margin-bottom: 0.5rem;
  display: block;
}
.suite-title-h {
  font-family: var(--font-heading);
  font-size: 1.8rem;
  color: #ffffff;
  margin-bottom: 1rem;
}
.suite-text-desc {
  font-size: 0.95rem;
  color: var(--text-muted);
  line-height: 1.75;
  margin-bottom: 2rem;
}

.suite-specs-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  margin-bottom: 2rem;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-sm);
}
.spec-item-box span {
  display: block;
  font-size: 0.68rem;
  color: var(--text-dim);
  text-transform: uppercase;
  font-weight: 700;
}
.spec-item-box strong {
  font-size: 0.88rem;
  color: #ffffff;
}

.suite-bottom-action {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding-top: 1.5rem;
}
.price-guarantee-pill {
  font-size: 0.78rem;
  color: var(--gold-light);
  font-weight: 600;
}

/* ============================================================================
   24-HOUR RITUALS (INTERACTIVE ATMOSPHERE DECK)
   ============================================================================ */
.atmosphere-liquid-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2rem;
}
.atmosphere-glass-card {
  background: var(--bg-card);
  backdrop-filter: var(--blur-heavy);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-lg);
  padding: 2.5rem;
  box-shadow: var(--shadow-liquid);
  transition: var(--transition);
  position: relative;
  overflow: hidden;
}
.atmosphere-glass-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--cyan-gradient);
  opacity: 0.7;
}
.atmosphere-glass-card:hover {
  border-color: var(--cyan-neon);
  transform: translateY(-6px);
  box-shadow: var(--shadow-glow);
}
.atmosphere-time-tag {
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--cyan-neon);
  text-transform: uppercase;
  margin-bottom: 0.8rem;
  display: block;
}
.atmosphere-glass-card h4 {
  font-family: var(--font-heading);
  font-size: 1.35rem;
  color: #ffffff;
  margin-bottom: 0.75rem;
}
.atmosphere-glass-card p {
  font-size: 0.92rem;
  color: var(--text-muted);
  line-height: 1.75;
}

/* ============================================================================
   GASTRONOMY: VIDEO & DEGUSTATION
   ============================================================================ */
.gastronomy-liquid-layout {
  display: grid;
  grid-template-columns: 1fr 1.15fr;
  gap: 4rem;
  align-items: center;
}
.degustation-card-glass {
  background: var(--bg-card);
  backdrop-filter: var(--blur-heavy);
  border: 1px solid var(--border-gold);
  border-radius: var(--radius-lg);
  padding: 2.75rem;
  box-shadow: var(--shadow-liquid), var(--shadow-gold);
}
.degustation-top-bar {
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 1.25rem;
  margin-bottom: 1.75rem;
}
.degustation-top-bar h3 {
  font-family: var(--font-heading);
  font-size: 1.65rem;
  color: #ffffff;
}
.course-stack-list {
  display: flex;
  flex-direction: column;
  gap: 1.6rem;
}
.course-item-row {
  display: flex;
  gap: 1.4rem;
}
.course-num-gold {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 1.6rem;
  color: var(--gold-light);
  line-height: 1;
}
.course-desc-col strong {
  display: block;
  font-family: var(--font-heading);
  font-size: 1.05rem;
  color: #ffffff;
  margin-bottom: 2px;
}
.course-desc-col p {
  font-size: 0.88rem;
  color: var(--text-muted);
}

.gastro-video-container {
  border-radius: var(--radius-lg);
  overflow: hidden;
  border: 1.5px solid var(--border-cyan);
  box-shadow: var(--shadow-liquid), var(--shadow-glow);
}
.gastro-video-container video {
  width: 100%;
  height: 420px;
  object-fit: cover;
  display: block;
}

/* ============================================================================
   NAUTICAL COVES: BENTO RADAR
   ============================================================================ */
.coves-bento-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2rem;
}
.cove-bento-card {
  background: var(--bg-card);
  backdrop-filter: var(--blur-heavy);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-liquid);
  transition: var(--transition);
}
.cove-bento-card:hover {
  border-color: var(--cyan-neon);
  transform: translateY(-6px);
  box-shadow: var(--shadow-glow);
}
.cove-image-wrap {
  position: relative;
  height: 230px;
}
.cove-image-wrap img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.cove-radar-badge {
  position: absolute;
  top: 1rem;
  left: 1rem;
  background: rgba(2, 7, 14, 0.85);
  backdrop-filter: var(--blur-medium);
  border: 1px solid var(--border-cyan);
  color: var(--cyan-neon);
  font-size: 0.72rem;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: var(--radius-full);
}
.cove-meta-body {
  padding: 1.75rem;
}
.cove-meta-body h3 {
  font-family: var(--font-heading);
  font-size: 1.25rem;
  color: #ffffff;
  margin-bottom: 0.5rem;
}
.cove-meta-body p {
  font-size: 0.88rem;
  color: var(--text-muted);
}

/* ============================================================================
   VIP CONCIERGE SALON
   ============================================================================ */
.vip-concierge-deck {
  background: var(--bg-card-heavy);
  backdrop-filter: var(--blur-heavy);
  border: 1.5px solid var(--border-cyan);
  border-radius: var(--radius-lg);
  padding: 3.5rem;
  box-shadow: var(--shadow-liquid), var(--shadow-glow);
}
.vip-concierge-split {
  display: grid;
  grid-template-columns: 1fr 1.15fr;
  gap: 4rem;
}
.vip-terminal-left h2 {
  font-family: var(--font-heading);
  font-size: 2.3rem;
  color: #ffffff;
  margin-bottom: 1rem;
}
.vip-contact-lines {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  margin: 2rem 0;
}
.contact-line-item strong {
  display: block;
  font-size: 0.74rem;
  color: var(--cyan-neon);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.contact-line-item span, .contact-line-item a {
  color: #ffffff;
  font-size: 0.95rem;
  text-decoration: none;
}

.vip-form-terminal {
  background: rgba(8, 24, 44, 0.75);
  border: 1px solid var(--border-glass);
  padding: 2.25rem;
  border-radius: var(--radius-md);
}
.terminal-duo-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1rem;
}
.terminal-field-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.terminal-field-group label {
  font-size: 0.74rem;
  font-weight: 700;
  color: var(--text-muted);
}
.terminal-field-group input, .terminal-field-group select, .terminal-field-group textarea {
  background: var(--bg-glass-input);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: var(--radius-sm);
  padding: 0.65rem 0.85rem;
  color: #ffffff;
  font-family: var(--font-sans);
  font-size: 0.9rem;
  outline: none;
}
.terminal-field-group input:focus, .terminal-field-group select:focus, .terminal-field-group textarea:focus {
  border-color: var(--cyan-neon);
  box-shadow: 0 0 15px rgba(0, 242, 254, 0.25);
}

/* Footer */
.v2-panoramic-footer {
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding: 4.5rem 0 3rem;
  position: relative;
  z-index: 2;
  background: #010408;
}
.footer-panoramic-grid {
  display: grid;
  grid-template-columns: 1.5fr 1fr 1fr;
  gap: 3.5rem;
  margin-bottom: 3.5rem;
}
.footer-brand-heading {
  font-family: var(--font-heading);
  font-size: 1.35rem;
  color: #ffffff;
  margin-bottom: 0.75rem;
}
.footer-column-nav {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}
.footer-column-nav strong {
  font-size: 0.78rem;
  letter-spacing: 0.1em;
  color: var(--cyan-neon);
  text-transform: uppercase;
  margin-bottom: 0.5rem;
}
.footer-column-nav a {
  color: var(--text-muted);
  text-decoration: none;
  font-size: 0.9rem;
  transition: var(--transition);
}
.footer-column-nav a:hover {
  color: #ffffff;
}
.footer-bottom-line {
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  padding-top: 2rem;
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
  color: var(--text-dim);
}

@media (max-width: 1024px) {
  .v2-nav-menu, .weather-status-pill { display: none; }
  .hero-v2-grid, .gastronomy-liquid-layout, .vip-concierge-split { grid-template-columns: 1fr; gap: 3.5rem; }
  .suite-lookbook-card, .suite-lookbook-card.reverse { grid-template-columns: 1fr; }
  .atmosphere-liquid-grid, .coves-bento-grid { grid-template-columns: 1fr; }
  .dock-form-row { grid-template-columns: 1fr 1fr; }
  .btn-dock-cta { grid-column: span 2; }
  .footer-panoramic-grid { grid-template-columns: 1fr 1fr; }
}

@media (max-width: 640px) {
  .dock-form-row { grid-template-columns: 1fr; }
  .btn-dock-cta { grid-column: span 1; }
  .terminal-duo-row { grid-template-columns: 1fr; }
  .vip-concierge-deck { padding: 1.75rem; }
  .suite-info-side { padding: 1.75rem; }
  .footer-panoramic-grid { grid-template-columns: 1fr; }
}
`;
}

// ============================================================================
// V2 HTML GENERATOR (LUMINOUS AEGEAN LIQUID GLASS)
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
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700;800&family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  
  <link rel="stylesheet" href="./styles.css">
  <script defer src="./app.js"></script>
</head>
<body class="v2-liquid-luminous" data-phone="${escapeHtml(cleanPhone)}" data-hotel="${escapeHtml(name)}">

  <!-- Ambient Fluid Glow Orbs -->
  <div class="ambient-glow-orb glow-cyan-top" aria-hidden="true"></div>
  <div class="ambient-glow-orb glow-gold-mid" aria-hidden="true"></div>
  <div class="ambient-glow-orb glow-deep-bot" aria-hidden="true"></div>

  <!-- FLOATING LIQUID ISLAND HEADER -->
  <header class="v2-floating-header" id="v2Header">
    <div class="header-glass-capsule">
      
      <a href="#top" class="brand-unit">
        <div class="brand-emblem-frame">
          ${getLuxuryEmblem(slug, name, true)}
        </div>
        <div class="brand-meta">
          <span class="brand-name-h">${escapeHtml(name).toUpperCase()}</span>
          <span class="brand-sub-h">SELİMİYE · MARMARİS</span>
        </div>
      </a>

      <nav class="v2-nav-menu">
        <a href="#suites" class="v2-menu-item">Süitler</a>
        <a href="#atmosphere" class="v2-menu-item">Koy Atmosferi</a>
        <a href="#gastronomy" class="v2-menu-item">Gastronomi</a>
        <a href="#coves" class="v2-menu-item">Koylar</a>
        <a href="#concierge" class="v2-menu-item">VIP Danışma</a>
      </nav>

      <div class="header-action-group">
        <div class="weather-status-pill">
          <span class="status-beacon-pulse"></span>
          <span>☀️ 28°C Selimiye Koyu</span>
        </div>
        <button class="btn-gold-capsule" data-book>
          <span>Rezervasyon Yap</span>
          <i>↗</i>
        </button>
      </div>

    </div>
  </header>

  <main id="top">
    
    <!-- HERO: SPLIT CINEMATIC PANORAMA -->
    <section class="hero-v2-split">
      <div class="container-v2">
        <div class="hero-v2-grid">
          
          <div class="hero-left-intro" data-reveal>
            <div class="hero-eyebrow-glow">
              <span class="status-beacon-pulse"></span>
              <span>SELİMİYE KOYU · ÖZEL İSKELE</span>
              <span class="badge-gold-tag">V2 LUMINOUS GLASS</span>
            </div>

            <h1 class="hero-main-heading">
              Akışkan Camın Işığında,<br>
              <em class="hero-highlight-italics">${escapeHtml(tagline)}</em>
            </h1>

            <p class="hero-lead-desc">
              ${escapeHtml(name)}; Selimiye’nin kristal turkuaz suları üzerinde, akışkan cam mimari ve masif ahşap iskele konforuyla tasarlanmış seçkin bir Ege tatili sunar.
            </p>

            <!-- Hero Floating Booking Dock -->
            <div class="hero-dock-glass">
              <form class="dock-form-row" onsubmit="return false;">
                <div class="dock-field-col">
                  <label>GİRİŞ TARİHİ</label>
                  <input type="date" id="heroCheckin" required>
                </div>
                <div class="dock-field-col">
                  <label>ÇIKIŞ TARİHİ</label>
                  <input type="date" id="heroCheckout" required>
                </div>
                <div class="dock-field-col">
                  <label>MİSAFİR</label>
                  <select id="heroGuests">
                    <option value="2 Yetişkin">2 Yetişkin</option>
                    <option value="1 Yetişkin">1 Yetişkin</option>
                    <option value="3 Yetişkin">3 Yetişkin</option>
                    <option value="4+ Yetişkin">4+ Yetişkin / Aile</option>
                  </select>
                </div>
                <button type="button" class="btn-dock-cta" id="heroSubmitBtn">
                  <span>Müsaitlik Al →</span>
                </button>
              </form>
            </div>
          </div>

          <div class="hero-right-visuals" data-reveal>
            <div class="visual-stack-main">
              <img src="./media/hero.jpg" alt="${escapeHtml(name)} Ana Görsel">
              <div class="floating-glass-badge-top">
                <span>✦ DOĞRUDAN REZERVASYON</span>
              </div>
              <div class="floating-glass-card-bot">
                <strong>${escapeHtml(name)}</strong>
                <span>${escapeHtml(address)}</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>

    <!-- SUITES: HORIZONTAL LOOKBOOK -->
    <section class="v2-section" id="suites" style="background: rgba(3, 10, 18, 0.5);">
      <div class="container-v2">
        
        <div class="section-headline-center" data-reveal>
          <div class="eyebrow-pill-cyan">PANORAMİK KONAKLAMA</div>
          <h2 class="section-title-lg">Koleksiyon Süitleri</h2>
          <p class="section-desc-sub">Doğal kireçtaşı, keten tekstiller ve Ege koyunu kucaklayan geniş özel teraslar.</p>
        </div>

        <div class="suites-lookbook-stack">
          ${rooms.map((room, idx) => `
            <article class="suite-lookbook-card ${idx % 2 === 1 ? 'reverse' : ''}" data-reveal>
              <div class="suite-visual-side">
                <img src="${idx === 0 ? './media/suite.jpg' : './media/room.jpg'}" alt="${escapeHtml(room.title)}">
                <span class="suite-badge-tag">${escapeHtml(room.badge || 'Özel Seri')}</span>
              </div>
              <div class="suite-info-side">
                <div>
                  <span class="suite-serial-tag">REZİDANS N° 0${idx + 1}</span>
                  <h3 class="suite-title-h">${escapeHtml(room.title)}</h3>
                  <p class="suite-text-desc">${escapeHtml(room.desc || 'Ferah banyo, doğal keten dokular ve dingin koy manzarası.')}</p>
                  
                  <div class="suite-specs-grid">
                    <div class="spec-item-box"><span>ALAN</span><strong>${escapeHtml(room.size || '36 m²')}</strong></div>
                    <div class="spec-item-box"><span>MANZARA</span><strong>${escapeHtml(room.view || 'Deniz & Avlu')}</strong></div>
                    <div class="spec-item-box"><span>YATAK</span><strong>${escapeHtml(room.bed || 'King Size')}</strong></div>
                  </div>
                </div>

                <div class="suite-bottom-action">
                  <span class="price-guarantee-pill">✦ En İyi Fiyat Garantisi</span>
                  <button class="btn-gold-capsule" data-suite-name="${escapeHtml(room.title)}">
                    <span>Hemen Rezerve Et ↗</span>
                  </button>
                </div>
              </div>
            </article>
          `).join('')}
        </div>

      </div>
    </section>

    <!-- ATMOSPHERE (DAY TO NIGHT RITUALS) -->
    <section class="v2-section" id="atmosphere">
      <div class="container-v2">
        <div class="section-headline-center" data-reveal>
          <div class="eyebrow-pill-cyan">24 SAAT SELİMİYE</div>
          <h2 class="section-title-lg">Koyda Zamanın Akışı</h2>
          <p class="section-desc-sub">Sabahın durgunluğundan gece yıldızlarına, acele etmeden yaşanan bir kıyı ritmi.</p>
        </div>

        <div class="atmosphere-liquid-grid">
          ${rituals.map(r => `
            <div class="atmosphere-glass-card" data-reveal>
              <span class="atmosphere-time-tag">${escapeHtml(r.time)}</span>
              <h4>${escapeHtml(r.title)}</h4>
              <p>${escapeHtml(r.desc)}</p>
            </div>
          `).join('')}
        </div>
      </div>
    </section>

    <!-- GASTRONOMY: VIDEO & DEGUSTATION -->
    <section class="v2-section" id="gastronomy" style="background: rgba(3, 10, 18, 0.5);">
      <div class="container-v2">
        <div class="gastronomy-liquid-layout">
          
          <div class="degustation-card-glass" data-reveal>
            <div class="degustation-top-bar">
              <span class="eyebrow-pill-cyan" style="margin-bottom:0.5rem;">TOPRAKTAN & DENİZDEN</span>
              <h3>Tadım Sofrası & Kıyı Masası</h3>
            </div>
            <div class="course-stack-list">
              <div class="course-item-row">
                <span class="course-num-gold">I.</span>
                <div class="course-desc-col">
                  <strong>Organik Köy Kahvaltısı</strong>
                  <p>Bozburun çam balı, taze keçi peynirleri ve taş fırın sıcak ekmekleri.</p>
                </div>
              </div>
              <div class="course-item-row">
                <span class="course-num-gold">II.</span>
                <div class="course-desc-col">
                  <strong>Erken Hasat Zeytinyağlılar</strong>
                  <p>Bahçemizden toplanan şifalı Ege otları ve soğuk sıkım zeytinyağı.</p>
                </div>
              </div>
              <div class="course-item-row">
                <span class="course-num-gold">III.</span>
                <div class="course-desc-col">
                  <strong>Günlük Kıyı Avı & Izgara</strong>
                  <p>Selimiye balıkçılarından günlük taze deniz balıkları ve ızgara kalamar.</p>
                </div>
              </div>
            </div>
          </div>

          <div class="gastro-video-container" data-reveal>
            <video autoplay muted loop playsinline preload="metadata" poster="./media/dining.jpg">
              <source src="./media/decor.mp4" type="video/mp4">
            </video>
          </div>

        </div>
      </div>
    </section>

    <!-- NAUTICAL COVES: BENTO RADAR -->
    <section class="v2-section" id="coves">
      <div class="container-v2">
        <div class="section-headline-center" data-reveal>
          <div class="eyebrow-pill-cyan">DESTİNASYON RADARI</div>
          <h2 class="section-title-lg">Denizcilik & Saklı Koylar</h2>
        </div>

        <div class="coves-bento-grid">
          <div class="cove-bento-card" data-reveal>
            <div class="cove-image-wrap">
              <img src="./media/jetty_hd.jpg" alt="Sığliman">
              <span class="cove-radar-badge">36°42'N 28°05'E</span>
            </div>
            <div class="cove-meta-body">
              <h3>Sığliman Koyu</h3>
              <p>Durgun göl berraklığında, sığ ve ılık suları ile Selimiye’nin en korunaklı yüzme koyu.</p>
            </div>
          </div>

          <div class="cove-bento-card" data-reveal>
            <div class="cove-image-wrap">
              <img src="./media/boat-arrival.jpg" alt="Kamelya Adası">
              <span class="cove-radar-badge">15 DK TEKNEYLE</span>
            </div>
            <div class="cove-meta-body">
              <h3>Kamelya & Dişlice</h3>
              <p>Antik manastır kalıntıları ve volkanik kaya dehlizleriyle ünlü turkuaz ada rotası.</p>
            </div>
          </div>

          <div class="cove-bento-card" data-reveal>
            <div class="cove-image-wrap">
              <img src="./media/terrace-view.jpg" alt="Karia Parkuru">
              <span class="cove-radar-badge">KARİA YOLU</span>
            </div>
            <div class="cove-meta-body">
              <h3>Antik Karia Patikaları</h3>
              <p>Adaçayı kokulu dağ yamaçlarından Selimiye Koyu’nu kuşbakışı izleyen yürüyüş rotaları.</p>
            </div>
          </div>
        </div>

      </div>
    </section>

    <!-- VIP CONCIERGE SALON -->
    <section class="v2-section" id="concierge">
      <div class="container-v2">
        <div class="vip-concierge-deck" data-reveal>
          <div class="vip-concierge-split">
            
            <div class="vip-terminal-left">
              <span class="eyebrow-pill-cyan">VIP DANIŞMA</span>
              <h2>Doğrudan<br><em class="hero-highlight-italics">Rezervasyon Terminali</em></h2>
              <p style="color:var(--text-muted); font-size:0.95rem; line-height:1.8;">
                Tarihlerinizi iletin; en avantajlı doğrudan fiyatlandırma ve kişisel transfer seçenekleriyle size anında dönüş yapalım.
              </p>

              <div class="vip-contact-lines">
                <div class="contact-line-item">
                  <strong>KONUM</strong>
                  <span>${escapeHtml(address)}</span>
                </div>
                <div class="contact-line-item">
                  <strong>RESEPSİYON TELEFON</strong>
                  <a href="tel:${escapeHtml(cleanPhone)}">${escapeHtml(phone)}</a>
                </div>
                <div class="contact-line-item">
                  <strong>WHATSAPP CANLI DANIŞMA</strong>
                  <a href="https://wa.me/${escapeHtml(cleanPhone)}?text=Merhaba%20${encodeURIComponent(name)},%20m%C3%BCsaitlik%20bilgisi%20almak%20istiyorum." target="_blank" style="color:var(--cyan-neon);">+90 Selimiye VIP Concierge ↗</a>
                </div>
              </div>
            </div>

            <div class="vip-form-terminal">
              <h3 style="font-family:var(--font-heading); color:#fff; font-size:1.4rem; margin-bottom:1.25rem;">Müsaitlik Talebi Gönder</h3>
              <form id="v2ContactForm" onsubmit="return false;">
                <div class="terminal-duo-row">
                  <div class="terminal-field-group">
                    <label>Adınız Soyadınız *</label>
                    <input type="text" id="v2Name" placeholder="Adınız Soyadınız" required>
                  </div>
                  <div class="terminal-field-group">
                    <label>Telefon Numarası *</label>
                    <input type="tel" id="v2Phone" placeholder="05XX XXX XX XX" required>
                  </div>
                </div>

                <div class="terminal-duo-row">
                  <div class="terminal-field-group">
                    <label>Giriş Tarihi *</label>
                    <input type="date" id="v2Checkin" required>
                  </div>
                  <div class="terminal-field-group">
                    <label>Çıkış Tarihi *</label>
                    <input type="date" id="v2Checkout" required>
                  </div>
                </div>

                <div class="terminal-duo-row">
                  <div class="terminal-field-group">
                    <label>Oda Tercihi</label>
                    <select id="v2Suite">
                      <option value="Tüm Koleksiyon">Tüm Odaları Göster</option>
                      ${rooms.map(r => `<option value="${escapeHtml(r.title)}">${escapeHtml(r.title)}</option>`).join('')}
                    </select>
                  </div>
                  <div class="terminal-field-group">
                    <label>Misafir Sayısı</label>
                    <select id="v2Guests">
                      <option value="2 Yetişkin">2 Yetişkin</option>
                      <option value="1 Yetişkin">1 Yetişkin</option>
                      <option value="3 Yetişkin">3 Yetişkin</option>
                      <option value="4+ Yetişkin">4+ Yetişkin / Aile</option>
                    </select>
                  </div>
                </div>

                <div class="terminal-field-group" style="margin-bottom:1.5rem;">
                  <label>Özel Talebiniz</label>
                  <textarea id="v2Notes" rows="3" placeholder="Örn: Balayı karşılama ikramı, tekne transferi, geç giriş..."></textarea>
                </div>

                <button type="button" class="btn-dock-cta" id="v2SubmitBtn" style="width:100%; justify-content:center; height:48px;">
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
  <footer class="v2-panoramic-footer">
    <div class="container-v2">
      <div class="footer-panoramic-grid">
        <div>
          <div class="footer-brand-heading">${escapeHtml(name).toUpperCase()}</div>
          <p style="color:var(--text-muted); font-size:0.88rem; line-height:1.7; margin-bottom:1rem;">
            ${escapeHtml(tagline)}
          </p>
          <small style="color:var(--text-dim); display:block;">${escapeHtml(address)}</small>
        </div>

        <div class="footer-column-nav">
          <strong>Hızlı Bağlantılar</strong>
          <a href="#suites">Koleksiyon Süitleri</a>
          <a href="#atmosphere">Koy Atmosferi</a>
          <a href="#gastronomy">Gastronomi & İskele</a>
          <a href="#coves">Koylar Rehberi</a>
          <a href="#concierge">VIP Danışma</a>
        </div>

        <div class="footer-column-nav">
          <strong>İletişim & Rezervasyon</strong>
          <a href="tel:${escapeHtml(cleanPhone)}">📞 ${escapeHtml(phone)}</a>
          <a href="https://wa.me/${escapeHtml(cleanPhone)}" target="_blank">💬 WhatsApp Canlı Hattı</a>
          <span style="color:var(--text-dim); font-size:0.82rem; margin-top:0.5rem;">7/24 Misafir Karşılama</span>
        </div>
      </div>

      <div class="footer-bottom-line">
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
