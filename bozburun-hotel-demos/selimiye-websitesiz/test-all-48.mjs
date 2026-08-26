import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const base = __dirname;
const research = JSON.parse(fs.readFileSync(path.join(base, 'hotel-research-v2.json'), 'utf8'));

async function checkUrl(url) {
  try {
    const res = await fetch(url);
    return res.status === 200;
  } catch (err) {
    return false;
  }
}

async function auditSite(version, slug) {
  const pageUrl = `http://localhost:3030/bozburun-hotel-demos/selimiye-websitesiz/${version}/${slug}/index.html`;
  const cssUrl = `http://localhost:3030/bozburun-hotel-demos/selimiye-websitesiz/${version}/${slug}/styles.css`;
  const jsUrl = `http://localhost:3030/bozburun-hotel-demos/selimiye-websitesiz/${version}/${slug}/app.js`;
  const logoUrl = `http://localhost:3030/bozburun-hotel-demos/selimiye-websitesiz/${version}/${slug}/media/logo.svg`;
  const heroUrl = `http://localhost:3030/bozburun-hotel-demos/selimiye-websitesiz/${version}/${slug}/media/hero.jpg`;
  const roomUrl = `http://localhost:3030/bozburun-hotel-demos/selimiye-websitesiz/${version}/${slug}/media/room.jpg`;
  const diningUrl = `http://localhost:3030/bozburun-hotel-demos/selimiye-websitesiz/${version}/${slug}/media/dining.jpg`;

  const results = await Promise.all([
    checkUrl(pageUrl),
    checkUrl(cssUrl),
    checkUrl(jsUrl),
    checkUrl(logoUrl),
    checkUrl(heroUrl),
    checkUrl(roomUrl),
    checkUrl(diningUrl)
  ]);

  const allPassed = results.every(Boolean);
  return {
    version,
    slug,
    allPassed,
    details: {
      page: results[0],
      css: results[1],
      js: results[2],
      logo: results[3],
      hero: results[4],
      room: results[5],
      dining: results[6]
    }
  };
}

async function runAudit() {
  console.log('🚀 Starting deep automated audit across ALL 48 Selimiye websites...');
  let totalTested = 0;
  let passedCount = 0;
  const failures = [];

  for (const h of research.hotels) {
    for (const v of ['v1', 'v2-gemini']) {
      totalTested++;
      const res = await auditSite(v, h.slug);
      if (res.allPassed) {
        passedCount++;
        console.log(`  [OK] ${v} / ${h.slug} — 100% assets 200 OK`);
      } else {
        failures.push(res);
        console.error(`  [FAIL] ${v} / ${h.slug}`, res.details);
      }
    }
  }

  console.log('\n=============================================');
  console.log(`TOTAL TESTED: ${totalTested}`);
  console.log(`PASSED: ${passedCount} / ${totalTested}`);
  console.log(`FAILED: ${failures.length}`);
  console.log('=============================================');

  if (failures.length > 0) {
    process.exit(1);
  }
}

runAudit();
