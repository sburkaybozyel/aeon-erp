import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 24 Selimiye Hotels and their bespoke luxury SVG logo designs
const hotelLogos = {
  "mi-amor-selimiye": {
    name: "Mi Amor",
    sub: "SELİMİYE",
    color1: "#d4af37",
    color2: "#c87d85",
    svgIcon: `
      <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.6"/>
      <circle cx="50" cy="50" r="41" fill="none" stroke="currentColor" stroke-width="0.8" stroke-dasharray="2,3"/>
      <path d="M50 30 C42 22, 30 26, 30 38 C30 50, 50 68, 50 68 C50 68, 70 50, 70 38 C70 26, 58 22, 50 30 Z" fill="none" stroke="currentColor" stroke-width="2"/>
      <path d="M38 52 Q50 44 62 52" fill="none" stroke="currentColor" stroke-width="1.2"/>
    `
  },
  "dut-selimiye": {
    name: "Dut",
    sub: "SELİMİYE",
    color1: "#e2c375",
    color2: "#2d5a3f",
    svgIcon: `
      <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <!-- Botanical Mulberry Leaf & Stem -->
      <path d="M50 20 Q68 32 62 54 Q56 70 50 80 Q44 70 38 54 Q32 32 50 20 Z" fill="none" stroke="currentColor" stroke-width="2"/>
      <path d="M50 25 L50 75" stroke="currentColor" stroke-width="1.2"/>
      <path d="M50 40 Q60 46 58 52" stroke="currentColor" stroke-width="1" fill="none"/>
      <path d="M50 50 Q40 56 42 62" stroke="currentColor" stroke-width="1" fill="none"/>
      <circle cx="50" cy="80" r="2.5" fill="currentColor"/>
    `
  },
  "elia-selimiye": {
    name: "Elia",
    sub: "SELİMİYE",
    color1: "#d4af37",
    color2: "#1b4332",
    svgIcon: `
      <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <!-- Olive Wreath Crest -->
      <path d="M32 65 C26 50, 26 35, 48 24 C45 32, 45 42, 38 48 C48 38, 55 32, 50 24" fill="none" stroke="currentColor" stroke-width="1.8"/>
      <path d="M68 65 C74 50, 74 35, 52 24 C55 32, 55 42, 62 48 C52 38, 45 32, 50 24" fill="none" stroke="currentColor" stroke-width="1.8"/>
      <circle cx="42" cy="38" r="2.5" fill="currentColor"/>
      <circle cx="58" cy="38" r="2.5" fill="currentColor"/>
      <circle cx="50" cy="62" r="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    `
  },
  "kiraz-vela-selimiye": {
    name: "Kiraz Vela",
    sub: "SELİMİYE",
    color1: "#e0a96d",
    color2: "#1a365d",
    svgIcon: `
      <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <!-- Nautical Sail & Compass Star -->
      <path d="M48 20 L48 76" stroke="currentColor" stroke-width="1.8"/>
      <path d="M48 24 Q72 45 48 68 Z" fill="none" stroke="currentColor" stroke-width="2"/>
      <path d="M44 32 Q26 50 44 68 Z" fill="none" stroke="currentColor" stroke-width="1.6"/>
      <path d="M28 78 Q50 84 72 78" stroke="currentColor" stroke-width="2" fill="none"/>
    `
  },
  "duru-selimiye": {
    name: "Duru",
    sub: "SELİMİYE",
    color1: "#38bdf8",
    color2: "#d4af37",
    svgIcon: `
      <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <!-- Pure Crystal Water Drop & Diamond -->
      <path d="M50 22 C50 22, 68 46, 68 58 C68 68, 60 76, 50 76 C40 76, 32 68, 32 58 C32 46, 50 22, 50 22 Z" fill="none" stroke="currentColor" stroke-width="2"/>
      <circle cx="50" cy="58" r="8" fill="none" stroke="currentColor" stroke-width="1.2"/>
      <circle cx="50" cy="58" r="2" fill="currentColor"/>
    `
  },
  "pineloft-selimiye": {
    name: "PineLoft",
    sub: "SELİMİYE",
    color1: "#e6ca65",
    color2: "#2d4a22",
    svgIcon: `
      <rect x="8" y="8" width="84" height="84" rx="16" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <!-- Pinecone & Modern Loft Triangle -->
      <path d="M50 22 L72 62 L28 62 Z" fill="none" stroke="currentColor" stroke-width="2"/>
      <path d="M50 36 L64 62 L36 62 Z" fill="none" stroke="currentColor" stroke-width="1.2"/>
      <line x1="50" y1="62" x2="50" y2="76" stroke="currentColor" stroke-width="2"/>
      <circle cx="50" cy="76" r="3" fill="currentColor"/>
    `
  },
  "selimiye-11-oda": {
    name: "11 Oda",
    sub: "SELİMİYE",
    color1: "#d4af37",
    color2: "#1f2421",
    svgIcon: `
      <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" stroke-width="0.8"/>
      <!-- Roman Numeral XI -->
      <text x="50" y="58" font-family="'Cinzel', 'Times New Roman', serif" font-size="28" font-weight="700" text-anchor="middle" fill="currentColor">XI</text>
    `
  },
  "selimiye-sakli-bahce-hotel": {
    name: "Saklı Bahçe",
    sub: "SELİMİYE",
    color1: "#f3df95",
    color2: "#2d6a4f",
    svgIcon: `
      <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <!-- Secret Botanical Arch Gate -->
      <path d="M32 76 L32 46 C32 32, 68 32, 68 46 L68 76" fill="none" stroke="currentColor" stroke-width="2"/>
      <circle cx="50" cy="46" r="6" fill="none" stroke="currentColor" stroke-width="1.2"/>
      <path d="M42 62 Q50 56 58 62" stroke="currentColor" stroke-width="1.5" fill="none"/>
      <path d="M26 40 Q32 30 40 36" stroke="currentColor" stroke-width="1.2" fill="none"/>
      <path d="M74 40 Q68 30 60 36" stroke="currentColor" stroke-width="1.2" fill="none"/>
    `
  },
  "yamac-motel-selimiye": {
    name: "Yamaç",
    sub: "SELİMİYE",
    color1: "#e0a96d",
    color2: "#7c3f00",
    svgIcon: `
      <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <!-- Hillside & Setting Sun Discs -->
      <circle cx="50" cy="42" r="14" fill="none" stroke="currentColor" stroke-width="1.8"/>
      <path d="M20 74 Q42 52 65 62 Q78 68 82 74" fill="none" stroke="currentColor" stroke-width="2.2"/>
      <path d="M26 78 Q52 66 74 78" fill="none" stroke="currentColor" stroke-width="1.2"/>
    `
  },
  "coban-hotel-selimiye": {
    name: "Çoban Hotel",
    sub: "SELİMİYE",
    color1: "#d4af37",
    color2: "#3d2b1f",
    svgIcon: `
      <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <!-- Pastoral Ram & Sheaf Emblem -->
      <path d="M30 40 Q38 28 50 38 Q62 28 70 40 Q64 56 50 48 Q36 56 30 40 Z" fill="none" stroke="currentColor" stroke-width="2"/>
      <path d="M50 48 L50 78" stroke="currentColor" stroke-width="2"/>
      <path d="M42 66 Q50 60 58 66" stroke="currentColor" stroke-width="1.5" fill="none"/>
    `
  },
  "dantel-pansiyon-restaurant": {
    name: "Dantel",
    sub: "SELİMİYE",
    color1: "#f3df95",
    color2: "#4a3b32",
    svgIcon: `
      <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <!-- Bohemian Lace Mandala -->
      <circle cx="50" cy="50" r="16" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <circle cx="50" cy="50" r="28" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="3,3"/>
      <circle cx="50" cy="26" r="5" fill="none" stroke="currentColor" stroke-width="1.2"/>
      <circle cx="50" cy="74" r="5" fill="none" stroke="currentColor" stroke-width="1.2"/>
      <circle cx="26" cy="50" r="5" fill="none" stroke="currentColor" stroke-width="1.2"/>
      <circle cx="74" cy="50" r="5" fill="none" stroke="currentColor" stroke-width="1.2"/>
      <circle cx="50" cy="50" r="3" fill="currentColor"/>
    `
  },
  "doga-pansiyon": {
    name: "Doğa",
    sub: "SELİMİYE",
    color1: "#00f5a0",
    color2: "#134e4a",
    svgIcon: `
      <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <!-- Twin Olive Leaf Symbol -->
      <path d="M50 78 C50 78 30 62 30 42 C30 26 44 22 50 34 C56 22 70 26 70 42 C70 62 50 78 50 78 Z" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="50" y1="36" x2="50" y2="76" stroke="currentColor" stroke-width="1.5"/>
    `
  },
  "ekin-pansiyon": {
    name: "Ekin",
    sub: "SELİMİYE",
    color1: "#f59e0b",
    color2: "#78350f",
    svgIcon: `
      <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <!-- Golden Wheat Sheaf & Sun -->
      <path d="M50 20 L50 80" stroke="currentColor" stroke-width="2"/>
      <ellipse cx="44" cy="32" rx="4" ry="7" transform="rotate(-30 44 32)" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <ellipse cx="56" cy="32" rx="4" ry="7" transform="rotate(30 56 32)" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <ellipse cx="42" cy="48" rx="4" ry="7" transform="rotate(-30 42 48)" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <ellipse cx="58" cy="48" rx="4" ry="7" transform="rotate(30 58 48)" fill="none" stroke="currentColor" stroke-width="1.5"/>
    `
  },
  "ekin-tatil-evi": {
    name: "Ekin Tatil Evi",
    sub: "SELİMİYE",
    color1: "#d4af37",
    color2: "#1c1917",
    svgIcon: `
      <rect x="8" y="8" width="84" height="84" rx="14" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <!-- Stone Cottage & Chimney -->
      <path d="M26 52 L50 30 L74 52 L74 76 L26 76 Z" fill="none" stroke="currentColor" stroke-width="2"/>
      <path d="M62 36 L62 26 L68 26 L68 42" stroke="currentColor" stroke-width="1.5" fill="none"/>
      <rect x="42" y="58" width="16" height="18" fill="none" stroke="currentColor" stroke-width="1.5"/>
    `
  },
  "hydas-pansiyon": {
    name: "Hydas",
    sub: "SELİMİYE",
    color1: "#d4af37",
    color2: "#0f172a",
    svgIcon: `
      <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <!-- Ancient Carian Pillar -->
      <path d="M30 76 L70 76" stroke="currentColor" stroke-width="2.5"/>
      <path d="M34 70 L66 70" stroke="currentColor" stroke-width="1.5"/>
      <line x1="42" y1="34" x2="42" y2="70" stroke="currentColor" stroke-width="2"/>
      <line x1="50" y1="34" x2="50" y2="70" stroke="currentColor" stroke-width="2"/>
      <line x1="58" y1="34" x2="58" y2="70" stroke="currentColor" stroke-width="2"/>
      <path d="M30 30 Q50 22 70 30 L66 34 L34 34 Z" fill="none" stroke="currentColor" stroke-width="2"/>
    `
  },
  "makia-otel": {
    name: "Makia",
    sub: "SELİMİYE",
    color1: "#10b981",
    color2: "#064e3b",
    svgIcon: `
      <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <!-- Maki Flora Monogram M -->
      <path d="M28 72 L28 32 L50 54 L72 32 L72 72" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="50" cy="30" r="3" fill="currentColor"/>
    `
  },
  "mavi-melek-hotel": {
    name: "Mavi Melek",
    sub: "SELİMİYE",
    color1: "#38bdf8",
    color2: "#0369a1",
    svgIcon: `
      <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <!-- Angel Wings & Aegean Waves -->
      <path d="M50 36 C42 22, 22 26, 20 48 C28 50, 38 46, 50 64 C62 46, 72 50, 80 48 C78 26, 58 22, 50 36 Z" fill="none" stroke="currentColor" stroke-width="2"/>
      <circle cx="50" cy="28" r="4" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <path d="M32 72 Q50 66 68 72" stroke="currentColor" stroke-width="1.8" fill="none"/>
    `
  },
  "moka-butik-hotel": {
    name: "Moka",
    sub: "SELİMİYE",
    color1: "#d97706",
    color2: "#451a03",
    svgIcon: `
      <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <!-- Artisanal Coffee Bean Crest -->
      <ellipse cx="50" cy="50" rx="20" ry="28" transform="rotate(-25 50 50)" fill="none" stroke="currentColor" stroke-width="2.2"/>
      <path d="M40 30 Q54 48 42 62 Q50 68 60 70" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    `
  },
  "naxos-beach": {
    name: "Naxos",
    sub: "SELİMİYE",
    color1: "#0ea5e9",
    color2: "#d4af37",
    svgIcon: `
      <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <!-- Cycladic Portal & Sun -->
      <rect x="32" y="26" width="36" height="50" fill="none" stroke="currentColor" stroke-width="3"/>
      <circle cx="50" cy="48" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/>
    `
  },
  "portakal-butik-otel": {
    name: "Portakal",
    sub: "SELİMİYE",
    color1: "#f97316",
    color2: "#7c2d12",
    svgIcon: `
      <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <!-- Orange Blossom & Slice -->
      <circle cx="50" cy="52" r="22" fill="none" stroke="currentColor" stroke-width="2"/>
      <path d="M50 24 Q58 14 66 18 Q62 26 50 26" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <path d="M50 52 L50 30" stroke="currentColor" stroke-width="1.2"/>
      <path d="M50 52 L68 42" stroke="currentColor" stroke-width="1.2"/>
      <path d="M50 52 L66 64" stroke="currentColor" stroke-width="1.2"/>
      <path d="M50 52 L34 64" stroke="currentColor" stroke-width="1.2"/>
      <path d="M50 52 L32 42" stroke="currentColor" stroke-width="1.2"/>
    `
  },
  "salkim-sahil-evi": {
    name: "Salkım",
    sub: "SELİMİYE",
    color1: "#a855f7",
    color2: "#d4af37",
    svgIcon: `
      <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <!-- Grape Cluster & Vine Leaf -->
      <path d="M50 20 Q62 16 66 26 Q56 30 50 26" stroke="currentColor" stroke-width="1.5" fill="none"/>
      <circle cx="42" cy="38" r="5" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <circle cx="58" cy="38" r="5" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <circle cx="36" cy="48" r="5" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <circle cx="50" cy="48" r="5" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <circle cx="64" cy="48" r="5" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <circle cx="43" cy="58" r="5" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <circle cx="57" cy="58" r="5" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <circle cx="50" cy="68" r="5" fill="none" stroke="currentColor" stroke-width="1.5"/>
    `
  },
  "sigliman-glamping-beach": {
    name: "Sığliman",
    sub: "GLAMPING · SELİMİYE",
    color1: "#00f5a0",
    color2: "#064e3b",
    svgIcon: `
      <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <!-- Bohemian Glamping Tent & Stars -->
      <path d="M50 22 L24 74 L76 74 Z" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="50" y1="22" x2="50" y2="74" stroke="currentColor" stroke-width="1.5"/>
      <circle cx="50" cy="16" r="2" fill="currentColor"/>
      <circle cx="30" cy="32" r="1.5" fill="currentColor"/>
      <circle cx="70" cy="32" r="1.5" fill="currentColor"/>
    `
  },
  "uzum-tatil-evi": {
    name: "Üzüm",
    sub: "SELİMİYE",
    color1: "#c084fc",
    color2: "#d4af37",
    svgIcon: `
      <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <!-- Geometric Grapevine Crest -->
      <path d="M50 20 L50 32" stroke="currentColor" stroke-width="2"/>
      <circle cx="50" cy="40" r="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <circle cx="38" cy="48" r="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <circle cx="62" cy="48" r="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <circle cx="44" cy="60" r="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <circle cx="56" cy="60" r="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <circle cx="50" cy="72" r="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
    `
  },
  "zakkum-frida-pansiyon": {
    name: "Zakkum Frida",
    sub: "SELİMİYE",
    color1: "#f472b6",
    color2: "#831843",
    svgIcon: `
      <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <!-- Blooming Oleander / Frida Floral Monogram -->
      <path d="M50 24 C40 36 30 50 50 64 C70 50 60 36 50 24 Z" fill="none" stroke="currentColor" stroke-width="1.8"/>
      <path d="M26 48 C38 40 50 50 64 50 C50 68 38 60 26 48 Z" fill="none" stroke="currentColor" stroke-width="1.8"/>
      <path d="M74 48 C62 40 50 50 36 50 C50 68 62 60 74 48 Z" fill="none" stroke="currentColor" stroke-width="1.8"/>
      <circle cx="50" cy="48" r="3.5" fill="currentColor"/>
    `
  }
};

export function generateSVGLogo(slug, hotelName) {
  const conf = hotelLogos[slug] || {
    name: hotelName || "Selimiye Hotel",
    sub: "SELİMİYE",
    color1: "#d4af37",
    color2: "#0f172a",
    svgIcon: `
      <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <text x="50" y="58" font-family="serif" font-size="28" text-anchor="middle" fill="currentColor">${(hotelName || 'S')[0]}</text>
    `
  };

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%" color="${conf.color1}">
  <defs>
    <linearGradient id="goldGrad-${slug}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${conf.color1}"/>
      <stop offset="100%" stop-color="${conf.color2}"/>
    </linearGradient>
  </defs>
  <g fill="none" stroke="currentColor">
    ${conf.svgIcon}
  </g>
</svg>`;
}

// Generate files for all 24 hotels in both v1 and v2 directories
function main() {
  const v1Base = path.join(__dirname, 'v1');
  const v2Base = path.join(__dirname, 'v2-gemini');

  let count = 0;
  for (const slug of Object.keys(hotelLogos)) {
    const svgContent = generateSVGLogo(slug);

    // Write to v1
    const v1Media = path.join(v1Base, slug, 'media');
    if (!fs.existsSync(v1Media)) fs.mkdirSync(v1Media, { recursive: true });
    fs.writeFileSync(path.join(v1Media, 'logo.svg'), svgContent, 'utf8');

    // Write to v2
    const v2Media = path.join(v2Base, slug, 'media');
    if (!fs.existsSync(v2Media)) fs.mkdirSync(v2Media, { recursive: true });
    fs.writeFileSync(path.join(v2Media, 'logo.svg'), svgContent, 'utf8');

    count++;
  }

  console.log(`✅ Successfully generated bespoke luxury SVG logos for all ${count} Selimiye hotels in v1 and v2!`);
}

main();
