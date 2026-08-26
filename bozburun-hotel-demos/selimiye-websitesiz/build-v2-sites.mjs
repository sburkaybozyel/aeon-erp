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
// ULTRA-LUXURIOUS MODERN LIQUID GLASS V2 CSS
// ============================================================================
function generateV2MasterCSS(hotel) {
  const theme = hotel.theme || {};
  const primary = theme.primary || '#00f2fe';
  const secondary = theme.secondary || '#d4af37';
  const dark = theme.dark || '#030812';
  const card = theme.card || 'rgba(9, 24, 44, 0.75)';
  const accentLight = theme.accent || '#fff3cf';

  return `/* ==========================================================================
   SELİMİYE HOTELS — ULTRA-LUXURY LIQUID GLASS V2
   Hotel: ${hotel.name.toUpperCase()}
   Theme: ${theme.paletteName || 'Obsidian Neon'}
   ========================================================================== */

@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700;800;900&family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');

:root {
  --bg-deep: ${dark};
  --bg-panel: ${card};
  --bg-panel2: color-mix(in srgb, ${dark} 80%, #ffffff 20%);
  --cream: #f8fafc;
  --muted: #94a3b8;
  --line: rgba(255, 255, 255, 0.15);
  
  --accent-primary: ${primary};
  --accent-secondary: ${secondary};
  --accent-light: ${accentLight};
  --glow-primary: ${primary}55;

  --sans: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
  --serif: 'Cormorant Garamond', Georgia, serif;
  --display: 'Cinzel', serif;
  --ease: cubic-bezier(.16, .84, .32, 1);
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; font-size: 16px; background-color: var(--bg-deep); color: var(--cream); }
body { font-family: var(--sans); background-color: var(--bg-deep); color: var(--cream); line-height: 1.65; overflow-x: hidden; position: relative; -webkit-font-smoothing: antialiased; }

/* Ambient Liquid Aurora Mesh */
.ambient-glow { position: fixed; border-radius: 50%; filter: blur(140px); pointer-events: none; z-index: 0; opacity: 0.4; animation: floatGlow 22s infinite alternate; }
.glow-1 { top: -10vw; left: 15vw; width: 60vw; height: 60vw; background: radial-gradient(circle, var(--glow-primary) 0%, transparent 70%); }
.glow-2 { top: 45vh; right: -10vw; width: 55vw; height: 55vw; background: radial-gradient(circle, ${secondary}44 0%, transparent 70%); animation-delay: -7s; }
@keyframes floatGlow { 0% { transform: translate(0,0) scale(1); } 100% { transform: translate(-40px, 50px) scale(1.08); } }

/* Floating Topbar */
.topbar { position: sticky; top: 0; z-index: 100; height: 84px; padding: 0 4.5vw; display: grid; grid-template-columns: 1fr auto 1fr; gap: 35px; align-items: center; background: rgba(5, 14, 26, 0.85); backdrop-filter: blur(28px); border-bottom: 1px solid var(--line); }
.brand-lockup { display: flex; align-items: center; gap: 14px; text-decoration: none; }
.brand-orbit { width: 58px; height: 58px; border-radius: 50%; overflow: hidden; display: grid; place-items: center; box-shadow: 0 0 25px var(--glow-primary); transition: transform .3s; }
.brand-orbit:hover { transform: scale(1.08); }
.brand-orbit svg { width: 100%; height: 100%; display: block; }
.brand-lockup b { display: block; font-family: var(--display); font-size: 1.15rem; font-weight: 800; letter-spacing: 0.08em; color: #fff; line-height: 1.2; }
.brand-lockup small { display: block; color: var(--accent-primary); font-size: 0.72rem; letter-spacing: 0.2em; text-transform: uppercase; font-weight: 700; margin-top: 3px; }

.topbar nav { display: flex; gap: 28px; font-size: 0.88rem; font-weight: 600; }
.topbar nav a { color: #cbd5e1; text-decoration: none; transition: color .2s; }
.topbar nav a:hover { color: var(--accent-primary); }

.topbar-right { display: flex; justify-content: flex-end; align-items: center; gap: 24px; }
.open-state { color: var(--accent-primary); font-size: 0.76rem; letter-spacing: 0.12em; text-transform: uppercase; font-weight: 700; display: inline-flex; align-items: center; gap: 8px; }
.open-state i { width: 8px; height: 8px; border-radius: 50%; background: var(--accent-primary); box-shadow: 0 0 10px var(--accent-primary); animation: flash 2s infinite; }
@keyframes flash { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }

.btn-pill-cta { background: linear-gradient(135deg, #fff3cf 0%, #d4af37 100%); color: #040810; border: none; font-size: 0.82rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; padding: 0.65rem 1.4rem; border-radius: 9999px; cursor: pointer; box-shadow: 0 0 30px rgba(212, 175, 55, 0.4); transition: transform .2s, box-shadow .2s; }
.btn-pill-cta:hover { transform: translateY(-2px); box-shadow: 0 0 40px rgba(212, 175, 55, 0.6); }

/* Hero / Arrival */
.arrival { min-height: 86vh; position: relative; padding: 0 5vw 65px; overflow: hidden; display: flex; align-items: center; }
.arrival-media { position: absolute; inset: 0 0 0 32%; overflow: hidden; background: #051422; }
.arrival-media img { width: 100%; height: 100%; object-fit: cover; }
.arrival-gradient { position: absolute; inset: 0; background: linear-gradient(90deg, var(--bg-deep) 0%, rgba(3, 8, 18, 0.88) 18%, rgba(3, 8, 18, 0.15) 70%), linear-gradient(0deg, var(--bg-deep) 0%, transparent 60%); }
.arrival-shell { width: 100%; max-width: 1360px; margin: 0 auto; display: grid; grid-template-columns: 1fr 380px; gap: 6vw; align-items: end; position: relative; z-index: 2; padding-top: 4rem; }
.arrival-title { max-width: 620px; }
.eyebrow { font-size: 0.76rem; letter-spacing: 0.22em; text-transform: uppercase; color: var(--accent-primary); font-weight: 800; margin-bottom: 1.25rem; display: block; }
.arrival-title h1 { font-family: var(--display); font-size: clamp(2.6rem, 5.2vw, 4.4rem); font-weight: 800; line-height: 1.12; color: #fff; margin-bottom: 1.5rem; text-shadow: 0 4px 30px rgba(0,0,0,0.9); }
.arrival-title h1 strong { font-family: var(--serif); font-style: italic; font-weight: 400; color: var(--accent-light); }
.arrival-title p { font-size: 1.12rem; color: #cbd5e1; line-height: 1.8; margin-bottom: 2rem; }

/* Floating Glass Reserve Card */
.reserve-card { background: var(--bg-panel); backdrop-filter: blur(28px); border: 1.5px solid var(--accent-primary); border-radius: 24px; padding: 2.25rem; box-shadow: 0 30px 80px rgba(0,0,0,0.9), 0 0 40px var(--glow-primary); }
.reserve-card-top { display: flex; justify-content: space-between; font-size: 0.75rem; letter-spacing: 0.14em; color: var(--accent-primary); font-weight: 800; margin-bottom: 1.5rem; text-transform: uppercase; }
.reserve-row { display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid var(--line); padding: 1rem 0; gap: 12px; }
.reserve-row small { font-size: 0.72rem; color: var(--muted); text-transform: uppercase; font-weight: 700; }
.reserve-row strong { font-family: var(--display); font-size: 1.05rem; color: #fff; }
.card-button { width: 100%; padding: 1rem; background: linear-gradient(135deg, #fff3cf 0%, #d4af37 100%); color: #040810; border: none; font-size: 0.86rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; border-radius: 12px; cursor: pointer; margin-top: 1.25rem; transition: transform .2s; }
.card-button:hover { transform: translateY(-2px); }

/* Marquee Ticker */
.marquee { overflow: hidden; background: var(--bg-panel); border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); padding: 1rem 0; }
.marquee-track { display: flex; width: max-content; animation: marqueeScroll 34s linear infinite; }
.marquee-track span { white-space: nowrap; font-family: var(--serif); font-style: italic; font-size: 1.25rem; color: var(--accent-light); padding-right: 2rem; }
@keyframes marqueeScroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }

/* Signal Row 4-Column Bar */
.signal-row { display: grid; grid-template-columns: repeat(4, 1fr); margin: 0 4.5vw; border: 1px solid var(--line); border-top: none; background: var(--bg-panel); backdrop-filter: blur(20px); border-radius: 0 0 20px 20px; overflow: hidden; }
.signal-row>div { padding: 1.75rem 2rem; border-right: 1px solid var(--line); display: flex; flex-direction: column; justify-content: center; }
.signal-row>div:last-child { border-right: none; }
.signal-row span { font-size: 0.75rem; color: var(--accent-primary); font-weight: 800; text-transform: uppercase; margin-bottom: 0.35rem; }
.signal-row b { font-family: var(--display); font-size: 1.15rem; color: #fff; margin-bottom: 0.25rem; }
.signal-row small { font-size: 0.82rem; color: var(--muted); }

/* Stay Board (Asymmetrical 3-Column Suites) */
.stay-board { padding: 8rem 4.5vw; display: grid; grid-template-columns: 0.8fr 1.3fr 0.9fr; gap: 3.5rem; align-items: center; }
.board-intro h2 { font-family: var(--display); font-size: clamp(2.4rem, 4.4vw, 3.6rem); line-height: 1.15; color: #fff; margin-bottom: 1.5rem; }
.board-intro h2 em { font-family: var(--serif); font-style: italic; font-weight: 400; color: var(--accent-light); }
.board-image { position: relative; height: 580px; border-radius: 24px; overflow: hidden; border: 1.5px solid var(--accent-primary); box-shadow: 0 30px 80px rgba(0,0,0,0.9), 0 0 40px var(--glow-primary); }
.board-image img { width: 100%; height: 100%; object-fit: cover; }
.image-pin { position: absolute; left: 1.5rem; bottom: 1.5rem; background: rgba(5, 14, 26, 0.9); backdrop-filter: blur(16px); border: 1px solid var(--line); padding: 0.6rem 1.2rem; border-radius: 9999px; font-size: 0.8rem; font-weight: 800; color: var(--accent-primary); }

.board-spec h3 { font-family: var(--display); font-size: 1.8rem; color: #fff; margin-bottom: 1rem; }
.board-spec p { font-size: 0.96rem; color: var(--muted); line-height: 1.8; margin-bottom: 1.5rem; }
.board-spec ul { list-style: none; border-top: 1px solid var(--line); margin-bottom: 2rem; }
.board-spec li { padding: 0.85rem 0; border-bottom: 1px solid var(--line); font-size: 0.92rem; color: #cbd5e1; display: flex; align-items: center; gap: 12px; }
.board-spec li span { color: var(--accent-primary); font-weight: 800; font-size: 0.78rem; }

/* Experience Split Grid */
.experience-grid { padding: 0 4.5vw 8rem; display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; }
.experience-card { background: var(--bg-panel); border-radius: 24px; overflow: hidden; border: 1px solid var(--line); }
.experience-image { position: relative; height: 500px; }
.experience-image img { width: 100%; height: 100%; object-fit: cover; }
.experience-copy { padding: 4rem; display: flex; flex-direction: column; justify-content: center; }
.experience-copy h2 { font-family: var(--display); font-size: 2.2rem; color: #fff; margin-bottom: 1.5rem; }
.route-list { margin: 2rem 0; border-top: 1px solid var(--line); }
.route-list span { display: flex; gap: 14px; padding: 1rem 0; border-bottom: 1px solid var(--line); font-size: 0.92rem; color: #cbd5e1; }
.route-list b { color: var(--accent-primary); font-family: var(--display); font-size: 0.88rem; }

/* Table Gastronomy Video Deck */
.table-module { margin: 0 4.5vw 8rem; display: grid; grid-template-columns: 120px 1.1fr 1fr; background: var(--bg-panel); border: 1.5px solid var(--accent-secondary); border-radius: 24px; overflow: hidden; box-shadow: 0 30px 80px rgba(0,0,0,0.9); }
.table-label { padding: 2.5rem 1.5rem; display: flex; flex-direction: column; justify-content: space-between; border-right: 1px solid var(--line); color: var(--accent-primary); font-size: 0.78rem; letter-spacing: 0.16em; font-weight: 800; text-transform: uppercase; }
.table-label span:first-child { font-family: var(--display); font-size: 2rem; color: var(--accent-secondary); }
.table-copy { padding: 4rem; display: flex; flex-direction: column; justify-content: center; }
.table-copy h2 { font-family: var(--display); font-size: 2.2rem; color: #fff; margin-bottom: 1.25rem; }
.table-texture { position: relative; }
.table-texture video { width: 100%; height: 100%; object-fit: cover; display: block; }

/* Contact Hub & Form */
.hotel-contact-hub { padding: 8rem 4.5vw; background: var(--bg-deep); border-top: 1px solid var(--line); }
.contact-hub-grid { display: grid; grid-template-columns: 1fr 1.15fr; gap: 4rem; }
.contact-info-card { background: var(--bg-panel); border: 1px solid var(--line); border-radius: 24px; padding: 3rem; display: flex; flex-direction: column; gap: 2rem; }
.card-item-label { font-size: 0.74rem; letter-spacing: 0.2em; color: var(--accent-primary); font-weight: 800; text-transform: uppercase; }
.card-item-value { font-family: var(--display); font-size: 1.25rem; color: #fff; }

.contact-form-box { background: var(--bg-panel); border: 1.5px solid var(--accent-primary); border-radius: 24px; padding: 3rem; box-shadow: 0 0 40px var(--glow-primary); }
.form-duo { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem; }
.form-cell { display: flex; flex-direction: column; gap: 0.4rem; }
.form-cell label { font-size: 0.74rem; font-weight: 800; color: var(--muted); text-transform: uppercase; }
.form-cell input, .form-cell select, .form-cell textarea { background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 12px; padding: 0.75rem 0.95rem; color: #fff; font-family: var(--sans); font-size: 0.92rem; outline: none; }
.form-cell input:focus, .form-cell select:focus, .form-cell textarea:focus { border-color: var(--accent-primary); box-shadow: 0 0 15px var(--glow-primary); }

footer { padding: 3rem 4.5vw; border-top: 1px solid var(--line); display: flex; justify-content: space-between; align-items: center; font-size: 0.84rem; color: var(--muted); }
footer a { color: var(--accent-primary); text-decoration: none; }

@media (max-width: 1024px) {
  .topbar nav { display: none; }
  .arrival-shell, .signal-row, .stay-board, .experience-grid, .table-module, .contact-hub-grid { grid-template-columns: 1fr; }
  .arrival-media { inset: 0; }
  .table-label { border-right: none; border-bottom: 1px solid var(--line); flex-direction: row; }
}
`;
}

// ============================================================================
// ULTRA-DETAILED V2 HTML BUILDER
// ============================================================================
function generateV2MasterHTML(hotel, detail) {
  const name = hotel.name;
  const slug = hotel.slug;
  const phone = detail?.phone || hotel.phone || '0252 456 23 40';
  const cleanPhone = phone.replace(/\D/g, '') || '902524562340';
  const address = detail?.address || hotel.location || 'Selimiye Koyu, Marmaris / Muğla';
  const tagline = hotel.tagline || 'Koyun Sessizliğinde, Kıyının Tam Önünde';
  const concept = hotel.concept || 'Kıyı Dinginliği & Lüks Butik Konaklama';
  const audience = hotel.targetAudience || 'Seçkin Misafirler';
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
  <title>${escapeHtml(name)} — Selimiye | Luminous Liquid Glass (V2)</title>
  
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="./styles.css?v=${Date.now()}">
  <script defer src="./app.js?v=${Date.now()}"></script>
</head>
<body class="edition-v2-liquid" data-phone="${escapeHtml(cleanPhone)}" data-hotel="${escapeHtml(name)}">

  <div class="ambient-glow glow-1" aria-hidden="true"></div>
  <div class="ambient-glow glow-2" aria-hidden="true"></div>

  <!-- FLOATING TOPBAR -->
  <header class="topbar">
    <a class="brand-lockup" href="#top">
      <span class="brand-orbit">
        ${getLuxuryEmblem(slug, name, true)}
      </span>
      <span>
        <b>${escapeHtml(name).toUpperCase()}</b>
        <small>${escapeHtml(seaDist).toUpperCase()}</small>
      </span>
    </a>
    
    <nav>
      <a href="#rooms">Odalar & Süitler</a>
      <a href="#experience">Koy Ritmi</a>
      <a href="#table">Gastronomi</a>
      <a href="#contact">İletişim & Konum</a>
    </nav>

    <div class="topbar-right">
      <span class="open-state"><i></i> ☀️ 28°C SELİMİYE</span>
      <button class="btn-pill-cta" data-book>Yerinizi Ayırın ↗</button>
    </div>
  </header>

  <main id="top">
    <!-- HERO ARRIVAL -->
    <section class="arrival" id="place">
      <div class="arrival-media">
        <img src="./media/hero.jpg" alt="${escapeHtml(name)} Selimiye Manzarası">
        <div class="arrival-gradient"></div>
      </div>
      <div class="arrival-shell">
        <div class="arrival-title">
          <p class="eyebrow">${escapeHtml(seaDist).toUpperCase()} · SELİMİYE</p>
          <h1>
            ${escapeHtml(name)}<br>
            <strong>${escapeHtml(tagline)}</strong>
          </h1>
          <p>${escapeHtml(concept)}. Selimiye’nin sakin koyunda, günün temposundan uzaklaşarak berrak sularda dinlenin.</p>
        </div>

        <aside class="reserve-card">
          <div class="reserve-card-top">
            <span>REZERVASYON</span>
            <b>V2 LIQUID</b>
          </div>
          <div class="reserve-row">
            <small>GİRİŞ</small>
            <strong>Tarihinizi Seçin</strong>
          </div>
          <div class="reserve-row">
            <small>KONUM</small>
            <strong>${escapeHtml(address)}</strong>
          </div>
          <div class="reserve-row">
            <small>KONONSEPT</small>
            <strong>${escapeHtml(audience)}</strong>
          </div>
          <button class="card-button" data-book>Müsaitlik ve Fiyat Gör ↗</button>
        </aside>
      </div>
    </section>

    <!-- MARQUEE -->
    <div class="marquee" aria-hidden="true">
      <div class="marquee-track">
        <span>${escapeHtml(name)} — ${escapeHtml(seaDist)} — ${escapeHtml(tagline)} — ${escapeHtml(address)} — </span>
        <span>${escapeHtml(name)} — ${escapeHtml(seaDist)} — ${escapeHtml(tagline)} — ${escapeHtml(address)} — </span>
      </div>
    </div>

    <!-- SIGNAL ROW -->
    <section class="signal-row">
      <div>
        <span>01 / LOKASYON</span>
        <b>Selimiye Koyu</b>
        <small>${escapeHtml(address)}</small>
      </div>
      <div>
        <span>02 / İMZA SÜİT</span>
        <b>${escapeHtml(rooms[0]?.title || 'Deluxe Taş Süit')}</b>
        <small>${escapeHtml(rooms[0]?.size || '36 m²')} · ${escapeHtml(rooms[0]?.view || 'Deniz')}</small>
      </div>
      <div>
        <span>03 / RİTÜEL</span>
        <b>Koyda Yavaş Sabah</b>
        <small>Serpme Ege Kahvaltısı</small>
      </div>
      <div>
        <span>04 / İLETİŞİM</span>
        <b>${escapeHtml(phone)}</b>
        <small>7/24 Misafir Karşılama</small>
      </div>
    </section>

    <!-- STAY BOARD (ROOMS) -->
    <section class="stay-board" id="rooms">
      <div class="board-intro">
        <p class="eyebrow">SEÇKİN KONAKLAMA</p>
        <h2>Koyun Sessizliğinde<br><em>Doğal Odalar</em></h2>
        <p>Taş mimarinin serinliği, doğal ahşap detaylar ve Ege Denizi'ni kucaklayan geniş özel teraslar.</p>
      </div>

      <div class="board-image">
        <img src="./media/suite.jpg" alt="${escapeHtml(rooms[0]?.title || 'Süit')}">
        <span class="image-pin">${escapeHtml(rooms[0]?.badge || 'Özel Seri')}</span>
      </div>

      <div class="board-spec">
        <p class="eyebrow">${escapeHtml(rooms[0]?.size || '36 m²')} · ${escapeHtml(rooms[0]?.view || 'Deniz')}</p>
        <h3>${escapeHtml(rooms[0]?.title || 'Deluxe Süit')}</h3>
        <p>${escapeHtml(rooms[0]?.desc || 'Ferah banyo, doğal keten dokular ve dingin koy manzarası.')}</p>
        <ul>
          <li><span>01</span> Doğal kireçtaşı ve keten tekstil dokuları</li>
          <li><span>02</span> Geniş deniz manzaralı balkon veya avlu verandası</li>
          <li><span>03</span> Özel ahşap iskele ve şezlong kullanımı dahil</li>
        </ul>
        <button class="btn-pill-cta" data-suite-name="${escapeHtml(rooms[0]?.title)}">Bu Odayı Rezerve Et ↗</button>
      </div>
    </section>

    <!-- EXPERIENCE GRID -->
    <section class="experience-grid" id="experience">
      <div class="experience-card experience-image">
        <img src="./media/room.jpg" alt="${escapeHtml(name)} Ortak Alan">
      </div>
      <div class="experience-card experience-copy">
        <p class="eyebrow">24 SAAT SELİMİYE</p>
        <h2>Günün Akışı &<br><em>Kıyı Ritmi</em></h2>
        <div class="route-list">
          ${rituals.map(r => `
            <span>
              <b>${escapeHtml(r.time)}</b>
              <div>
                <strong style="display:block; color:#fff; font-family:var(--display); font-size:1.05rem; margin-bottom:2px;">${escapeHtml(r.title)}</strong>
                <small style="color:var(--muted);">${escapeHtml(r.desc)}</small>
              </div>
            </span>
          `).join('')}
        </div>
      </div>
    </section>

    <!-- TABLE GASTRONOMY -->
    <section class="table-module" id="table">
      <div class="table-label">
        <span>03</span>
        <span>TOPRAKTAN & DENİZDEN</span>
      </div>
      <div class="table-copy">
        <p class="eyebrow">EGE MUTFAĞI</p>
        <h2>Tadım Sofrası & Kıyı Masası</h2>
        <p style="color:var(--muted); line-height:1.8; margin-bottom:2rem;">
          Selimiye'nin erken hasat zeytinyağları, sabah toplanan şifalı Ege otları ve günlük taze deniz balıklarıyla hazırlanan gün batımı sofraları.
        </p>
        <button class="btn-pill-cta" data-book>Masa & Oda Ayırtın ↗</button>
      </div>
      <div class="table-texture">
        <video autoplay muted loop playsinline poster="./media/dining.jpg">
          <source src="./media/decor.mp4" type="video/mp4">
        </video>
      </div>
    </section>

    <!-- HOTEL CONTACT & VIP HUB -->
    <section class="hotel-contact-hub" id="contact">
      <div class="contact-hub-grid">
        <div class="contact-info-card">
          <div>
            <p class="eyebrow">DOĞRUDAN İLETİŞİM</p>
            <h2 style="font-family:var(--display); font-size:2.2rem; color:#fff; margin-bottom:1rem;">${escapeHtml(name)}</h2>
            <p style="color:var(--muted);">${escapeHtml(tagline)}</p>
          </div>

          <div>
            <span class="card-item-label">AÇIK ADRES</span>
            <p style="color:#fff; font-size:1.05rem; margin-top:4px;">${escapeHtml(address)}</p>
          </div>

          <div>
            <span class="card-item-label">RESEPSİYON TELEFON</span>
            <p style="margin-top:4px;"><a href="tel:${escapeHtml(cleanPhone)}" style="color:var(--accent-primary); font-size:1.15rem; font-weight:700; text-decoration:none;">${escapeHtml(phone)}</a></p>
          </div>

          <div>
            <span class="card-item-label">WHATSAPP CANLI REZERVASYON</span>
            <p style="margin-top:4px;"><a href="https://wa.me/${escapeHtml(cleanPhone)}?text=Merhaba%20${encodeURIComponent(name)},%20rezervasyon%20hakk%C4%B1nda%20bilgi%20almak%20istiyorum." target="_blank" style="color:#25D366; font-size:1.1rem; font-weight:700; text-decoration:none;">💬 WhatsApp Üzerinden Yazın ↗</a></p>
          </div>
        </div>

        <div class="contact-form-box">
          <h3 style="font-family:var(--display); font-size:1.45rem; color:#fff; margin-bottom:1.5rem;">Müsaitlik Talebi Gönder</h3>
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
                  <option value="3+ Yetişkin">3+ Yetişkin</option>
                </select>
              </div>
            </div>
            <div class="form-cell" style="margin-bottom:1.5rem;">
              <label>Özel İstekler</label>
              <textarea id="v2Notes" rows="3" placeholder="Örn: Balayı ikramı, tekne transferi, geç giriş..."></textarea>
            </div>
            <button type="button" class="card-button" id="v2SubmitBtn">Talebi İlet & Müsaitlik Al ↗</button>
          </form>
        </div>
      </div>
    </section>
  </main>

  <footer>
    <span>© ${new Date().getFullYear()} ${escapeHtml(name)}. Tüm Hakları Saklıdır.</span>
    <span>Selimiye Koyu · Marmaris / Muğla</span>
    <a href="#top">Yukarı Çık ↑</a>
  </footer>

</body>
</html>`;
}

function generateV2MasterJS() {
  return `document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-book]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
    });
  });

  document.querySelectorAll('[data-suite-name]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const name = e.currentTarget.getAttribute('data-suite-name');
      const select = document.getElementById('v2Suite');
      if (select && name) select.value = name;
      document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
    });
  });

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
  console.log('💎 Compiling 24 V2 Selimiye Websites with FULL MASTER ARCHITECTURE & UNIQUE MEDIA...');
  const js = generateV2MasterJS();

  for (const hotel of rawV2Data.hotels) {
    const slug = hotel.slug;
    const detail = detailBySlug.get(slug);
    const hotelDir = path.join(outBaseDir, slug);
    if (!fs.existsSync(hotelDir)) fs.mkdirSync(hotelDir, { recursive: true });

    syncUniqueMedia(hotel, hotelDir);

    const css = generateV2MasterCSS(hotel);
    const html = generateV2MasterHTML(hotel, detail);

    fs.writeFileSync(path.join(hotelDir, 'index.html'), html, 'utf8');
    fs.writeFileSync(path.join(hotelDir, 'styles.css'), css, 'utf8');
    fs.writeFileSync(path.join(hotelDir, 'app.js'), js, 'utf8');
  }

  console.log('✅ Successfully compiled and deployed all 24 V2 sites with MASTER LIQUID ARCHITECTURE!');
}

buildAllV2Sites();
