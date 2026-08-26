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

// Copy unique photos per hotel
function syncUniqueMedia(hotel, hotelDir) {
  const mediaDir = path.join(hotelDir, 'media');
  if (!fs.existsSync(mediaDir)) fs.mkdirSync(mediaDir, { recursive: true });

  const mediaConfig = hotel.media || {};
  const visualAssetsRoot = path.join(__dirname, '..', 'template-system', 'visual-assets');

  // Resolve specific source folders
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
// ARCHETYPE 1: WATERFRONT LUXURY (Obsidian Glass & Liquid Aurora)
// ============================================================================
function generateWaterfrontCSS(hotel) {
  const primary = hotel.theme?.primary || '#00f2fe';
  const secondary = hotel.theme?.secondary || '#d4af37';
  const dark = hotel.theme?.dark || '#02060d';
  const card = hotel.theme?.card || 'rgba(8, 20, 36, 0.7)';

  return `@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700;800;900&family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');

:root {
  --bg-deep: ${dark};
  --bg-card: ${card};
  --accent-primary: ${primary};
  --accent-secondary: ${secondary};
  --accent-light: #fff3cf;
  --glow-primary: ${primary}55;
  --font-serif: 'Cormorant Garamond', Georgia, serif;
  --font-heading: 'Cinzel', serif;
  --font-sans: 'Plus Jakarta Sans', system-ui, sans-serif;
  --border-glass: rgba(255, 255, 255, 0.14);
  --border-accent: ${primary}66;
  --radius-lg: 28px;
  --radius-full: 9999px;
  --transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; font-size: 16px; background: var(--bg-deep); color: #f8fafc; }
body { font-family: var(--font-sans); background: var(--bg-deep); color: #f8fafc; line-height: 1.7; overflow-x: hidden; }

/* Aurora Mesh */
.ambient-aurora-mesh { position: fixed; inset: 0; pointer-events: none; z-index: 0; }
.aurora-orb { position: absolute; border-radius: 50%; filter: blur(140px); opacity: 0.45; animation: auroraFloat 22s infinite alternate; }
.orb-1 { top: -10vh; left: 10vw; width: 60vw; height: 60vw; background: radial-gradient(circle, var(--glow-primary) 0%, transparent 70%); }
.orb-2 { top: 40vh; right: -10vw; width: 55vw; height: 55vw; background: radial-gradient(circle, ${secondary}44 0%, transparent 70%); animation-delay: -7s; }
@keyframes auroraFloat { 0% { transform: translate(0, 0) scale(1); } 100% { transform: translate(-30px, 50px) scale(1.06); } }

.container-v2 { width: 100%; max-width: 1380px; margin: 0 auto; padding: 0 2.25rem; position: relative; z-index: 2; }

/* Floating Glass Header */
.wf-header { position: sticky; top: 0; z-index: 100; padding: 1.2rem 0; }
.wf-header-capsule { max-width: 1380px; margin: 0 auto; padding: 0.75rem 2rem; display: flex; align-items: center; justify-content: space-between; background: rgba(5, 16, 30, 0.85); backdrop-filter: blur(28px); border: 1px solid var(--border-glass); border-radius: var(--radius-full); box-shadow: 0 20px 50px rgba(0,0,0,0.8); }
.brand-link { display: flex; align-items: center; gap: 1.2rem; text-decoration: none; }
.brand-disc { width: 58px; height: 58px; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 25px var(--glow-primary); }
.brand-disc svg { width: 100%; height: 100%; display: block; }
.brand-title { font-family: var(--font-heading); font-size: 1.25rem; font-weight: 800; letter-spacing: 0.12em; color: #fff; }
.header-nav { display: flex; align-items: center; gap: 2rem; }
.nav-item { font-size: 0.92rem; color: #cbd5e1; text-decoration: none; font-weight: 600; }
.nav-item:hover { color: #fff; }
.btn-cta-gold { background: linear-gradient(135deg, #fff3cf 0%, #d4af37 100%); color: #040810; border: none; font-size: 0.86rem; font-weight: 800; padding: 0.72rem 1.6rem; border-radius: var(--radius-full); cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 0 35px rgba(212, 175, 55, 0.4); }

/* Split Hero */
.hero-waterfront { padding: 6rem 0 5rem; min-height: 90vh; display: flex; align-items: center; }
.hero-wf-grid { display: grid; grid-template-columns: 1.15fr 1fr; gap: 5rem; align-items: center; }
.eyebrow-chip { display: inline-flex; align-items: center; gap: 8px; background: rgba(255, 255, 255, 0.06); border: 1px solid var(--border-accent); padding: 0.45rem 1.3rem; border-radius: var(--radius-full); font-size: 0.78rem; font-weight: 800; color: var(--accent-primary); margin-bottom: 1.4rem; }
.hero-wf-h1 { font-family: var(--font-heading); font-size: clamp(2.6rem, 5vw, 4.4rem); font-weight: 800; line-height: 1.14; margin-bottom: 1.6rem; }
.hero-wf-dock { background: var(--bg-card); backdrop-filter: blur(28px); border: 1px solid var(--border-accent); border-radius: var(--radius-lg); padding: 1.75rem 2rem; box-shadow: 0 30px 80px rgba(0,0,0,0.9); }
.wf-dock-grid { display: grid; grid-template-columns: repeat(3, 1fr) auto; gap: 1.25rem; align-items: center; }
.wf-dock-grid input, .wf-dock-grid select { background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 12px; padding: 0.75rem 0.95rem; color: #fff; font-size: 0.9rem; outline: none; }
.stage-card { border-radius: var(--radius-lg); overflow: hidden; border: 1.5px solid var(--border-accent); box-shadow: 0 30px 80px rgba(0,0,0,0.9); height: 490px; }
.stage-card img { width: 100%; height: 100%; object-fit: cover; }

/* Panoramic Lookbook */
.v2-section { padding: 8rem 0; position: relative; z-index: 2; }
.section-center { text-align: center; max-width: 860px; margin: 0 auto 5rem; }
.section-h2 { font-family: var(--font-heading); font-size: clamp(2.2rem, 4.4vw, 3.4rem); font-weight: 800; margin-bottom: 1.2rem; }
.suites-stack { display: flex; flex-direction: column; gap: 3.5rem; }
.suite-card { display: grid; grid-template-columns: 1.15fr 1fr; background: var(--bg-card); backdrop-filter: blur(28px); border: 1px solid var(--border-glass); border-radius: var(--radius-lg); overflow: hidden; box-shadow: 0 30px 80px rgba(0,0,0,0.9); transition: var(--transition); }
.suite-card.reverse { grid-template-columns: 1fr 1.15fr; }
.suite-card:hover { border-color: var(--accent-primary); transform: translateY(-8px); }
.suite-img { min-height: 400px; position: relative; }
.suite-img img { width: 100%; height: 100%; object-fit: cover; }
.suite-info { padding: 3.5rem; display: flex; flex-direction: column; justify-content: space-between; }

/* VIP Deck */
.vip-deck { background: rgba(5, 16, 30, 0.9); backdrop-filter: blur(28px); border: 1.5px solid var(--border-accent); border-radius: var(--radius-lg); padding: 4rem; box-shadow: 0 30px 80px rgba(0,0,0,0.9); }
.vip-grid { display: grid; grid-template-columns: 1fr 1.15fr; gap: 4.5rem; }
.vip-form { background: rgba(10, 24, 44, 0.85); border: 1px solid var(--border-glass); padding: 2.5rem; border-radius: 20px; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1.1rem; margin-bottom: 1.1rem; }
.form-cell { display: flex; flex-direction: column; gap: 0.4rem; }
.form-cell label { font-size: 0.74rem; font-weight: 800; color: #94a3b8; }
.form-cell input, .form-cell select, .form-cell textarea { background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 12px; padding: 0.75rem 0.95rem; color: #fff; font-size: 0.92rem; outline: none; }

.v2-footer { border-top: 1px solid rgba(255, 255, 255, 0.1); padding: 5rem 0 3.5rem; background: #010408; position: relative; z-index: 2; }
.footer-grid { display: grid; grid-template-columns: 1.6fr 1fr 1fr; gap: 4rem; }

@media (max-width: 1024px) {
  .header-nav { display: none; }
  .hero-wf-grid, .suite-card, .suite-card.reverse, .vip-grid, .footer-grid { grid-template-columns: 1fr; }
}
`;
}

// ============================================================================
// ARCHETYPE 2: BOHEMIAN GLAMPING & SUNKEN DECK (Terracotta & Sand)
// ============================================================================
function generateGlampingCSS(hotel) {
  const primary = hotel.theme?.primary || '#e29d72';
  const secondary = hotel.theme?.secondary || '#8da18b';
  const dark = hotel.theme?.dark || '#161311';
  const card = hotel.theme?.card || 'rgba(32, 26, 23, 0.85)';

  return `@import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');

:root {
  --bg-deep: ${dark};
  --bg-card: ${card};
  --accent-primary: ${primary};
  --accent-secondary: ${secondary};
  --font-heading: 'Syne', sans-serif;
  --font-sans: 'Plus Jakarta Sans', system-ui, sans-serif;
  --border-glass: rgba(226, 157, 114, 0.2);
  --border-accent: ${primary};
  --radius-lg: 24px;
  --radius-full: 9999px;
  --transition: all 0.35s ease;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; font-size: 16px; background: var(--bg-deep); color: #fdf8f4; }
body { font-family: var(--font-sans); background: var(--bg-deep); color: #fdf8f4; line-height: 1.7; overflow-x: hidden; }

.container-v2 { width: 100%; max-width: 1380px; margin: 0 auto; padding: 0 2.25rem; position: relative; z-index: 2; }

/* Bohemian Header */
.glamp-header { position: sticky; top: 0; z-index: 100; padding: 1.2rem 0; }
.glamp-header-capsule { max-width: 1380px; margin: 0 auto; padding: 0.75rem 2rem; display: flex; align-items: center; justify-content: space-between; background: rgba(28, 22, 19, 0.9); backdrop-filter: blur(24px); border: 1px solid var(--border-glass); border-radius: var(--radius-full); }
.brand-link { display: flex; align-items: center; gap: 1.2rem; text-decoration: none; }
.brand-disc { width: 56px; height: 56px; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; }
.brand-disc svg { width: 100%; height: 100%; display: block; }
.brand-title { font-family: var(--font-heading); font-size: 1.2rem; font-weight: 800; color: #fff; }
.header-nav { display: flex; align-items: center; gap: 2rem; }
.nav-item { font-size: 0.9rem; color: #e2d7ce; text-decoration: none; font-weight: 700; }
.btn-glamp-cta { background: var(--accent-primary); color: #161311; border: none; font-size: 0.86rem; font-weight: 800; padding: 0.72rem 1.6rem; border-radius: var(--radius-full); cursor: pointer; }

/* Bento Hero */
.hero-glamping { padding: 4.5rem 0; min-height: 85vh; }
.glamp-bento-grid { display: grid; grid-template-columns: 1.35fr 1fr; grid-template-rows: 280px 280px; gap: 1.5rem; }
.bento-hero-main { grid-row: span 2; border-radius: var(--radius-lg); overflow: hidden; position: relative; border: 1px solid var(--border-accent); display: flex; flex-direction: column; justify-content: flex-end; padding: 3.5rem; background: linear-gradient(0deg, rgba(16,13,11,0.92) 0%, transparent 60%), url('./media/hero.jpg') center/cover; }
.bento-hero-h1 { font-family: var(--font-heading); font-size: clamp(2.4rem, 4.5vw, 3.8rem); font-weight: 800; line-height: 1.1; margin-bottom: 1rem; color: #fff; }
.bento-card-side { border-radius: var(--radius-lg); overflow: hidden; border: 1px solid var(--border-glass); }
.bento-card-side img { width: 100%; height: 100%; object-fit: cover; }
.bento-info-box { background: var(--bg-card); padding: 2.5rem; display: flex; flex-direction: column; justify-content: center; border-radius: var(--radius-lg); border: 1px solid var(--border-glass); }

/* Sunken Deck Tracker */
.v2-section { padding: 7rem 0; position: relative; z-index: 2; }
.section-center { text-align: center; max-width: 860px; margin: 0 auto 4.5rem; }
.deck-tracker { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2rem; }
.tracker-item { background: var(--bg-card); border: 1px solid var(--border-glass); border-radius: var(--radius-lg); padding: 2.5rem; }
.tracker-badge { width: 48px; height: 48px; border-radius: 50%; background: var(--accent-primary); color: #161311; display: flex; align-items: center; justify-content: center; font-size: 1.3rem; margin-bottom: 1.2rem; }

/* Masonry Suites */
.glamp-suites-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 2.5rem; }
.glamp-card { background: var(--bg-card); border-radius: var(--radius-lg); overflow: hidden; border: 1px solid var(--border-glass); }
.glamp-card-img { height: 320px; }
.glamp-card-img img { width: 100%; height: 100%; object-fit: cover; }
.glamp-card-body { padding: 2.5rem; }

.vip-deck { background: var(--bg-card); border: 1.5px solid var(--accent-primary); border-radius: var(--radius-lg); padding: 3.5rem; }
.vip-grid { display: grid; grid-template-columns: 1fr 1.15fr; gap: 4rem; }
.vip-form { background: rgba(18, 14, 12, 0.9); border: 1px solid var(--border-glass); padding: 2.5rem; border-radius: 20px; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1.1rem; margin-bottom: 1.1rem; }
.form-cell { display: flex; flex-direction: column; gap: 0.4rem; }
.form-cell input, .form-cell select, .form-cell textarea { background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 10px; padding: 0.75rem 0.95rem; color: #fff; font-size: 0.92rem; outline: none; }

.v2-footer { border-top: 1px solid var(--border-glass); padding: 5rem 0 3.5rem; background: #0c0a08; }
.footer-grid { display: grid; grid-template-columns: 1.6fr 1fr 1fr; gap: 4rem; }

@media (max-width: 1024px) {
  .header-nav { display: none; }
  .glamp-bento-grid { grid-template-columns: 1fr; grid-template-rows: auto; }
  .deck-tracker, .glamp-suites-grid, .vip-grid, .footer-grid { grid-template-columns: 1fr; }
}
`;
}

// ============================================================================
// ARCHETYPE 3: STONE BOTANICAL SANCTUARY (Warm Linen & Olive Editorial)
// ============================================================================
function generateStoneBotanicalCSS(hotel) {
  const primary = hotel.theme?.primary || '#607358';
  const secondary = hotel.theme?.secondary || '#c5a059';

  return `@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap');

:root {
  --bg-deep: #f7f4ee;
  --bg-surface: #efebe1;
  --bg-card: #ffffff;
  --text-main: #1f2421;
  --text-muted: #5e665e;
  --accent-primary: ${primary};
  --accent-secondary: ${secondary};
  --font-serif: 'Cormorant Garamond', Georgia, serif;
  --font-heading: 'Playfair Display', Georgia, serif;
  --font-sans: 'Plus Jakarta Sans', system-ui, sans-serif;
  --border-stone: rgba(96, 115, 88, 0.25);
  --border-gold: rgba(197, 160, 89, 0.4);
  --radius-sm: 4px;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; font-size: 16px; background: var(--bg-deep); color: var(--text-main); }
body { font-family: var(--font-sans); background: var(--bg-deep); color: var(--text-main); line-height: 1.75; overflow-x: hidden; }

.container-v2 { width: 100%; max-width: 1360px; margin: 0 auto; padding: 0 2.5rem; }

/* Editorial Linen Header */
.stone-header { position: sticky; top: 0; z-index: 100; background: rgba(247, 244, 238, 0.95); backdrop-filter: blur(20px); border-bottom: 1px solid var(--border-stone); padding: 1.25rem 0; }
.stone-header-bar { display: flex; align-items: center; justify-content: space-between; }
.brand-link { display: flex; align-items: center; gap: 1.2rem; text-decoration: none; color: var(--text-main); }
.brand-disc { width: 56px; height: 56px; border-radius: 50%; overflow: hidden; }
.brand-disc svg { width: 100%; height: 100%; display: block; }
.brand-title { font-family: var(--font-heading); font-size: 1.35rem; font-weight: 700; color: var(--text-main); letter-spacing: 0.08em; }
.header-nav { display: flex; align-items: center; gap: 2.2rem; }
.nav-item { font-size: 0.92rem; color: var(--text-muted); text-decoration: none; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; }
.btn-stone-cta { background: var(--accent-primary); color: #fff; border: none; font-family: var(--font-sans); font-size: 0.84rem; font-weight: 700; letter-spacing: 0.1em; padding: 0.75rem 1.8rem; border-radius: 2px; cursor: pointer; text-transform: uppercase; }

/* Asymmetric Editorial Hero */
.hero-stone { min-height: 85vh; display: flex; align-items: center; padding: 6rem 0 4rem; }
.stone-hero-layout { display: grid; grid-template-columns: 1fr 1.25fr; gap: 5rem; align-items: center; }
.stone-vertical-tag { font-size: 0.74rem; letter-spacing: 0.25em; color: var(--accent-primary); font-weight: 800; text-transform: uppercase; display: block; margin-bottom: 1rem; }
.stone-title-h1 { font-family: var(--font-serif); font-size: clamp(3.2rem, 6.2vw, 5.4rem); font-weight: 400; line-height: 1.05; margin-bottom: 1.8rem; color: var(--text-main); }
.stone-hero-frame { height: 520px; border-radius: 2px; border: 1px solid var(--border-gold); overflow: hidden; box-shadow: 0 25px 60px rgba(0,0,0,0.12); }
.stone-hero-frame img { width: 100%; height: 100%; object-fit: cover; }

/* Courtyard Grid */
.v2-section { padding: 7.5rem 0; }
.section-center { text-align: center; max-width: 860px; margin: 0 auto 5rem; }
.section-h2 { font-family: var(--font-serif); font-size: clamp(2.4rem, 4.6vw, 3.8rem); font-weight: 400; color: var(--text-main); margin-bottom: 1.2rem; }
.botanical-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2.5rem; }
.botanical-card { background: #fff; border: 1px solid var(--border-stone); padding: 3rem; border-radius: 2px; box-shadow: 0 10px 30px rgba(0,0,0,0.04); }

/* Stone Suite Rows */
.stone-suite-row { display: grid; grid-template-columns: 1.1fr 1fr; gap: 4.5rem; align-items: center; margin-bottom: 5rem; }
.stone-suite-frame { height: 400px; overflow: hidden; border-radius: 2px; box-shadow: 0 20px 50px rgba(0,0,0,0.1); }
.stone-suite-frame img { width: 100%; height: 100%; object-fit: cover; }

/* VIP Terminal */
.vip-deck { background: #fff; border: 1px solid var(--border-stone); padding: 4rem; border-radius: 2px; box-shadow: 0 20px 60px rgba(0,0,0,0.08); }
.vip-grid { display: grid; grid-template-columns: 1fr 1.15fr; gap: 4.5rem; }
.vip-form { background: var(--bg-surface); border: 1px solid var(--border-stone); padding: 2.5rem; border-radius: 2px; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1.1rem; margin-bottom: 1.1rem; }
.form-cell { display: flex; flex-direction: column; gap: 0.4rem; }
.form-cell label { font-size: 0.76rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.08em; }
.form-cell input, .form-cell select, .form-cell textarea { background: #fff; border: 1px solid #d3cdc1; padding: 0.8rem 1rem; color: var(--text-main); font-size: 0.94rem; outline: none; border-radius: 2px; }

.v2-footer { border-top: 1px solid var(--border-stone); padding: 5rem 0 3.5rem; background: #eae5d9; }
.footer-grid { display: grid; grid-template-columns: 1.6fr 1fr 1fr; gap: 4rem; }
.footer-grid a { color: var(--text-muted); text-decoration: none; font-size: 0.94rem; }

@media (max-width: 1024px) {
  .header-nav { display: none; }
  .stone-hero-layout, .botanical-grid, .stone-suite-row, .vip-grid, .footer-grid { grid-template-columns: 1fr; gap: 3rem; }
}
`;
}

// ============================================================================
// ARCHETYPE 4: MARITIME RIVIERA & PRIVATE JETTY (Deep Navy & Brass)
// ============================================================================
function generateMaritimeCSS(hotel) {
  const primary = hotel.theme?.primary || '#00e5ff';
  const secondary = hotel.theme?.secondary || '#d4af37';
  const dark = '#040d1a';
  const card = 'rgba(7, 23, 44, 0.8)';

  return `@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700;800;900&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');

:root {
  --bg-deep: ${dark};
  --bg-card: ${card};
  --accent-primary: ${primary};
  --accent-secondary: ${secondary};
  --font-heading: 'Cinzel', serif;
  --font-sans: 'Plus Jakarta Sans', system-ui, sans-serif;
  --border-glass: rgba(0, 229, 255, 0.2);
  --border-accent: ${primary};
  --border-gold: rgba(212, 175, 55, 0.4);
  --radius-lg: 20px;
  --radius-full: 9999px;
  --transition: all 0.35s ease;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; font-size: 16px; background: var(--bg-deep); color: #f8fafc; }
body { font-family: var(--font-sans); background: var(--bg-deep); color: #f8fafc; line-height: 1.7; overflow-x: hidden; }

.container-v2 { width: 100%; max-width: 1380px; margin: 0 auto; padding: 0 2.25rem; }

/* Maritime Header */
.maritime-header { position: sticky; top: 0; z-index: 100; padding: 1.2rem 0; }
.maritime-header-capsule { max-width: 1380px; margin: 0 auto; padding: 0.75rem 2rem; display: flex; align-items: center; justify-content: space-between; background: rgba(5, 17, 34, 0.9); backdrop-filter: blur(28px); border: 1px solid var(--border-glass); border-radius: var(--radius-full); box-shadow: 0 20px 50px rgba(0,0,0,0.8); }
.brand-link { display: flex; align-items: center; gap: 1.2rem; text-decoration: none; }
.brand-disc { width: 56px; height: 56px; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; }
.brand-disc svg { width: 100%; height: 100%; display: block; }
.brand-title { font-family: var(--font-heading); font-size: 1.2rem; font-weight: 800; color: #fff; letter-spacing: 0.1em; }
.header-nav { display: flex; align-items: center; gap: 2rem; }
.nav-item { font-size: 0.9rem; color: #cbd5e1; text-decoration: none; font-weight: 700; }
.btn-maritime-cta { background: linear-gradient(135deg, #00e5ff 0%, #0077b6 100%); color: #020814; border: none; font-size: 0.86rem; font-weight: 800; padding: 0.72rem 1.6rem; border-radius: var(--radius-full); cursor: pointer; }

/* Maritime Hero & Radar */
.hero-maritime { min-height: 88vh; display: flex; align-items: center; padding: 5rem 0 4rem; }
.maritime-split-hero { display: grid; grid-template-columns: 1.2fr 1fr; gap: 4.5rem; align-items: center; }
.maritime-radar-tag { display: inline-flex; align-items: center; gap: 10px; background: rgba(0, 229, 255, 0.08); border: 1px solid var(--border-accent); padding: 0.45rem 1.2rem; border-radius: var(--radius-full); font-size: 0.8rem; font-weight: 800; color: var(--accent-primary); margin-bottom: 1.5rem; }
.maritime-h1 { font-family: var(--font-heading); font-size: clamp(2.4rem, 4.6vw, 4rem); font-weight: 800; line-height: 1.15; color: #fff; margin-bottom: 1.5rem; }
.nautical-radar-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.5rem; margin-top: 3.5rem; }
.nautical-card { background: var(--bg-card); border: 1px solid var(--border-glass); border-radius: 16px; padding: 2rem 1.5rem; text-align: center; }
.nautical-card strong { font-size: 1.7rem; font-family: var(--font-heading); color: var(--accent-primary); display: block; }
.nautical-card span { font-size: 0.76rem; color: #94a3b8; text-transform: uppercase; font-weight: 700; }

/* Maritime Suites */
.v2-section { padding: 7.5rem 0; }
.section-center { text-align: center; max-width: 860px; margin: 0 auto 5rem; }
.maritime-suites-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 3rem; }
.maritime-card { background: var(--bg-card); border-radius: var(--radius-lg); overflow: hidden; border: 1px solid var(--border-glass); }
.maritime-card-media { height: 340px; }
.maritime-card-media img { width: 100%; height: 100%; object-fit: cover; }
.maritime-card-info { padding: 2.75rem; }

.vip-deck { background: var(--bg-card); border: 1.5px solid var(--border-accent); border-radius: var(--radius-lg); padding: 4rem; }
.vip-grid { display: grid; grid-template-columns: 1fr 1.15fr; gap: 4.5rem; }
.vip-form { background: rgba(5, 17, 34, 0.85); border: 1px solid var(--border-glass); padding: 2.5rem; border-radius: 16px; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1.1rem; margin-bottom: 1.1rem; }
.form-cell { display: flex; flex-direction: column; gap: 0.4rem; }
.form-cell input, .form-cell select, .form-cell textarea { background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 10px; padding: 0.75rem 0.95rem; color: #fff; font-size: 0.92rem; outline: none; }

.v2-footer { border-top: 1px solid rgba(255, 255, 255, 0.1); padding: 5rem 0 3.5rem; background: #02070e; }
.footer-grid { display: grid; grid-template-columns: 1.6fr 1fr 1fr; gap: 4rem; }

@media (max-width: 1024px) {
  .header-nav { display: none; }
  .maritime-split-hero, .maritime-suites-grid, .nautical-radar-grid, .vip-grid, .footer-grid { grid-template-columns: 1fr; }
}
`;
}

// Generate CSS router
function generateV2CSS(hotel) {
  const slug = hotel.slug;
  const archetype = HOTEL_ARCHETYPE_MAP[slug] || ARCHETYPES.WATERFRONT_LUXURY;

  if (archetype === ARCHETYPES.WATERFRONT_LUXURY) return generateWaterfrontCSS(hotel);
  if (archetype === ARCHETYPES.BOHEMIAN_GLAMPING) return generateGlampingCSS(hotel);
  if (archetype === ARCHETYPES.STONE_BOTANICAL) return generateStoneBotanicalCSS(hotel);
  if (archetype === ARCHETYPES.MARITIME_RIVIERA) return generateMaritimeCSS(hotel);
  return generateWaterfrontCSS(hotel);
}

// ============================================================================
// HTML BUILDER FOR ALL 4 ARCHETYPES
// ============================================================================
function generateV2HTML(hotel) {
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

  let bodyHTML = '';

  // 1. WATERFRONT LUXURY
  if (archetype === ARCHETYPES.WATERFRONT_LUXURY) {
    bodyHTML = `
    <div class="ambient-aurora-mesh" aria-hidden="true">
      <div class="aurora-orb orb-1"></div>
      <div class="aurora-orb orb-2"></div>
    </div>

    <header class="wf-header">
      <div class="wf-header-capsule">
        <a href="#top" class="brand-link">
          <div class="brand-disc">${getLuxuryEmblem(slug, name, true)}</div>
          <span class="brand-title">${escapeHtml(name).toUpperCase()}</span>
        </a>
        <nav class="header-nav">
          <a href="#suites" class="nav-item">Süitler</a>
          <a href="#rituals" class="nav-item">Koy Ritmi</a>
          <a href="#concierge" class="nav-item">VIP Danışma</a>
        </nav>
        <button class="btn-cta-gold" data-book><span>Rezervasyon Yap ↗</span></button>
      </div>
    </header>

    <main id="top">
      <section class="hero-waterfront">
        <div class="container-v2">
          <div class="hero-wf-grid">
            <div>
              <div class="eyebrow-chip">✦ ${escapeHtml(seaDist).toUpperCase()}</div>
              <h1 class="hero-wf-h1">${escapeHtml(name)}</h1>
              <p style="font-size:1.15rem; color:#cbd5e1; margin-bottom:2.5rem; line-height:1.8;">${escapeHtml(tagline)} — ${escapeHtml(concept)}.</p>
              <div class="hero-wf-dock">
                <form class="wf-dock-grid" onsubmit="return false;">
                  <input type="date" id="heroCheckin" required>
                  <input type="date" id="heroCheckout" required>
                  <select id="heroGuests"><option value="2 Yetişkin">2 Yetişkin</option><option value="1 Yetişkin">1 Yetişkin</option><option value="3+ Misafir">3+ Misafir</option></select>
                  <button type="button" class="btn-cta-gold" id="heroSubmitBtn"><span>Müsaitlik Al →</span></button>
                </form>
              </div>
            </div>
            <div class="stage-card">
              <img src="./media/hero.jpg" alt="${escapeHtml(name)}">
            </div>
          </div>
        </div>
      </section>

      <section class="v2-section" id="suites" style="background: rgba(0,0,0,0.35);">
        <div class="container-v2">
          <div class="section-center">
            <div class="eyebrow-chip">PANORAMİK ODALAR</div>
            <h2 class="section-h2">Koleksiyon Süitleri</h2>
          </div>
          <div class="suites-stack">
            ${rooms.map((room, idx) => `
              <article class="suite-card ${idx % 2 === 1 ? 'reverse' : ''}">
                <div class="suite-img"><img src="${idx === 0 ? './media/suite.jpg' : './media/room.jpg'}" alt="${escapeHtml(room.title)}"></div>
                <div class="suite-info">
                  <div>
                    <span style="color:var(--accent-primary); font-size:0.76rem; letter-spacing:0.2em; font-weight:800; display:block; margin-bottom:0.6rem;">REZİDANS N° 0${idx + 1}</span>
                    <h3 style="font-family:var(--font-heading); font-size:1.85rem; margin-bottom:1rem;">${escapeHtml(room.title)}</h3>
                    <p style="color:#94a3b8; font-size:0.96rem; line-height:1.8; margin-bottom:2rem;">${escapeHtml(room.desc)}</p>
                  </div>
                  <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border-glass); padding-top:1.5rem;">
                    <span style="color:var(--accent-light); font-weight:700;">${escapeHtml(room.size)} · ${escapeHtml(room.view)}</span>
                    <button class="btn-cta-gold" data-suite-name="${escapeHtml(room.title)}"><span>Rezerve Et ↗</span></button>
                  </div>
                </div>
              </article>
            `).join('')}
          </div>
        </div>
      </section>
    `;
  } 
  // 2. BOHEMIAN GLAMPING
  else if (archetype === ARCHETYPES.BOHEMIAN_GLAMPING) {
    bodyHTML = `
    <header class="glamp-header">
      <div class="glamp-header-capsule">
        <a href="#top" class="brand-link">
          <div class="brand-disc">${getLuxuryEmblem(slug, name, true)}</div>
          <span class="brand-title">${escapeHtml(name).toUpperCase()}</span>
        </a>
        <nav class="header-nav">
          <a href="#suites" class="nav-item">Glamping & Odalar</a>
          <a href="#rituals" class="nav-item">Kıyı Ritüelleri</a>
          <a href="#concierge" class="nav-item">Rezervasyon</a>
        </nav>
        <button class="btn-glamp-cta" data-book><span>Müsaitlik Al ↗</span></button>
      </div>
    </header>

    <main id="top">
      <section class="hero-glamping">
        <div class="container-v2">
          <div class="glamp-bento-grid">
            <div class="bento-hero-main">
              <span style="color:var(--accent-primary); font-weight:800; font-size:0.8rem; letter-spacing:0.2em; text-transform:uppercase; margin-bottom:0.8rem; display:block;">✦ BOHEM SAHİL KAÇAMAĞI</span>
              <h1 class="bento-hero-h1">${escapeHtml(name)}</h1>
              <p style="color:#e2d7ce; font-size:1.15rem; max-width:550px; margin-bottom:1.5rem;">${escapeHtml(tagline)}</p>
              <button class="btn-glamp-cta" data-book style="width:fit-content;"><span>Doğada Yerinizi Ayırın ↗</span></button>
            </div>
            <div class="bento-card-side"><img src="./media/suite.jpg" alt="${escapeHtml(name)}"></div>
            <div class="bento-info-box">
              <span style="color:var(--accent-primary); font-size:0.75rem; letter-spacing:0.2em; font-weight:800; text-transform:uppercase;">KOY DENEYİMİ</span>
              <h3 style="font-family:var(--font-heading); font-size:1.35rem; margin:0.4rem 0 0.8rem;">${escapeHtml(seaDist)}</h3>
              <p style="color:#94a3b8; font-size:0.9rem;">${escapeHtml(concept)}</p>
            </div>
          </div>
        </div>
      </section>

      <section class="v2-section" id="rituals">
        <div class="container-v2">
          <div class="section-center">
            <h2 style="font-family:var(--font-heading); font-size:2.8rem; margin-bottom:1rem;">Günün Akışı & Kıyı Hali</h2>
          </div>
          <div class="deck-tracker">
            ${rituals.map((r, i) => `
              <div class="tracker-item">
                <div class="tracker-badge">${i === 0 ? '🌿' : i === 1 ? '☀️' : '🌙'}</div>
                <span style="color:var(--accent-primary); font-weight:800; font-size:0.78rem; display:block; margin-bottom:0.5rem;">${escapeHtml(r.time)}</span>
                <h4 style="font-family:var(--font-heading); font-size:1.35rem; margin-bottom:0.8rem;">${escapeHtml(r.title)}</h4>
                <p style="color:#94a3b8; font-size:0.92rem;">${escapeHtml(r.desc)}</p>
              </div>
            `).join('')}
          </div>
        </div>
      </section>

      <section class="v2-section" id="suites" style="background: rgba(0,0,0,0.3);">
        <div class="container-v2">
          <div class="section-center"><h2 style="font-family:var(--font-heading); font-size:2.8rem;">Konaklama Çadırları & Taş Ev</h2></div>
          <div class="glamp-suites-grid">
            ${rooms.map((room, idx) => `
              <article class="glamp-card">
                <div class="glamp-card-img"><img src="${idx === 0 ? './media/suite.jpg' : './media/room.jpg'}" alt="${escapeHtml(room.title)}"></div>
                <div class="glamp-card-body">
                  <h3 style="font-family:var(--font-heading); font-size:1.6rem; margin-bottom:0.8rem;">${escapeHtml(room.title)}</h3>
                  <p style="color:#94a3b8; font-size:0.94rem; margin-bottom:1.5rem;">${escapeHtml(room.desc)}</p>
                  <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border-glass); padding-top:1.2rem;">
                    <span style="color:var(--accent-primary); font-weight:800;">${escapeHtml(room.size)} · ${escapeHtml(room.view)}</span>
                    <button class="btn-glamp-cta" data-suite-name="${escapeHtml(room.title)}"><span>Seç ↗</span></button>
                  </div>
                </div>
              </article>
            `).join('')}
          </div>
        </div>
      </section>
    `;
  }
  // 3. STONE BOTANICAL SANCTUARY (Linen & Olive)
  else if (archetype === ARCHETYPES.STONE_BOTANICAL) {
    bodyHTML = `
    <header class="stone-header">
      <div class="container-v2 stone-header-bar">
        <a href="#top" class="brand-link">
          <div class="brand-disc">${getLuxuryEmblem(slug, name, true)}</div>
          <span class="brand-title">${escapeHtml(name).toUpperCase()}</span>
        </a>
        <nav class="header-nav">
          <a href="#suites" class="nav-item">Taş Odalar</a>
          <a href="#rituals" class="nav-item">Avlu Ritüelleri</a>
          <a href="#concierge" class="nav-item">İletişim</a>
        </nav>
        <button class="btn-stone-cta" data-book><span>Rezervasyon ↗</span></button>
      </div>
    </header>

    <main id="top">
      <section class="hero-stone">
        <div class="container-v2">
          <div class="stone-hero-layout">
            <div>
              <span class="stone-vertical-tag">TAŞ MİMARİ & ZEYTİNLİK AVLU</span>
              <h1 class="stone-title-h1">${escapeHtml(name)}</h1>
              <p style="font-family:var(--font-serif); font-size:1.35rem; color:var(--accent-primary); font-style:italic; line-height:1.5; margin-bottom:1.5rem;">
                "${escapeHtml(tagline)}"
              </p>
              <p style="color:var(--text-muted); font-size:1.05rem; line-height:1.8; margin-bottom:2.5rem;">${escapeHtml(concept)}.</p>
              <button class="btn-stone-cta" data-book><span>Avluya Adım Atın ↗</span></button>
            </div>
            <div class="stone-hero-frame">
              <img src="./media/hero.jpg" alt="${escapeHtml(name)}">
            </div>
          </div>
        </div>
      </section>

      <section class="v2-section" id="rituals" style="background: var(--bg-surface);">
        <div class="container-v2">
          <div class="section-center">
            <span class="stone-vertical-tag">AVLUDA YAŞAM</span>
            <h2 class="section-h2">Zeytin Ağaçları Altında Gün</h2>
          </div>
          <div class="botanical-grid">
            ${rituals.map(r => `
              <div class="botanical-card">
                <span style="font-size:0.75rem; color:var(--accent-primary); font-weight:800; text-transform:uppercase; letter-spacing:0.1em; display:block; margin-bottom:0.8rem;">${escapeHtml(r.time)}</span>
                <h4 style="font-family:var(--font-heading); font-size:1.4rem; color:var(--text-main); margin-bottom:0.8rem;">${escapeHtml(r.title)}</h4>
                <p style="color:var(--text-muted); font-size:0.92rem;">${escapeHtml(r.desc)}</p>
              </div>
            `).join('')}
          </div>
        </div>
      </section>

      <section class="v2-section" id="suites">
        <div class="container-v2">
          <div class="section-center">
            <span class="stone-vertical-tag">ÖZEL SEÇKİ</span>
            <h2 class="section-h2">Taş Mimarili Butik Süitler</h2>
          </div>
          ${rooms.map((room, idx) => `
            <div class="stone-suite-row">
              <div class="stone-suite-frame"><img src="${idx === 0 ? './media/suite.jpg' : './media/room.jpg'}" alt="${escapeHtml(room.title)}"></div>
              <div>
                <span class="stone-vertical-tag">ODA 0${idx + 1}</span>
                <h3 style="font-family:var(--font-heading); font-size:2.2rem; color:var(--text-main); margin:0.5rem 0 1rem;">${escapeHtml(room.title)}</h3>
                <p style="color:var(--text-muted); font-size:1rem; line-height:1.8; margin-bottom:1.5rem;">${escapeHtml(room.desc)}</p>
                <div style="margin-bottom:2rem; font-weight:600; color:var(--accent-primary);">${escapeHtml(room.size)} · ${escapeHtml(room.view)}</div>
                <button class="btn-stone-cta" data-suite-name="${escapeHtml(room.title)}"><span>Bu Odayı Rezerve Et ↗</span></button>
              </div>
            </div>
          `).join('')}
        </div>
      </section>
    `;
  }
  // 4. MARITIME RIVIERA
  else if (archetype === ARCHETYPES.MARITIME_RIVIERA) {
    bodyHTML = `
    <header class="maritime-header">
      <div class="maritime-header-capsule">
        <a href="#top" class="brand-link">
          <div class="brand-disc">${getLuxuryEmblem(slug, name, true)}</div>
          <span class="brand-title">${escapeHtml(name).toUpperCase()}</span>
        </a>
        <nav class="header-nav">
          <a href="#suites" class="nav-item">Deniz Süitleri</a>
          <a href="#radar" class="nav-item">İskele Radar</a>
          <a href="#concierge" class="nav-item">VIP İskele</a>
        </nav>
        <button class="btn-maritime-cta" data-book><span>İskele Müsaitliği ↗</span></button>
      </div>
    </header>

    <main id="top">
      <section class="hero-maritime">
        <div class="container-v2">
          <div class="maritime-split-hero">
            <div>
              <div class="maritime-radar-tag"><span>⚓ 36°42'N 28°05'E · ÖZEL İSKELE</span></div>
              <h1 class="maritime-h1">${escapeHtml(name)}</h1>
              <p style="color:#cbd5e1; font-size:1.1rem; line-height:1.8; margin-bottom:2.5rem;">${escapeHtml(tagline)} — ${escapeHtml(concept)}.</p>
              <button class="btn-maritime-cta" data-book><span>İskele Rezervasyonu ↗</span></button>
            </div>
            <div style="height:480px; border-radius:20px; overflow:hidden; border:1px solid var(--border-accent);">
              <img src="./media/hero.jpg" alt="${escapeHtml(name)}" style="width:100%; height:100%; object-fit:cover;">
            </div>
          </div>
          <div class="nautical-radar-grid" id="radar">
            <div class="nautical-card"><strong>2.5m</strong><span>İskele Derinliği</span></div>
            <div class="nautical-card"><strong>40m²</strong><span>Güneşlenme Platformu</span></div>
            <div class="nautical-card"><strong>28°C</strong><span>Deniz Suyu Sıcaklığı</span></div>
            <div class="nautical-card"><strong>100%</strong><span>Durgun Turkuaz Koy</span></div>
          </div>
        </div>
      </section>

      <section class="v2-section" id="suites" style="background: rgba(0,0,0,0.35);">
        <div class="container-v2">
          <div class="section-center"><h2 style="font-family:var(--font-heading); font-size:2.8rem;">Deniz Sıfır İskele Süitleri</h2></div>
          <div class="maritime-suites-grid">
            ${rooms.map((room, idx) => `
              <article class="maritime-card">
                <div class="maritime-card-media"><img src="${idx === 0 ? './media/suite.jpg' : './media/room.jpg'}" alt="${escapeHtml(room.title)}"></div>
                <div class="maritime-card-info">
                  <h3 style="font-family:var(--font-heading); font-size:1.6rem; margin-bottom:0.8rem;">${escapeHtml(room.title)}</h3>
                  <p style="color:#94a3b8; font-size:0.95rem; line-height:1.75; margin-bottom:1.5rem;">${escapeHtml(room.desc)}</p>
                  <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border-glass); padding-top:1.2rem;">
                    <span style="color:var(--accent-primary); font-weight:800;">${escapeHtml(room.size)} · ${escapeHtml(room.view)}</span>
                    <button class="btn-maritime-cta" data-suite-name="${escapeHtml(room.title)}"><span>Seç ↗</span></button>
                  </div>
                </div>
              </article>
            `).join('')}
          </div>
        </div>
      </section>
    `;
  }

  // Common VIP Form & Footer
  const commonFooter = `
    <!-- VIP CONCIERGE -->
    <section class="v2-section" id="concierge">
      <div class="container-v2">
        <div class="vip-deck">
          <div class="vip-grid">
            <div>
              <h2 style="font-family:var(--font-heading); font-size:2.4rem; margin-bottom:1.2rem;">Doğrudan Rezervasyon</h2>
              <p style="color:#94a3b8; font-size:0.96rem; line-height:1.8; margin-bottom:2rem;">
                Tarihlerinizi ve misafir sayınızı iletin; ${escapeHtml(name)} ekibi doğrudan en avantajlı fiyat teklifini WhatsApp üzerinden anında paylaşsın.
              </p>
              <div style="display:flex; flex-direction:column; gap:1.2rem;">
                <div><strong style="color:var(--accent-primary); font-size:0.75rem; text-transform:uppercase;">Konum</strong><p>${escapeHtml(address)}</p></div>
                <div><strong style="color:var(--accent-primary); font-size:0.75rem; text-transform:uppercase;">Resepsiyon</strong><p><a href="tel:${escapeHtml(cleanPhone)}" style="color:inherit; text-decoration:none;">${escapeHtml(phone)}</a></p></div>
                <div><strong style="color:var(--accent-primary); font-size:0.75rem; text-transform:uppercase;">WhatsApp Canlı</strong><p><a href="https://wa.me/${escapeHtml(cleanPhone)}?text=Merhaba%20${encodeURIComponent(name)},%20rezervasyon%20hakk%C4%B1nda%20bilgi%20almak%20istiyorum." target="_blank" style="color:var(--accent-primary); font-weight:700;">+90 Selimiye VIP Concierge ↗</a></p></div>
              </div>
            </div>

            <div class="vip-form">
              <h3 style="font-family:var(--font-heading); font-size:1.4rem; margin-bottom:1.5rem;">Müsaitlik Talebi Gönder</h3>
              <form id="v2ContactForm" onsubmit="return false;">
                <div class="form-row">
                  <div class="form-cell">
                    <label>Adınız Soyadınız *</label>
                    <input type="text" id="v2Name" placeholder="Adınız Soyadınız" required>
                  </div>
                  <div class="form-cell">
                    <label>Telefon *</label>
                    <input type="tel" id="v2Phone" placeholder="05XX XXX XX XX" required>
                  </div>
                </div>
                <div class="form-row">
                  <div class="form-cell">
                    <label>Giriş Tarihi *</label>
                    <input type="date" id="v2Checkin" required>
                  </div>
                  <div class="form-cell">
                    <label>Çıkış Tarihi *</label>
                    <input type="date" id="v2Checkout" required>
                  </div>
                </div>
                <div class="form-row">
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
                      <option value="3+ Misafir">3+ Misafir</option>
                    </select>
                  </div>
                </div>
                <div class="form-cell" style="margin-bottom:1.5rem;">
                  <label>Özel İstekler</label>
                  <textarea id="v2Notes" rows="3" placeholder="Örn: Balayı ikramı, tekne transferi..."></textarea>
                </div>
                <button type="button" class="btn-cta-gold btn-glamp-cta btn-stone-cta btn-maritime-cta" id="v2SubmitBtn" style="width:100%; justify-content:center; height:50px;">
                  <span>Talebi İlet & Müsaitlik Al ↗</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>

    <footer class="v2-footer">
      <div class="container-v2">
        <div class="footer-grid">
          <div>
            <div style="font-family:var(--font-heading); font-size:1.4rem; margin-bottom:0.8rem;">${escapeHtml(name).toUpperCase()}</div>
            <p style="color:#94a3b8; font-size:0.92rem; line-height:1.75; margin-bottom:1rem;">${escapeHtml(tagline)}</p>
            <small style="color:#64748b;">${escapeHtml(address)}</small>
          </div>
          <div style="display:flex; flex-direction:column; gap:0.75rem;">
            <strong style="color:var(--accent-primary); font-size:0.8rem; text-transform:uppercase;">Gezinme</strong>
            <a href="#suites" style="color:inherit; text-decoration:none;">Koleksiyon Süitleri</a>
            <a href="#rituals" style="color:inherit; text-decoration:none;">Koy Ritüelleri</a>
            <a href="#concierge" style="color:inherit; text-decoration:none;">VIP Danışma</a>
          </div>
          <div style="display:flex; flex-direction:column; gap:0.75rem;">
            <strong style="color:var(--accent-primary); font-size:0.8rem; text-transform:uppercase;">İletişim</strong>
            <a href="tel:${escapeHtml(cleanPhone)}" style="color:inherit; text-decoration:none;">📞 ${escapeHtml(phone)}</a>
            <a href="https://wa.me/${escapeHtml(cleanPhone)}" target="_blank" style="color:inherit; text-decoration:none;">💬 WhatsApp Canlı Hattı</a>
          </div>
        </div>
      </div>
    </footer>
  </main>`;

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
  ${bodyHTML}
  ${commonFooter}
</body>
</html>`;
}

// Generate JS
function generateArchetypeJS() {
  return `/**
 * SELİMİYE V2 MULTI-ARCHETYPE ENGINE
 */
document.addEventListener('DOMContentLoaded', () => {
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
  console.log('💎 Compiling 24 V2 Selimiye Websites with INDIVIDUAL PHOTOS and 4 RADICAL ARCHETYPES...');
  const js = generateArchetypeJS();

  for (const hotel of rawV2Data.hotels) {
    const slug = hotel.slug;
    const hotelDir = path.join(outBaseDir, slug);
    if (!fs.existsSync(hotelDir)) fs.mkdirSync(hotelDir, { recursive: true });

    // 1. Sync unique photos per hotel
    syncUniqueMedia(hotel, hotelDir);

    // 2. Generate CSS and HTML
    const css = generateV2CSS(hotel);
    const html = generateV2HTML(hotel);

    fs.writeFileSync(path.join(hotelDir, 'index.html'), html, 'utf8');
    fs.writeFileSync(path.join(hotelDir, 'styles.css'), css, 'utf8');
    fs.writeFileSync(path.join(hotelDir, 'app.js'), js, 'utf8');
  }

  console.log('✅ Successfully compiled 24 V2 sites with REAL UNIQUE PHOTOS and 4 RADICALLY DIFFERENT DESIGN WORLDS!');
}

buildAllV2Sites();
