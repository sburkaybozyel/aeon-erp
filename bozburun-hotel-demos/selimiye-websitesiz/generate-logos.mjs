import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const baseDir = __dirname;
const research = JSON.parse(fs.readFileSync(path.join(baseDir, 'hotel-research-v2.json'), 'utf8'));

// Haute Joaillerie 3D Gold Foil Shader & Lighting Filters
function getShaderDefs(idPrefix) {
  return `
  <defs>
    <!-- Bullion Gold Linear Gradient -->
    <linearGradient id="${idPrefix}_gold3D" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fff8db"/>
      <stop offset="15%" stop-color="#ffe699"/>
      <stop offset="35%" stop-color="#d4af37"/>
      <stop offset="60%" stop-color="#9a7322"/>
      <stop offset="85%" stop-color="#eac66f"/>
      <stop offset="100%" stop-color="#735010"/>
    </linearGradient>
    
    <!-- Specular Platinum Gold Glow -->
    <linearGradient id="${idPrefix}_goldSheen" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#805b18"/>
      <stop offset="30%" stop-color="#fdf3d1"/>
      <stop offset="70%" stop-color="#c59f42"/>
      <stop offset="100%" stop-color="#543c0f"/>
    </linearGradient>

    <!-- Deep Metallic Shadow Filter -->
    <filter id="${idPrefix}_emboss" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000000" flood-opacity="0.6"/>
    </filter>

    <!-- Radial Dark Backdrop Glow -->
    <radialGradient id="${idPrefix}_darkGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#141f2e"/>
      <stop offset="70%" stop-color="#070c13"/>
      <stop offset="100%" stop-color="#030508"/>
    </radialGradient>

    <radialGradient id="${idPrefix}_lightGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="70%" stop-color="#faf7f0"/>
      <stop offset="100%" stop-color="#f0ebe0"/>
    </radialGradient>
  </defs>
  `;
}

function buildLuxuryLogo(slug, name, isDark = true) {
  const p = isDark ? 'd' : 'l';
  const bg = isDark ? `url(#${p}_darkGlow)` : `url(#${p}_lightGlow)`;
  const gold = `url(#${p}_gold3D)`;
  const sheen = `url(#${p}_goldSheen)`;
  const textColor = isDark ? '#fbf1ce' : '#143527';
  const filter = `filter="url(#${p}_emboss)"`;

  // Standard high-luxury bezel framing
  const frame = `
    <circle cx="150" cy="150" r="146" fill="${bg}"/>
    <circle cx="150" cy="150" r="142" fill="none" stroke="${gold}" stroke-width="2.5"/>
    <circle cx="150" cy="150" r="134" fill="none" stroke="${sheen}" stroke-width="1" stroke-dasharray="3 3" opacity="0.9"/>
    <circle cx="150" cy="150" r="128" fill="none" stroke="${gold}" stroke-width="1.5"/>

    <!-- 4 Royal Jewels -->
    <circle cx="150" cy="16" r="3.5" fill="${gold}"/>
    <circle cx="150" cy="284" r="3.5" fill="${gold}"/>
    <circle cx="16" cy="150" r="3.5" fill="${gold}"/>
    <circle cx="284" cy="150" r="3.5" fill="${gold}"/>
  `;

  let artwork = '';

  switch (slug) {
    case 'duru-selimiye':
      artwork = `
        <!-- DURU: Brilliant Faceted Celestial Diamond & Dew -->
        <g transform="translate(150, 116)" ${filter}>
          <!-- Sacred Geometry Star Halo -->
          <polygon points="0,-48 12,-16 46,-16 18,6 28,38 0,18 -28,38 -18,6 -46,-16 -12,-16" fill="none" stroke="${gold}" stroke-width="1.2" opacity="0.6"/>
          <!-- Central Cut Diamond -->
          <polygon points="0,-38 32,-4 0,44 -32,-4" fill="none" stroke="${gold}" stroke-width="3"/>
          <polygon points="0,-38 16,-4 0,44 -16,-4" fill="none" stroke="${sheen}" stroke-width="1.5"/>
          <line x1="-32" y1="-4" x2="32" y2="-4" stroke="${gold}" stroke-width="2"/>
          <circle cx="0" cy="-4" r="5" fill="${gold}"/>
        </g>
        <text x="150" y="196" font-family="'Cinzel', 'Playfair Display', serif" font-size="24" font-weight="700" fill="${gold}" text-anchor="middle" letter-spacing="8" ${filter}>DURU</text>
        <text x="150" y="214" font-family="'Plus Jakarta Sans', sans-serif" font-size="8.5" font-weight="700" fill="${textColor}" text-anchor="middle" letter-spacing="4">SELİMİYE</text>
      `;
      break;

    case 'mi-amor-selimiye':
      artwork = `
        <!-- MI AMOR: Interlocking Imperial Monogram & Coronet -->
        <g transform="translate(150, 114)" ${filter}>
          <!-- Crown -->
          <path d="M-18 -38 L0 -50 L18 -38 L12 -34 L0 -42 L-12 -34 Z" fill="${gold}"/>
          <circle cx="0" cy="-54" r="3" fill="${gold}"/>
          <circle cx="-18" cy="-42" r="2.5" fill="${gold}"/>
          <circle cx="18" cy="-42" r="2.5" fill="${gold}"/>
          <!-- Interlocking MA Monogram -->
          <text x="0" y="22" font-family="'Cormorant Garamond', 'Cinzel', serif" font-size="68" font-style="italic" font-weight="700" fill="${gold}" text-anchor="middle" letter-spacing="1">MA</text>
          <!-- Laurel Branches -->
          <path d="M-45 10 C-45 35 -20 48 0 48 C20 48 45 35 45 10" fill="none" stroke="${sheen}" stroke-width="2"/>
        </g>
        <text x="150" y="196" font-family="'Cinzel', serif" font-size="20" font-weight="700" fill="${gold}" text-anchor="middle" letter-spacing="6" ${filter}>MI AMOR</text>
        <text x="150" y="214" font-family="'Plus Jakarta Sans', sans-serif" font-size="8.5" font-weight="700" fill="${textColor}" text-anchor="middle" letter-spacing="4">HOTEL & SUITES</text>
      `;
      break;

    case 'dut-selimiye':
      artwork = `
        <!-- DUT: Botanical Mulberry Tree Heraldry & Leaf Crest -->
        <g transform="translate(150, 114)" ${filter}>
          <path d="M0 -46 C-30 -22 -38 12 0 46 C38 12 30 -22 0 -46 Z" fill="none" stroke="${gold}" stroke-width="2.8"/>
          <path d="M0 -40 L0 40" stroke="${gold}" stroke-width="1.8"/>
          <path d="M0 -18 C-18 -6 -18 6 0 12" fill="none" stroke="${sheen}" stroke-width="1.5"/>
          <path d="M0 -18 C18 -6 18 6 0 12" fill="none" stroke="${sheen}" stroke-width="1.5"/>
          <circle cx="0" cy="-50" r="3.5" fill="${gold}"/>
        </g>
        <text x="150" y="196" font-family="'Cinzel', serif" font-size="24" font-weight="700" fill="${gold}" text-anchor="middle" letter-spacing="8" ${filter}>DUT</text>
        <text x="150" y="214" font-family="'Plus Jakarta Sans', sans-serif" font-size="8.5" font-weight="700" fill="${textColor}" text-anchor="middle" letter-spacing="4">SELİMİYE · 1984</text>
      `;
      break;

    case 'elia-selimiye':
      artwork = `
        <!-- ELIA: Classical Aegean Olive Crown & Serif E -->
        <g transform="translate(150, 114)" ${filter}>
          <path d="M-44 6 C-48 -24 -22 -44 0 -44 C22 -44 48 -24 44 6 C38 32 20 44 0 44 C-20 44 -38 32 -44 6" fill="none" stroke="${gold}" stroke-width="2.2"/>
          <circle cx="-28" cy="-26" r="3.5" fill="${gold}"/>
          <circle cx="28" cy="-26" r="3.5" fill="${gold}"/>
          <circle cx="-42" cy="4" r="3.5" fill="${gold}"/>
          <circle cx="42" cy="4" r="3.5" fill="${gold}"/>
          <text x="0" y="18" font-family="'Cormorant Garamond', 'Cinzel', serif" font-size="54" font-style="italic" font-weight="700" fill="${gold}" text-anchor="middle">E</text>
        </g>
        <text x="150" y="196" font-family="'Cinzel', serif" font-size="22" font-weight="700" fill="${gold}" text-anchor="middle" letter-spacing="7" ${filter}>ELIA</text>
        <text x="150" y="214" font-family="'Plus Jakarta Sans', sans-serif" font-size="8.5" font-weight="700" fill="${textColor}" text-anchor="middle" letter-spacing="4">OLIVE RETREAT</text>
      `;
      break;

    case 'pineloft-selimiye':
      artwork = `
        <!-- PINELOFT: Modern Scandinavian Pinecone & Loft Crest -->
        <g transform="translate(150, 112)" ${filter}>
          <polygon points="0,-44 38,24 -38,24" fill="none" stroke="${gold}" stroke-width="2.5"/>
          <path d="M0 -30 C-12 -16 -12 -6 0 2 C12 -6 12 -16 0 -30 Z" fill="none" stroke="${sheen}" stroke-width="1.8"/>
          <path d="M-14 -10 C-22 2 -20 12 -6 18" fill="none" stroke="${sheen}" stroke-width="1.8"/>
          <path d="M14 -10 C22 2 20 12 6 18" fill="none" stroke="${sheen}" stroke-width="1.8"/>
        </g>
        <text x="150" y="196" font-family="'Cinzel', serif" font-size="20" font-weight="700" fill="${gold}" text-anchor="middle" letter-spacing="5" ${filter}>PINELOFT</text>
        <text x="150" y="214" font-family="'Plus Jakarta Sans', sans-serif" font-size="8.5" font-weight="700" fill="${textColor}" text-anchor="middle" letter-spacing="4">SUITES & LIVING</text>
      `;
      break;

    case 'kiraz-vela-selimiye':
      artwork = `
        <!-- KIRAZ VELA: Haute Yachting Dual Sail & Compass Rose -->
        <g transform="translate(150, 112)" ${filter}>
          <path d="M-5 -40 L-5 22 C-28 22 -34 6 -5 -40 Z" fill="none" stroke="${gold}" stroke-width="2.5"/>
          <path d="M5 -28 L5 22 C24 22 28 8 5 -28 Z" fill="none" stroke="${gold}" stroke-width="2.5"/>
          <path d="M-36 28 C-12 36 12 36 36 28" fill="none" stroke="${sheen}" stroke-width="2.5"/>
          <polygon points="0,-50 3,-44 9,-44 4,-40 6,-34 0,-38 -6,-34 -4,-40 -9,-44 -3,-44" fill="${gold}"/>
        </g>
        <text x="150" y="196" font-family="'Cinzel', serif" font-size="19" font-weight="700" fill="${gold}" text-anchor="middle" letter-spacing="4" ${filter}>KIRAZ VELA</text>
        <text x="150" y="214" font-family="'Plus Jakarta Sans', sans-serif" font-size="8.5" font-weight="700" fill="${textColor}" text-anchor="middle" letter-spacing="4">HOTEL & YACHTING</text>
      `;
      break;

    case 'selimiye-11-oda':
      artwork = `
        <!-- 11 ODA: Roman Imperial XI & 11 Star Crest -->
        <g transform="translate(150, 114)" ${filter}>
          <circle cx="0" cy="0" r="46" fill="none" stroke="${gold}" stroke-width="2"/>
          <circle cx="0" cy="0" r="38" fill="none" stroke="${sheen}" stroke-width="1" stroke-dasharray="4 2"/>
          <text x="0" y="18" font-family="'Cinzel', serif" font-size="52" font-weight="800" fill="${gold}" text-anchor="middle" letter-spacing="2">XI</text>
        </g>
        <text x="150" y="196" font-family="'Cinzel', serif" font-size="22" font-weight="700" fill="${gold}" text-anchor="middle" letter-spacing="6" ${filter}>11 ODA</text>
        <text x="150" y="214" font-family="'Plus Jakarta Sans', sans-serif" font-size="8.5" font-weight="700" fill="${textColor}" text-anchor="middle" letter-spacing="4">SELİMİYE</text>
      `;
      break;

    case 'naxos-beach':
      artwork = `
        <!-- NAXOS: Portara Cycladic Marble Gateway -->
        <g transform="translate(150, 112)" ${filter}>
          <rect x="-26" y="-38" width="52" height="64" fill="none" stroke="${gold}" stroke-width="3.5"/>
          <rect x="-32" y="-42" width="64" height="9" fill="${gold}"/>
          <circle cx="0" cy="-6" r="16" fill="none" stroke="${sheen}" stroke-width="1.8"/>
          <path d="M-20 14 C-8 8 8 20 20 14" fill="none" stroke="${gold}" stroke-width="2"/>
        </g>
        <text x="150" y="196" font-family="'Cinzel', serif" font-size="22" font-weight="700" fill="${gold}" text-anchor="middle" letter-spacing="6" ${filter}>NAXOS</text>
        <text x="150" y="214" font-family="'Plus Jakarta Sans', sans-serif" font-size="8.5" font-weight="700" fill="${textColor}" text-anchor="middle" letter-spacing="4">BEACH RESORT</text>
      `;
      break;

    case 'makia-otel':
      artwork = `
        <!-- MAKIA: Haute Couture M Monogram & Flora Halo -->
        <g transform="translate(150, 114)" ${filter}>
          <circle cx="0" cy="0" r="44" fill="none" stroke="${gold}" stroke-width="2"/>
          <path d="M-32 16 C-22 -26 0 -36 0 -36 C0 -36 22 -26 32 16" fill="none" stroke="${sheen}" stroke-width="1.8"/>
          <text x="0" y="22" font-family="'Cinzel', serif" font-size="44" font-weight="700" fill="${gold}" text-anchor="middle">M</text>
        </g>
        <text x="150" y="196" font-family="'Cinzel', serif" font-size="22" font-weight="700" fill="${gold}" text-anchor="middle" letter-spacing="6" ${filter}>MAKIA</text>
        <text x="150" y="214" font-family="'Plus Jakarta Sans', sans-serif" font-size="8.5" font-weight="700" fill="${textColor}" text-anchor="middle" letter-spacing="4">SELİMİYE</text>
      `;
      break;

    case 'mavi-melek-hotel':
      artwork = `
        <!-- MAVI MELEK: Gilded Seraph Wings & Star Halo -->
        <g transform="translate(150, 112)" ${filter}>
          <path d="M-6 -8 C-26 -38 -48 -22 -38 16 C-28 2 -16 4 -6 -8 Z" fill="none" stroke="${gold}" stroke-width="2.2"/>
          <path d="M6 -8 C26 -38 48 -22 38 16 C28 2 16 4 6 -8 Z" fill="none" stroke="${gold}" stroke-width="2.2"/>
          <circle cx="0" cy="-18" r="7" fill="${gold}"/>
          <circle cx="0" cy="18" r="3.5" fill="${gold}"/>
        </g>
        <text x="150" y="196" font-family="'Cinzel', serif" font-size="18" font-weight="700" fill="${gold}" text-anchor="middle" letter-spacing="4" ${filter}>MAVİ MELEK</text>
        <text x="150" y="214" font-family="'Plus Jakarta Sans', sans-serif" font-size="8.5" font-weight="700" fill="${textColor}" text-anchor="middle" letter-spacing="4">HOTEL SELİMİYE</text>
      `;
      break;

    case 'yamac-motel-selimiye':
      artwork = `
        <!-- YAMAC: Cliff Skyline & Nautical Compass -->
        <g transform="translate(150, 112)" ${filter}>
          <circle cx="0" cy="0" r="42" fill="none" stroke="${gold}" stroke-width="2"/>
          <path d="M-38 20 L-14 -18 L10 8 L24 -8 L38 20" fill="none" stroke="${gold}" stroke-width="2.2"/>
          <circle cx="18" cy="-22" r="7" fill="${gold}"/>
        </g>
        <text x="150" y="196" font-family="'Cinzel', serif" font-size="20" font-weight="700" fill="${gold}" text-anchor="middle" letter-spacing="5" ${filter}>YAMAÇ</text>
        <text x="150" y="214" font-family="'Plus Jakarta Sans', sans-serif" font-size="8.5" font-weight="700" fill="${textColor}" text-anchor="middle" letter-spacing="4">MOTEL SELİMİYE</text>
      `;
      break;

    case 'coban-hotel-selimiye':
      artwork = `
        <!-- COBAN: Imperial Aries Ram Horns & Royal Crest -->
        <g transform="translate(150, 112)" ${filter}>
          <path d="M-24 -8 C-38 -30 -12 -38 0 -20 C12 -38 38 -30 24 -8 C14 8 -14 8 -24 -8 Z" fill="none" stroke="${gold}" stroke-width="2.5"/>
          <polygon points="0,-12 9,14 -9,14" fill="none" stroke="${sheen}" stroke-width="2"/>
          <circle cx="0" cy="24" r="3.5" fill="${gold}"/>
        </g>
        <text x="150" y="196" font-family="'Cinzel', serif" font-size="22" font-weight="700" fill="${gold}" text-anchor="middle" letter-spacing="6" ${filter}>ÇOBAN</text>
        <text x="150" y="214" font-family="'Plus Jakarta Sans', sans-serif" font-size="8.5" font-weight="700" fill="${textColor}" text-anchor="middle" letter-spacing="4">HOTEL SELİMİYE</text>
      `;
      break;

    case 'dantel-pansiyon-restaurant':
      artwork = `
        <!-- DANTEL: Royal Filigree Mandala Rosette -->
        <g transform="translate(150, 112)" ${filter}>
          <circle cx="0" cy="0" r="42" fill="none" stroke="${gold}" stroke-width="1.8"/>
          <circle cx="0" cy="-20" r="16" fill="none" stroke="${sheen}" stroke-width="1.2"/>
          <circle cx="0" cy="20" r="16" fill="none" stroke="${sheen}" stroke-width="1.2"/>
          <circle cx="-20" cy="0" r="16" fill="none" stroke="${sheen}" stroke-width="1.2"/>
          <circle cx="20" cy="0" r="16" fill="none" stroke="${sheen}" stroke-width="1.2"/>
          <circle cx="0" cy="0" r="7" fill="${gold}"/>
        </g>
        <text x="150" y="196" font-family="'Cinzel', serif" font-size="20" font-weight="700" fill="${gold}" text-anchor="middle" letter-spacing="5" ${filter}>DANTEL</text>
        <text x="150" y="214" font-family="'Plus Jakarta Sans', sans-serif" font-size="8.5" font-weight="700" fill="${textColor}" text-anchor="middle" letter-spacing="4">MAISON & DINING</text>
      `;
      break;

    case 'doga-pansiyon':
      artwork = `
        <!-- DOGA: Dual Botanical Laurel Leaf & Serif D -->
        <g transform="translate(150, 112)" ${filter}>
          <path d="M-30 22 C-38 -12 -16 -38 0 -42 C16 -38 38 -12 30 22" fill="none" stroke="${gold}" stroke-width="2.5"/>
          <path d="M0 -38 L0 26" stroke="${sheen}" stroke-width="1.8"/>
          <text x="0" y="16" font-family="'Cinzel', serif" font-size="42" font-weight="700" fill="${gold}" text-anchor="middle">D</text>
        </g>
        <text x="150" y="196" font-family="'Cinzel', serif" font-size="22" font-weight="700" fill="${gold}" text-anchor="middle" letter-spacing="6" ${filter}>DOĞA</text>
        <text x="150" y="214" font-family="'Plus Jakarta Sans', sans-serif" font-size="8.5" font-weight="700" fill="${textColor}" text-anchor="middle" letter-spacing="4">SELİMİYE</text>
      `;
      break;

    case 'ekin-pansiyon':
    case 'ekin-tatil-evi':
      artwork = `
        <!-- EKIN: Imperial Golden Wheat & Sunburst -->
        <g transform="translate(150, 112)" ${filter}>
          <path d="M0 -44 L0 32" stroke="${gold}" stroke-width="2.5"/>
          <ellipse cx="-9" cy="-30" rx="7" ry="3.5" transform="rotate(-30 -9 -30)" fill="${gold}"/>
          <ellipse cx="9" cy="-30" rx="7" ry="3.5" transform="rotate(30 9 -30)" fill="${gold}"/>
          <ellipse cx="-11" cy="-14" rx="8" ry="4" transform="rotate(-30 -11 -14)" fill="${gold}"/>
          <ellipse cx="11" cy="-14" rx="8" ry="4" transform="rotate(30 11 -14)" fill="${gold}"/>
          <ellipse cx="-11" cy="2" rx="8" ry="4" transform="rotate(-30 -11 2)" fill="${gold}"/>
          <ellipse cx="11" cy="2" rx="8" ry="4" transform="rotate(30 11 2)" fill="${gold}"/>
        </g>
        <text x="150" y="196" font-family="'Cinzel', serif" font-size="22" font-weight="700" fill="${gold}" text-anchor="middle" letter-spacing="6" ${filter}>EKİN</text>
        <text x="150" y="214" font-family="'Plus Jakarta Sans', sans-serif" font-size="8.5" font-weight="700" fill="${textColor}" text-anchor="middle" letter-spacing="4">${slug.includes('tatil') ? 'TATİL EVİ' : 'SELİMİYE'}</text>
      `;
      break;

    case 'hydas-pansiyon':
      artwork = `
        <!-- HYDAS: Ancient Carian Ionic Column Acropolis -->
        <g transform="translate(150, 112)" ${filter}>
          <circle cx="-18" cy="-26" r="9" fill="none" stroke="${gold}" stroke-width="2.2"/>
          <circle cx="18" cy="-26" r="9" fill="none" stroke="${gold}" stroke-width="2.2"/>
          <rect x="-26" y="-35" width="52" height="7" fill="${gold}"/>
          <line x1="-14" y1="-17" x2="-14" y2="26" stroke="${gold}" stroke-width="2.5"/>
          <line x1="0" y1="-17" x2="0" y2="26" stroke="${sheen}" stroke-width="2"/>
          <line x1="14" y1="-17" x2="14" y2="26" stroke="${gold}" stroke-width="2.5"/>
          <rect x="-20" y="26" width="40" height="7" fill="${gold}"/>
        </g>
        <text x="150" y="196" font-family="'Cinzel', serif" font-size="22" font-weight="700" fill="${gold}" text-anchor="middle" letter-spacing="6" ${filter}>HYDAS</text>
        <text x="150" y="214" font-family="'Plus Jakarta Sans', sans-serif" font-size="8.5" font-weight="700" fill="${textColor}" text-anchor="middle" letter-spacing="4">ANCIENT CARIA</text>
      `;
      break;

    case 'moka-butik-hotel':
      artwork = `
        <!-- MOKA: Artisanal Coffee Bean & Botanical Monogram -->
        <g transform="translate(150, 112)" ${filter}>
          <circle cx="0" cy="0" r="42" fill="none" stroke="${gold}" stroke-width="2"/>
          <ellipse cx="0" cy="-6" rx="16" ry="22" fill="none" stroke="${gold}" stroke-width="2.2"/>
          <path d="M0 -28 C-8 -10 8 8 0 16" stroke="${sheen}" stroke-width="2"/>
          <circle cx="0" cy="-34" r="3.5" fill="${gold}"/>
        </g>
        <text x="150" y="196" font-family="'Cinzel', serif" font-size="22" font-weight="700" fill="${gold}" text-anchor="middle" letter-spacing="6" ${filter}>MOKA</text>
        <text x="150" y="214" font-family="'Plus Jakarta Sans', sans-serif" font-size="8.5" font-weight="700" fill="${textColor}" text-anchor="middle" letter-spacing="4">BUTİK HOTEL</text>
      `;
      break;

    case 'portakal-butik-otel':
      artwork = `
        <!-- PORTAKAL: Royal Citrus Blossom & Gilded Leaves -->
        <g transform="translate(150, 112)" ${filter}>
          <circle cx="0" cy="2" r="28" fill="none" stroke="${gold}" stroke-width="2.5"/>
          <circle cx="0" cy="2" r="7" fill="${gold}"/>
          <path d="M-10 -24 C-20 -34 0 -38 0 -38 C0 -38 20 -34 10 -24" fill="none" stroke="${sheen}" stroke-width="2"/>
          <line x1="0" y1="-38" x2="0" y2="-24" stroke="${sheen}" stroke-width="2"/>
        </g>
        <text x="150" y="196" font-family="'Cinzel', serif" font-size="19" font-weight="700" fill="${gold}" text-anchor="middle" letter-spacing="5" ${filter}>PORTAKAL</text>
        <text x="150" y="214" font-family="'Plus Jakarta Sans', sans-serif" font-size="8.5" font-weight="700" fill="${textColor}" text-anchor="middle" letter-spacing="4">BUTİK OTEL</text>
      `;
      break;

    case 'salkim-sahil-evi':
    case 'uzum-tatil-evi':
      artwork = `
        <!-- SALKIM / UZUM: Gilded Grape Cluster & Vine Crest -->
        <g transform="translate(150, 112)" ${filter}>
          <path d="M0 -36 C-18 -40 -22 -26 0 -20 C22 -26 18 -40 0 -36 Z" fill="none" stroke="${sheen}" stroke-width="2"/>
          <circle cx="-11" cy="-8" r="6" fill="${gold}"/>
          <circle cx="0" cy="-8" r="6" fill="${gold}"/>
          <circle cx="11" cy="-8" r="6" fill="${gold}"/>
          <circle cx="-6" cy="2" r="6" fill="${gold}"/>
          <circle cx="6" cy="2" r="6" fill="${gold}"/>
          <circle cx="0" cy="11" r="6" fill="${gold}"/>
        </g>
        <text x="150" y="196" font-family="'Cinzel', serif" font-size="22" font-weight="700" fill="${gold}" text-anchor="middle" letter-spacing="6" ${filter}>${slug.includes('salkim') ? 'SALKIM' : 'ÜZÜM'}</text>
        <text x="150" y="214" font-family="'Plus Jakarta Sans', sans-serif" font-size="8.5" font-weight="700" fill="${textColor}" text-anchor="middle" letter-spacing="4">SAHİL EVİ</text>
      `;
      break;

    case 'sigliman-glamping-beach':
      artwork = `
        <!-- SIGLIMAN: Luxury Bohemian Canopy & North Star -->
        <g transform="translate(150, 112)" ${filter}>
          <polygon points="0,-38 34,24 -34,24" fill="none" stroke="${gold}" stroke-width="2.5"/>
          <line x1="0" y1="-38" x2="0" y2="24" stroke="${sheen}" stroke-width="1.8"/>
          <polygon points="0,-18 18,24 -18,24" fill="none" stroke="${sheen}" stroke-width="1.5"/>
          <circle cx="0" cy="-48" r="3.5" fill="${gold}"/>
        </g>
        <text x="150" y="196" font-family="'Cinzel', serif" font-size="19" font-weight="700" fill="${gold}" text-anchor="middle" letter-spacing="4" ${filter}>SIĞLİMAN</text>
        <text x="150" y="214" font-family="'Plus Jakarta Sans', sans-serif" font-size="8.5" font-weight="700" fill="${textColor}" text-anchor="middle" letter-spacing="4">GLAMPING & BEACH</text>
      `;
      break;

    case 'selimiye-sakli-bahce-hotel':
      artwork = `
        <!-- SAKLI BAHCE: Secret Garden Arched Gate & Key -->
        <g transform="translate(150, 112)" ${filter}>
          <path d="M-30 28 L-30 -10 C-30 -30 30 -30 30 -10 L30 28" fill="none" stroke="${gold}" stroke-width="2.8"/>
          <line x1="-30" y1="28" x2="30" y2="28" stroke="${gold}" stroke-width="2.5"/>
          <circle cx="0" cy="-6" r="11" fill="none" stroke="${sheen}" stroke-width="1.8"/>
          <path d="M0 5 L0 22 M-4 15 L0 15 M-4 19 L0 19" stroke="${sheen}" stroke-width="1.8"/>
          <circle cx="0" cy="-30" r="3.5" fill="${gold}"/>
        </g>
        <text x="150" y="196" font-family="'Cinzel', serif" font-size="18" font-weight="700" fill="${gold}" text-anchor="middle" letter-spacing="4" ${filter}>SAKLI BAHÇE</text>
        <text x="150" y="214" font-family="'Plus Jakarta Sans', sans-serif" font-size="8.5" font-weight="700" fill="${textColor}" text-anchor="middle" letter-spacing="4">HOTEL & BOTANIC</text>
      `;
      break;

    case 'zakkum-frida-pansiyon':
      artwork = `
        <!-- ZAKKUM FRIDA: Oleander Bloom & Artist Monogram -->
        <g transform="translate(150, 112)" ${filter}>
          <circle cx="0" cy="0" r="40" fill="none" stroke="${gold}" stroke-width="1.8"/>
          <path d="M0 -24 C-10 -12 10 -12 0 -24 Z" fill="${gold}"/>
          <text x="0" y="18" font-family="'Cormorant Garamond', serif" font-size="48" font-style="italic" font-weight="700" fill="${gold}" text-anchor="middle">ZF</text>
        </g>
        <text x="150" y="196" font-family="'Cinzel', serif" font-size="18" font-weight="700" fill="${gold}" text-anchor="middle" letter-spacing="4" ${filter}>ZAKKUM FRIDA</text>
        <text x="150" y="214" font-family="'Plus Jakarta Sans', sans-serif" font-size="8.5" font-weight="700" fill="${textColor}" text-anchor="middle" letter-spacing="4">MAISON D'ART</text>
      `;
      break;

    default:
      artwork = `
        <!-- CLASSICAL IMPERIAL EMBLEM -->
        <g transform="translate(150, 112)" ${filter}>
          <circle cx="0" cy="0" r="44" fill="none" stroke="${gold}" stroke-width="2.5"/>
          <text x="0" y="20" font-family="'Cinzel', serif" font-size="46" font-weight="800" fill="${gold}" text-anchor="middle">${name.charAt(0)}</text>
        </g>
        <text x="150" y="196" font-family="'Cinzel', serif" font-size="20" font-weight="700" fill="${gold}" text-anchor="middle" letter-spacing="5" ${filter}>${name.toUpperCase()}</text>
        <text x="150" y="214" font-family="'Plus Jakarta Sans', sans-serif" font-size="8.5" font-weight="700" fill="${textColor}" text-anchor="middle" letter-spacing="4">SELİMİYE</text>
      `;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="100%" height="100%">
    ${getShaderDefs(p)}
    ${frame}
    ${artwork}
  </svg>`;
}

function deployAllLogos() {
  console.log('💎 Generating 3D Bullion Gold Haute Joaillerie Insignias for all 24 Selimiye Hotels...');

  for (const hotel of research.hotels) {
    const slug = hotel.slug;
    const name = hotel.name;

    // V1 (Obsidian Gold)
    const v1Svg = buildLuxuryLogo(slug, name, true);
    const v1Path = path.join(baseDir, 'v1', slug, 'media', 'logo.svg');
    fs.mkdirSync(path.dirname(v1Path), { recursive: true });
    fs.writeFileSync(v1Path, v1Svg, 'utf8');

    // V2 (Warm Alabaster Linen & Cypress)
    const v2Svg = buildLuxuryLogo(slug, name, false);
    const v2Path = path.join(baseDir, 'v2-gemini', slug, 'media', 'logo.svg');
    fs.mkdirSync(path.dirname(v2Path), { recursive: true });
    fs.writeFileSync(v2Path, v2Svg, 'utf8');
  }

  console.log('✅ Successfully compiled and deployed all 48 Haute Joaillerie luxury emblems!');
}

deployAllLogos();
