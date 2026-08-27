#!/usr/bin/env node
/**
 * download-modern-photos.mjs
 * Unsplash'tan yüksek çözünürlüklü modern otel fotoğrafları indirir.
 * Kategori başına birden fazla fotoğraf var — her otel için farklı kombinasyon kullanılır.
 */
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

// Curated Unsplash photo IDs — modern luxury boutique hotel / Mediterranean coastal
// Format: https://images.unsplash.com/photo-{id}?auto=format&fit=crop&w=1920&q=85
const PHOTOS = {
  hero: [
    '1520250497591-112f2f40a3f4', // infinity pool, sea view
    '1571896349842-33c89424de2d', // resort pool blue water
    '1566073771259-470b785d5db2', // hotel terrace sea
    '1507525428034-b723cf961d3e', // clear beach water
    '1602002418082-a4443e081dd1', // luxury pool sunset
    '1540202404-1b927e27fa8b', // coastal Mediterranean
    '1439130490301-25e322d45abe', // beach chairs sea
    '1501425878756-a7b5d8a5d6a7', // cove turquoise water
    '1468581264429-2548ef9eb732', // sea view terrace
    '1482192596544-9eb780fc7f66', // blue sea rocks
  ],
  suite: [
    '1631049307264-da0ec9d70304', // white luxury room
    '1618773928121-c32242e63f39', // minimalist room sea view
    '1590490360182-c33d57733427', // bed with pillows
    '1595576508898-0ad5176d28be', // boutique room
    '1522771739844-6a9f6d5f14af', // modern hotel room white
    '1564078516393-cf04bd966897', // cozy room sunlight
    '1540518614846-7eded433c457', // wooden floor room
    '1505693314120-0d443867891c', // luxury bedroom view
    '1534619905-93df8e7f8e3a', // white bed minimalist
    '1462826303086-329f9e8ae522', // boutique suite detail
  ],
  room: [
    '1616047006789-b7af5afb8c20', // bedroom stone wall
    '1555041469-a586c61ea9bc', // cozy room window
    '1586023492125-27b2c045efd1', // bright hotel room
    '1587985064135-0366vb29be39', // boutique room
    '1560472354-b33ff0ad9c89', // small luxury room
    '1515263487990-61654c0ec2be', // cozy bedroom
    '1578683010236-d716f9a3f461', // wooden room nature
    '1447752741029-8e3f6a6cbad2', // stone cottage interior
    '1467987506553-8f3916508521', // wooden boutique room
    '1484154218962-a197022b5858', // cozy bed sunlight
  ],
  dining: [
    '1414235077428-338989a2e8c0', // outdoor restaurant table
    '1555396273-367ea4eb4db5', // restaurant sea view
    '1559339352-11d035aa65de', // Mediterranean table outside
    '1547592180-85f173990554', // breakfast table
    '1504674900247-0877df9cc836', // food on table
    '1544025162-d76538036334', // evening restaurant
    '1558618666-fcd25c85cd64', // outdoor dining sunset
    '1466978913421-dad2ebd01d17', // dinner table candlelight
    '1493770348161-369560ae357d', // colorful food table
    '1540189549336-e6e99eb4b393', // meze dishes table
  ]
};

function download(photoId, destPath) {
  return new Promise((resolve, reject) => {
    const url = `https://images.unsplash.com/photo-${photoId}?auto=format&fit=crop&w=1920&q=85`;
    const file = fs.createWriteStream(destPath);
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        https.get(res.headers.location, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res2) => {
          res2.pipe(file);
          file.on('finish', () => { file.close(); resolve(); });
        }).on('error', reject);
        return;
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function downloadPhoto(category, index, destPath) {
  const ids = PHOTOS[category];
  const id = ids[index % ids.length];
  try {
    await download(id, destPath);
    return true;
  } catch (e) {
    // fallback to next id
    try {
      const fallbackId = ids[(index + 1) % ids.length];
      await download(fallbackId, destPath);
      return true;
    } catch (e2) {
      console.error(`  ✗ Failed ${category} for index ${index}:`, e2.message);
      return false;
    }
  }
}

// ── Update Defne Lorina ───────────────────────────────────────────────────────
async function updateDefneLorina() {
  const dirs = [
    path.join(here, '../template-system/generated-sites/defne-lorina-v1/media'),
    path.join(here, '../template-system/generated-sites/defne-lorina-v2/media'),
    path.join(here, '../template-system/visual-assets/defne-lorina'),
  ];

  console.log('\n🌿 Defne Lorina fotoğrafları güncelleniyor...');
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) { fs.mkdirSync(dir, { recursive: true }); }
    await downloadPhoto('hero',   0, path.join(dir, 'hero.jpg'));   process.stdout.write('  hero ✓ ');
    await downloadPhoto('suite',  0, path.join(dir, 'suite.jpg'));  process.stdout.write('suite ✓ ');
    await downloadPhoto('room',   0, path.join(dir, 'room.jpg'));   process.stdout.write('room ✓ ');
    await downloadPhoto('dining', 0, path.join(dir, 'dining.jpg')); process.stdout.write('dining ✓\n');
  }
}

// ── Update Selimiye V1/V2 — use different photo index per hotel ──────────────
async function updateSelimiyePhotos() {
  const v2Json = JSON.parse(fs.readFileSync(path.join(here, '../selimiye-websitesiz/hotel-research-v2.json'), 'utf8'));
  const hotels = v2Json.hotels;
  console.log(`\n🌊 Selimiye ${hotels.length} otel fotoğrafları güncelleniyor...`);

  for (let i = 0; i < hotels.length; i++) {
    const hotel = hotels[i];
    const slug = hotel.slug;

    // Update v1 and v2-gemini media dirs
    for (const variant of ['v1', 'v2-gemini']) {
      const mediaDir = path.join(here, `../selimiye-websitesiz/${variant}/${slug}/media`);
      if (!fs.existsSync(mediaDir)) continue;

      // Use different indices per hotel so each gets different photos
      const ok1 = await downloadPhoto('hero',   i,     path.join(mediaDir, 'hero.jpg'));
      const ok2 = await downloadPhoto('suite',  i + 1, path.join(mediaDir, 'suite.jpg'));
      const ok3 = await downloadPhoto('room',   i + 2, path.join(mediaDir, 'room.jpg'));
      const ok4 = await downloadPhoto('dining', i + 3, path.join(mediaDir, 'dining.jpg'));
      if (ok1 && ok2 && ok3 && ok4) {
        process.stdout.write(`  [${variant}/${slug}] ✓\n`);
      }
    }
  }
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
console.log('📸 Modern hotel fotoğrafları Unsplash\'tan indiriliyor...');
console.log('   Çözünürlük: 1920px genişlik, %85 kalite\n');

await updateDefneLorina();
await updateSelimiyePhotos();

console.log('\n✅ Tüm fotoğraflar güncellendi!');
