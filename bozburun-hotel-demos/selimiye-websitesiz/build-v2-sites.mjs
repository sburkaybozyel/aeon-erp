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
// LUMINOUS AEGEAN LIQUID GLASS CSS FOR V2
// ============================================================================
function generateV2LiquidCSS() {
  return `/* ==========================================================================
   SELİMİYE HOTELS — LUMINOUS AEGEAN LIQUID GLASS & HAUTE LUXURY (V2)
   ========================================================================== */

:root {
  --bg-deep: #02070e;
  --bg-surface: #06111e;
  --bg-card: rgba(8, 20, 36, 0.65);
  --bg-card-heavy: rgba(5, 14, 26, 0.85);
  --bg-glass-input: rgba(12, 28, 48, 0.7);

  --font-serif: 'Cormorant Garamond', Georgia, serif;
  --font-heading: 'Cinzel', 'Playfair Display', Georgia, serif;
  --font-sans: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;

  --cyan-luminous: #00f2fe;
  --cyan-gradient: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  --gold-primary: #d4af37;
  --gold-light: #fef0c7;
  --gold-gradient: linear-gradient(135deg, #fff2cc 0%, #e2c174 40%, #c59b3f 75%, #8c6721 100%);
  --gold-glow: rgba(212, 175, 55, 0.3);

  --border-glass: rgba(255, 255, 255, 0.12);
  --border-cyan: rgba(0, 242, 254, 0.3);
  --border-gold: rgba(212, 175, 55, 0.35);

  --text-main: #f8fafc;
  --text-muted: #94a3b8;
  --text-dim: #64748b;

  --shadow-liquid: 0 25px 60px -15px rgba(0, 0, 0, 0.7), 0 0 30px rgba(0, 242, 254, 0.05);
  --shadow-glow: 0 0 40px rgba(0, 242, 254, 0.18);
  --shadow-gold: 0 0 35px rgba(212, 175, 55, 0.25);

  --blur-heavy: blur(28px) saturate(190%);
  --blur-medium: blur(16px) saturate(160%);

  --radius-xs: 6px;
  --radius-sm: 10px;
  --radius-md: 18px;
  --radius-lg: 28px;
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

/* Ambient Fluid Orbs */
.ambient-orb {
  position: fixed;
  border-radius: 50%;
  pointer-events: none;
  z-index: 0;
  filter: blur(120px);
  opacity: 0.35;
  animation: orbFloat 20s ease-in-out infinite alternate;
}
.orb-cyan {
  top: -10vh;
  left: 10vw;
  width: 55vw;
  height: 55vw;
  background: radial-gradient(circle, rgba(0, 242, 254, 0.25) 0%, rgba(79, 172, 254, 0.05) 70%, transparent 100%);
}
.orb-gold {
  top: 45vh;
  right: -10vw;
  width: 50vw;
  height: 50vw;
  background: radial-gradient(circle, rgba(212, 175, 55, 0.2) 0%, rgba(200, 150, 40, 0.04) 70%, transparent 100%);
  animation-delay: -7s;
}
.orb-deep {
  bottom: -15vh;
  left: 20vw;
  width: 60vw;
  height: 60vw;
  background: radial-gradient(circle, rgba(14, 165, 233, 0.18) 0%, transparent 70%);
  animation-delay: -12s;
}
@keyframes orbFloat {
  0% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(40px, -30px) scale(1.06); }
  100% { transform: translate(-30px, 40px) scale(0.95); }
}

.container-liquid {
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 2rem;
  position: relative;
  z-index: 2;
}

/* Liquid Floating Header Island */
.v2-header {
  position: sticky;
  top: 0;
  z-index: 100;
  padding: 1.1rem 0;
  transition: var(--transition);
}
.v2-header.scrolled {
  padding: 0.6rem 0;
}
.header-island {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0.65rem 1.75rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--bg-card-heavy);
  backdrop-filter: var(--blur-heavy);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-full);
  box-shadow: var(--shadow-liquid);
}

.brand-capsule-link {
  display: flex;
  align-items: center;
  gap: 1rem;
  text-decoration: none;
}
.brand-logo-frame {
  width: 58px;
  height: 58px;
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 25px rgba(0, 242, 254, 0.25), 0 0 15px rgba(212, 175, 55, 0.3);
  transition: var(--transition);
}
.brand-logo-frame:hover {
  transform: scale(1.06) rotate(3deg);
  box-shadow: 0 0 35px rgba(0, 242, 254, 0.45);
}
.brand-logo-frame svg {
  width: 100%;
  height: 100%;
  display: block;
}

.brand-text-col {
  display: flex;
  flex-direction: column;
}
.brand-title {
  font-family: var(--font-heading);
  font-size: 1.15rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: #ffffff;
  line-height: 1.2;
}
.brand-sub {
  font-size: 0.68rem;
  letter-spacing: 0.22em;
  background: var(--gold-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  text-transform: uppercase;
  font-weight: 700;
}

.v2-nav-links {
  display: flex;
  align-items: center;
  gap: 1.6rem;
}
.v2-link {
  font-size: 0.88rem;
  color: #cbd5e1;
  text-decoration: none;
  font-weight: 500;
  letter-spacing: 0.04em;
  transition: var(--transition);
  position: relative;
  padding: 0.4rem 0;
}
.v2-link:hover {
  color: #ffffff;
}
.v2-link::after {
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
.v2-link:hover::after {
  width: 100%;
}

.header-action-dock {
  display: flex;
  align-items: center;
  gap: 1rem;
}
.btn-live-pulse {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(0, 242, 254, 0.08);
  border: 1px solid var(--border-cyan);
  padding: 0.45rem 1rem;
  border-radius: var(--radius-full);
  color: var(--cyan-luminous);
  font-size: 0.78rem;
  font-weight: 600;
  text-decoration: none;
  transition: var(--transition);
}
.btn-live-pulse:hover {
  background: rgba(0, 242, 254, 0.16);
  box-shadow: 0 0 20px rgba(0, 242, 254, 0.3);
}
.live-dot {
  width: 8px;
  height: 8px;
  background: var(--cyan-luminous);
  border-radius: 50%;
  box-shadow: 0 0 10px var(--cyan-luminous);
  animation: pulseBeacon 2s infinite;
}
@keyframes pulseBeacon {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.75); }
}

.btn-liquid-book {
  background: var(--gold-gradient);
  color: #040810;
  border: none;
  font-family: var(--font-sans);
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  padding: 0.65rem 1.4rem;
  border-radius: var(--radius-full);
  cursor: pointer;
  box-shadow: var(--shadow-gold);
  transition: var(--transition);
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.btn-liquid-book:hover {
  transform: translateY(-2px) scale(1.02);
  box-shadow: 0 0 35px rgba(212, 175, 55, 0.5);
}

/* HERO: Luminous Kinetic Canvas */
.hero-liquid-cinematic {
  position: relative;
  min-height: 92vh;
  display: flex;
  align-items: center;
  padding: 7rem 0 5rem;
  overflow: hidden;
}
.hero-backdrop-wrap {
  position: absolute;
  inset: 0;
  z-index: 0;
}
.hero-backdrop-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  animation: cinematicKenBurns 24s ease-out infinite alternate;
}
@keyframes cinematicKenBurns {
  0% { transform: scale(1.02); }
  100% { transform: scale(1.09); }
}
.hero-backdrop-overlay {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at center, rgba(2, 7, 14, 0.35) 0%, rgba(2, 7, 14, 0.85) 75%, var(--bg-deep) 100%);
}

.hero-liquid-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  z-index: 2;
}
.hero-badge-pill {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  background: rgba(6, 18, 32, 0.8);
  backdrop-filter: var(--blur-medium);
  border: 1px solid var(--border-cyan);
  padding: 0.5rem 1.4rem;
  border-radius: var(--radius-full);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.15em;
  color: #ffffff;
  margin-bottom: 2rem;
  box-shadow: var(--shadow-glow);
}
.pill-beacon {
  width: 8px;
  height: 8px;
  background: var(--cyan-luminous);
  border-radius: 50%;
  box-shadow: 0 0 12px var(--cyan-luminous);
}
.pill-accent {
  background: var(--gold-gradient);
  color: #000;
  font-size: 0.68rem;
  font-weight: 800;
  padding: 2px 8px;
  border-radius: var(--radius-full);
}

.hero-liquid-title {
  font-family: var(--font-heading);
  font-size: clamp(2.5rem, 5.8vw, 4.6rem);
  font-weight: 700;
  line-height: 1.15;
  color: #ffffff;
  margin-bottom: 1.5rem;
  text-shadow: 0 4px 30px rgba(0, 0, 0, 0.9);
}
.hero-highlight-cyan {
  font-family: var(--font-serif);
  font-style: italic;
  font-weight: 400;
  background: var(--gold-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.hero-liquid-lead {
  max-width: 840px;
  font-size: 1.15rem;
  color: #cbd5e1;
  line-height: 1.8;
  margin-bottom: 3.25rem;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.8);
}

/* Floating Glass Dock */
.liquid-dock-card {
  width: 100%;
  max-width: 1080px;
  background: rgba(8, 22, 38, 0.75);
  backdrop-filter: var(--blur-heavy);
  border: 1px solid var(--border-cyan);
  border-radius: var(--radius-lg);
  padding: 1.5rem 2rem;
  box-shadow: var(--shadow-liquid), var(--shadow-glow);
}
.dock-fields-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr) auto;
  gap: 1.25rem;
  align-items: center;
}
.dock-cell {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  text-align: left;
}
.dock-cell label {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--cyan-luminous);
  text-transform: uppercase;
}
.dock-input, .dock-select {
  background: var(--bg-glass-input);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: var(--radius-sm);
  padding: 0.65rem 0.85rem;
  color: #ffffff;
  font-family: var(--font-sans);
  font-size: 0.9rem;
  outline: none;
  transition: var(--transition);
}
.dock-input:focus, .dock-select:focus {
  border-color: var(--cyan-luminous);
  box-shadow: 0 0 15px rgba(0, 242, 254, 0.25);
}

.btn-dock-submit {
  background: var(--gold-gradient);
  color: #040810;
  border: none;
  font-family: var(--font-sans);
  font-size: 0.88rem;
  font-weight: 700;
  padding: 0.85rem 1.6rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  box-shadow: var(--shadow-gold);
  transition: var(--transition);
}
.btn-dock-submit:hover {
  transform: translateY(-2px);
  box-shadow: 0 0 30px rgba(212, 175, 55, 0.5);
}

/* Sections Common */
.v2-section {
  padding: 7rem 0;
  position: relative;
  z-index: 2;
}
.section-center-head {
  text-align: center;
  max-width: 820px;
  margin: 0 auto 4rem;
}
.eyebrow-cyan-pill {
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
  color: var(--cyan-luminous);
  margin-bottom: 1.25rem;
}
.section-headline {
  font-family: var(--font-heading);
  font-size: clamp(2rem, 4vw, 3.2rem);
  font-weight: 700;
  line-height: 1.2;
  color: #ffffff;
  margin-bottom: 1.25rem;
}
.section-lead {
  font-size: 1.05rem;
  color: var(--text-muted);
  line-height: 1.8;
}

/* Story Liquid Glass Grid */
.story-liquid-grid {
  display: grid;
  grid-template-columns: 1.15fr 1fr;
  gap: 4rem;
  align-items: center;
}
.story-glass-card {
  background: var(--bg-card);
  backdrop-filter: var(--blur-heavy);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-lg);
  padding: 3rem;
  box-shadow: var(--shadow-liquid);
}
.story-lead-text {
  font-size: 1.18rem;
  color: #ffffff;
  line-height: 1.75;
  margin-bottom: 1.5rem;
}
.story-body-text {
  font-size: 0.96rem;
  color: var(--text-muted);
  line-height: 1.8;
  margin-bottom: 2rem;
}
.story-pillars-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.25rem;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding-top: 2rem;
}
.pillar-row {
  display: flex;
  gap: 1.2rem;
  align-items: flex-start;
}
.pillar-badge {
  background: rgba(0, 242, 254, 0.12);
  color: var(--cyan-luminous);
  border: 1px solid var(--border-cyan);
  font-family: var(--font-heading);
  font-weight: 700;
  font-size: 0.85rem;
  padding: 4px 10px;
  border-radius: var(--radius-xs);
}

.story-visual-frame {
  position: relative;
  border-radius: var(--radius-lg);
  overflow: hidden;
  border: 1px solid var(--border-cyan);
  box-shadow: var(--shadow-liquid), var(--shadow-glow);
}
.story-visual-frame img {
  width: 100%;
  height: 480px;
  object-fit: cover;
  display: block;
}
.story-visual-overlay-badge {
  position: absolute;
  bottom: 1.5rem;
  left: 1.5rem;
  right: 1.5rem;
  background: rgba(4, 12, 22, 0.88);
  backdrop-filter: var(--blur-medium);
  border: 1px solid var(--border-gold);
  padding: 1rem 1.4rem;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-gold);
}

/* Suites Luminous Deck */
.suites-liquid-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 2.5rem;
}
.suite-liquid-card {
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
.suite-liquid-card:hover {
  border-color: var(--cyan-luminous);
  transform: translateY(-8px);
  box-shadow: 0 30px 80px -15px rgba(0, 0, 0, 0.9), var(--shadow-glow);
}
.suite-img-wrap {
  position: relative;
  height: 320px;
  overflow: hidden;
}
.suite-img-wrap img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.8s ease;
}
.suite-liquid-card:hover .suite-img-wrap img {
  transform: scale(1.06);
}
.suite-tag-pill {
  position: absolute;
  top: 1.25rem;
  left: 1.25rem;
  background: rgba(2, 7, 14, 0.85);
  backdrop-filter: var(--blur-medium);
  border: 1px solid var(--border-gold);
  color: var(--gold-light);
  font-size: 0.72rem;
  font-weight: 700;
  padding: 4px 12px;
  border-radius: var(--radius-full);
}
.suite-specs-capsule {
  position: absolute;
  bottom: 1.25rem;
  left: 1.25rem;
  right: 1.25rem;
  background: rgba(4, 14, 26, 0.85);
  backdrop-filter: var(--blur-medium);
  border: 1px solid var(--border-glass);
  padding: 0.6rem 1rem;
  border-radius: var(--radius-full);
  display: flex;
  justify-content: space-around;
  font-size: 0.75rem;
  color: #ffffff;
}

.suite-body-content {
  padding: 2.25rem;
  display: flex;
  flex-direction: column;
  flex: 1;
}
.suite-card-title {
  font-family: var(--font-heading);
  font-size: 1.45rem;
  color: #ffffff;
  margin-bottom: 0.6rem;
}
.suite-card-desc {
  font-size: 0.92rem;
  color: var(--text-muted);
  line-height: 1.7;
  margin-bottom: 1.5rem;
}
.suite-amenities-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  margin-bottom: 2rem;
}
.amenity-chip {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border-glass);
  padding: 4px 10px;
  border-radius: var(--radius-xs);
  font-size: 0.76rem;
  color: #cbd5e1;
}
.suite-card-footer {
  margin-top: auto;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding-top: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.btn-reserve-suite {
  background: var(--gold-gradient);
  color: #040810;
  border: none;
  font-family: var(--font-sans);
  font-size: 0.84rem;
  font-weight: 700;
  padding: 0.65rem 1.4rem;
  border-radius: var(--radius-full);
  cursor: pointer;
  transition: var(--transition);
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.btn-reserve-suite:hover {
  transform: translateY(-2px);
  box-shadow: 0 0 25px rgba(212, 175, 55, 0.5);
}

/* Day to Night Rituals */
.rituals-liquid-deck {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2rem;
}
.ritual-glass-card {
  background: var(--bg-card);
  backdrop-filter: var(--blur-heavy);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-lg);
  padding: 2.25rem;
  box-shadow: var(--shadow-liquid);
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
  height: 3px;
  background: var(--cyan-gradient);
  opacity: 0.6;
}
.ritual-glass-card:hover {
  border-color: var(--cyan-luminous);
  transform: translateY(-6px);
  box-shadow: var(--shadow-glow);
}
.ritual-timestamp {
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--cyan-luminous);
  text-transform: uppercase;
  margin-bottom: 0.8rem;
  display: block;
}
.ritual-glass-card h4 {
  font-family: var(--font-heading);
  font-size: 1.3rem;
  color: #ffffff;
  margin-bottom: 0.65rem;
}
.ritual-glass-card p {
  font-size: 0.9rem;
  color: var(--text-muted);
  line-height: 1.7;
}

/* Gastronomy Box */
.gastronomy-liquid-box {
  display: grid;
  grid-template-columns: 1fr 1.15fr;
  gap: 4rem;
  align-items: center;
}
.degustation-glass-card {
  background: var(--bg-card);
  backdrop-filter: var(--blur-heavy);
  border: 1px solid var(--border-gold);
  border-radius: var(--radius-lg);
  padding: 2.5rem;
  box-shadow: var(--shadow-liquid), var(--shadow-gold);
}
.degustation-header {
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 1.25rem;
  margin-bottom: 1.75rem;
}
.degustation-header h3 {
  font-family: var(--font-heading);
  font-size: 1.6rem;
  color: #ffffff;
}
.degustation-courses {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}
.course-row {
  display: flex;
  gap: 1.25rem;
}
.course-num-roman {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 1.6rem;
  color: var(--gold-light);
  line-height: 1;
}
.course-info strong {
  display: block;
  font-family: var(--font-heading);
  font-size: 1.05rem;
  color: #ffffff;
  margin-bottom: 2px;
}
.course-info p {
  font-size: 0.88rem;
  color: var(--text-muted);
}

.gastro-video-frame {
  border-radius: var(--radius-lg);
  overflow: hidden;
  border: 1px solid var(--border-cyan);
  box-shadow: var(--shadow-liquid), var(--shadow-glow);
}
.gastro-video-frame video {
  width: 100%;
  height: 400px;
  object-fit: cover;
  display: block;
}

/* Nautical Coves */
.coves-liquid-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2rem;
}
.cove-glass-card {
  background: var(--bg-card);
  backdrop-filter: var(--blur-heavy);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-liquid);
  transition: var(--transition);
}
.cove-glass-card:hover {
  border-color: var(--cyan-luminous);
  transform: translateY(-6px);
  box-shadow: var(--shadow-glow);
}
.cove-img-box {
  position: relative;
  height: 220px;
}
.cove-img-box img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.cove-coord-tag {
  position: absolute;
  top: 1rem;
  left: 1rem;
  background: rgba(2, 7, 14, 0.85);
  backdrop-filter: var(--blur-medium);
  border: 1px solid var(--border-cyan);
  color: var(--cyan-luminous);
  font-size: 0.72rem;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: var(--radius-full);
}
.cove-card-body {
  padding: 1.75rem;
}
.cove-card-body h3 {
  font-family: var(--font-heading);
  font-size: 1.25rem;
  color: #ffffff;
  margin-bottom: 0.5rem;
}
.cove-card-body p {
  font-size: 0.88rem;
  color: var(--text-muted);
}

/* VIP Reservation Salon */
.vip-salon-card {
  background: var(--bg-card-heavy);
  backdrop-filter: var(--blur-heavy);
  border: 1px solid var(--border-cyan);
  border-radius: var(--radius-lg);
  padding: 3.5rem;
  box-shadow: var(--shadow-liquid), var(--shadow-glow);
}
.vip-salon-layout {
  display: grid;
  grid-template-columns: 1fr 1.15fr;
  gap: 4rem;
}
.vip-salon-left h2 {
  font-family: var(--font-heading);
  font-size: 2.2rem;
  color: #ffffff;
  margin-bottom: 1rem;
}
.vip-contacts-stack {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  margin: 2rem 0;
}
.vip-contact-row strong {
  display: block;
  font-size: 0.75rem;
  color: var(--cyan-luminous);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.vip-contact-row span, .vip-contact-row a {
  color: #ffffff;
  font-size: 0.95rem;
  text-decoration: none;
}

.vip-form-box {
  background: rgba(8, 20, 36, 0.75);
  border: 1px solid var(--border-glass);
  padding: 2.25rem;
  border-radius: var(--radius-md);
}
.form-duo-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1rem;
}
.form-group-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.form-group-field label {
  font-size: 0.74rem;
  font-weight: 700;
  color: var(--text-muted);
}
.form-group-field input, .form-group-field select, .form-group-field textarea {
  background: var(--bg-glass-input);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: var(--radius-sm);
  padding: 0.65rem 0.85rem;
  color: #ffffff;
  font-family: var(--font-sans);
  font-size: 0.9rem;
  outline: none;
}
.form-group-field input:focus, .form-group-field select:focus, .form-group-field textarea:focus {
  border-color: var(--cyan-luminous);
  box-shadow: 0 0 15px rgba(0, 242, 254, 0.25);
}

/* Footer */
.v2-footer {
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding: 4.5rem 0 3rem;
  position: relative;
  z-index: 2;
  background: #010408;
}
.footer-liquid-grid {
  display: grid;
  grid-template-columns: 1.5fr 1fr 1fr;
  gap: 3rem;
  margin-bottom: 3.5rem;
}
.footer-brand-title {
  font-family: var(--font-heading);
  font-size: 1.3rem;
  color: #ffffff;
  margin-bottom: 0.75rem;
}
.footer-links-col {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}
.footer-links-col strong {
  font-size: 0.78rem;
  letter-spacing: 0.1em;
  color: var(--cyan-luminous);
  text-transform: uppercase;
  margin-bottom: 0.5rem;
}
.footer-links-col a {
  color: var(--text-muted);
  text-decoration: none;
  font-size: 0.9rem;
  transition: var(--transition);
}
.footer-links-col a:hover {
  color: #ffffff;
}
.footer-copyright-bar {
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  padding-top: 2rem;
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
  color: var(--text-dim);
}

@media (max-width: 1024px) {
  .v2-nav-links, .header-action-dock .btn-live-pulse { display: none; }
  .story-liquid-grid, .gastronomy-liquid-box, .vip-salon-layout { grid-template-columns: 1fr; gap: 3rem; }
  .suites-liquid-grid, .rituals-liquid-deck, .coves-liquid-grid { grid-template-columns: 1fr; }
  .dock-fields-grid { grid-template-columns: 1fr 1fr; }
  .btn-dock-submit { grid-column: span 2; }
  .footer-liquid-grid { grid-template-columns: 1fr 1fr; }
}

@media (max-width: 640px) {
  .dock-fields-grid { grid-template-columns: 1fr; }
  .btn-dock-submit { grid-column: span 1; }
  .form-duo-row { grid-template-columns: 1fr; }
  .vip-salon-card { padding: 1.75rem; }
  .footer-liquid-grid { grid-template-columns: 1fr; }
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
  <title>${escapeHtml(name)} — Selimiye | Luminous Liquid Glass Luxury (V2)</title>
  
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700;800&family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  
  <link rel="stylesheet" href="./styles.css">
  <script defer src="./app.js"></script>
</head>
<body class="v2-liquid-luminous" data-phone="${escapeHtml(cleanPhone)}" data-hotel="${escapeHtml(name)}">

  <!-- Ambient Fluid Orbs -->
  <div class="ambient-orb orb-cyan" aria-hidden="true"></div>
  <div class="ambient-orb orb-gold" aria-hidden="true"></div>
  <div class="ambient-orb orb-deep" aria-hidden="true"></div>

  <!-- FLOATING LIQUID ISLAND HEADER -->
  <header class="v2-header" id="v2Header">
    <div class="header-island">
      
      <a href="#top" class="brand-capsule-link">
        <div class="brand-logo-frame">
          ${getLuxuryEmblem(slug, name, true)}
        </div>
        <div class="brand-text-col">
          <span class="brand-title">${escapeHtml(name).toUpperCase()}</span>
          <span class="brand-sub">SELİMİYE · MARMARİS</span>
        </div>
      </a>

      <nav class="v2-nav-links">
        <a href="#story" class="v2-link">Felsefe</a>
        <a href="#residences" class="v2-link">Süitler & Odalar</a>
        <a href="#rituals" class="v2-link">Günün Akışı</a>
        <a href="#gastronomy" class="v2-link">Gastronomi</a>
        <a href="#coves" class="v2-link">Koylar</a>
        <a href="#concierge" class="v2-link">VIP İletişim</a>
      </nav>

      <div class="header-action-dock">
        <a href="tel:${escapeHtml(cleanPhone)}" class="btn-live-pulse">
          <span class="live-dot"></span>
          <span>📞 ${escapeHtml(phone)}</span>
        </a>
        <button class="btn-liquid-book" data-book>
          <span>Rezervasyon</span>
          <i>↗</i>
        </button>
      </div>

    </div>
  </header>

  <main id="top">
    
    <!-- KINETIC LIQUID HERO -->
    <section class="hero-liquid-cinematic">
      <div class="hero-backdrop-wrap">
        <img src="./media/hero.jpg" alt="${escapeHtml(name)} Selimiye Panoraması" class="hero-backdrop-img">
        <div class="hero-backdrop-overlay"></div>
      </div>

      <div class="container-liquid hero-liquid-content">
        <div class="hero-badge-pill" data-reveal>
          <span class="pill-beacon"></span>
          <span>SELİMİYE KOYU · ÖZEL İSKELE</span>
          <span class="pill-accent">LUMINOUS GLASS EDITION</span>
        </div>

        <h1 class="hero-liquid-title" data-reveal>
          Kristal Suların Kıyısında,<br>
          <em class="hero-highlight-cyan">${escapeHtml(tagline)}</em>
        </h1>

        <p class="hero-liquid-lead" data-reveal>
          ${escapeHtml(name)}; Selimiye’nin dingin turkuaz koyunda, akışkan cam mimari ve doğal taş dokuların kusursuz sükunetiyle buluştuğu çağdaş bir Ege inzivası sunar.
        </p>

        <!-- Floating Glass Booking Dock -->
        <div class="liquid-dock-card" data-reveal>
          <form class="dock-fields-grid" onsubmit="return false;">
            <div class="dock-cell">
              <label>GİRİŞ TARİHİ</label>
              <input type="date" id="heroCheckin" class="dock-input" required>
            </div>
            <div class="dock-cell">
              <label>ÇIKIŞ TARİHİ</label>
              <input type="date" id="heroCheckout" class="dock-input" required>
            </div>
            <div class="dock-cell">
              <label>MİSAFİR</label>
              <select id="heroGuests" class="dock-select">
                <option value="2 Yetişkin">2 Yetişkin</option>
                <option value="1 Yetişkin">1 Yetişkin</option>
                <option value="3 Yetişkin">3 Yetişkin</option>
                <option value="4+ Yetişkin">4+ Yetişkin / Aile</option>
              </select>
            </div>
            <div class="dock-cell">
              <label>SÜİT TERCİHİ</label>
              <select id="heroSuite" class="dock-select">
                <option value="all">Tüm Koleksiyon</option>
                ${rooms.map(r => `<option value="${escapeHtml(r.title)}">${escapeHtml(r.title)}</option>`).join('')}
              </select>
            </div>
            <button type="button" class="btn-dock-submit" id="heroSubmitBtn">
              <span>Müsaitlik Sorgula →</span>
            </button>
          </form>
        </div>

      </div>
    </section>

    <!-- STORY & PHILOSOPHY -->
    <section class="v2-section" id="story">
      <div class="container-liquid">
        <div class="story-liquid-grid">
          
          <div data-reveal>
            <div class="eyebrow-cyan-pill">01. FELSEFE & MİMARİ</div>
            <h2 class="section-headline">Taşın Serinliğinde,<br><em class="hero-highlight-cyan">Yavaşlayan Bir Ege Hikayesi.</em></h2>
            
            <div class="story-glass-card">
              <p class="story-lead-text">
                ${escapeHtml(name)}, modern telaşlardan arınmış, doğanın kendi ritmine teslim olan bir yaşam alanıdır. Selimiye’nin antik zeytinlikleri ve kristal suları arasına yerleşen taş mimarimiz, çağdaş lüks duygusuyla harmanlanır.
              </p>
              <p class="story-body-text">
                Burada lüks; gösterişte değil, sabahın ilk ışıklarıyla iskeleden denize dalmanın ve kıyıda dalga sesleri eşliğinde kurulan sofraların dinginliğinde gizlidir.
              </p>

              <div class="story-pillars-grid">
                <div class="pillar-row">
                  <span class="pillar-badge">01</span>
                  <div>
                    <strong style="color:#fff; display:block;">İzole Kıyı Mahremiyeti:</strong>
                    <span style="color:var(--text-muted); font-size:0.88rem;">Sınırlı sayıda süit ile dingin ve kişiselleştirilmiş konaklama.</span>
                  </div>
                </div>
                <div class="pillar-row">
                  <span class="pillar-badge">02</span>
                  <div>
                    <strong style="color:#fff; display:block;">Özel Ahşap İskele:</strong>
                    <span style="color:var(--text-muted); font-size:0.88rem;">Doğrudan denize açılan geniş şezlong ve dinlenme platformu.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="story-visual-frame" data-reveal>
            <img src="./media/suite_hd.jpg" alt="Taş Mimari">
            <div class="story-visual-overlay-badge">
              <strong style="display:block; color:#fff; font-size:1.1rem;">${escapeHtml(name)}</strong>
              <small style="color:var(--cyan-luminous);">${escapeHtml(address)}</small>
            </div>
          </div>

        </div>
      </div>
    </section>

    <!-- SUITES & RESIDENCES -->
    <section class="v2-section" id="residences" style="background: rgba(4, 12, 22, 0.45);">
      <div class="container-liquid">
        
        <div class="section-center-head" data-reveal>
          <div class="eyebrow-cyan-pill">02. REZİDANSLAR & SÜİTLER</div>
          <h2 class="section-headline">Seçkin Süit Koleksiyonu</h2>
          <p class="section-lead">Her biri bağımsız teras, keten tekstiller ve panoramik koy manzarası sunan özel konaklama alanları.</p>
        </div>

        <div class="suites-liquid-grid">
          ${rooms.map((room, idx) => `
            <article class="suite-liquid-card" data-reveal>
              <div class="suite-img-wrap">
                <img src="${idx === 0 ? './media/suite.jpg' : './media/room.jpg'}" alt="${escapeHtml(room.title)}">
                <span class="suite-tag-pill">${escapeHtml(room.badge || 'Özel Seri')}</span>
                <div class="suite-specs-capsule">
                  <span>📐 ${escapeHtml(room.size || '36 m²')}</span>
                  <span>🌊 ${escapeHtml(room.view || 'Deniz & Avlu')}</span>
                  <span>🛏️ ${escapeHtml(room.bed || 'King Size')}</span>
                </div>
              </div>
              <div class="suite-body-content">
                <h3 class="suite-card-title">${escapeHtml(room.title)}</h3>
                <p class="suite-card-desc">${escapeHtml(room.desc || 'Ferah banyo, doğal keten dokular ve dingin koy manzarası.')}</p>
                <div class="suite-amenities-list">
                  <span class="amenity-chip">✦ Özel Teras</span>
                  <span class="amenity-chip">✦ Yağmur Duşu</span>
                  <span class="amenity-chip">✦ Sessiz İklimlendirme</span>
                  <span class="amenity-chip">✦ Wi-Fi 6</span>
                </div>
                <div class="suite-card-footer">
                  <span style="font-size:0.8rem; color:var(--cyan-luminous); font-weight:700;">EN İYİ FİYAT GARANTİSİ</span>
                  <button class="btn-reserve-suite" data-suite-name="${escapeHtml(room.title)}">
                    <span>Rezerve Et</span> <i>↗</i>
                  </button>
                </div>
              </div>
            </article>
          `).join('')}
        </div>

      </div>
    </section>

    <!-- RITUALS (GÜNÜN AKIŞI) -->
    <section class="v2-section" id="rituals">
      <div class="container-liquid">
        <div class="section-center-head" data-reveal>
          <div class="eyebrow-cyan-pill">03. GÜNÜN AKIŞI</div>
          <h2 class="section-headline">Selimiye Koyu’nun Ritmi</h2>
          <p class="section-lead">Acele etmeden, her saatin tadını çıkararak yaşanan dingin bir günün anatomisi.</p>
        </div>

        <div class="rituals-liquid-deck">
          ${rituals.map(r => `
            <div class="ritual-glass-card" data-reveal>
              <span class="ritual-timestamp">${escapeHtml(r.time)}</span>
              <h4>${escapeHtml(r.title)}</h4>
              <p>${escapeHtml(r.desc)}</p>
            </div>
          `).join('')}
        </div>
      </div>
    </section>

    <!-- GASTRONOMY -->
    <section class="v2-section" id="gastronomy" style="background: rgba(4, 12, 22, 0.45);">
      <div class="container-liquid">
        <div class="gastronomy-liquid-box">
          
          <div class="degustation-glass-card" data-reveal>
            <div class="degustation-header">
              <span class="eyebrow-cyan-pill" style="margin-bottom:0.5rem;">BAHÇEDEN & DENİZDEN</span>
              <h3>Tadım Sofrası & Gastronomi</h3>
            </div>
            <div class="degustation-courses">
              <div class="course-row">
                <span class="course-num-roman">I.</span>
                <div class="course-info">
                  <strong>Organik Köy Kahvaltısı</strong>
                  <p>Bozburun çam balı, taze keçi peynirleri ve taş fırın ekmekleri.</p>
                </div>
              </div>
              <div class="course-row">
                <span class="course-num-roman">II.</span>
                <div class="course-info">
                  <strong>Erken Hasat Zeytinyağlılar</strong>
                  <p>Bahçemizden toplanan şifalı otlar ve soğuk sıkım zeytinyağı.</p>
                </div>
              </div>
              <div class="course-row">
                <span class="course-num-roman">III.</span>
                <div class="course-info">
                  <strong>Günlük Kıyı Avı & Izgara</strong>
                  <p>Selimiye balıkçılarından günlük taze deniz balıkları ve kalamar.</p>
                </div>
              </div>
            </div>
          </div>

          <div class="gastro-video-frame" data-reveal>
            <video autoplay muted loop playsinline preload="metadata" poster="./media/dining.jpg">
              <source src="./media/decor.mp4" type="video/mp4">
            </video>
          </div>

        </div>
      </div>
    </section>

    <!-- DESTINATION & COVES -->
    <section class="v2-section" id="coves">
      <div class="container-liquid">
        <div class="section-center-head" data-reveal>
          <div class="eyebrow-cyan-pill">04. DESTİNASYON REHBERİ</div>
          <h2 class="section-headline">Denizcilik & Saklı Koylar</h2>
        </div>

        <div class="coves-liquid-grid">
          <div class="cove-glass-card" data-reveal>
            <div class="cove-img-box">
              <img src="./media/jetty_hd.jpg" alt="Sığliman">
              <span class="cove-coord-tag">36°42'N 28°05'E</span>
            </div>
            <div class="cove-card-body">
              <h3>Sığliman Koyu</h3>
              <p>Durgun göl berraklığında, sığ ve ılık suları ile Selimiye’nin en korunaklı yüzme koyu.</p>
            </div>
          </div>

          <div class="cove-glass-card" data-reveal>
            <div class="cove-img-box">
              <img src="./media/boat-arrival.jpg" alt="Kamelya Adası">
              <span class="cove-coord-tag">15 DK TEKNEYLE</span>
            </div>
            <div class="cove-card-body">
              <h3>Kamelya & Dişlice</h3>
              <p>Antik manastır kalıntıları ve volkanik kaya dehlizleriyle ünlü turkuaz ada rotası.</p>
            </div>
          </div>

          <div class="cove-glass-card" data-reveal>
            <div class="cove-img-box">
              <img src="./media/terrace-view.jpg" alt="Karia Parkuru">
              <span class="cove-coord-tag">KARİA YOLU</span>
            </div>
            <div class="cove-card-body">
              <h3>Antik Karia Patikaları</h3>
              <p>Adaçayı kokulu dağ yamaçlarından Selimiye Koyu’nu kuşbakışı izleyen yürüyüş rotaları.</p>
            </div>
          </div>
        </div>

      </div>
    </section>

    <!-- CONCIERGE & VIP RESERVATION SALON -->
    <section class="v2-section" id="concierge">
      <div class="container-liquid">
        <div class="vip-salon-card" data-reveal>
          <div class="vip-salon-layout">
            
            <div class="vip-salon-left">
              <span class="eyebrow-cyan-pill">DOĞRUDAN İLETİŞİM</span>
              <h2>Kişiselleştirilmiş<br><em class="hero-highlight-cyan">Rezervasyon & Danışma</em></h2>
              <p style="color:var(--text-muted); font-size:0.95rem; line-height:1.75;">
                Tarihlerinizi iletin; en avantajlı doğrudan fiyatlandırma ve kişisel transfer seçenekleriyle size anında dönüş yapalım.
              </p>

              <div class="vip-contacts-stack">
                <div class="vip-contact-row">
                  <strong>KONUM</strong>
                  <span>${escapeHtml(address)}</span>
                </div>
                <div class="vip-contact-row">
                  <strong>RESEPSİYON TELEFON</strong>
                  <a href="tel:${escapeHtml(cleanPhone)}">${escapeHtml(phone)}</a>
                </div>
                <div class="vip-contact-row">
                  <strong>WHATSAPP CANLI DANIŞMA</strong>
                  <a href="https://wa.me/${escapeHtml(cleanPhone)}?text=Merhaba%20${encodeURIComponent(name)},%20m%C3%BCsaitlik%20bilgisi%20almak%20istiyorum." target="_blank" style="color:var(--cyan-luminous);">+90 Selimiye VIP Concierge ↗</a>
                </div>
              </div>
            </div>

            <div class="vip-form-box">
              <h3 style="font-family:var(--font-heading); color:#fff; font-size:1.35rem; margin-bottom:1rem;">Müsaitlik Talebi Gönder</h3>
              <form id="v2ContactForm" onsubmit="return false;">
                <div class="form-duo-row">
                  <div class="form-group-field">
                    <label>Adınız Soyadınız *</label>
                    <input type="text" id="v2Name" placeholder="Adınız Soyadınız" required>
                  </div>
                  <div class="form-group-field">
                    <label>Telefon Numarası *</label>
                    <input type="tel" id="v2Phone" placeholder="05XX XXX XX XX" required>
                  </div>
                </div>

                <div class="form-duo-row">
                  <div class="form-group-field">
                    <label>Giriş Tarihi *</label>
                    <input type="date" id="v2Checkin" required>
                  </div>
                  <div class="form-group-field">
                    <label>Çıkış Tarihi *</label>
                    <input type="date" id="v2Checkout" required>
                  </div>
                </div>

                <div class="form-duo-row">
                  <div class="form-group-field">
                    <label>Oda Tercihi</label>
                    <select id="v2Suite">
                      <option value="Tüm Koleksiyon">Tüm Odaları Göster</option>
                      ${rooms.map(r => `<option value="${escapeHtml(r.title)}">${escapeHtml(r.title)}</option>`).join('')}
                    </select>
                  </div>
                  <div class="form-group-field">
                    <label>Misafir Sayısı</label>
                    <select id="v2Guests">
                      <option value="2 Yetişkin">2 Yetişkin</option>
                      <option value="1 Yetişkin">1 Yetişkin</option>
                      <option value="3 Yetişkin">3 Yetişkin</option>
                      <option value="4+ Yetişkin">4+ Yetişkin / Aile</option>
                    </select>
                  </div>
                </div>

                <div class="form-group-field" style="margin-bottom:1.5rem;">
                  <label>Özel Talebiniz</label>
                  <textarea id="v2Notes" rows="3" placeholder="Örn: Balayı karşılama ikramı, tekne transferi, geç giriş..."></textarea>
                </div>

                <button type="button" class="btn-dock-submit w-full" id="v2SubmitBtn" style="width:100%; justify-content:center;">
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
  <footer class="v2-footer">
    <div class="container-liquid">
      <div class="footer-liquid-grid">
        <div>
          <div class="footer-brand-title">${escapeHtml(name).toUpperCase()}</div>
          <p style="color:var(--text-muted); font-size:0.88rem; line-height:1.7; margin-bottom:1rem;">
            ${escapeHtml(tagline)}
          </p>
          <small style="color:var(--text-dim); display:block;">${escapeHtml(address)}</small>
        </div>

        <div class="footer-links-col">
          <strong>Hızlı Bağlantılar</strong>
          <a href="#story">Felsefe & Hikaye</a>
          <a href="#residences">Süitler & Rezidanslar</a>
          <a href="#rituals">Günün Akışı</a>
          <a href="#gastronomy">Gastronomi & İskele</a>
          <a href="#coves">Koylar Rehberi</a>
        </div>

        <div class="footer-links-col">
          <strong>İletişim & Rezervasyon</strong>
          <a href="tel:${escapeHtml(cleanPhone)}">📞 ${escapeHtml(phone)}</a>
          <a href="https://wa.me/${escapeHtml(cleanPhone)}" target="_blank">💬 WhatsApp Canlı Hattı</a>
          <span style="color:var(--text-dim); font-size:0.82rem; margin-top:0.5rem;">7/24 Misafir Karşılama</span>
        </div>
      </div>

      <div class="footer-copyright-bar">
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
      const suite = document.getElementById('heroSuite')?.value || 'Tüm Koleksiyon';

      const v2Checkin = document.getElementById('v2Checkin');
      const v2Checkout = document.getElementById('v2Checkout');
      const v2Guests = document.getElementById('v2Guests');
      const v2Suite = document.getElementById('v2Suite');

      if (v2Checkin && checkin) v2Checkin.value = checkin;
      if (v2Checkout && checkout) v2Checkout.value = checkout;
      if (v2Guests && guests) v2Guests.value = guests;
      if (v2Suite && suite !== 'all') v2Suite.value = suite;

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
