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

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// 4 DISTINCT ARCHITECTURAL ARCHETYPES FOR SELİMİYE HOTELS
const ARCHETYPES = {
  WATERFRONT_LUXURY: 'WATERFRONT_LUXURY',
  BOHEMIAN_GLAMPING: 'BOHEMIAN_GLAMPING',
  STONE_BOTANICAL: 'STONE_BOTANICAL',
  MARITIME_RIVIERA: 'MARITIME_RIVIERA'
};

const HOTEL_ARCHETYPE_MAP = {
  'mi-amor-selimiye': ARCHETYPES.WATERFRONT_LUXURY,
  'duru-selimiye': ARCHETYPES.WATERFRONT_LUXURY,
  'kiraz-vela-selimiye': ARCHETYPES.WATERFRONT_LUXURY,
  'mavi-melek-hotel': ARCHETYPES.WATERFRONT_LUXURY,
  'naxos-beach': ARCHETYPES.WATERFRONT_LUXURY,
  'makia-otel': ARCHETYPES.WATERFRONT_LUXURY,

  'sigliman-glamping-beach': ARCHETYPES.BOHEMIAN_GLAMPING,
  'doga-pansiyon': ARCHETYPES.BOHEMIAN_GLAMPING,
  'coban-hotel-selimiye': ARCHETYPES.BOHEMIAN_GLAMPING,
  'pineloft-selimiye': ARCHETYPES.BOHEMIAN_GLAMPING,
  'yamac-motel-selimiye': ARCHETYPES.BOHEMIAN_GLAMPING,

  'dut-selimiye': ARCHETYPES.STONE_BOTANICAL,
  'ekin-tatil-evi': ARCHETYPES.STONE_BOTANICAL,
  'selimiye-sakli-bahce-hotel': ARCHETYPES.STONE_BOTANICAL,
  'zakkum-frida-pansiyon': ARCHETYPES.STONE_BOTANICAL,
  'portakal-butik-otel': ARCHETYPES.STONE_BOTANICAL,
  'uzum-tatil-evi': ARCHETYPES.STONE_BOTANICAL,

  'selimiye-11-oda': ARCHETYPES.MARITIME_RIVIERA,
  'dantel-pansiyon-restaurant': ARCHETYPES.MARITIME_RIVIERA,
  'elia-selimiye': ARCHETYPES.MARITIME_RIVIERA,
  'salkim-sahil-evi': ARCHETYPES.MARITIME_RIVIERA,
  'hydas-pansiyon': ARCHETYPES.MARITIME_RIVIERA,
  'moka-butik-hotel': ARCHETYPES.MARITIME_RIVIERA,
  'ekin-pansiyon': ARCHETYPES.MARITIME_RIVIERA
};

// ============================================================================
// SHARED BASE CSS ENGINE
// ============================================================================
function getBaseCSSEngine(hotel, archetype) {
  const theme = hotel.theme || {};
  const primary = theme.primary || '#00f2fe';
  const secondary = theme.secondary || '#d4af37';
  const dark = theme.dark || '#030712';
  const card = theme.card || 'rgba(15, 23, 42, 0.7)';

  return `/* ==========================================================================
   SELİMİYE V2 — ARCHETYPE: ${archetype}
   Hotel: ${hotel.name.toUpperCase()}
   ========================================================================== */

@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700;800;900&family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Syne:wght@600;700;800&display=swap');

:root {
  --bg-deep: ${dark};
  --bg-surface: color-mix(in srgb, ${dark} 85%, #ffffff 15%);
  --bg-card: ${card};
  --bg-card-hover: color-mix(in srgb, ${card} 80%, #ffffff 20%);
  --bg-glass-input: rgba(255, 255, 255, 0.08);

  --accent-primary: ${primary};
  --accent-secondary: ${secondary};
  --accent-light: ${theme.accent || '#fff3cf'};
  --glow-primary: ${primary}44;
  --glow-secondary: ${secondary}44;

  --font-serif: 'Cormorant Garamond', Georgia, serif;
  --font-heading: ${archetype === ARCHETYPES.BOHEMIAN_GLAMPING ? "'Syne', sans-serif" : "'Cinzel', serif"};
  --font-sans: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;

  --gradient-accent: linear-gradient(135deg, ${primary} 0%, ${secondary} 100%);
  --gradient-gold: linear-gradient(135deg, #fff3cf 0%, #e2c174 35%, #c59b3f 70%, #8c6721 100%);

  --border-glass: rgba(255, 255, 255, 0.12);
  --border-accent: ${primary}66;
  --border-gold: rgba(212, 175, 55, 0.4);

  --shadow-liquid: 0 30px 80px -15px rgba(0, 0, 0, 0.9), 0 0 35px var(--glow-primary);
  --shadow-glow: 0 0 50px var(--glow-primary);
  --shadow-gold: 0 0 45px rgba(212, 175, 55, 0.4);

  --blur-heavy: blur(32px) saturate(210%);
  --blur-medium: blur(20px) saturate(180%);

  --radius-sm: 12px;
  --radius-md: 20px;
  --radius-lg: 32px;
  --radius-full: 9999px;
  --transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; font-size: 16px; background-color: var(--bg-deep); color: #f8fafc; }
body { font-family: var(--font-sans); background-color: var(--bg-deep); color: #f8fafc; line-height: 1.7; overflow-x: hidden; position: relative; -webkit-font-smoothing: antialiased; }

/* Fluid Ambient Mesh */
.ambient-aurora-mesh { position: fixed; inset: 0; pointer-events: none; z-index: 0; overflow: hidden; }
.aurora-orb { position: absolute; border-radius: 50%; filter: blur(140px); opacity: 0.45; animation: auroraMotion 24s ease-in-out infinite alternate; }
.orb-1 { top: -10vh; left: 10vw; width: 60vw; height: 60vw; background: radial-gradient(circle, var(--glow-primary) 0%, transparent 70%); }
.orb-2 { top: 40vh; right: -10vw; width: 55vw; height: 55vw; background: radial-gradient(circle, var(--glow-secondary) 0%, transparent 70%); animation-delay: -8s; }
.orb-3 { bottom: -15vh; left: 20vw; width: 65vw; height: 65vw; background: radial-gradient(circle, var(--glow-primary) 0%, transparent 70%); animation-delay: -15s; }
@keyframes auroraMotion { 0% { transform: translate(0, 0) scale(1); } 50% { transform: translate(60px, -40px) scale(1.08); } 100% { transform: translate(-40px, 60px) scale(0.94); } }

.container-v2 { width: 100%; max-width: 1380px; margin: 0 auto; padding: 0 2.25rem; position: relative; z-index: 2; }

/* Dynamic Floating Header */
.v2-header { position: sticky; top: 0; z-index: 100; padding: 1.2rem 0; transition: var(--transition); }
.v2-header.scrolled { padding: 0.65rem 0; }
.header-capsule { max-width: 1380px; margin: 0 auto; padding: 0.75rem 2rem; display: flex; align-items: center; justify-content: space-between; background: var(--bg-surface); backdrop-filter: var(--blur-heavy); border: 1px solid var(--border-glass); border-radius: var(--radius-full); box-shadow: var(--shadow-liquid); }
.brand-link { display: flex; align-items: center; gap: 1.2rem; text-decoration: none; }
.brand-disc { width: 60px; height: 60px; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 25px var(--glow-primary), 0 0 15px rgba(212, 175, 55, 0.35); transition: var(--transition); }
.brand-disc:hover { transform: scale(1.08) rotate(4deg); }
.brand-disc svg { width: 100%; height: 100%; display: block; }
.brand-text-col { display: flex; flex-direction: column; }
.brand-title { font-family: var(--font-heading); font-size: 1.25rem; font-weight: 800; letter-spacing: 0.12em; color: #fff; line-height: 1.2; }
.brand-sub { font-size: 0.68rem; letter-spacing: 0.22em; background: var(--gradient-gold); -webkit-background-clip: text; -webkit-text-fill-color: transparent; text-transform: uppercase; font-weight: 700; }

.header-nav { display: flex; align-items: center; gap: 2rem; }
.nav-item { font-size: 0.92rem; color: #cbd5e1; text-decoration: none; font-weight: 600; transition: var(--transition); position: relative; padding: 0.4rem 0; }
.nav-item:hover { color: #fff; }
.nav-item::after { content: ''; position: absolute; bottom: 0; left: 0; width: 0; height: 2px; background: var(--gradient-accent); transition: width 0.3s; }
.nav-item:hover::after { width: 100%; }

.header-actions { display: flex; align-items: center; gap: 1.2rem; }
.live-pill { display: inline-flex; align-items: center; gap: 8px; background: rgba(255, 255, 255, 0.05); border: 1px solid var(--border-accent); padding: 0.45rem 1.1rem; border-radius: var(--radius-full); color: var(--accent-primary); font-size: 0.8rem; font-weight: 700; }
.pulse-dot { width: 8px; height: 8px; background: var(--accent-primary); border-radius: 50%; box-shadow: 0 0 12px var(--accent-primary); animation: pulseDot 2s infinite; }
@keyframes pulseDot { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.35; transform: scale(0.7); } }

.btn-cta-gold { background: var(--gradient-gold); color: #040810; border: none; font-family: var(--font-sans); font-size: 0.86rem; font-weight: 800; letter-spacing: 0.06em; padding: 0.72rem 1.6rem; border-radius: var(--radius-full); cursor: pointer; box-shadow: var(--shadow-gold); transition: var(--transition); display: inline-flex; align-items: center; gap: 6px; }
.btn-cta-gold:hover { transform: translateY(-2px) scale(1.02); box-shadow: 0 0 40px rgba(212, 175, 55, 0.55); }

/* Common Sections */
.v2-section { padding: 8rem 0; position: relative; z-index: 2; }
.section-center-mast { text-align: center; max-width: 860px; margin: 0 auto 5rem; }
.eyebrow-chip { display: inline-flex; align-items: center; gap: 8px; background: rgba(255, 255, 255, 0.05); border: 1px solid var(--border-accent); padding: 0.45rem 1.3rem; border-radius: var(--radius-full); font-size: 0.78rem; font-weight: 800; letter-spacing: 0.16em; color: var(--accent-primary); margin-bottom: 1.4rem; }
.section-h2 { font-family: var(--font-heading); font-size: clamp(2.2rem, 4.4vw, 3.4rem); font-weight: 800; line-height: 1.18; color: #fff; margin-bottom: 1.35rem; }
.section-sub { font-size: 1.1rem; color: #94a3b8; line-height: 1.85; }

/* VIP Concierge Terminal */
.vip-deck { background: var(--bg-surface); backdrop-filter: var(--blur-heavy); border: 1.5px solid var(--border-accent); border-radius: var(--radius-lg); padding: 4rem; box-shadow: var(--shadow-liquid), var(--shadow-glow); }
.vip-grid { display: grid; grid-template-columns: 1fr 1.15fr; gap: 4.5rem; }
.vip-form-box { background: color-mix(in srgb, var(--bg-deep) 85%, #ffffff 15%); border: 1px solid var(--border-glass); padding: 2.5rem; border-radius: var(--radius-md); }
.form-duo { display: grid; grid-template-columns: 1fr 1fr; gap: 1.1rem; margin-bottom: 1.1rem; }
.form-cell { display: flex; flex-direction: column; gap: 0.4rem; }
.form-cell label { font-size: 0.76rem; font-weight: 800; color: #94a3b8; }
.form-cell input, .form-cell select, .form-cell textarea { background: var(--bg-glass-input); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: var(--radius-sm); padding: 0.75rem 0.95rem; color: #fff; font-family: var(--font-sans); font-size: 0.92rem; outline: none; }
.form-cell input:focus, .form-cell select:focus, .form-cell textarea:focus { border-color: var(--accent-primary); box-shadow: 0 0 18px var(--glow-primary); }

/* Footer */
.v2-footer { border-top: 1px solid rgba(255, 255, 255, 0.1); padding: 5rem 0 3.5rem; position: relative; z-index: 2; background: #010408; }
.footer-3col { display: grid; grid-template-columns: 1.6fr 1fr 1fr; gap: 4rem; margin-bottom: 4rem; }
.footer-col { display: flex; flex-direction: column; gap: 0.75rem; }
.footer-col strong { font-size: 0.8rem; letter-spacing: 0.12em; color: var(--accent-primary); text-transform: uppercase; margin-bottom: 0.6rem; }
.footer-col a { color: #94a3b8; text-decoration: none; font-size: 0.94rem; transition: var(--transition); }
.footer-col a:hover { color: #fff; }
.footer-bot { border-top: 1px solid rgba(255, 255, 255, 0.08); padding-top: 2.25rem; display: flex; justify-content: space-between; font-size: 0.84rem; color: #64748b; }

@media (max-width: 1024px) {
  .header-nav, .live-pill { display: none; }
  .vip-grid { grid-template-columns: 1fr; }
  .footer-3col { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 640px) {
  .form-duo { grid-template-columns: 1fr; }
  .vip-deck { padding: 2rem; }
  .footer-3col { grid-template-columns: 1fr; }
}
`;
}

// ============================================================================
// ARCHETYPE 1: WATERFRONT LUXURY (Split Kinetic Hero & Panoramic Lookbook)
// ============================================================================
function getWaterfrontLuxuryCSS() {
  return `
/* --- ARCHETYPE: WATERFRONT LUXURY --- */
.hero-waterfront { position: relative; min-height: 92vh; display: flex; align-items: center; padding: 6rem 0 5rem; }
.hero-wf-grid { display: grid; grid-template-columns: 1.15fr 1fr; gap: 5rem; align-items: center; }
.hero-wf-h1 { font-family: var(--font-heading); font-size: clamp(2.6rem, 5vw, 4.4rem); font-weight: 800; line-height: 1.14; margin-bottom: 1.6rem; text-shadow: 0 4px 35px rgba(0, 0, 0, 0.95); }
.hero-wf-dock { background: var(--bg-card); backdrop-filter: var(--blur-heavy); border: 1px solid var(--border-accent); border-radius: var(--radius-lg); padding: 1.75rem 2rem; box-shadow: var(--shadow-liquid), var(--shadow-glow); }
.wf-dock-grid { display: grid; grid-template-columns: repeat(3, 1fr) auto; gap: 1.25rem; align-items: center; }
.stage-main-card { position: relative; border-radius: var(--radius-lg); overflow: hidden; border: 1.5px solid var(--border-accent); box-shadow: var(--shadow-liquid), var(--shadow-glow); height: 500px; }
.stage-main-card img { width: 100%; height: 100%; object-fit: cover; }

.suites-panoramic-stack { display: flex; flex-direction: column; gap: 3.5rem; }
.suite-panoramic-card { display: grid; grid-template-columns: 1.15fr 1fr; background: var(--bg-card); backdrop-filter: var(--blur-heavy); border: 1px solid var(--border-glass); border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-liquid); transition: var(--transition); }
.suite-panoramic-card.reverse { grid-template-columns: 1fr 1.15fr; }
.suite-panoramic-card:hover { border-color: var(--accent-primary); transform: translateY(-8px); box-shadow: 0 35px 90px -15px rgba(0, 0, 0, 0.95), var(--shadow-glow); }
.suite-photo-side { position: relative; min-height: 420px; overflow: hidden; }
.suite-photo-side img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.8s ease; }
.suite-panoramic-card:hover .suite-photo-side img { transform: scale(1.06); }
.suite-details-side { padding: 3.5rem; display: flex; flex-direction: column; justify-content: space-between; }
.suite-specs-3box { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.25rem; margin-bottom: 2.25rem; padding: 1.2rem; background: rgba(255, 255, 255, 0.04); border: 1px solid var(--border-glass); border-radius: var(--radius-sm); }
.suite-action-strip { display: flex; align-items: center; justify-content: space-between; border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 1.75rem; }

.rituals-3deck { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2.25rem; }
.ritual-card { background: var(--bg-card); backdrop-filter: var(--blur-heavy); border: 1px solid var(--border-glass); border-radius: var(--radius-lg); padding: 2.75rem; box-shadow: var(--shadow-liquid); transition: var(--transition); position: relative; overflow: hidden; }
.ritual-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3.5px; background: var(--gradient-accent); opacity: 0.85; }
.ritual-card:hover { border-color: var(--accent-primary); transform: translateY(-8px); box-shadow: var(--shadow-glow); }

.gastronomy-split { display: grid; grid-template-columns: 1fr 1.15fr; gap: 4.5rem; align-items: center; }
.degustation-panel { background: var(--bg-card); backdrop-filter: var(--blur-heavy); border: 1px solid var(--border-gold); border-radius: var(--radius-lg); padding: 3rem; box-shadow: var(--shadow-liquid), var(--shadow-gold); }

@media (max-width: 1024px) {
  .hero-wf-grid, .gastronomy-split { grid-template-columns: 1fr; gap: 4rem; }
  .suite-panoramic-card, .suite-panoramic-card.reverse { grid-template-columns: 1fr; }
  .rituals-3deck { grid-template-columns: 1fr; }
  .wf-dock-grid { grid-template-columns: 1fr 1fr; }
}
`;
}

// ============================================================================
// ARCHETYPE 2: BOHEMIAN GLAMPING & SUNKEN DECK (Bento Hero & Deck Tracker)
// ============================================================================
function getBohemianGlampingCSS() {
  return `
/* --- ARCHETYPE: BOHEMIAN GLAMPING --- */
.hero-glamping { padding: 5rem 0 4rem; position: relative; }
.glamping-bento-hero { display: grid; grid-template-columns: 1.4fr 1fr; grid-template-rows: 280px 280px; gap: 1.5rem; }
.bento-cell { border-radius: var(--radius-lg); overflow: hidden; position: relative; border: 1px solid var(--border-accent); box-shadow: var(--shadow-liquid); }
.bento-hero-main { grid-row: span 2; display: flex; flex-direction: column; justify-content: flex-end; padding: 3.5rem; background: linear-gradient(0deg, rgba(0,0,0,0.9) 0%, transparent 60%), url('./media/hero.jpg') center/cover; }
.bento-hero-h1 { font-family: 'Syne', sans-serif; font-size: clamp(2.4rem, 4.5vw, 3.8rem); font-weight: 800; line-height: 1.1; margin-bottom: 1rem; color: #fff; }
.bento-cell-img img { width: 100%; height: 100%; object-fit: cover; }
.bento-cell-card { background: var(--bg-card); backdrop-filter: var(--blur-heavy); padding: 2.5rem; display: flex; flex-direction: column; justify-content: center; }

.deck-tracker-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2rem; }
.tracker-card { background: var(--bg-card); border: 1px solid var(--border-glass); border-radius: var(--radius-lg); padding: 2.5rem; transition: var(--transition); }
.tracker-card:hover { border-color: var(--accent-primary); transform: scale(1.02); }
.tracker-icon-badge { width: 50px; height: 50px; border-radius: 50%; background: var(--gradient-accent); display: flex; align-items: center; justify-content: center; font-size: 1.4rem; margin-bottom: 1.5rem; box-shadow: 0 0 20px var(--glow-primary); }

.glamping-masonry-suites { display: grid; grid-template-columns: repeat(2, 1fr); gap: 2.5rem; }
.glamp-suite-card { background: var(--bg-card); border-radius: var(--radius-lg); overflow: hidden; border: 1px solid var(--border-glass); transition: var(--transition); }
.glamp-suite-card:hover { border-color: var(--accent-primary); transform: translateY(-6px); }
.glamp-suite-img { height: 320px; position: relative; }
.glamp-suite-img img { width: 100%; height: 100%; object-fit: cover; }
.glamp-suite-body { padding: 2.5rem; }

@media (max-width: 1024px) {
  .glamping-bento-hero { grid-template-columns: 1fr; grid-template-rows: auto; }
  .deck-tracker-grid, .glamping-masonry-suites { grid-template-columns: 1fr; }
}
`;
}

// ============================================================================
// ARCHETYPE 3: STONE BOTANICAL ESTATE (Asymmetrical Sanctuary & Courtyard)
// ============================================================================
function getStoneBotanicalCSS() {
  return `
/* --- ARCHETYPE: STONE BOTANICAL SANCTUARY --- */
.hero-stone { min-height: 90vh; display: flex; align-items: center; padding: 6rem 0 4rem; }
.stone-hero-layout { display: grid; grid-template-columns: 1fr 1.3fr; gap: 4.5rem; align-items: center; }
.stone-vertical-tag { writing-mode: vertical-rl; transform: rotate(180deg); font-size: 0.72rem; letter-spacing: 0.3em; color: var(--accent-primary); font-weight: 800; text-transform: uppercase; margin-bottom: 1rem; }
.stone-title-h1 { font-family: 'Cormorant Garamond', Georgia, serif; font-size: clamp(3rem, 6vw, 5.2rem); font-weight: 400; line-height: 1.05; margin-bottom: 2rem; color: #fff; }
.stone-hero-img-frame { height: 520px; border-radius: 4px; border: 1px solid var(--border-gold); overflow: hidden; box-shadow: var(--shadow-liquid); position: relative; }
.stone-hero-img-frame img { width: 100%; height: 100%; object-fit: cover; }

.botanical-courtyard-grid { display: grid; grid-template-columns: 1.2fr 1fr 1fr; gap: 2rem; }
.botanical-feature-card { background: var(--bg-card); border: 1px solid var(--border-gold); padding: 3rem; border-radius: 8px; display: flex; flex-direction: column; justify-content: space-between; }
.stone-suite-row { display: grid; grid-template-columns: 1fr 1fr; gap: 3.5rem; align-items: center; margin-bottom: 4.5rem; }
.stone-suite-frame { height: 380px; border-radius: 6px; overflow: hidden; border: 1px solid var(--border-glass); }
.stone-suite-frame img { width: 100%; height: 100%; object-fit: cover; }

@media (max-width: 1024px) {
  .stone-hero-layout, .botanical-courtyard-grid, .stone-suite-row { grid-template-columns: 1fr; gap: 3rem; }
}
`;
}

// ============================================================================
// ARCHETYPE 4: MARITIME RIVIERA & PRIVATE JETTY (Nautical Radar & Sommelier)
// ============================================================================
function getMaritimeRivieraCSS() {
  return `
/* --- ARCHETYPE: MARITIME RIVIERA --- */
.hero-maritime { min-height: 90vh; display: flex; align-items: center; padding: 6rem 0 4rem; }
.maritime-split-hero { display: grid; grid-template-columns: 1.2fr 1fr; gap: 4.5rem; align-items: center; }
.maritime-radar-tag { display: inline-flex; align-items: center; gap: 10px; background: rgba(0, 242, 254, 0.08); border: 1px solid var(--border-accent); padding: 0.45rem 1.2rem; border-radius: var(--radius-full); font-size: 0.8rem; font-weight: 800; color: var(--accent-primary); margin-bottom: 1.5rem; }
.maritime-h1 { font-family: 'Cinzel', serif; font-size: clamp(2.4rem, 4.6vw, 4rem); font-weight: 800; line-height: 1.15; color: #fff; margin-bottom: 1.5rem; }

.nautical-radar-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.5rem; margin: 3.5rem 0; }
.nautical-stat-card { background: var(--bg-card); border: 1px solid var(--border-glass); border-radius: var(--radius-md); padding: 2rem 1.5rem; text-align: center; }
.nautical-stat-card strong { font-size: 1.6rem; font-family: 'Cinzel', serif; color: var(--accent-primary); display: block; margin-bottom: 0.25rem; }
.nautical-stat-card span { font-size: 0.78rem; color: #94a3b8; text-transform: uppercase; font-weight: 700; }

.maritime-suites-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 3rem; }
.maritime-suite-card { background: var(--bg-card); border-radius: var(--radius-lg); overflow: hidden; border: 1px solid var(--border-glass); transition: var(--transition); }
.maritime-suite-card:hover { border-color: var(--accent-primary); transform: translateY(-8px); box-shadow: var(--shadow-glow); }
.maritime-suite-media { height: 340px; position: relative; }
.maritime-suite-media img { width: 100%; height: 100%; object-fit: cover; }
.maritime-suite-info { padding: 2.75rem; }

@media (max-width: 1024px) {
  .maritime-split-hero, .maritime-suites-grid { grid-template-columns: 1fr; }
  .nautical-radar-grid { grid-template-columns: 1fr 1fr; }
}
`;
}

// Generate CSS per Hotel
function generateArchetypeCSS(hotel) {
  const slug = hotel.slug;
  const archetype = HOTEL_ARCHETYPE_MAP[slug] || ARCHETYPES.WATERFRONT_LUXURY;
  const baseEngine = getBaseCSSEngine(hotel, archetype);

  let specificCSS = '';
  if (archetype === ARCHETYPES.WATERFRONT_LUXURY) specificCSS = getWaterfrontLuxuryCSS();
  else if (archetype === ARCHETYPES.BOHEMIAN_GLAMPING) specificCSS = getBohemianGlampingCSS();
  else if (archetype === ARCHETYPES.STONE_BOTANICAL) specificCSS = getStoneBotanicalCSS();
  else if (archetype === ARCHETYPES.MARITIME_RIVIERA) specificCSS = getMaritimeRivieraCSS();

  return baseEngine + '\n' + specificCSS;
}

// ============================================================================
// HTML GENERATOR WITH 4 DISTINCT ARCHETYPE LAYOUTS
// ============================================================================
function generateArchetypeHTML(hotel) {
  const name = hotel.name;
  const slug = hotel.slug;
  const archetype = HOTEL_ARCHETYPE_MAP[slug] || ARCHETYPES.WATERFRONT_LUXURY;
  const phone = hotel.phone || '0252 456 23 40';
  const cleanPhone = phone.replace(/\D/g, '') || '902524562340';
  const address = hotel.address || hotel.location || 'Selimiye Koyu, Marmaris / Muğla';
  const tagline = hotel.tagline || 'Selimiye’de Kristal Sular & Yüksek Kıyı Konforu';
  const concept = hotel.concept || 'Kıyı Dinginliği & Lüks Butik Deneyim';
  const audience = hotel.targetAudience || 'Seçkin Misafirler & Çiftler';
  const seaDist = hotel.seaDistance || 'Denize Sıfır & Özel İskele';

  const rooms = (hotel.rooms && hotel.rooms.length) ? hotel.rooms : [
    { title: "Deluxe Deniz Manzaralı Taş Süit", size: "36 m²", view: "Panoramik Deniz Manzaralı", bed: "King Size Yatak", desc: "Geniş verandası, doğal taş dokuları ve sabahın ilk ışıklarını karşılayan ferah yaşam alanı.", badge: "İmza Süit" },
    { title: "Botanik Avlu Bahçe Odası", size: "28 m²", view: "Zeytinlik & Bahçe Avlusu", bed: "Queen Size Yatak", desc: "Begonviller ve zeytin ağaçlarıyla çevrili, serin taş mimarisiyle izole bir kaçış köşesi.", badge: "Sakin Kaçış" }
  ];

  const rituals = (hotel.rituals && hotel.rituals.length) ? hotel.rituals : [
    { time: "08:30 - 11:00", title: "Koyda Yavaş Kahvaltı", desc: "Yerel Selimiye zeytinleri, keçi peyniri ve ev yapımı incir reçeliyle güne acele etmeden başlayın." },
    { time: "14:00 - 17:30", title: "İskelede Tuz & Güneş", desc: "Kristal berraklığındaki koy suyunda yüzün, gölgede kitabınızı okurken dinlenin." },
    { time: "19:30 - 23:00", title: "Gün Batımı & Kıyı Masası", desc: "Gökyüzü kızıla bürünürken taze Ege mezeleri eşliğinde baş başa bir akşam." }
  ];

  // Common Header & Footers
  const headerHtml = `
  <div class="ambient-aurora-mesh" aria-hidden="true">
    <div class="aurora-orb orb-1"></div>
    <div class="aurora-orb orb-2"></div>
    <div class="aurora-orb orb-3"></div>
  </div>

  <header class="v2-header" id="v2Header">
    <div class="header-capsule">
      <a href="#top" class="brand-link">
        <div class="brand-disc">
          ${getLuxuryEmblem(slug, name, true)}
        </div>
        <div class="brand-text-col">
          <span class="brand-title">${escapeHtml(name).toUpperCase()}</span>
          <span class="brand-sub">SELİMİYE · MARMARİS</span>
        </div>
      </a>

      <nav class="header-nav">
        <a href="#suites" class="nav-item">Süitler</a>
        <a href="#rituals" class="nav-item">Koy Ritüelleri</a>
        <a href="#gastronomy" class="nav-item">Gastronomi</a>
        <a href="#concierge" class="nav-item">VIP Danışma</a>
      </nav>

      <div class="header-actions">
        <div class="live-pill">
          <span class="pulse-dot"></span>
          <span>☀️ 28°C Selimiye</span>
        </div>
        <button class="btn-cta-gold" data-book>
          <span>Rezervasyon</span>
          <i>↗</i>
        </button>
      </div>
    </div>
  </header>`;

  const vipAndFooterHtml = `
    <!-- VIP CONCIERGE -->
    <section class="v2-section" id="concierge">
      <div class="container-v2">
        <div class="vip-deck" data-reveal>
          <div class="vip-grid">
            <div>
              <div class="eyebrow-chip">VIP CANLI DANIŞMA</div>
              <h2 class="section-h2">Doğrudan<br><em style="font-family:var(--font-serif); font-style:italic; color:var(--accent-light);">Rezervasyon Terminali</em></h2>
              <p class="section-sub" style="margin-bottom:2rem;">
                Tarihlerinizi iletin; ${escapeHtml(name)} ekibi doğrudan en avantajlı fiyat teklifini WhatsApp üzerinden anında paylaşsın.
              </p>
              <div style="display:flex; flex-direction:column; gap:1.2rem;">
                <div><strong style="color:var(--accent-primary); font-size:0.78rem; text-transform:uppercase;">Konum</strong><p>${escapeHtml(address)}</p></div>
                <div><strong style="color:var(--accent-primary); font-size:0.78rem; text-transform:uppercase;">Resepsiyon</strong><p><a href="tel:${escapeHtml(cleanPhone)}" style="color:#fff; text-decoration:none;">${escapeHtml(phone)}</a></p></div>
                <div><strong style="color:var(--accent-primary); font-size:0.78rem; text-transform:uppercase;">WhatsApp Canlı</strong><p><a href="https://wa.me/${escapeHtml(cleanPhone)}?text=Merhaba%20${encodeURIComponent(name)},%20rezervasyon%20hakk%C4%B1nda%20bilgi%20almak%20istiyorum." target="_blank" style="color:var(--accent-primary); font-weight:700;">+90 Selimiye VIP Concierge ↗</a></p></div>
              </div>
            </div>

            <div class="vip-form-box">
              <h3 style="font-family:var(--font-heading); color:#fff; font-size:1.4rem; margin-bottom:1.5rem;">Müsaitlik Talebi Gönder</h3>
              <form id="v2ContactForm" onsubmit="return false;">
                <div class="form-duo">
                  <div class="form-cell">
                    <label>Adınız Soyadınız *</label>
                    <input type="text" id="v2Name" placeholder="Adınız Soyadınız" required>
                  </div>
                  <div class="form-cell">
                    <label>Telefon *</label>
                    <input type="tel" id="v2Phone" placeholder="05XX XXX XX XX" required>
                  </div>
                </div>
                <div class="form-duo">
                  <div class="form-cell">
                    <label>Giriş Tarihi *</label>
                    <input type="date" id="v2Checkin" required>
                  </div>
                  <div class="form-cell">
                    <label>Çıkış Tarihi *</label>
                    <input type="date" id="v2Checkout" required>
                  </div>
                </div>
                <div class="form-duo">
                  <div class="form-cell">
                    <label>Oda Tercihi</label>
                    <select id="v2Suite">
                      <option value="Tüm Odalar">Tüm Odaları Göster</option>
                      ${rooms.map(r => `<option value="${escapeHtml(r.title)}">${escapeHtml(r.title)}</option>`).join('')}
                    </select>
                  </div>
                  <div class="form-cell">
                    <label>Misafir</label>
                    <select id="v2Guests">
                      <option value="2 Yetişkin">2 Yetişkin</option>
                      <option value="1 Yetişkin">1 Yetişkin</option>
                      <option value="3 Yetişkin">3 Yetişkin</option>
                      <option value="4+ Yetişkin">4+ Yetişkin</option>
                    </select>
                  </div>
                </div>
                <div class="form-cell" style="margin-bottom:1.5rem;">
                  <label>Özel İstekler</label>
                  <textarea id="v2Notes" rows="3" placeholder="Örn: Balayı ikramı, tekne transferi..."></textarea>
                </div>
                <button type="button" class="btn-cta-gold" id="v2SubmitBtn" style="width:100%; justify-content:center; height:50px;">
                  <span>Talebi İlet & Müsaitlik Al ↗</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- FOOTER -->
    <footer class="v2-footer">
      <div class="container-v2">
        <div class="footer-3col">
          <div>
            <div style="font-family:var(--font-heading); font-size:1.4rem; color:#fff; margin-bottom:0.8rem;">${escapeHtml(name).toUpperCase()}</div>
            <p style="color:#94a3b8; font-size:0.92rem; line-height:1.75; margin-bottom:1rem;">${escapeHtml(tagline)}</p>
            <small style="color:#64748b;">${escapeHtml(address)}</small>
          </div>
          <div class="footer-col">
            <strong>Hızlı Gezinme</strong>
            <a href="#suites">Koleksiyon Süitleri</a>
            <a href="#rituals">Koy Ritüelleri</a>
            <a href="#gastronomy">Gastronomi</a>
            <a href="#concierge">VIP Rezervasyon</a>
          </div>
          <div class="footer-col">
            <strong>İletişim Hattı</strong>
            <a href="tel:${escapeHtml(cleanPhone)}">📞 ${escapeHtml(phone)}</a>
            <a href="https://wa.me/${escapeHtml(cleanPhone)}" target="_blank">💬 WhatsApp Canlı Hattı</a>
            <span style="color:#64748b; font-size:0.82rem; margin-top:0.5rem;">Selimiye Koyu · Marmaris</span>
          </div>
        </div>
        <div class="footer-bot">
          <span>© ${new Date().getFullYear()} ${escapeHtml(name)}. Tüm Hakları Saklıdır.</span>
          <span>Aeon Luxury Portfolio</span>
        </div>
      </div>
    </footer>`;

  // BODY CONTENT PER ARCHETYPE
  let bodyContent = '';

  if (archetype === ARCHETYPES.WATERFRONT_LUXURY) {
    bodyContent = `
    <!-- ARCHETYPE: WATERFRONT LUXURY -->
    <section class="hero-waterfront">
      <div class="container-v2">
        <div class="hero-wf-grid">
          <div data-reveal>
            <div class="eyebrow-chip">
              <span class="pulse-dot"></span>
              <span>${escapeHtml(seaDist).toUpperCase()}</span>
            </div>
            <h1 class="hero-wf-h1">
              Akışkan Camın Işığında,<br>
              <em style="font-family:var(--font-serif); font-style:italic; color:var(--accent-light);">${escapeHtml(tagline)}</em>
            </h1>
            <p class="section-sub" style="margin-bottom:2.5rem;">
              ${escapeHtml(name)}; Selimiye’nin kristal turkuaz suları üzerinde, ${escapeHtml(concept).toLowerCase()} anlayışıyla tasarlanmış seçkin bir Ege inzivası sunar.
            </p>

            <div class="hero-wf-dock">
              <form class="wf-dock-grid" onsubmit="return false;">
                <div class="form-cell">
                  <label>GİRİŞ</label>
                  <input type="date" id="heroCheckin">
                </div>
                <div class="form-cell">
                  <label>ÇIKIŞ</label>
                  <input type="date" id="heroCheckout">
                </div>
                <div class="form-cell">
                  <label>MİSAFİR</label>
                  <select id="heroGuests">
                    <option value="2 Yetişkin">2 Yetişkin</option>
                    <option value="1 Yetişkin">1 Yetişkin</option>
                    <option value="3+ Yetişkin">3+ Yetişkin</option>
                  </select>
                </div>
                <button type="button" class="btn-cta-gold" id="heroSubmitBtn" style="height:48px;">
                  <span>Müsaitlik Al →</span>
                </button>
              </form>
            </div>
          </div>

          <div data-reveal>
            <div class="stage-main-card">
              <img src="./media/hero.jpg" alt="${escapeHtml(name)}">
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- SUITES -->
    <section class="v2-section" id="suites" style="background: rgba(0,0,0,0.3);">
      <div class="container-v2">
        <div class="section-center-mast" data-reveal>
          <div class="eyebrow-chip">PANORAMİK KONAKLAMA</div>
          <h2 class="section-h2">Koleksiyon Süitleri</h2>
          <p class="section-sub">Doğal kireçtaşı, keten tekstiller ve Ege koyunu kucaklayan geniş özel teraslar.</p>
        </div>

        <div class="suites-panoramic-stack">
          ${rooms.map((room, idx) => `
            <article class="suite-panoramic-card ${idx % 2 === 1 ? 'reverse' : ''}" data-reveal>
              <div class="suite-photo-side">
                <img src="${idx === 0 ? './media/suite.jpg' : './media/room.jpg'}" alt="${escapeHtml(room.title)}">
              </div>
              <div class="suite-details-side">
                <div>
                  <span style="font-size:0.75rem; color:var(--accent-primary); letter-spacing:0.2em; font-weight:800; display:block; margin-bottom:0.5rem;">REZİDANS N° 0${idx + 1}</span>
                  <h3 style="font-family:var(--font-heading); font-size:1.9rem; color:#fff; margin-bottom:1rem;">${escapeHtml(room.title)}</h3>
                  <p style="color:#94a3b8; font-size:0.96rem; line-height:1.8; margin-bottom:2rem;">${escapeHtml(room.desc || 'Dingin koy manzarası ve masif ahşap iskele konforu.')}</p>
                  
                  <div class="suite-specs-3box">
                    <div><span style="font-size:0.7rem; color:#64748b; text-transform:uppercase; font-weight:800; display:block;">ALAN</span><strong style="color:#fff;">${escapeHtml(room.size || '36 m²')}</strong></div>
                    <div><span style="font-size:0.7rem; color:#64748b; text-transform:uppercase; font-weight:800; display:block;">MANZARA</span><strong style="color:#fff;">${escapeHtml(room.view || 'Deniz')}</strong></div>
                    <div><span style="font-size:0.7rem; color:#64748b; text-transform:uppercase; font-weight:800; display:block;">YATAK</span><strong style="color:#fff;">${escapeHtml(room.bed || 'King')}</strong></div>
                  </div>
                </div>

                <div class="suite-action-strip">
                  <span style="color:var(--accent-light); font-size:0.84rem; font-weight:700;">✦ En İyi Fiyat Garantisi</span>
                  <button class="btn-cta-gold" data-suite-name="${escapeHtml(room.title)}">
                    <span>Rezerve Et ↗</span>
                  </button>
                </div>
              </div>
            </article>
          `).join('')}
        </div>
      </div>
    </section>

    <!-- RITUALS -->
    <section class="v2-section" id="rituals">
      <div class="container-v2">
        <div class="section-center-mast" data-reveal>
          <div class="eyebrow-chip">24 SAAT SELİMİYE</div>
          <h2 class="section-h2">Koyda Zamanın Akışı</h2>
        </div>
        <div class="rituals-3deck">
          ${rituals.map(r => `
            <div class="ritual-card" data-reveal>
              <span style="color:var(--accent-primary); font-size:0.78rem; font-weight:800; display:block; margin-bottom:0.8rem;">${escapeHtml(r.time)}</span>
              <h4 style="font-family:var(--font-heading); font-size:1.4rem; color:#fff; margin-bottom:0.8rem;">${escapeHtml(r.title)}</h4>
              <p style="color:#94a3b8; font-size:0.94rem;">${escapeHtml(r.desc)}</p>
            </div>
          `).join('')}
        </div>
      </div>
    </section>

    <!-- GASTRONOMY -->
    <section class="v2-section" id="gastronomy" style="background: rgba(0,0,0,0.3);">
      <div class="container-v2">
        <div class="gastronomy-split">
          <div class="degustation-panel" data-reveal>
            <div class="eyebrow-chip">TOPRAKTAN & DENİZDEN</div>
            <h3 style="font-family:var(--font-heading); font-size:1.8rem; color:#fff; margin-bottom:1.5rem;">Tadım Sofrası & Kıyı Masası</h3>
            <p style="color:#94a3b8; line-height:1.8; margin-bottom:1.5rem;">
              Yerel Selimiye zeytinyağları, sabah toplanan Ege otları ve günlük taze balık avıyla hazırlanan gün batımı ziyafeti.
            </p>
          </div>
          <div style="border-radius:var(--radius-lg); overflow:hidden; border:1px solid var(--border-accent);" data-reveal>
            <video autoplay muted loop playsinline poster="./media/dining.jpg" style="width:100%; height:440px; object-fit:cover; display:block;">
              <source src="./media/decor.mp4" type="video/mp4">
            </video>
          </div>
        </div>
      </div>
    </section>`;
  } else if (archetype === ARCHETYPES.BOHEMIAN_GLAMPING) {
    bodyContent = `
    <!-- ARCHETYPE: BOHEMIAN GLAMPING -->
    <section class="hero-glamping">
      <div class="container-v2">
        <div class="glamping-bento-hero" data-reveal>
          <div class="bento-cell bento-hero-main">
            <div class="eyebrow-chip" style="width:fit-content; margin-bottom:1rem;">
              <span>✦ BOHEM DOĞA İNZİVASI</span>
            </div>
            <h1 class="bento-hero-h1">${escapeHtml(name)}</h1>
            <p style="color:#cbd5e1; font-size:1.15rem; max-width:550px; margin-bottom:1.5rem;">${escapeHtml(tagline)}</p>
            <button class="btn-cta-gold" data-book style="width:fit-content;">
              <span>Müsaitlik Sorgula ↗</span>
            </button>
          </div>

          <div class="bento-cell bento-cell-img">
            <img src="./media/hero.jpg" alt="${escapeHtml(name)} Sahil">
          </div>

          <div class="bento-cell bento-cell-card">
            <span style="color:var(--accent-primary); font-size:0.75rem; letter-spacing:0.2em; font-weight:800; text-transform:uppercase;">KOY KONUMU</span>
            <h3 style="font-family:var(--font-heading); font-size:1.4rem; color:#fff; margin:0.4rem 0 0.8rem;">${escapeHtml(seaDist)}</h3>
            <p style="color:#94a3b8; font-size:0.9rem;">${escapeHtml(concept)}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- DECK TRACKER -->
    <section class="v2-section" id="rituals">
      <div class="container-v2">
        <div class="section-center-mast" data-reveal>
          <div class="eyebrow-chip">GÜNÜN AKIŞI</div>
          <h2 class="section-h2">Doğa & Kıyı Deneyimi</h2>
        </div>
        <div class="deck-tracker-grid">
          ${rituals.map((r, i) => `
            <div class="tracker-card" data-reveal>
              <div class="tracker-icon-badge">${i === 0 ? '🌿' : i === 1 ? '☀️' : '🌙'}</div>
              <span style="color:var(--accent-primary); font-weight:800; font-size:0.78rem; display:block; margin-bottom:0.5rem;">${escapeHtml(r.time)}</span>
              <h4 style="font-family:var(--font-heading); font-size:1.35rem; color:#fff; margin-bottom:0.8rem;">${escapeHtml(r.title)}</h4>
              <p style="color:#94a3b8; font-size:0.92rem;">${escapeHtml(r.desc)}</p>
            </div>
          `).join('')}
        </div>
      </div>
    </section>

    <!-- SUITES -->
    <section class="v2-section" id="suites" style="background: rgba(0,0,0,0.3);">
      <div class="container-v2">
        <div class="section-center-mast" data-reveal>
          <div class="eyebrow-chip">KONAKLAMA</div>
          <h2 class="section-h2">Doğal Taş & Glamping Çadırlar</h2>
        </div>

        <div class="glamping-masonry-suites">
          ${rooms.map((room, idx) => `
            <article class="glamp-suite-card" data-reveal>
              <div class="glamp-suite-img">
                <img src="${idx === 0 ? './media/suite.jpg' : './media/room.jpg'}" alt="${escapeHtml(room.title)}">
              </div>
              <div class="glamp-suite-body">
                <h3 style="font-family:var(--font-heading); font-size:1.6rem; color:#fff; margin-bottom:0.8rem;">${escapeHtml(room.title)}</h3>
                <p style="color:#94a3b8; font-size:0.94rem; line-height:1.75; margin-bottom:1.5rem;">${escapeHtml(room.desc || 'Bohem ahşap teras ve izole doğa köşesi.')}</p>
                <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border-glass); padding-top:1.2rem;">
                  <span style="color:var(--accent-primary); font-weight:800; font-size:0.88rem;">${escapeHtml(room.size || '32 m²')} · ${escapeHtml(room.view || 'Doğa')}</span>
                  <button class="btn-cta-gold" data-suite-name="${escapeHtml(room.title)}"><span>Seç ↗</span></button>
                </div>
              </div>
            </article>
          `).join('')}
        </div>
      </div>
    </section>`;
  } else if (archetype === ARCHETYPES.STONE_BOTANICAL) {
    bodyContent = `
    <!-- ARCHETYPE: STONE BOTANICAL SANCTUARY -->
    <section class="hero-stone">
      <div class="container-v2">
        <div class="stone-hero-layout">
          <div data-reveal>
            <span class="stone-vertical-tag">TAŞ MİMARİ & ZEYTİNLİK</span>
            <h1 class="stone-title-h1">${escapeHtml(name)}</h1>
            <p style="font-family:var(--font-serif); font-size:1.4rem; color:var(--accent-light); font-style:italic; line-height:1.4; margin-bottom:1.5rem;">
              "${escapeHtml(tagline)}"
            </p>
            <p class="section-sub" style="margin-bottom:2.5rem;">${escapeHtml(concept)}</p>
            <button class="btn-cta-gold" data-book>
              <span>Avluya Adım Atın ↗</span>
            </button>
          </div>

          <div data-reveal>
            <div class="stone-hero-img-frame">
              <img src="./media/hero.jpg" alt="${escapeHtml(name)} Taş Ev">
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- COURTYARD FEATURES -->
    <section class="v2-section" id="rituals">
      <div class="container-v2">
        <div class="section-center-mast" data-reveal>
          <div class="eyebrow-chip">AVLUDA YAŞAM</div>
          <h2 class="section-h2">Zeytin Ağaçları Altında Sessizlik</h2>
        </div>
        <div class="botanical-courtyard-grid">
          ${rituals.map(r => `
            <div class="botanical-feature-card" data-reveal>
              <span style="font-size:0.75rem; color:var(--accent-primary); font-weight:800; text-transform:uppercase;">${escapeHtml(r.time)}</span>
              <div>
                <h4 style="font-family:var(--font-heading); font-size:1.4rem; color:#fff; margin:0.8rem 0;">${escapeHtml(r.title)}</h4>
                <p style="color:#94a3b8; font-size:0.92rem;">${escapeHtml(r.desc)}</p>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </section>

    <!-- SUITES -->
    <section class="v2-section" id="suites" style="background: rgba(0,0,0,0.3);">
      <div class="container-v2">
        <div class="section-center-mast" data-reveal>
          <div class="eyebrow-chip">TAŞ ODALAR</div>
          <h2 class="section-h2">Taş Mimarili Butik Süitler</h2>
        </div>

        ${rooms.map((room, idx) => `
          <div class="stone-suite-row" data-reveal>
            <div class="stone-suite-frame">
              <img src="${idx === 0 ? './media/suite.jpg' : './media/room.jpg'}" alt="${escapeHtml(room.title)}">
            </div>
            <div>
              <span style="font-size:0.76rem; color:var(--accent-primary); font-weight:800; letter-spacing:0.2em; text-transform:uppercase;">ODA 0${idx + 1}</span>
              <h3 style="font-family:var(--font-serif); font-size:2.4rem; color:#fff; margin:0.5rem 0 1rem;">${escapeHtml(room.title)}</h3>
              <p style="color:#94a3b8; font-size:1rem; line-height:1.8; margin-bottom:1.5rem;">${escapeHtml(room.desc || 'Doğal taş duvarlar ve bahçe avlusu serinliği.')}</p>
              <button class="btn-cta-gold" data-suite-name="${escapeHtml(room.title)}"><span>Bu Odayı Rezerve Et ↗</span></button>
            </div>
          </div>
        `).join('')}
      </div>
    </section>`;
  } else if (archetype === ARCHETYPES.MARITIME_RIVIERA) {
    bodyContent = `
    <!-- ARCHETYPE: MARITIME RIVIERA -->
    <section class="hero-maritime">
      <div class="container-v2">
        <div class="maritime-split-hero">
          <div data-reveal>
            <div class="maritime-radar-tag">
              <span>⚓ 36°42'N 28°05'E · ÖZEL İSKELE</span>
            </div>
            <h1 class="maritime-h1">${escapeHtml(name)}</h1>
            <p class="section-sub" style="margin-bottom:2.5rem;">${escapeHtml(tagline)}</p>
            <button class="btn-cta-gold" data-book>
              <span>İskele Müsaitliği ↗</span>
            </button>
          </div>

          <div data-reveal>
            <div style="height:480px; border-radius:var(--radius-lg); overflow:hidden; border:1px solid var(--border-accent); box-shadow:var(--shadow-liquid);">
              <img src="./media/hero.jpg" alt="${escapeHtml(name)}" style="width:100%; height:100%; object-fit:cover;">
            </div>
          </div>
        </div>

        <div class="nautical-radar-grid" data-reveal>
          <div class="nautical-stat-card"><strong>2.5m</strong><span>İskele Derinliği</span></div>
          <div class="nautical-stat-card"><strong>40m²</strong><span>Güneşlenme Terası</span></div>
          <div class="nautical-stat-card"><strong>28°C</strong><span>Deniz Suyu Sıcaklığı</span></div>
          <div class="nautical-stat-card"><strong>100%</strong><span>Durgun Koy</span></div>
        </div>
      </div>
    </section>

    <!-- SUITES -->
    <section class="v2-section" id="suites" style="background: rgba(0,0,0,0.3);">
      <div class="container-v2">
        <div class="section-center-mast" data-reveal>
          <div class="eyebrow-chip">RİVİERA KONAKLAMA</div>
          <h2 class="section-h2">Deniz Sıfır Süitler</h2>
        </div>

        <div class="maritime-suites-grid">
          ${rooms.map((room, idx) => `
            <article class="maritime-suite-card" data-reveal>
              <div class="maritime-suite-media">
                <img src="${idx === 0 ? './media/suite.jpg' : './media/room.jpg'}" alt="${escapeHtml(room.title)}">
              </div>
              <div class="maritime-suite-info">
                <h3 style="font-family:var(--font-heading); font-size:1.6rem; color:#fff; margin-bottom:0.8rem;">${escapeHtml(room.title)}</h3>
                <p style="color:#94a3b8; font-size:0.95rem; line-height:1.75; margin-bottom:1.5rem;">${escapeHtml(room.desc || 'Doğrudan iskeleye açılan özel deniz terası.')}</p>
                <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border-glass); padding-top:1.2rem;">
                  <span style="color:var(--accent-primary); font-weight:800; font-size:0.88rem;">${escapeHtml(room.size || '36 m²')} · ${escapeHtml(room.view || 'Deniz')}</span>
                  <button class="btn-cta-gold" data-suite-name="${escapeHtml(room.title)}"><span>Seç ↗</span></button>
                </div>
              </div>
            </article>
          `).join('')}
        </div>
      </div>
    </section>`;
  }

  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
  <meta name="description" content="${escapeHtml(name)} — Selimiye Koyu'nda ${escapeHtml(concept)}. ${escapeHtml(audience)}.">
  <title>${escapeHtml(name)} — Selimiye | ${archetype} (V2)</title>
  
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="./styles.css?v=${Date.now()}">
  <script defer src="./app.js?v=${Date.now()}"></script>
</head>
<body data-phone="${escapeHtml(cleanPhone)}" data-hotel="${escapeHtml(name)}">

  ${headerHtml}

  <main id="top">
    ${bodyContent}
    ${vipAndFooterHtml}
  </main>

</body>
</html>`;
}

// Generate JS
function generateArchetypeJS() {
  return `/**
 * SELİMİYE V2 MULTI-ARCHETYPE ENGINE
 */
document.addEventListener('DOMContentLoaded', () => {
  const header = document.getElementById('v2Header');
  if (header) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 40) header.classList.add('scrolled');
      else header.classList.remove('scrolled');
    }, { passive: true });
  }

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
    }, { threshold: 0.1 });

    reveals.forEach(el => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(24px)';
      el.style.transition = 'opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1), transform 0.7s cubic-bezier(0.16, 1, 0.3, 1)';
      observer.observe(el);
    });
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
      if (select) select.value = name;
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

// Build all 24 sites
function buildAllV2Sites() {
  console.log('💎 Compiling 24 V2 Selimiye Websites with 4 DISTINCT ARCHITECTURAL LAYOUTS...');
  const js = generateArchetypeJS();

  for (const hotel of rawV2Data.hotels) {
    const slug = hotel.slug;
    const hotelDir = path.join(outBaseDir, slug);
    if (!fs.existsSync(hotelDir)) fs.mkdirSync(hotelDir, { recursive: true });

    const css = generateArchetypeCSS(hotel);
    const html = generateArchetypeHTML(hotel);

    fs.writeFileSync(path.join(hotelDir, 'index.html'), html, 'utf8');
    fs.writeFileSync(path.join(hotelDir, 'styles.css'), css, 'utf8');
    fs.writeFileSync(path.join(hotelDir, 'app.js'), js, 'utf8');
  }

  console.log('✅ Successfully compiled 24 V2 sites across 4 distinct luxury architectural archetypes!');
}

buildAllV2Sites();
