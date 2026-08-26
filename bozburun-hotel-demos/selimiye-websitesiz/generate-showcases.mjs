import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const researchV2 = JSON.parse(fs.readFileSync(path.join(__dirname, 'hotel-research-v2.json'), 'utf8'));
const hotels = researchV2.hotels;

function generateShowcaseHTML(activeVersion) {
  const isV2 = activeVersion === 'v2';
  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Selimiye Butik Otel Siteleri Koleksiyonu — 48 Web Sitesi (24 Otel x V1/V2)</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700;800&family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400;1,600&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg: #070d14;
      --card-bg: rgba(15, 26, 38, 0.75);
      --gold: #d4af37;
      --gold-light: #f3df95;
      --emerald: #00f5a0;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --border: rgba(255, 255, 255, 0.1);
      --font-serif: 'Cormorant Garamond', Georgia, serif;
      --font-heading: 'Cinzel', serif;
      --font-sans: 'Plus Jakarta Sans', sans-serif;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: var(--font-sans);
      min-height: 100vh;
      line-height: 1.6;
      background-image: radial-gradient(circle at 50% 0%, rgba(212, 175, 55, 0.15), transparent 60%);
    }
    .container {
      max-width: 1360px;
      margin: 0 auto;
      padding: 60px 24px;
    }
    header {
      text-align: center;
      margin-bottom: 50px;
    }
    .eyebrow {
      font-size: 0.8rem;
      letter-spacing: 0.25em;
      text-transform: uppercase;
      color: var(--gold-light);
      margin-bottom: 12px;
      font-weight: 700;
    }
    h1 {
      font-family: var(--font-heading);
      font-size: clamp(2.4rem, 4.5vw, 3.8rem);
      font-weight: 700;
      line-height: 1.15;
      margin-bottom: 16px;
      color: #fff;
    }
    h1 em {
      font-family: var(--font-serif);
      font-style: italic;
      color: var(--gold-light);
    }
    .lead {
      max-width: 760px;
      margin: 0 auto 30px;
      color: var(--text-muted);
      font-size: 1.1rem;
    }
    .version-switcher {
      display: inline-flex;
      background: rgba(255, 255, 255, 0.06);
      padding: 6px;
      border-radius: 9999px;
      border: 1px solid var(--border);
      gap: 6px;
    }
    .v-tab {
      padding: 10px 24px;
      border-radius: 9999px;
      font-size: 0.85rem;
      font-weight: 700;
      text-decoration: none;
      color: var(--text-muted);
      transition: all 0.3s;
    }
    .v-tab.active {
      background: var(--gold);
      color: #050a10;
      box-shadow: 0 4px 20px rgba(212, 175, 55, 0.4);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(310px, 1fr));
      gap: 24px;
      margin-top: 40px;
    }
    .hotel-card {
      background: var(--card-bg);
      backdrop-filter: blur(20px);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 24px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .hotel-card:hover {
      border-color: var(--gold);
      transform: translateY(-6px);
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
    }
    .card-top {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 18px;
    }
    .logo-frame {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: #000;
      border: 1.5px solid var(--gold);
      padding: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 15px rgba(212, 175, 55, 0.25);
    }
    .hotel-name {
      font-family: var(--font-heading);
      font-size: 1.25rem;
      font-weight: 700;
      color: #fff;
    }
    .tagline {
      color: var(--text-muted);
      font-size: 0.88rem;
      line-height: 1.5;
      margin-bottom: 20px;
    }
    .card-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      padding-top: 16px;
    }
    .btn-preview {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 10px 14px;
      border-radius: 10px;
      font-size: 0.82rem;
      font-weight: 700;
      text-decoration: none;
      transition: all 0.25s;
    }
    .btn-v1 {
      background: rgba(212, 175, 55, 0.12);
      border: 1px solid rgba(212, 175, 55, 0.35);
      color: var(--gold-light);
    }
    .btn-v1:hover {
      background: var(--gold);
      color: #000;
    }
    .btn-v2 {
      background: rgba(0, 245, 160, 0.12);
      border: 1px solid rgba(0, 245, 160, 0.35);
      color: var(--emerald);
    }
    .btn-v2:hover {
      background: var(--emerald);
      color: #000;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="eyebrow">SELİMİYE BUTİK OTEL PORTFÖYÜ</div>
      <h1>24 Butik Otel, <em>48 Özel Web Sitesi</em></h1>
      <p class="lead">Her otele özel tasarlanmış 3D altın mühür amblem, Obsidian Gold (V1) ve Luminous Aegean Liquid Glass (V2) mimarisiyle hazırlanan web siteleri.</p>
      
      <div class="version-switcher">
        <a href="../v1/index.html" class="v-tab ${!isV2 ? 'active' : ''}">V1: Obsidian Gold Liquid Glass</a>
        <a href="../v2-gemini/index.html" class="v-tab ${isV2 ? 'active' : ''}">V2: Luminous Aegean Liquid Glass</a>
      </div>
    </header>

    <div class="grid">
      ${hotels.map((h, i) => `
        <div class="hotel-card">
          <div>
            <div class="card-top">
              <div class="logo-frame">
                <img src="../v2-gemini/${h.slug}/media/logo.svg" alt="${h.name} Logo" width="100%" height="100%">
              </div>
              <div>
                <h3 class="hotel-name">${h.name}</h3>
                <small style="color:var(--gold-light); font-size:0.75rem;">${h.targetAudience || 'Selimiye Koyu'}</small>
              </div>
            </div>
            <p class="tagline">${h.tagline || 'Selimiye’nin en özel kıyısında butik konaklama deneyimi.'}</p>
          </div>
          <div class="card-actions">
            <a href="../v1/${h.slug}/index.html" class="btn-preview btn-v1" target="_blank">V1 Demo ↗</a>
            <a href="../v2-gemini/${h.slug}/index.html" class="btn-preview btn-v2" target="_blank">V2 Demo ↗</a>
          </div>
        </div>
      `).join('')}
    </div>
  </div>
</body>
</html>`;
}

fs.writeFileSync(path.join(__dirname, 'v1', 'index.html'), generateShowcaseHTML('v1'), 'utf8');
fs.writeFileSync(path.join(__dirname, 'v2-gemini', 'index.html'), generateShowcaseHTML('v2'), 'utf8');

console.log('✅ Updated showcase index pages for both V1 and V2!');
