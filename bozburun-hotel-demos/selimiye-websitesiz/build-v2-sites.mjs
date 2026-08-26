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
// TRUE FULL-BLEED CINEMATIC LIQUID GLASS CSS
// ============================================================================
function generateTrueLiquidCSS(hotel) {
  const theme = hotel.theme || {};
  const primary = theme.primary || '#00f2fe';
  const secondary = theme.secondary || '#d4af37';
  const dark = '#040914';

  return `/* ==========================================================================
   SELİMİYE HOTELS — TRUE FULL-BLEED LIQUID GLASS
   Hotel: ${hotel.name.toUpperCase()}
   ========================================================================== */

@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700;800;900&family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');

:root {
  --bg-deep: ${dark};
  --primary: ${primary};
  --secondary: ${secondary};
  --glow-primary: ${primary}66;
  --glow-secondary: ${secondary}55;

  --glass-nav: rgba(6, 15, 28, 0.72);
  --glass-card: rgba(8, 20, 38, 0.65);
  --glass-dock: rgba(5, 14, 26, 0.78);
  --glass-pill: rgba(255, 255, 255, 0.1);

  --border-glass: rgba(255, 255, 255, 0.2);
  --border-glass-bright: rgba(255, 255, 255, 0.35);
  --border-accent: ${primary}88;
  --border-gold: rgba(212, 175, 55, 0.6);

  --font-serif: 'Cormorant Garamond', Georgia, serif;
  --font-heading: 'Cinzel', serif;
  --font-sans: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;

  --shadow-liquid: 0 30px 80px -10px rgba(0, 0, 0, 0.95), 0 0 40px var(--glow-primary);
  --shadow-gold: 0 0 35px rgba(212, 175, 55, 0.45);
  --shadow-inset-gloss: inset 0 1px 1px rgba(255, 255, 255, 0.45), inset 0 -1px 1px rgba(0, 0, 0, 0.5);

  --blur-glass: blur(28px) saturate(200%);
  --radius-lg: 32px;
  --radius-full: 9999px;
  --transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; font-size: 16px; background: var(--bg-deep); color: #f8fafc; }
body { font-family: var(--font-sans); background: var(--bg-deep); color: #f8fafc; line-height: 1.7; overflow-x: hidden; -webkit-font-smoothing: antialiased; }

.container-liquid { width: 100%; max-width: 1400px; margin: 0 auto; padding: 0 2.5rem; position: relative; z-index: 2; }

/* Floating VisionOS Glass Navigation */
.liquid-topbar { position: fixed; top: 1.5rem; left: 0; right: 0; z-index: 100; transition: var(--transition); }
.liquid-nav-island { max-width: 1360px; margin: 0 auto; padding: 0.75rem 2.25rem; display: flex; align-items: center; justify-content: space-between; background: var(--glass-nav); backdrop-filter: var(--blur-glass); -webkit-backdrop-filter: var(--blur-glass); border: 1px solid var(--border-glass-bright); border-radius: var(--radius-full); box-shadow: var(--shadow-liquid), var(--shadow-inset-gloss); }

.brand-unit { display: flex; align-items: center; gap: 1.25rem; text-decoration: none; }
.brand-medallion { width: 58px; height: 58px; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 25px var(--glow-primary); transition: var(--transition); }
.brand-medallion svg { width: 100%; height: 100%; display: block; }
.brand-title { font-family: var(--font-heading); font-size: 1.25rem; font-weight: 800; letter-spacing: 0.12em; color: #fff; line-height: 1.2; }
.brand-sub { font-size: 0.7rem; letter-spacing: 0.22em; color: var(--primary); text-transform: uppercase; font-weight: 800; display: block; }

.nav-links { display: flex; align-items: center; gap: 2.25rem; }
.nav-link { font-size: 0.94rem; color: #cbd5e1; text-decoration: none; font-weight: 600; transition: color .2s; }
.nav-link:hover { color: #fff; }

.btn-gold-action { background: linear-gradient(135deg, #fff3cf 0%, #d4af37 100%); color: #040810; border: none; font-size: 0.88rem; font-weight: 800; padding: 0.75rem 1.8rem; border-radius: var(--radius-full); cursor: pointer; box-shadow: var(--shadow-gold); transition: var(--transition); display: inline-flex; align-items: center; gap: 6px; }
.btn-gold-action:hover { transform: translateY(-2px); box-shadow: 0 0 45px rgba(212, 175, 55, 0.65); }

/* ============================================================================
   FULL-BLEED CINEMATIC HERO
   ============================================================================ */
.hero-fullbleed-cinema {
  min-height: 100vh;
  position: relative;
  display: flex;
  align-items: flex-end;
  padding: 12rem 0 6rem;
  background: linear-gradient(180deg, rgba(4, 9, 20, 0.45) 0%, rgba(4, 9, 20, 0.88) 100%), url('./media/hero.jpg') center/cover no-repeat fixed;
  overflow: hidden;
}
.hero-fullbleed-cinema::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 20% 40%, var(--glow-primary) 0%, transparent 50%), radial-gradient(circle at 80% 60%, var(--glow-secondary) 0%, transparent 50%);
  pointer-events: none;
  opacity: 0.5;
}

.hero-cinema-content {
  width: 100%;
  position: relative;
  z-index: 2;
}
.hero-eyebrow-chip {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  background: rgba(5, 14, 26, 0.8);
  backdrop-filter: var(--blur-glass);
  border: 1px solid var(--border-accent);
  padding: 0.55rem 1.6rem;
  border-radius: var(--radius-full);
  font-size: 0.82rem;
  font-weight: 800;
  letter-spacing: 0.16em;
  color: var(--primary);
  margin-bottom: 1.8rem;
  box-shadow: var(--shadow-liquid);
}
.hero-cinema-h1 {
  font-family: var(--font-heading);
  font-size: clamp(3.2rem, 6.5vw, 5.8rem);
  font-weight: 800;
  line-height: 1.08;
  color: #fff;
  margin-bottom: 1.5rem;
  text-shadow: 0 4px 40px rgba(0,0,0,0.95);
}
.hero-cinema-h1 em {
  font-family: var(--font-serif);
  font-style: italic;
  font-weight: 400;
  background: linear-gradient(135deg, #fff3cf 0%, #d4af37 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
.hero-cinema-p {
  font-size: 1.25rem;
  color: #e2e8f0;
  max-width: 720px;
  line-height: 1.8;
  margin-bottom: 3.5rem;
  text-shadow: 0 2px 20px rgba(0,0,0,0.9);
}

/* Floating Glass Dock */
.floating-glass-dock {
  background: var(--glass-dock);
  backdrop-filter: var(--blur-glass);
  -webkit-backdrop-filter: var(--blur-glass);
  border: 1.5px solid var(--border-glass-bright);
  border-radius: var(--radius-lg);
  padding: 2rem 2.5rem;
  box-shadow: var(--shadow-liquid), var(--shadow-inset-gloss);
}
.dock-form-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr) auto;
  gap: 1.5rem;
  align-items: center;
}
.dock-field {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}
.dock-field label {
  font-size: 0.74rem;
  font-weight: 800;
  letter-spacing: 0.14em;
  color: var(--primary);
  text-transform: uppercase;
}
.dock-field input, .dock-field select {
  background: var(--glass-pill);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 14px;
  padding: 0.85rem 1.1rem;
  color: #fff;
  font-family: var(--font-sans);
  font-size: 0.96rem;
  outline: none;
  transition: var(--transition);
}
.dock-field input:focus, .dock-field select:focus {
  border-color: var(--primary);
  box-shadow: 0 0 25px var(--glow-primary);
}

/* ============================================================================
   SUITES: 3D PANORAMIC LOOKBOOK
   ============================================================================ */
.v2-section {
  padding: 9rem 0;
  position: relative;
  z-index: 2;
}
.section-center {
  text-align: center;
  max-width: 860px;
  margin: 0 auto 5.5rem;
}
.section-center h2 {
  font-family: var(--font-heading);
  font-size: clamp(2.4rem, 4.6vw, 3.6rem);
  font-weight: 800;
  color: #fff;
  margin-bottom: 1.2rem;
}

.suites-stack {
  display: flex;
  flex-direction: column;
  gap: 4rem;
}
.suite-card-liquid {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  background: var(--glass-card);
  backdrop-filter: var(--blur-glass);
  -webkit-backdrop-filter: var(--blur-glass);
  border: 1px solid var(--border-glass-bright);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-liquid), var(--shadow-inset-gloss);
  transition: var(--transition);
}
.suite-card-liquid.reverse {
  grid-template-columns: 1fr 1.2fr;
}
.suite-card-liquid:hover {
  border-color: var(--primary);
  transform: translateY(-8px);
}
.suite-media-wrap {
  position: relative;
  min-height: 460px;
}
.suite-media-wrap img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.suite-content-wrap {
  padding: 4rem;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
.suite-content-wrap h3 {
  font-family: var(--font-heading);
  font-size: 2.2rem;
  color: #fff;
  margin-bottom: 1.2rem;
}
.suite-content-wrap p {
  color: #94a3b8;
  font-size: 1.05rem;
  line-height: 1.8;
  margin-bottom: 2.5rem;
}

/* ============================================================================
   RITUALS & GASTRONOMY
   ============================================================================ */
.rituals-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2.5rem;
}
.ritual-card-glass {
  background: var(--glass-card);
  backdrop-filter: var(--blur-glass);
  -webkit-backdrop-filter: var(--blur-glass);
  border: 1px solid var(--border-glass-bright);
  border-radius: var(--radius-lg);
  padding: 3.25rem;
  box-shadow: var(--shadow-liquid), var(--shadow-inset-gloss);
  transition: var(--transition);
}
.ritual-card-glass:hover {
  border-color: var(--primary);
  transform: translateY(-8px);
}
.ritual-card-glass h4 {
  font-family: var(--font-heading);
  font-size: 1.6rem;
  color: #fff;
  margin-bottom: 1rem;
}

/* VIP Terminal */
.vip-terminal-box {
  background: var(--glass-card);
  backdrop-filter: var(--blur-glass);
  -webkit-backdrop-filter: var(--blur-glass);
  border: 1.5px solid var(--border-accent);
  border-radius: var(--radius-lg);
  padding: 4.5rem;
  box-shadow: var(--shadow-liquid), var(--shadow-inset-gloss);
}
.vip-grid-2col {
  display: grid;
  grid-template-columns: 1fr 1.15fr;
  gap: 5rem;
}
.vip-grid-2col h2 {
  font-family: var(--font-heading);
  font-size: 2.6rem;
  color: #fff;
  margin-bottom: 1.2rem;
}
.vip-form-inner {
  background: rgba(4, 9, 20, 0.85);
  border: 1px solid var(--border-glass-bright);
  padding: 2.75rem;
  border-radius: 24px;
}
.form-duo {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.2rem;
  margin-bottom: 1.2rem;
}
.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}
.form-field label {
  font-size: 0.76rem;
  font-weight: 800;
  color: #94a3b8;
  text-transform: uppercase;
}
.form-field input, .form-field select, .form-field textarea {
  background: var(--glass-pill);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 12px;
  padding: 0.8rem 1rem;
  color: #fff;
  font-family: var(--font-sans);
  font-size: 0.94rem;
  outline: none;
}
.form-field input:focus, .form-field select:focus, .form-field textarea:focus {
  border-color: var(--primary);
  box-shadow: 0 0 20px var(--glow-primary);
}

.liquid-footer {
  border-top: 1px solid rgba(255, 255, 255, 0.12);
  padding: 5.5rem 0 3.5rem;
  background: #02050b;
}
.footer-3col {
  display: grid;
  grid-template-columns: 1.6fr 1fr 1fr;
  gap: 4.5rem;
}

@media (max-width: 1024px) {
  .nav-links { display: none; }
  .dock-form-grid, .suite-card-liquid, .suite-card-liquid.reverse, .rituals-grid, .vip-grid-2col, .footer-3col { grid-template-columns: 1fr; }
}
`;
}

// ============================================================================
// TRUE FULL-BLEED CINEMATIC LIQUID GLASS HTML
// ============================================================================
function generateTrueLiquidHTML(hotel, detail) {
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
<body data-phone="${escapeHtml(cleanPhone)}" data-hotel="${escapeHtml(name)}">

  <!-- FLOATING VISIONOS GLASS NAVIGATION -->
  <header class="liquid-topbar">
    <div class="liquid-nav-island">
      <a href="#top" class="brand-unit">
        <div class="brand-medallion">
          ${getLuxuryEmblem(slug, name, true)}
        </div>
        <div>
          <span class="brand-title">${escapeHtml(name).toUpperCase()}</span>
          <span class="brand-sub">SELİMİYE · MARMARİS</span>
        </div>
      </a>

      <nav class="nav-links">
        <a href="#suites" class="nav-link">Süitler</a>
        <a href="#rituals" class="nav-link">Koy Ritmi</a>
        <a href="#concierge" class="nav-link">VIP Danışma</a>
      </nav>

      <button class="btn-gold-action" data-book>
        <span>Müsaitlik Al ↗</span>
      </button>
    </div>
  </header>

  <main id="top">
    <!-- FULL-BLEED CINEMATIC HERO -->
    <section class="hero-fullbleed-cinema">
      <div class="container-liquid hero-cinema-content">
        <div class="hero-eyebrow-chip">✦ ${escapeHtml(seaDist).toUpperCase()}</div>
        <h1 class="hero-cinema-h1">
          ${escapeHtml(name)}<br>
          <em>${escapeHtml(tagline)}</em>
        </h1>
        <p class="hero-cinema-p">
          ${escapeHtml(concept)}. Selimiye'nin sakin koyunda, günün temposundan uzaklaşarak berrak sularda dinlenin.
        </p>

        <!-- Floating Glass Dock -->
        <div class="floating-glass-dock">
          <form class="dock-form-grid" onsubmit="return false;">
            <div class="dock-field">
              <label>GİRİŞ TARİHİ</label>
              <input type="date" id="heroCheckin" required>
            </div>
            <div class="dock-field">
              <label>ÇIKIŞ TARİHİ</label>
              <input type="date" id="heroCheckout" required>
            </div>
            <div class="dock-field">
              <label>MİSAFİR</label>
              <select id="heroGuests">
                <option value="2 Yetişkin">2 Yetişkin</option>
                <option value="1 Yetişkin">1 Yetişkin</option>
                <option value="3+ Yetişkin">3+ Yetişkin / Aile</option>
              </select>
            </div>
            <button type="button" class="btn-gold-action" id="heroSubmitBtn" style="height:50px;">
              <span>Müsaitlik Gör →</span>
            </button>
          </form>
        </div>
      </div>
    </section>

    <!-- SUITES: 3D PANORAMIC LOOKBOOK -->
    <section class="v2-section" id="suites">
      <div class="container-liquid">
        <div class="section-center">
          <div class="hero-eyebrow-chip">PANORAMİK KOLEKSİYON</div>
          <h2>Koleksiyon Süitleri</h2>
          <p style="color:#94a3b8; font-size:1.1rem;">Doğal kireçtaşı dokuları, keten kumaşlar ve kesintisiz Ege manzarası.</p>
        </div>

        <div class="suites-stack">
          ${rooms.map((room, idx) => `
            <article class="suite-card-liquid ${idx % 2 === 1 ? 'reverse' : ''}">
              <div class="suite-media-wrap">
                <img src="${idx === 0 ? './media/suite.jpg' : './media/room.jpg'}" alt="${escapeHtml(room.title)}">
              </div>
              <div class="suite-content-wrap">
                <div>
                  <span style="color:var(--primary); font-size:0.75rem; letter-spacing:0.2em; font-weight:800; text-transform:uppercase; display:block; margin-bottom:0.6rem;">SÜİT 0${idx + 1}</span>
                  <h3>${escapeHtml(room.title)}</h3>
                  <p>${escapeHtml(room.desc)}</p>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border-glass); padding-top:1.5rem;">
                  <span style="color:#fff3cf; font-weight:700;">${escapeHtml(room.size)} · ${escapeHtml(room.view)}</span>
                  <button class="btn-gold-action" data-suite-name="${escapeHtml(room.title)}"><span>Rezerve Et ↗</span></button>
                </div>
              </div>
            </article>
          `).join('')}
        </div>
      </div>
    </section>

    <!-- RITUALS -->
    <section class="v2-section" id="rituals" style="background: rgba(3, 8, 18, 0.7);">
      <div class="container-liquid">
        <div class="section-center">
          <div class="hero-eyebrow-chip">24 SAAT SELİMİYE</div>
          <h2>Koyda Günün Akışı</h2>
        </div>
        <div class="rituals-grid">
          ${rituals.map(r => `
            <div class="ritual-card-glass">
              <span style="color:var(--primary); font-size:0.78rem; font-weight:800; letter-spacing:0.12em; display:block; margin-bottom:0.8rem;">${escapeHtml(r.time)}</span>
              <h4>${escapeHtml(r.title)}</h4>
              <p style="color:#94a3b8; font-size:0.96rem; line-height:1.75;">${escapeHtml(r.desc)}</p>
            </div>
          `).join('')}
        </div>
      </div>
    </section>

    <!-- VIP CONCIERGE -->
    <section class="v2-section" id="concierge">
      <div class="container-liquid">
        <div class="vip-terminal-box">
          <div class="vip-grid-2col">
            <div>
              <div class="hero-eyebrow-chip">DOĞRUDAN REZERVASYON</div>
              <h2>${escapeHtml(name)}</h2>
              <p style="color:#94a3b8; font-size:1.05rem; line-height:1.85; margin-bottom:2rem;">
                Tarihlerinizi iletin; en avantajlı doğrudan fiyat teklifini WhatsApp üzerinden anında paylaşalım.
              </p>
              <div style="display:flex; flex-direction:column; gap:1.25rem;">
                <div><strong style="color:var(--primary); font-size:0.75rem; text-transform:uppercase;">Açık Adres</strong><p style="color:#fff;">${escapeHtml(address)}</p></div>
                <div><strong style="color:var(--primary); font-size:0.75rem; text-transform:uppercase;">Resepsiyon</strong><p><a href="tel:${escapeHtml(cleanPhone)}" style="color:#fff; text-decoration:none;">${escapeHtml(phone)}</a></p></div>
                <div><strong style="color:var(--primary); font-size:0.75rem; text-transform:uppercase;">WhatsApp Canlı</strong><p><a href="https://wa.me/${escapeHtml(cleanPhone)}?text=Merhaba%20${encodeURIComponent(name)},%20rezervasyon%20hakk%C4%B1nda%20bilgi%20almak%20istiyorum." target="_blank" style="color:var(--primary); font-weight:700;">+90 Selimiye VIP Concierge ↗</a></p></div>
              </div>
            </div>

            <div class="vip-form-inner">
              <h3 style="font-family:var(--font-heading); font-size:1.4rem; color:#fff; margin-bottom:1.5rem;">Müsaitlik Talebi Gönder</h3>
              <form id="v2ContactForm" onsubmit="return false;">
                <div class="form-duo">
                  <div class="form-field">
                    <label>Adınız Soyadınız *</label>
                    <input type="text" id="v2Name" placeholder="Adınız Soyadınız" required>
                  </div>
                  <div class="form-field">
                    <label>Telefon *</label>
                    <input type="tel" id="v2Phone" placeholder="05XX XXX XX XX" required>
                  </div>
                </div>
                <div class="form-duo">
                  <div class="form-field">
                    <label>Giriş Tarihi *</label>
                    <input type="date" id="v2Checkin" required>
                  </div>
                  <div class="form-field">
                    <label>Çıkış Tarihi *</label>
                    <input type="date" id="v2Checkout" required>
                  </div>
                </div>
                <div class="form-duo">
                  <div class="form-field">
                    <label>Oda Tercihi</label>
                    <select id="v2Suite">
                      <option value="Tüm Odalar">Tüm Odaları Göster</option>
                      ${rooms.map(r => `<option value="${escapeHtml(r.title)}">${escapeHtml(r.title)}</option>`).join('')}
                    </select>
                  </div>
                  <div class="form-field">
                    <label>Misafir</label>
                    <select id="v2Guests">
                      <option value="2 Yetişkin">2 Yetişkin</option>
                      <option value="1 Yetişkin">1 Yetişkin</option>
                      <option value="3+ Yetişkin">3+ Yetişkin</option>
                    </select>
                  </div>
                </div>
                <div class="form-field" style="margin-bottom:1.5rem;">
                  <label>Özel İstekler</label>
                  <textarea id="v2Notes" rows="3" placeholder="Örn: Balayı ikramı, tekne transferi..."></textarea>
                </div>
                <button type="button" class="btn-gold-action" id="v2SubmitBtn" style="width:100%; justify-content:center; height:50px;">
                  <span>Talebi İlet & Müsaitlik Al ↗</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  </main>

  <footer class="liquid-footer">
    <div class="container-liquid">
      <div class="footer-3col">
        <div>
          <div style="font-family:var(--font-heading); font-size:1.4rem; color:#fff; margin-bottom:0.8rem;">${escapeHtml(name).toUpperCase()}</div>
          <p style="color:#94a3b8; font-size:0.92rem; line-height:1.75; margin-bottom:1rem;">${escapeHtml(tagline)}</p>
          <small style="color:#64748b;">${escapeHtml(address)}</small>
        </div>
        <div style="display:flex; flex-direction:column; gap:0.75rem;">
          <strong style="color:var(--primary); font-size:0.8rem; text-transform:uppercase;">Gezinme</strong>
          <a href="#suites" style="color:#94a3b8; text-decoration:none;">Koleksiyon Süitleri</a>
          <a href="#rituals" style="color:#94a3b8; text-decoration:none;">Koy Ritüelleri</a>
          <a href="#concierge" style="color:#94a3b8; text-decoration:none;">VIP Danışma</a>
        </div>
        <div style="display:flex; flex-direction:column; gap:0.75rem;">
          <strong style="color:var(--primary); font-size:0.8rem; text-transform:uppercase;">İletişim</strong>
          <a href="tel:${escapeHtml(cleanPhone)}" style="color:#94a3b8; text-decoration:none;">📞 ${escapeHtml(phone)}</a>
          <a href="https://wa.me/${escapeHtml(cleanPhone)}" target="_blank" style="color:#94a3b8; text-decoration:none;">💬 WhatsApp Canlı Hattı</a>
        </div>
      </div>
    </div>
  </footer>

</body>
</html>`;
}

function generateTrueLiquidJS() {
  return `document.addEventListener('DOMContentLoaded', () => {
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
  console.log('💎 Compiling 24 V2 Selimiye Websites with TRUE FULL-BLEED LIQUID GLASS ARCHITECTURE...');
  const js = generateTrueLiquidJS();

  for (const hotel of rawV2Data.hotels) {
    const slug = hotel.slug;
    const detail = detailBySlug.get(slug);
    const hotelDir = path.join(outBaseDir, slug);
    if (!fs.existsSync(hotelDir)) fs.mkdirSync(hotelDir, { recursive: true });

    syncUniqueMedia(hotel, hotelDir);

    const css = generateTrueLiquidCSS(hotel);
    const html = generateTrueLiquidHTML(hotel, detail);

    fs.writeFileSync(path.join(hotelDir, 'index.html'), html, 'utf8');
    fs.writeFileSync(path.join(hotelDir, 'styles.css'), css, 'utf8');
    fs.writeFileSync(path.join(hotelDir, 'app.js'), js, 'utf8');
  }

  console.log('✅ Successfully compiled 24 V2 websites with TRUE FULL-BLEED LIQUID GLASS!');
}

buildAllV2Sites();
