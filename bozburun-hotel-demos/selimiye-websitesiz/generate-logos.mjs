import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const baseDir = __dirname;
const research = JSON.parse(fs.readFileSync(path.join(baseDir, 'hotel-research-v2.json'), 'utf8'));

// Common Gold Gradients & Filters
const goldDefs = `
  <defs>
    <linearGradient id="goldLuxury" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fff1c5"/>
      <stop offset="25%" stop-color="#e2c174"/>
      <stop offset="50%" stop-color="#c59b3f"/>
      <stop offset="75%" stop-color="#9d7422"/>
      <stop offset="100%" stop-color="#d4af37"/>
    </linearGradient>
    <linearGradient id="goldRing" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#8a6118"/>
      <stop offset="50%" stop-color="#e8cf8d"/>
      <stop offset="100%" stop-color="#9a7324"/>
    </linearGradient>
    <linearGradient id="emeraldLuxury" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1b4d39"/>
      <stop offset="50%" stop-color="#0c2b20"/>
      <stop offset="100%" stop-color="#051610"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="2" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>
`;

function getLogoSVG(slug, name, isDark = true) {
  const bgFill = isDark ? '#080d14' : '#ffffff';
  const strokeColor = 'url(#goldLuxury)';
  const innerBg = isDark ? '#05090f' : '#fcfbfa';
  const textColor = isDark ? '#f5dfa0' : '#143527';

  // Common outer ornamental medallion
  const outerRings = `
    <rect width="280" height="280" rx="140" fill="${bgFill}"/>
    <circle cx="140" cy="140" r="132" fill="${innerBg}" stroke="url(#goldRing)" stroke-width="2"/>
    <circle cx="140" cy="140" r="126" fill="none" stroke="url(#goldLuxury)" stroke-width="0.8" stroke-dasharray="2 3" opacity="0.85"/>
    <circle cx="140" cy="140" r="120" fill="none" stroke="url(#goldLuxury)" stroke-width="1.2"/>
    
    <!-- 4 Cardinal Accents -->
    <polygon points="140,9 143,15 137,15" fill="url(#goldLuxury)"/>
    <polygon points="140,271 143,265 137,265" fill="url(#goldLuxury)"/>
    <polygon points="9,140 15,143 15,137" fill="url(#goldLuxury)"/>
    <polygon points="271,140 265,143 265,137" fill="url(#goldLuxury)"/>
  `;

  let emblemContent = '';

  switch (slug) {
    case 'mi-amor-selimiye':
      emblemContent = `
        <!-- Mi Amor: Interlocking Regal Monogram & Coronet -->
        <path d="M125 75 L140 60 L155 75 L148 78 L140 68 L132 78 Z" fill="url(#goldLuxury)"/>
        <circle cx="140" cy="56" r="3" fill="url(#goldLuxury)"/>
        <circle cx="123" cy="73" r="2.5" fill="url(#goldLuxury)"/>
        <circle cx="157" cy="73" r="2.5" fill="url(#goldLuxury)"/>
        <!-- Interlocking M & A -->
        <text x="140" y="152" font-family="'Cormorant Garamond', 'Cinzel', serif" font-size="64" font-weight="700" fill="url(#goldLuxury)" text-anchor="middle" letter-spacing="2">MA</text>
        <!-- Laurel Sprigs -->
        <path d="M78 140 C78 180 100 205 140 212 C180 205 202 180 202 140" fill="none" stroke="url(#goldLuxury)" stroke-width="1.5"/>
        <path d="M85 155 C78 150 74 140 82 135" fill="none" stroke="url(#goldLuxury)" stroke-width="1.2"/>
        <path d="M195 155 C202 150 206 140 198 135" fill="none" stroke="url(#goldLuxury)" stroke-width="1.2"/>
        <text x="140" y="182" font-family="'Plus Jakarta Sans', sans-serif" font-size="10" font-weight="600" fill="${textColor}" text-anchor="middle" letter-spacing="4">SELİMİYE</text>
      `;
      break;

    case 'dut-selimiye':
      emblemContent = `
        <!-- Dut Selimiye: Royal Mulberry Leaf Heraldry -->
        <g transform="translate(140, 115)">
          <path d="M0 -45 C-25 -25 -35 10 0 45 C35 10 25 -25 0 -45 Z" fill="none" stroke="url(#goldLuxury)" stroke-width="2"/>
          <path d="M0 -40 L0 40" stroke="url(#goldLuxury)" stroke-width="1.2"/>
          <path d="M0 -20 C-15 -10 -15 0 0 5" fill="none" stroke="url(#goldLuxury)" stroke-width="1"/>
          <path d="M0 -20 C15 -10 15 0 0 5" fill="none" stroke="url(#goldLuxury)" stroke-width="1"/>
          <path d="M0 5 C-18 15 -18 25 0 30" fill="none" stroke="url(#goldLuxury)" stroke-width="1"/>
          <path d="M0 5 C18 15 18 25 0 30" fill="none" stroke="url(#goldLuxury)" stroke-width="1"/>
          <circle cx="0" cy="-48" r="3" fill="url(#goldLuxury)"/>
        </g>
        <text x="140" y="185" font-family="'Cinzel', 'Cormorant Garamond', serif" font-size="22" font-weight="700" fill="url(#goldLuxury)" text-anchor="middle" letter-spacing="6">DUT</text>
        <text x="140" y="202" font-family="'Plus Jakarta Sans', sans-serif" font-size="9" font-weight="600" fill="${textColor}" text-anchor="middle" letter-spacing="4">EST. 1984</text>
      `;
      break;

    case 'duru-selimiye':
      emblemContent = `
        <!-- Duru Selimiye: Celestial Water Prism Diamond & Sacred Sunburst -->
        <g transform="translate(140, 118)">
          <!-- Radiating Halo -->
          <circle cx="0" cy="0" r="48" fill="none" stroke="url(#goldLuxury)" stroke-width="0.7" stroke-dasharray="3 3"/>
          <line x1="0" y1="-56" x2="0" y2="-48" stroke="url(#goldLuxury)" stroke-width="1.5"/>
          <line x1="0" y1="56" x2="0" y2="48" stroke="url(#goldLuxury)" stroke-width="1.5"/>
          <line x1="-56" y1="0" x2="-48" y2="0" stroke="url(#goldLuxury)" stroke-width="1.5"/>
          <line x1="56" y1="0" x2="48" y2="0" stroke="url(#goldLuxury)" stroke-width="1.5"/>
          <!-- Luxury Faceted Jewel Drop -->
          <polygon points="0,-36 28,-8 0,38 -28,-8" fill="none" stroke="url(#goldLuxury)" stroke-width="2"/>
          <polygon points="0,-36 14,-8 0,38 -14,-8" fill="none" stroke="url(#goldLuxury)" stroke-width="1"/>
          <line x1="-28" y1="-8" x2="28" y2="-8" stroke="url(#goldLuxury)" stroke-width="1.2"/>
          <circle cx="0" cy="-8" r="4" fill="url(#goldLuxury)"/>
        </g>
        <text x="140" y="190" font-family="'Cinzel', serif" font-size="20" font-weight="700" fill="url(#goldLuxury)" text-anchor="middle" letter-spacing="5">DURU</text>
        <text x="140" y="206" font-family="'Plus Jakarta Sans', sans-serif" font-size="8" font-weight="700" fill="${textColor}" text-anchor="middle" letter-spacing="4">PURE WATER RETREAT</text>
      `;
      break;

    case 'makia-otel':
      emblemContent = `
        <!-- Makia: Sacred Mediterranean Flora Crest -->
        <g transform="translate(140, 112)">
          <circle cx="0" cy="0" r="42" fill="none" stroke="url(#goldLuxury)" stroke-width="1.5"/>
          <path d="M-30 15 C-20 -25 0 -35 0 -35 C0 -35 20 -25 30 15" fill="none" stroke="url(#goldLuxury)" stroke-width="1.5"/>
          <path d="M-22 0 C-10 -15 0 -22 0 -22 C0 -22 10 -15 22 0" fill="none" stroke="url(#goldLuxury)" stroke-width="1"/>
          <text x="0" y="20" font-family="'Cinzel', serif" font-size="34" font-weight="700" fill="url(#goldLuxury)" text-anchor="middle">M</text>
        </g>
        <text x="140" y="188" font-family="'Cinzel', serif" font-size="18" font-weight="700" fill="url(#goldLuxury)" text-anchor="middle" letter-spacing="5">MAKIA</text>
        <text x="140" y="204" font-family="'Plus Jakarta Sans', sans-serif" font-size="8" font-weight="700" fill="${textColor}" text-anchor="middle" letter-spacing="3">SELİMİYE</text>
      `;
      break;

    case 'pineloft-selimiye':
      emblemContent = `
        <!-- PineLoft: Modern Architectural Pine & Loft Crest -->
        <g transform="translate(140, 110)">
          <polygon points="0,-42 36,22 -36,22" fill="none" stroke="url(#goldLuxury)" stroke-width="1.8"/>
          <!-- Gilded Pinecone Scales -->
          <path d="M0 -30 C-10 -18 -10 -8 0 0 C10 -8 10 -18 0 -30 Z" fill="none" stroke="url(#goldLuxury)" stroke-width="1.2"/>
          <path d="M-12 -12 C-20 0 -18 10 -6 16" fill="none" stroke="url(#goldLuxury)" stroke-width="1.2"/>
          <path d="M12 -12 C20 0 18 10 6 16" fill="none" stroke="url(#goldLuxury)" stroke-width="1.2"/>
          <line x1="0" y1="0" x2="0" y2="22" stroke="url(#goldLuxury)" stroke-width="1.5"/>
        </g>
        <text x="140" y="186" font-family="'Cinzel', serif" font-size="18" font-weight="700" fill="url(#goldLuxury)" text-anchor="middle" letter-spacing="4">PINELOFT</text>
        <text x="140" y="202" font-family="'Plus Jakarta Sans', sans-serif" font-size="8" font-weight="700" fill="${textColor}" text-anchor="middle" letter-spacing="3">SUITES & LIVING</text>
      `;
      break;

    case 'elia-selimiye':
      emblemContent = `
        <!-- Elia: Classical Aegean Olive Crown & Amphora -->
        <g transform="translate(140, 112)">
          <!-- Olive Wreath -->
          <path d="M-40 10 C-45 -20 -20 -42 0 -42 C20 -42 45 -20 40 10 C35 32 18 42 0 42 C-18 42 -35 32 -40 10" fill="none" stroke="url(#goldLuxury)" stroke-width="1.5"/>
          <circle cx="-25" cy="-25" r="3" fill="url(#goldLuxury)"/>
          <circle cx="25" cy="-25" r="3" fill="url(#goldLuxury)"/>
          <circle cx="-38" cy="0" r="3" fill="url(#goldLuxury)"/>
          <circle cx="38" cy="0" r="3" fill="url(#goldLuxury)"/>
          <!-- Classical Greek Letter or Amphora -->
          <text x="0" y="14" font-family="'Cormorant Garamond', serif" font-size="44" font-style="italic" font-weight="700" fill="url(#goldLuxury)" text-anchor="middle">E</text>
        </g>
        <text x="140" y="188" font-family="'Cinzel', serif" font-size="20" font-weight="700" fill="url(#goldLuxury)" text-anchor="middle" letter-spacing="6">ELIA</text>
        <text x="140" y="204" font-family="'Plus Jakarta Sans', sans-serif" font-size="8" font-weight="700" fill="${textColor}" text-anchor="middle" letter-spacing="4">OLIVE RESIDENCE</text>
      `;
      break;

    case 'kiraz-vela-selimiye':
      emblemContent = `
        <!-- Kiraz Vela: Haute Nautical Dual Sail & North Star -->
        <g transform="translate(140, 110)">
          <!-- Sails -->
          <path d="M-4 -38 L-4 22 C-26 22 -32 6 -4 -38 Z" fill="none" stroke="url(#goldLuxury)" stroke-width="1.8"/>
          <path d="M4 -28 L4 22 C22 22 26 8 4 -28 Z" fill="none" stroke="url(#goldLuxury)" stroke-width="1.8"/>
          <!-- Hull & Waves -->
          <path d="M-34 28 C-10 36 10 36 34 28" fill="none" stroke="url(#goldLuxury)" stroke-width="2"/>
          <!-- Star -->
          <polygon points="0,-48 3,-42 9,-42 4,-38 6,-32 0,-36 -6,-32 -4,-38 -9,-42 -3,-42" fill="url(#goldLuxury)"/>
        </g>
        <text x="140" y="186" font-family="'Cinzel', serif" font-size="18" font-weight="700" fill="url(#goldLuxury)" text-anchor="middle" letter-spacing="4">KIRAZ VELA</text>
        <text x="140" y="202" font-family="'Plus Jakarta Sans', sans-serif" font-size="8" font-weight="700" fill="${textColor}" text-anchor="middle" letter-spacing="3">HOTEL & YACHTING</text>
      `;
      break;

    case 'selimiye-11-oda':
      emblemContent = `
        <!-- 11 Oda: Roman Imperial XI & Zodiac Star Ring -->
        <g transform="translate(140, 112)">
          <circle cx="0" cy="0" r="44" fill="none" stroke="url(#goldLuxury)" stroke-width="1.5"/>
          <circle cx="0" cy="0" r="38" fill="none" stroke="url(#goldLuxury)" stroke-width="0.8" stroke-dasharray="4 2"/>
          <text x="0" y="16" font-family="'Cinzel', serif" font-size="46" font-weight="700" fill="url(#goldLuxury)" text-anchor="middle" letter-spacing="2">XI</text>
          <circle cx="0" cy="-38" r="2.5" fill="url(#goldLuxury)"/>
          <circle cx="0" cy="38" r="2.5" fill="url(#goldLuxury)"/>
          <circle cx="-38" cy="0" r="2.5" fill="url(#goldLuxury)"/>
          <circle cx="38" cy="0" r="2.5" fill="url(#goldLuxury)"/>
        </g>
        <text x="140" y="188" font-family="'Cinzel', serif" font-size="18" font-weight="700" fill="url(#goldLuxury)" text-anchor="middle" letter-spacing="5">11 ODA</text>
        <text x="140" y="204" font-family="'Plus Jakarta Sans', sans-serif" font-size="8" font-weight="700" fill="${textColor}" text-anchor="middle" letter-spacing="4">BOUTIQUE RETREAT</text>
      `;
      break;

    case 'naxos-beach':
      emblemContent = `
        <!-- Naxos Beach: Portara Cycladic Gateway & Aegean Wave -->
        <g transform="translate(140, 110)">
          <!-- Portara Frame -->
          <rect x="-24" y="-36" width="48" height="60" fill="none" stroke="url(#goldLuxury)" stroke-width="3"/>
          <rect x="-30" y="-40" width="60" height="8" fill="url(#goldLuxury)"/>
          <!-- Rising Sun -->
          <circle cx="0" cy="-6" r="14" fill="none" stroke="url(#goldLuxury)" stroke-width="1.2"/>
          <path d="M-18 12 C-6 6 6 18 18 12" fill="none" stroke="url(#goldLuxury)" stroke-width="1.5"/>
        </g>
        <text x="140" y="186" font-family="'Cinzel', serif" font-size="18" font-weight="700" fill="url(#goldLuxury)" text-anchor="middle" letter-spacing="5">NAXOS</text>
        <text x="140" y="202" font-family="'Plus Jakarta Sans', sans-serif" font-size="8" font-weight="700" fill="${textColor}" text-anchor="middle" letter-spacing="4">BEACH RESORT</text>
      `;
      break;

    case 'selimiye-sakli-bahce-hotel':
      emblemContent = `
        <!-- Saklı Bahçe: Secret Garden Gate & Key -->
        <g transform="translate(140, 110)">
          <path d="M-28 26 L-28 -10 C-28 -28 28 -28 28 -10 L28 26" fill="none" stroke="url(#goldLuxury)" stroke-width="2"/>
          <line x1="-28" y1="26" x2="28" y2="26" stroke="url(#goldLuxury)" stroke-width="2"/>
          <circle cx="0" cy="-6" r="10" fill="none" stroke="url(#goldLuxury)" stroke-width="1.2"/>
          <path d="M0 4 L0 20 M-4 14 L0 14 M-4 18 L0 18" stroke="url(#goldLuxury)" stroke-width="1.5"/>
          <circle cx="0" cy="-28" r="3" fill="url(#goldLuxury)"/>
        </g>
        <text x="140" y="186" font-family="'Cinzel', serif" font-size="16" font-weight="700" fill="url(#goldLuxury)" text-anchor="middle" letter-spacing="3">SAKLI BAHÇE</text>
        <text x="140" y="202" font-family="'Plus Jakarta Sans', sans-serif" font-size="8" font-weight="700" fill="${textColor}" text-anchor="middle" letter-spacing="3">HOTEL & BOTANIC</text>
      `;
      break;

    case 'yamac-motel-selimiye':
      emblemContent = `
        <!-- Yamaç Motel: Cliff Horizon & Marine Compass -->
        <g transform="translate(140, 110)">
          <circle cx="0" cy="0" r="40" fill="none" stroke="url(#goldLuxury)" stroke-width="1.5"/>
          <!-- Mountain/Cliff Lines -->
          <path d="M-36 18 L-12 -18 L10 6 L22 -8 L36 18" fill="none" stroke="url(#goldLuxury)" stroke-width="1.8"/>
          <circle cx="16" cy="-22" r="7" fill="url(#goldLuxury)"/>
        </g>
        <text x="140" y="186" font-family="'Cinzel', serif" font-size="18" font-weight="700" fill="url(#goldLuxury)" text-anchor="middle" letter-spacing="4">YAMAÇ</text>
        <text x="140" y="202" font-family="'Plus Jakarta Sans', sans-serif" font-size="8" font-weight="700" fill="${textColor}" text-anchor="middle" letter-spacing="3">SELİMİYE MOTEL</text>
      `;
      break;

    case 'coban-hotel-selimiye':
      emblemContent = `
        <!-- Çoban Hotel: Imperial Ram & Pastoral Wreath -->
        <g transform="translate(140, 110)">
          <!-- Ram Horns Silhouette -->
          <path d="M-22 -8 C-36 -28 -10 -36 0 -18 C10 -36 36 -28 22 -8 C12 6 -12 6 -22 -8 Z" fill="none" stroke="url(#goldLuxury)" stroke-width="2"/>
          <polygon points="0,-10 8,14 -8,14" fill="none" stroke="url(#goldLuxury)" stroke-width="1.5"/>
          <circle cx="0" cy="22" r="3" fill="url(#goldLuxury)"/>
        </g>
        <text x="140" y="186" font-family="'Cinzel', serif" font-size="18" font-weight="700" fill="url(#goldLuxury)" text-anchor="middle" letter-spacing="4">ÇOBAN</text>
        <text x="140" y="202" font-family="'Plus Jakarta Sans', sans-serif" font-size="8" font-weight="700" fill="${textColor}" text-anchor="middle" letter-spacing="3">HOTEL SELİMİYE</text>
      `;
      break;

    case 'dantel-pansiyon-restaurant':
      emblemContent = `
        <!-- Dantel: Royal Filigree Mandala Rosette -->
        <g transform="translate(140, 110)">
          <circle cx="0" cy="0" r="38" fill="none" stroke="url(#goldLuxury)" stroke-width="1"/>
          <!-- 8-petal mandala -->
          <circle cx="0" cy="-18" r="14" fill="none" stroke="url(#goldLuxury)" stroke-width="0.8"/>
          <circle cx="0" cy="18" r="14" fill="none" stroke="url(#goldLuxury)" stroke-width="0.8"/>
          <circle cx="-18" cy="0" r="14" fill="none" stroke="url(#goldLuxury)" stroke-width="0.8"/>
          <circle cx="18" cy="0" r="14" fill="none" stroke="url(#goldLuxury)" stroke-width="0.8"/>
          <circle cx="0" cy="0" r="6" fill="url(#goldLuxury)"/>
        </g>
        <text x="140" y="186" font-family="'Cinzel', serif" font-size="18" font-weight="700" fill="url(#goldLuxury)" text-anchor="middle" letter-spacing="4">DANTEL</text>
        <text x="140" y="202" font-family="'Plus Jakarta Sans', sans-serif" font-size="8" font-weight="700" fill="${textColor}" text-anchor="middle" letter-spacing="3">MAISON & RESTAURANT</text>
      `;
      break;

    case 'doga-pansiyon':
      emblemContent = `
        <!-- Doğa: Dual Botanical Laurel Leaf -->
        <g transform="translate(140, 110)">
          <path d="M-28 20 C-36 -10 -15 -35 0 -40 C15 -35 36 -10 28 20" fill="none" stroke="url(#goldLuxury)" stroke-width="2"/>
          <path d="M0 -36 L0 24" stroke="url(#goldLuxury)" stroke-width="1.5"/>
          <circle cx="0" cy="-44" r="3" fill="url(#goldLuxury)"/>
          <text x="0" y="12" font-family="'Cinzel', serif" font-size="34" font-weight="700" fill="url(#goldLuxury)" text-anchor="middle">D</text>
        </g>
        <text x="140" y="186" font-family="'Cinzel', serif" font-size="18" font-weight="700" fill="url(#goldLuxury)" text-anchor="middle" letter-spacing="5">DOĞA</text>
        <text x="140" y="202" font-family="'Plus Jakarta Sans', sans-serif" font-size="8" font-weight="700" fill="${textColor}" text-anchor="middle" letter-spacing="3">SELİMİYE</text>
      `;
      break;

    case 'ekin-pansiyon':
    case 'ekin-tatil-evi':
      emblemContent = `
        <!-- Ekin: Imperial Golden Wheat & Solar Rays -->
        <g transform="translate(140, 110)">
          <path d="M0 -42 L0 30" stroke="url(#goldLuxury)" stroke-width="2"/>
          <!-- Wheat Ears -->
          <ellipse cx="-8" cy="-28" rx="6" ry="3" transform="rotate(-30 -8 -28)" fill="url(#goldLuxury)"/>
          <ellipse cx="8" cy="-28" rx="6" ry="3" transform="rotate(30 8 -28)" fill="url(#goldLuxury)"/>
          <ellipse cx="-10" cy="-14" rx="7" ry="3.5" transform="rotate(-30 -10 -14)" fill="url(#goldLuxury)"/>
          <ellipse cx="10" cy="-14" rx="7" ry="3.5" transform="rotate(30 10 -14)" fill="url(#goldLuxury)"/>
          <ellipse cx="-10" cy="0" rx="7" ry="3.5" transform="rotate(-30 -10 0)" fill="url(#goldLuxury)"/>
          <ellipse cx="10" cy="0" rx="7" ry="3.5" transform="rotate(30 10 0)" fill="url(#goldLuxury)"/>
        </g>
        <text x="140" y="186" font-family="'Cinzel', serif" font-size="18" font-weight="700" fill="url(#goldLuxury)" text-anchor="middle" letter-spacing="4">EKİN</text>
        <text x="140" y="202" font-family="'Plus Jakarta Sans', sans-serif" font-size="8" font-weight="700" fill="${textColor}" text-anchor="middle" letter-spacing="3">${slug.includes('tatil') ? 'TATİL EVİ' : 'SELİMİYE'}</text>
      `;
      break;

    case 'hydas-pansiyon':
      emblemContent = `
        <!-- Hydas: Ancient Carian Ionic Column Acropolis -->
        <g transform="translate(140, 110)">
          <!-- Ionic Capital -->
          <circle cx="-16" cy="-24" r="8" fill="none" stroke="url(#goldLuxury)" stroke-width="1.8"/>
          <circle cx="16" cy="-24" r="8" fill="none" stroke="url(#goldLuxury)" stroke-width="1.8"/>
          <rect x="-24" y="-32" width="48" height="6" fill="url(#goldLuxury)"/>
          <!-- Column Shaft -->
          <line x1="-12" y1="-16" x2="-12" y2="24" stroke="url(#goldLuxury)" stroke-width="2"/>
          <line x1="0" y1="-16" x2="0" y2="24" stroke="url(#goldLuxury)" stroke-width="1.5"/>
          <line x1="12" y1="-16" x2="12" y2="24" stroke="url(#goldLuxury)" stroke-width="2"/>
          <rect x="-18" y="24" width="36" height="6" fill="url(#goldLuxury)"/>
        </g>
        <text x="140" y="186" font-family="'Cinzel', serif" font-size="18" font-weight="700" fill="url(#goldLuxury)" text-anchor="middle" letter-spacing="5">HYDAS</text>
        <text x="140" y="202" font-family="'Plus Jakarta Sans', sans-serif" font-size="8" font-weight="700" fill="${textColor}" text-anchor="middle" letter-spacing="3">ANCIENT CARIA</text>
      `;
      break;

    case 'mavi-melek-hotel':
      emblemContent = `
        <!-- Mavi Melek: Angelic Wings & Sea Halo -->
        <g transform="translate(140, 110)">
          <!-- Left Wing -->
          <path d="M-6 -8 C-24 -36 -46 -20 -36 14 C-26 0 -14 2 -6 -8 Z" fill="none" stroke="url(#goldLuxury)" stroke-width="1.8"/>
          <!-- Right Wing -->
          <path d="M6 -8 C24 -36 46 -20 36 14 C26 0 14 2 6 -8 Z" fill="none" stroke="url(#goldLuxury)" stroke-width="1.8"/>
          <!-- Center Star/Halo -->
          <circle cx="0" cy="-18" r="6" fill="url(#goldLuxury)"/>
          <circle cx="0" cy="18" r="3" fill="url(#goldLuxury)"/>
        </g>
        <text x="140" y="186" font-family="'Cinzel', serif" font-size="16" font-weight="700" fill="url(#goldLuxury)" text-anchor="middle" letter-spacing="3">MAVİ MELEK</text>
        <text x="140" y="202" font-family="'Plus Jakarta Sans', sans-serif" font-size="8" font-weight="700" fill="${textColor}" text-anchor="middle" letter-spacing="3">HOTEL SELİMİYE</text>
      `;
      break;

    case 'moka-butik-hotel':
      emblemContent = `
        <!-- Moka: Artisanal Botanical Blossom & Coffee Monogram -->
        <g transform="translate(140, 110)">
          <circle cx="0" cy="0" r="38" fill="none" stroke="url(#goldLuxury)" stroke-width="1.5"/>
          <ellipse cx="0" cy="-6" rx="14" ry="20" fill="none" stroke="url(#goldLuxury)" stroke-width="1.5"/>
          <path d="M0 -26 C-6 -10 6 6 0 14" stroke="url(#goldLuxury)" stroke-width="1.5"/>
          <circle cx="0" cy="-32" r="3" fill="url(#goldLuxury)"/>
        </g>
        <text x="140" y="186" font-family="'Cinzel', serif" font-size="18" font-weight="700" fill="url(#goldLuxury)" text-anchor="middle" letter-spacing="5">MOKA</text>
        <text x="140" y="202" font-family="'Plus Jakarta Sans', sans-serif" font-size="8" font-weight="700" fill="${textColor}" text-anchor="middle" letter-spacing="3">BUTİK HOTEL</text>
      `;
      break;

    case 'portakal-butik-otel':
      emblemContent = `
        <!-- Portakal: Royal Citrus Blossom & Leaves -->
        <g transform="translate(140, 110)">
          <!-- Citrus Wheel -->
          <circle cx="0" cy="2" r="26" fill="none" stroke="url(#goldLuxury)" stroke-width="1.8"/>
          <circle cx="0" cy="2" r="6" fill="url(#goldLuxury)"/>
          <path d="M-8 -22 C-18 -32 0 -36 0 -36 C0 -36 18 -32 8 -22" fill="none" stroke="url(#goldLuxury)" stroke-width="1.5"/>
          <line x1="0" y1="-36" x2="0" y2="-22" stroke="url(#goldLuxury)" stroke-width="1.5"/>
        </g>
        <text x="140" y="186" font-family="'Cinzel', serif" font-size="16" font-weight="700" fill="url(#goldLuxury)" text-anchor="middle" letter-spacing="4">PORTAKAL</text>
        <text x="140" y="202" font-family="'Plus Jakarta Sans', sans-serif" font-size="8" font-weight="700" fill="${textColor}" text-anchor="middle" letter-spacing="3">BUTİK OTEL</text>
      `;
      break;

    case 'salkim-sahil-evi':
    case 'uzum-tatil-evi':
      emblemContent = `
        <!-- Salkım / Üzüm: Gilded Grape Cluster & Vineyard Vine -->
        <g transform="translate(140, 110)">
          <!-- Vine Leaf -->
          <path d="M0 -34 C-16 -38 -20 -24 0 -18 C20 -24 16 -38 0 -34 Z" fill="none" stroke="url(#goldLuxury)" stroke-width="1.5"/>
          <!-- Grapes -->
          <circle cx="-10" cy="-8" r="5" fill="url(#goldLuxury)"/>
          <circle cx="0" cy="-8" r="5" fill="url(#goldLuxury)"/>
          <circle cx="10" cy="-8" r="5" fill="url(#goldLuxury)"/>
          <circle cx="-5" cy="0" r="5" fill="url(#goldLuxury)"/>
          <circle cx="5" cy="0" r="5" fill="url(#goldLuxury)"/>
          <circle cx="0" cy="8" r="5" fill="url(#goldLuxury)"/>
        </g>
        <text x="140" y="186" font-family="'Cinzel', serif" font-size="18" font-weight="700" fill="url(#goldLuxury)" text-anchor="middle" letter-spacing="4">${slug.includes('salkim') ? 'SALKIM' : 'ÜZÜM'}</text>
        <text x="140" y="202" font-family="'Plus Jakarta Sans', sans-serif" font-size="8" font-weight="700" fill="${textColor}" text-anchor="middle" letter-spacing="3">SAHİL EVİ</text>
      `;
      break;

    case 'sigliman-glamping-beach':
      emblemContent = `
        <!-- Sığliman: Bohemian Luxury Canopy & Star Compass -->
        <g transform="translate(140, 110)">
          <!-- Glamping Tent Canopy -->
          <polygon points="0,-36 32,22 -32,22" fill="none" stroke="url(#goldLuxury)" stroke-width="1.8"/>
          <line x1="0" y1="-36" x2="0" y2="22" stroke="url(#goldLuxury)" stroke-width="1.2"/>
          <polygon points="0,-18 16,22 -16,22" fill="none" stroke="url(#goldLuxury)" stroke-width="1"/>
          <!-- Celestial Moon & Stars -->
          <circle cx="0" cy="-44" r="3" fill="url(#goldLuxury)"/>
        </g>
        <text x="140" y="186" font-family="'Cinzel', serif" font-size="16" font-weight="700" fill="url(#goldLuxury)" text-anchor="middle" letter-spacing="3">SIĞLİMAN</text>
        <text x="140" y="202" font-family="'Plus Jakarta Sans', sans-serif" font-size="8" font-weight="700" fill="${textColor}" text-anchor="middle" letter-spacing="3">GLAMPING & BEACH</text>
      `;
      break;

    case 'zakkum-frida-pansiyon':
      emblemContent = `
        <!-- Zakkum Frida: Oleander Bloom & Artist Monogram -->
        <g transform="translate(140, 110)">
          <!-- 5 Petal Oleander Bloom -->
          <circle cx="0" cy="0" r="36" fill="none" stroke="url(#goldLuxury)" stroke-width="1"/>
          <path d="M0 -22 C-8 -12 8 -12 0 -22 Z" fill="url(#goldLuxury)"/>
          <text x="0" y="16" font-family="'Cormorant Garamond', serif" font-size="42" font-style="italic" font-weight="700" fill="url(#goldLuxury)" text-anchor="middle">ZF</text>
        </g>
        <text x="140" y="186" font-family="'Cinzel', serif" font-size="16" font-weight="700" fill="url(#goldLuxury)" text-anchor="middle" letter-spacing="3">ZAKKUM FRIDA</text>
        <text x="140" y="202" font-family="'Plus Jakarta Sans', sans-serif" font-size="8" font-weight="700" fill="${textColor}" text-anchor="middle" letter-spacing="3">MAISON D'ART</text>
      `;
      break;

    default:
      emblemContent = `
        <!-- Classical Serif Monogram -->
        <g transform="translate(140, 110)">
          <circle cx="0" cy="0" r="40" fill="none" stroke="url(#goldLuxury)" stroke-width="1.8"/>
          <text x="0" y="16" font-family="'Cinzel', serif" font-size="38" font-weight="700" fill="url(#goldLuxury)" text-anchor="middle">${name.charAt(0)}</text>
        </g>
        <text x="140" y="186" font-family="'Cinzel', serif" font-size="18" font-weight="700" fill="url(#goldLuxury)" text-anchor="middle" letter-spacing="4">${escapeHtml(name).toUpperCase()}</text>
        <text x="140" y="202" font-family="'Plus Jakarta Sans', sans-serif" font-size="8" font-weight="700" fill="${textColor}" text-anchor="middle" letter-spacing="3">SELİMİYE</text>
      `;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 280" width="100%" height="100%">
    ${goldDefs}
    ${outerRings}
    ${emblemContent}
  </svg>`;
}

function generateAllLogos() {
  console.log('🎨 Generating bespoke high-luxury SVG insignias for all 24 Selimiye hotels...');

  for (const hotel of research.hotels) {
    const slug = hotel.slug;
    const name = hotel.name;

    // Generate V1 (Obsidian Gold) Logo
    const v1Svg = getLogoSVG(slug, name, true);
    const v1Path = path.join(baseDir, 'v1', slug, 'media', 'logo.svg');
    fs.mkdirSync(path.dirname(v1Path), { recursive: true });
    fs.writeFileSync(v1Path, v1Svg, 'utf8');

    // Generate V2 (Haute Editorial) Logo
    const v2Svg = getLogoSVG(slug, name, false);
    const v2Path = path.join(baseDir, 'v2-gemini', slug, 'media', 'logo.svg');
    fs.mkdirSync(path.dirname(v2Path), { recursive: true });
    fs.writeFileSync(v2Path, v2Svg, 'utf8');
  }

  console.log('✅ Successfully generated and deployed all 48 high-luxury hotel logos!');
}

generateAllLogos();
