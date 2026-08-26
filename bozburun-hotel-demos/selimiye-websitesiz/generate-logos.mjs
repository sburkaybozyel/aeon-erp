import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const baseDir = __dirname;
const research = JSON.parse(fs.readFileSync(path.join(baseDir, 'hotel-research-v2.json'), 'utf8'));

// Bulletproof, filter-free, high-contrast gold gradients
const sharedDefs = `
  <defs>
    <!-- Rich Bullion Gold Gradient -->
    <linearGradient id="goldLinear" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fff0b8"/>
      <stop offset="20%" stop-color="#e5c158"/>
      <stop offset="45%" stop-color="#c99726"/>
      <stop offset="70%" stop-color="#8a6111"/>
      <stop offset="90%" stop-color="#d8a834"/>
      <stop offset="100%" stop-color="#fdf2c6"/>
    </linearGradient>

    <!-- Ring Specular Gradient -->
    <linearGradient id="goldRadial" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#9a6e18"/>
      <stop offset="35%" stop-color="#fff2c2"/>
      <stop offset="70%" stop-color="#c59424"/>
      <stop offset="100%" stop-color="#734f0c"/>
    </linearGradient>

    <!-- Midnight Obsidian Backdrop -->
    <radialGradient id="darkBg" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#152232"/>
      <stop offset="65%" stop-color="#09101a"/>
      <stop offset="100%" stop-color="#04070c"/>
    </radialGradient>

    <!-- Deep Emerald Backdrop for V2 -->
    <radialGradient id="emeraldBg" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#1b4634"/>
      <stop offset="65%" stop-color="#0c251b"/>
      <stop offset="100%" stop-color="#05140e"/>
    </radialGradient>
  </defs>
`;

function getLuxuryEmblem(slug, name, isDark = true) {
  const bg = isDark ? 'url(#darkBg)' : 'url(#emeraldBg)';
  const gold = 'url(#goldLinear)';
  const ringGold = 'url(#goldRadial)';
  const textSub = '#f9e8af';

  const frame = `
    <!-- Solid Dark Backdrop Medallion -->
    <circle cx="150" cy="150" r="146" fill="${bg}"/>
    <circle cx="150" cy="150" r="140" fill="none" stroke="${gold}" stroke-width="3"/>
    <circle cx="150" cy="150" r="132" fill="none" stroke="${ringGold}" stroke-width="1.2" stroke-dasharray="3 3"/>
    <circle cx="150" cy="150" r="125" fill="none" stroke="${gold}" stroke-width="1.5"/>

    <!-- 4 Cardinal Gold Points -->
    <polygon points="150,11 154,19 146,19" fill="${gold}"/>
    <polygon points="150,289 154,281 146,281" fill="${gold}"/>
    <polygon points="11,150 19,154 19,146" fill="${gold}"/>
    <polygon points="289,150 281,154 281,146" fill="${gold}"/>
  `;

  let inner = '';

  switch (slug) {
    case 'duru-selimiye':
      inner = `
        <!-- DURU: Brilliant Faceted Diamond & Starburst -->
        <g transform="translate(150, 112)">
          <!-- Starburst Rays -->
          <line x1="0" y1="-50" x2="0" y2="-38" stroke="${gold}" stroke-width="2"/>
          <line x1="0" y1="50" x2="0" y2="38" stroke="${gold}" stroke-width="2"/>
          <line x1="-50" y1="0" x2="-38" y2="0" stroke="${gold}" stroke-width="2"/>
          <line x1="50" y1="0" x2="38" y2="0" stroke="${gold}" stroke-width="2"/>
          <!-- Diamond Facets -->
          <polygon points="0,-36 34,-2 0,44 -34,-2" fill="none" stroke="${gold}" stroke-width="3.5"/>
          <polygon points="0,-36 17,-2 0,44 -17,-2" fill="none" stroke="${ringGold}" stroke-width="2"/>
          <line x1="-34" y1="-2" x2="34" y2="-2" stroke="${gold}" stroke-width="2.5"/>
          <circle cx="0" cy="-2" r="5" fill="${gold}"/>
        </g>
        <text x="150" y="196" font-family="'Cinzel', 'Playfair Display', Georgia, serif" font-size="24" font-weight="700" fill="${gold}" text-anchor="middle" letter-spacing="8">DURU</text>
        <text x="150" y="215" font-family="'Plus Jakarta Sans', sans-serif" font-size="9" font-weight="700" fill="${textSub}" text-anchor="middle" letter-spacing="4">SELİMİYE</text>
      `;
      break;

    case 'mi-amor-selimiye':
      inner = `
        <!-- MI AMOR: Intertwined Imperial Monogram & Coronet -->
        <g transform="translate(150, 110)">
          <path d="M-20 -38 L0 -52 L20 -38 L14 -34 L0 -44 L-14 -34 Z" fill="${gold}"/>
          <circle cx="0" cy="-56" r="3.5" fill="${gold}"/>
          <circle cx="-20" cy="-42" r="3" fill="${gold}"/>
          <circle cx="20" cy="-42" r="3" fill="${gold}"/>
          <text x="0" y="24" font-family="'Cormorant Garamond', Georgia, serif" font-size="70" font-style="italic" font-weight="700" fill="${gold}" text-anchor="middle">MA</text>
          <path d="M-46 10 C-46 36 -22 48 0 48 C22 48 46 36 46 10" fill="none" stroke="${ringGold}" stroke-width="2.2"/>
        </g>
        <text x="150" y="196" font-family="'Cinzel', Georgia, serif" font-size="20" font-weight="700" fill="${gold}" text-anchor="middle" letter-spacing="6">MI AMOR</text>
        <text x="150" y="215" font-family="'Plus Jakarta Sans', sans-serif" font-size="9" font-weight="700" fill="${textSub}" text-anchor="middle" letter-spacing="4">HOTEL & SUITES</text>
      `;
      break;

    case 'dut-selimiye':
      inner = `
        <!-- DUT: Mulberry Leaf & Heritage Crest -->
        <g transform="translate(150, 110)">
          <path d="M0 -46 C-32 -22 -40 14 0 48 C40 14 32 -22 0 -46 Z" fill="none" stroke="${gold}" stroke-width="3"/>
          <path d="M0 -40 L0 42" stroke="${gold}" stroke-width="2"/>
          <path d="M0 -18 C-18 -6 -18 6 0 14" fill="none" stroke="${ringGold}" stroke-width="1.8"/>
          <path d="M0 -18 C18 -6 18 6 0 14" fill="none" stroke="${ringGold}" stroke-width="1.8"/>
          <circle cx="0" cy="-50" r="4" fill="${gold}"/>
        </g>
        <text x="150" y="196" font-family="'Cinzel', Georgia, serif" font-size="25" font-weight="700" fill="${gold}" text-anchor="middle" letter-spacing="8">DUT</text>
        <text x="150" y="215" font-family="'Plus Jakarta Sans', sans-serif" font-size="9" font-weight="700" fill="${textSub}" text-anchor="middle" letter-spacing="4">SELİMİYE · 1984</text>
      `;
      break;

    case 'elia-selimiye':
      inner = `
        <!-- ELIA: Classical Greek Olive Crown & Serif E -->
        <g transform="translate(150, 110)">
          <path d="M-45 6 C-48 -24 -22 -45 0 -45 C22 -45 48 -24 45 6 C38 34 20 46 0 46 C-20 46 -38 34 -45 6" fill="none" stroke="${gold}" stroke-width="2.5"/>
          <circle cx="-28" cy="-26" r="3.5" fill="${gold}"/>
          <circle cx="28" cy="-26" r="3.5" fill="${gold}"/>
          <circle cx="-44" cy="4" r="3.5" fill="${gold}"/>
          <circle cx="44" cy="4" r="3.5" fill="${gold}"/>
          <text x="0" y="20" font-family="'Cormorant Garamond', Georgia, serif" font-size="56" font-style="italic" font-weight="700" fill="${gold}" text-anchor="middle">E</text>
        </g>
        <text x="150" y="196" font-family="'Cinzel', Georgia, serif" font-size="22" font-weight="700" fill="${gold}" text-anchor="middle" letter-spacing="7">ELIA</text>
        <text x="150" y="215" font-family="'Plus Jakarta Sans', sans-serif" font-size="9" font-weight="700" fill="${textSub}" text-anchor="middle" letter-spacing="4">OLIVE RESIDENCE</text>
      `;
      break;

    case 'pineloft-selimiye':
      inner = `
        <!-- PINELOFT: Geometric Pinecone & Loft Architecture -->
        <g transform="translate(150, 110)">
          <polygon points="0,-44 38,24 -38,24" fill="none" stroke="${gold}" stroke-width="3"/>
          <path d="M0 -30 C-14 -16 -14 -6 0 2 C14 -6 14 -16 0 -30 Z" fill="none" stroke="${ringGold}" stroke-width="2"/>
          <path d="M-15 -10 C-24 2 -22 12 -6 18" fill="none" stroke="${ringGold}" stroke-width="2"/>
          <path d="M15 -10 C24 2 22 12 6 18" fill="none" stroke="${ringGold}" stroke-width="2"/>
        </g>
        <text x="150" y="196" font-family="'Cinzel', Georgia, serif" font-size="20" font-weight="700" fill="${gold}" text-anchor="middle" letter-spacing="5">PINELOFT</text>
        <text x="150" y="215" font-family="'Plus Jakarta Sans', sans-serif" font-size="9" font-weight="700" fill="${textSub}" text-anchor="middle" letter-spacing="4">SUITES & LIVING</text>
      `;
      break;

    case 'kiraz-vela-selimiye':
      inner = `
        <!-- KIRAZ VELA: Haute Nautical Dual Sail & North Star -->
        <g transform="translate(150, 110)">
          <path d="M-5 -40 L-5 22 C-30 22 -36 6 -5 -40 Z" fill="none" stroke="${gold}" stroke-width="3"/>
          <path d="M5 -28 L5 22 C26 22 30 8 5 -28 Z" fill="none" stroke="${gold}" stroke-width="3"/>
          <path d="M-38 28 C-12 36 12 36 38 28" fill="none" stroke="${ringGold}" stroke-width="3"/>
          <polygon points="0,-50 3,-44 9,-44 4,-40 6,-34 0,-38 -6,-34 -4,-40 -9,-44 -3,-44" fill="${gold}"/>
        </g>
        <text x="150" y="196" font-family="'Cinzel', Georgia, serif" font-size="19" font-weight="700" fill="${gold}" text-anchor="middle" letter-spacing="4">KIRAZ VELA</text>
        <text x="150" y="215" font-family="'Plus Jakarta Sans', sans-serif" font-size="9" font-weight="700" fill="${textSub}" text-anchor="middle" letter-spacing="4">HOTEL & YACHTING</text>
      `;
      break;

    case 'selimiye-11-oda':
      inner = `
        <!-- 11 ODA: Roman Imperial XI & Crown of Stars -->
        <g transform="translate(150, 112)">
          <circle cx="0" cy="0" r="46" fill="none" stroke="${gold}" stroke-width="2.5"/>
          <circle cx="0" cy="0" r="38" fill="none" stroke="${ringGold}" stroke-width="1.2" stroke-dasharray="4 2"/>
          <text x="0" y="19" font-family="'Cinzel', Georgia, serif" font-size="54" font-weight="800" fill="${gold}" text-anchor="middle" letter-spacing="2">XI</text>
        </g>
        <text x="150" y="196" font-family="'Cinzel', Georgia, serif" font-size="22" font-weight="700" fill="${gold}" text-anchor="middle" letter-spacing="6">11 ODA</text>
        <text x="150" y="215" font-family="'Plus Jakarta Sans', sans-serif" font-size="9" font-weight="700" fill="${textSub}" text-anchor="middle" letter-spacing="4">SELİMİYE</text>
      `;
      break;

    case 'naxos-beach':
      inner = `
        <!-- NAXOS: Portara Cycladic Gateway -->
        <g transform="translate(150, 110)">
          <rect x="-26" y="-38" width="52" height="64" fill="none" stroke="${gold}" stroke-width="4"/>
          <rect x="-32" y="-42" width="64" height="10" fill="${gold}"/>
          <circle cx="0" cy="-6" r="16" fill="none" stroke="${ringGold}" stroke-width="2"/>
          <path d="M-20 14 C-8 8 8 20 20 14" fill="none" stroke="${gold}" stroke-width="2.5"/>
        </g>
        <text x="150" y="196" font-family="'Cinzel', Georgia, serif" font-size="22" font-weight="700" fill="${gold}" text-anchor="middle" letter-spacing="6">NAXOS</text>
        <text x="150" y="215" font-family="'Plus Jakarta Sans', sans-serif" font-size="9" font-weight="700" fill="${textSub}" text-anchor="middle" letter-spacing="4">BEACH RESORT</text>
      `;
      break;

    case 'makia-otel':
      inner = `
        <!-- MAKIA: Haute Couture M Monogram & Flora Halo -->
        <g transform="translate(150, 112)">
          <circle cx="0" cy="0" r="44" fill="none" stroke="${gold}" stroke-width="2.5"/>
          <path d="M-32 16 C-22 -26 0 -36 0 -36 C0 -36 22 -26 32 16" fill="none" stroke="${ringGold}" stroke-width="2"/>
          <text x="0" y="22" font-family="'Cinzel', Georgia, serif" font-size="46" font-weight="700" fill="${gold}" text-anchor="middle">M</text>
        </g>
        <text x="150" y="196" font-family="'Cinzel', Georgia, serif" font-size="22" font-weight="700" fill="${gold}" text-anchor="middle" letter-spacing="6">MAKIA</text>
        <text x="150" y="215" font-family="'Plus Jakarta Sans', sans-serif" font-size="9" font-weight="700" fill="${textSub}" text-anchor="middle" letter-spacing="4">SELİMİYE</text>
      `;
      break;

    case 'mavi-melek-hotel':
      inner = `
        <!-- MAVI MELEK: Seraph Wings & Star Halo -->
        <g transform="translate(150, 110)">
          <path d="M-6 -8 C-28 -38 -50 -22 -40 16 C-30 2 -18 4 -6 -8 Z" fill="none" stroke="${gold}" stroke-width="2.5"/>
          <path d="M6 -8 C28 -38 50 -22 40 16 C30 2 18 4 6 -8 Z" fill="none" stroke="${gold}" stroke-width="2.5"/>
          <circle cx="0" cy="-18" r="8" fill="${gold}"/>
          <circle cx="0" cy="18" r="4" fill="${gold}"/>
        </g>
        <text x="150" y="196" font-family="'Cinzel', Georgia, serif" font-size="18" font-weight="700" fill="${gold}" text-anchor="middle" letter-spacing="4">MAVİ MELEK</text>
        <text x="150" y="215" font-family="'Plus Jakarta Sans', sans-serif" font-size="9" font-weight="700" fill="${textSub}" text-anchor="middle" letter-spacing="4">HOTEL SELİMİYE</text>
      `;
      break;

    case 'yamac-motel-selimiye':
      inner = `
        <!-- YAMAC: Cliff Horizon & Marine Compass -->
        <g transform="translate(150, 110)">
          <circle cx="0" cy="0" r="42" fill="none" stroke="${gold}" stroke-width="2.5"/>
          <path d="M-38 20 L-14 -18 L10 8 L24 -8 L38 20" fill="none" stroke="${gold}" stroke-width="2.5"/>
          <circle cx="18" cy="-22" r="7" fill="${gold}"/>
        </g>
        <text x="150" y="196" font-family="'Cinzel', Georgia, serif" font-size="20" font-weight="700" fill="${gold}" text-anchor="middle" letter-spacing="5">YAMAÇ</text>
        <text x="150" y="215" font-family="'Plus Jakarta Sans', sans-serif" font-size="9" font-weight="700" fill="${textSub}" text-anchor="middle" letter-spacing="4">MOTEL SELİMİYE</text>
      `;
      break;

    case 'coban-hotel-selimiye':
      inner = `
        <!-- COBAN: Imperial Aries Ram Horns -->
        <g transform="translate(150, 110)">
          <path d="M-24 -8 C-38 -30 -12 -38 0 -20 C12 -38 38 -30 24 -8 C14 8 -14 8 -24 -8 Z" fill="none" stroke="${gold}" stroke-width="3"/>
          <polygon points="0,-12 9,14 -9,14" fill="none" stroke="${ringGold}" stroke-width="2"/>
          <circle cx="0" cy="24" r="4" fill="${gold}"/>
        </g>
        <text x="150" y="196" font-family="'Cinzel', Georgia, serif" font-size="22" font-weight="700" fill="${gold}" text-anchor="middle" letter-spacing="6">ÇOBAN</text>
        <text x="150" y="215" font-family="'Plus Jakarta Sans', sans-serif" font-size="9" font-weight="700" fill="${textSub}" text-anchor="middle" letter-spacing="4">HOTEL SELİMİYE</text>
      `;
      break;

    case 'dantel-pansiyon-restaurant':
      inner = `
        <!-- DANTEL: Filigree Mandala Rosette -->
        <g transform="translate(150, 110)">
          <circle cx="0" cy="0" r="42" fill="none" stroke="${gold}" stroke-width="2"/>
          <circle cx="0" cy="-20" r="16" fill="none" stroke="${ringGold}" stroke-width="1.5"/>
          <circle cx="0" cy="20" r="16" fill="none" stroke="${ringGold}" stroke-width="1.5"/>
          <circle cx="-20" cy="0" r="16" fill="none" stroke="${ringGold}" stroke-width="1.5"/>
          <circle cx="20" cy="0" r="16" fill="none" stroke="${ringGold}" stroke-width="1.5"/>
          <circle cx="0" cy="0" r="7" fill="${gold}"/>
        </g>
        <text x="150" y="196" font-family="'Cinzel', Georgia, serif" font-size="20" font-weight="700" fill="${gold}" text-anchor="middle" letter-spacing="5">DANTEL</text>
        <text x="150" y="215" font-family="'Plus Jakarta Sans', sans-serif" font-size="9" font-weight="700" fill="${textSub}" text-anchor="middle" letter-spacing="4">MAISON & DINING</text>
      `;
      break;

    case 'doga-pansiyon':
      inner = `
        <!-- DOGA: Dual Botanical Laurel Leaf & Serif D -->
        <g transform="translate(150, 110)">
          <path d="M-30 22 C-38 -12 -16 -38 0 -42 C16 -38 38 -12 30 22" fill="none" stroke="${gold}" stroke-width="3"/>
          <path d="M0 -38 L0 26" stroke="${ringGold}" stroke-width="2"/>
          <text x="0" y="16" font-family="'Cinzel', Georgia, serif" font-size="44" font-weight="700" fill="${gold}" text-anchor="middle">D</text>
        </g>
        <text x="150" y="196" font-family="'Cinzel', Georgia, serif" font-size="22" font-weight="700" fill="${gold}" text-anchor="middle" letter-spacing="6">DOĞA</text>
        <text x="150" y="215" font-family="'Plus Jakarta Sans', sans-serif" font-size="9" font-weight="700" fill="${textSub}" text-anchor="middle" letter-spacing="4">SELİMİYE</text>
      `;
      break;

    case 'ekin-pansiyon':
    case 'ekin-tatil-evi':
      inner = `
        <!-- EKIN: Imperial Golden Wheat & Solar Discs -->
        <g transform="translate(150, 110)">
          <path d="M0 -44 L0 32" stroke="${gold}" stroke-width="3"/>
          <ellipse cx="-9" cy="-30" rx="7" ry="3.5" transform="rotate(-30 -9 -30)" fill="${gold}"/>
          <ellipse cx="9" cy="-30" rx="7" ry="3.5" transform="rotate(30 9 -30)" fill="${gold}"/>
          <ellipse cx="-11" cy="-14" rx="8" ry="4" transform="rotate(-30 -11 -14)" fill="${gold}"/>
          <ellipse cx="11" cy="-14" rx="8" ry="4" transform="rotate(30 11 -14)" fill="${gold}"/>
          <ellipse cx="-11" cy="2" rx="8" ry="4" transform="rotate(-30 -11 2)" fill="${gold}"/>
          <ellipse cx="11" cy="2" rx="8" ry="4" transform="rotate(30 11 2)" fill="${gold}"/>
        </g>
        <text x="150" y="196" font-family="'Cinzel', Georgia, serif" font-size="22" font-weight="700" fill="${gold}" text-anchor="middle" letter-spacing="6">EKİN</text>
        <text x="150" y="215" font-family="'Plus Jakarta Sans', sans-serif" font-size="9" font-weight="700" fill="${textSub}" text-anchor="middle" letter-spacing="4">${slug.includes('tatil') ? 'TATİL EVİ' : 'SELİMİYE'}</text>
      `;
      break;

    case 'hydas-pansiyon':
      inner = `
        <!-- HYDAS: Ancient Carian Ionic Column Acropolis -->
        <g transform="translate(150, 110)">
          <circle cx="-18" cy="-26" r="9" fill="none" stroke="${gold}" stroke-width="2.5"/>
          <circle cx="18" cy="-26" r="9" fill="none" stroke="${gold}" stroke-width="2.5"/>
          <rect x="-26" y="-35" width="52" height="8" fill="${gold}"/>
          <line x1="-14" y1="-17" x2="-14" y2="26" stroke="${gold}" stroke-width="3"/>
          <line x1="0" y1="-17" x2="0" y2="26" stroke="${ringGold}" stroke-width="2"/>
          <line x1="14" y1="-17" x2="14" y2="26" stroke="${gold}" stroke-width="3"/>
          <rect x="-20" y="26" width="40" height="8" fill="${gold}"/>
        </g>
        <text x="150" y="196" font-family="'Cinzel', Georgia, serif" font-size="22" font-weight="700" fill="${gold}" text-anchor="middle" letter-spacing="6">HYDAS</text>
        <text x="150" y="215" font-family="'Plus Jakarta Sans', sans-serif" font-size="9" font-weight="700" fill="${textSub}" text-anchor="middle" letter-spacing="4">ANCIENT CARIA</text>
      `;
      break;

    case 'moka-butik-hotel':
      inner = `
        <!-- MOKA: Artisanal Coffee Bean & Monogram -->
        <g transform="translate(150, 110)">
          <circle cx="0" cy="0" r="42" fill="none" stroke="${gold}" stroke-width="2.5"/>
          <ellipse cx="0" cy="-6" rx="16" ry="22" fill="none" stroke="${gold}" stroke-width="2.5"/>
          <path d="M0 -28 C-8 -10 8 8 0 16" stroke="${ringGold}" stroke-width="2.5"/>
          <circle cx="0" cy="-34" r="4" fill="${gold}"/>
        </g>
        <text x="150" y="196" font-family="'Cinzel', Georgia, serif" font-size="22" font-weight="700" fill="${gold}" text-anchor="middle" letter-spacing="6">MOKA</text>
        <text x="150" y="215" font-family="'Plus Jakarta Sans', sans-serif" font-size="9" font-weight="700" fill="${textSub}" text-anchor="middle" letter-spacing="4">BUTİK HOTEL</text>
      `;
      break;

    case 'portakal-butik-otel':
      inner = `
        <!-- PORTAKAL: Royal Citrus Blossom & Gilded Leaves -->
        <g transform="translate(150, 110)">
          <circle cx="0" cy="2" r="28" fill="none" stroke="${gold}" stroke-width="3"/>
          <circle cx="0" cy="2" r="7" fill="${gold}"/>
          <path d="M-10 -24 C-20 -34 0 -38 0 -38 C0 -38 20 -34 10 -24" fill="none" stroke="${ringGold}" stroke-width="2.5"/>
          <line x1="0" y1="-38" x2="0" y2="-24" stroke="${ringGold}" stroke-width="2.5"/>
        </g>
        <text x="150" y="196" font-family="'Cinzel', Georgia, serif" font-size="19" font-weight="700" fill="${gold}" text-anchor="middle" letter-spacing="5">PORTAKAL</text>
        <text x="150" y="215" font-family="'Plus Jakarta Sans', sans-serif" font-size="9" font-weight="700" fill="${textSub}" text-anchor="middle" letter-spacing="4">BUTİK OTEL</text>
      `;
      break;

    case 'salkim-sahil-evi':
    case 'uzum-tatil-evi':
      inner = `
        <!-- SALKIM / UZUM: Gilded Grape Cluster & Vine -->
        <g transform="translate(150, 110)">
          <path d="M0 -36 C-18 -40 -22 -26 0 -20 C22 -26 18 -40 0 -36 Z" fill="none" stroke="${ringGold}" stroke-width="2.5"/>
          <circle cx="-11" cy="-8" r="6.5" fill="${gold}"/>
          <circle cx="0" cy="-8" r="6.5" fill="${gold}"/>
          <circle cx="11" cy="-8" r="6.5" fill="${gold}"/>
          <circle cx="-6" cy="2" r="6.5" fill="${gold}"/>
          <circle cx="6" cy="2" r="6.5" fill="${gold}"/>
          <circle cx="0" cy="11" r="6.5" fill="${gold}"/>
        </g>
        <text x="150" y="196" font-family="'Cinzel', Georgia, serif" font-size="22" font-weight="700" fill="${gold}" text-anchor="middle" letter-spacing="6">${slug.includes('salkim') ? 'SALKIM' : 'ÜZÜM'}</text>
        <text x="150" y="215" font-family="'Plus Jakarta Sans', sans-serif" font-size="9" font-weight="700" fill="${textSub}" text-anchor="middle" letter-spacing="4">SAHİL EVİ</text>
      `;
      break;

    case 'sigliman-glamping-beach':
      inner = `
        <!-- SIGLIMAN: Luxury Bohemian Canopy & North Star -->
        <g transform="translate(150, 110)">
          <polygon points="0,-38 34,24 -34,24" fill="none" stroke="${gold}" stroke-width="3"/>
          <line x1="0" y1="-38" x2="0" y2="24" stroke="${ringGold}" stroke-width="2"/>
          <polygon points="0,-18 18,24 -18,24" fill="none" stroke="${ringGold}" stroke-width="1.8"/>
          <circle cx="0" cy="-48" r="4" fill="${gold}"/>
        </g>
        <text x="150" y="196" font-family="'Cinzel', Georgia, serif" font-size="19" font-weight="700" fill="${gold}" text-anchor="middle" letter-spacing="4">SIĞLİMAN</text>
        <text x="150" y="215" font-family="'Plus Jakarta Sans', sans-serif" font-size="9" font-weight="700" fill="${textSub}" text-anchor="middle" letter-spacing="4">GLAMPING & BEACH</text>
      `;
      break;

    case 'selimiye-sakli-bahce-hotel':
      inner = `
        <!-- SAKLI BAHCE: Secret Garden Arched Gate & Key -->
        <g transform="translate(150, 110)">
          <path d="M-30 28 L-30 -10 C-30 -30 30 -30 30 -10 L30 28" fill="none" stroke="${gold}" stroke-width="3.2"/>
          <line x1="-30" y1="28" x2="30" y2="28" stroke="${gold}" stroke-width="2.8"/>
          <circle cx="0" cy="-6" r="11" fill="none" stroke="${ringGold}" stroke-width="2"/>
          <path d="M0 5 L0 22 M-4 15 L0 15 M-4 19 L0 19" stroke="${ringGold}" stroke-width="2"/>
          <circle cx="0" cy="-30" r="4" fill="${gold}"/>
        </g>
        <text x="150" y="196" font-family="'Cinzel', Georgia, serif" font-size="18" font-weight="700" fill="${gold}" text-anchor="middle" letter-spacing="4">SAKLI BAHÇE</text>
        <text x="150" y="215" font-family="'Plus Jakarta Sans', sans-serif" font-size="9" font-weight="700" fill="${textSub}" text-anchor="middle" letter-spacing="4">HOTEL & BOTANIC</text>
      `;
      break;

    case 'zakkum-frida-pansiyon':
      inner = `
        <!-- ZAKKUM FRIDA: Oleander Bloom & Artist Monogram -->
        <g transform="translate(150, 110)">
          <circle cx="0" cy="0" r="40" fill="none" stroke="${gold}" stroke-width="2"/>
          <path d="M0 -24 C-10 -12 10 -12 0 -24 Z" fill="${gold}"/>
          <text x="0" y="20" font-family="'Cormorant Garamond', Georgia, serif" font-size="52" font-style="italic" font-weight="700" fill="${gold}" text-anchor="middle">ZF</text>
        </g>
        <text x="150" y="196" font-family="'Cinzel', Georgia, serif" font-size="18" font-weight="700" fill="${gold}" text-anchor="middle" letter-spacing="4">ZAKKUM FRIDA</text>
        <text x="150" y="215" font-family="'Plus Jakarta Sans', sans-serif" font-size="9" font-weight="700" fill="${textSub}" text-anchor="middle" letter-spacing="4">MAISON D'ART</text>
      `;
      break;

    default:
      inner = `
        <!-- CLASSICAL IMPERIAL EMBLEM -->
        <g transform="translate(150, 110)">
          <circle cx="0" cy="0" r="44" fill="none" stroke="${gold}" stroke-width="3"/>
          <text x="0" y="22" font-family="'Cinzel', Georgia, serif" font-size="48" font-weight="800" fill="${gold}" text-anchor="middle">${name.charAt(0)}</text>
        </g>
        <text x="150" y="196" font-family="'Cinzel', Georgia, serif" font-size="20" font-weight="700" fill="${gold}" text-anchor="middle" letter-spacing="5">${name.toUpperCase()}</text>
        <text x="150" y="215" font-family="'Plus Jakarta Sans', sans-serif" font-size="9" font-weight="700" fill="${textSub}" text-anchor="middle" letter-spacing="4">SELİMİYE</text>
      `;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="300" height="300">
  ${sharedDefs}
  ${frame}
  ${inner}
</svg>`;
}

function deployAllLogos() {
  console.log('💎 Generating ultra-crisp, high-contrast, filter-free luxury emblems for all 24 Selimiye hotels...');

  for (const hotel of research.hotels) {
    const slug = hotel.slug;
    const name = hotel.name;

    // V1 (Obsidian Gold Medallion)
    const v1Svg = getLuxuryEmblem(slug, name, true);
    const v1Path = path.join(baseDir, 'v1', slug, 'media', 'logo.svg');
    fs.mkdirSync(path.dirname(v1Path), { recursive: true });
    fs.writeFileSync(v1Path, v1Svg, 'utf8');

    // V2 (Imperial Emerald & Gold Medallion)
    const v2Svg = getLuxuryEmblem(slug, name, false);
    const v2Path = path.join(baseDir, 'v2-gemini', slug, 'media', 'logo.svg');
    fs.mkdirSync(path.dirname(v2Path), { recursive: true });
    fs.writeFileSync(v2Path, v2Svg, 'utf8');
  }

  console.log('✅ Successfully compiled and deployed all 48 high-contrast luxury hotel logos!');
}

deployAllLogos();
