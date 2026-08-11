import { chromium } from 'playwright';

const BASE = 'http://localhost:3100';
let failures = 0;
const check = (name, cond) => { if (cond) console.log(`  ✓ ${name}`); else { failures++; console.error(`  ✗ ${name}`); } };

const browser = await chromium.launch();
const page = await browser.newPage();

try {
  console.log('1) Login sayfası yükleniyor');
  await page.goto(BASE, { waitUntil: 'networkidle' });
  check('login form görünür', await page.isVisible('#login-form'));

  console.log('2) Giriş yap');
  await page.fill('#login-email', 'admin@aeon.local');
  await page.fill('#login-password', 'admin123');
  await page.click('#login-form button[type=submit]');
  await page.waitForSelector('#app-view:not(.hidden)', { timeout: 5000 });
  check('app görünür', await page.isVisible('#app-view'));
  check('dashboard title', (await page.textContent('#view-title')) === 'Dashboard');

  console.log('3) Firmalar + firma ekle');
  await page.click('#nav a[data-view=firms]');
  await page.waitForTimeout(600);
  check('firmalar görünümü', await page.isVisible('#view-container .card'));
  await page.click('[data-action=new-firm]');
  await page.waitForSelector('#firm-form', { timeout: 5000 });
  check('modal açıldı', await page.isVisible('#modal'));

  console.log('4) Yeni firma formu');
  await page.fill('#firm-form input[name=name]', 'Playwright Travel');
  await page.click('#firm-form button[type=submit]');
  await page.waitForTimeout(800);
  check('firma kaydedildi', (await page.textContent('#toast')) === 'Kaydedildi' || !(await page.isVisible('#modal')));

  console.log('5) Pipeline');
  await page.click('#nav a[data-view=pipeline]');
  await page.waitForTimeout(600);
  check('kanban görünür', await page.isVisible('.kanban'));

  console.log('6) Lead görünümü');
  await page.click('#nav a[data-view=leads]');
  await page.waitForTimeout(600);
  check('lead tablosu', await page.isVisible('.table'));

  console.log('7) Kullanıcılar (admin-only görünüm)');
  await page.click('#nav a[data-view=users]');
  await page.waitForTimeout(600);
  check('kullanıcı listesi', (await page.textContent('#view-container')).includes('Sistem Yöneticisi'));

  console.log('8) Global arama');
  await page.fill('#global-search', 'Playwright');
  await page.waitForTimeout(800);
  check('arama sonucu', await page.isVisible('#search-results'));

  console.log('9) Teklif düzenleyici (Faz 2)');
  await page.click('#nav a[data-view=offers]');
  await page.waitForTimeout(600);
  check('teklif listesi', await page.isVisible('[data-action=open-offer]') || (await page.textContent('#view-container')).includes('Henüz teklif'));
  if (await page.isVisible('[data-action=open-offer]')) {
    await page.click('[data-action=open-offer]');
    await page.waitForTimeout(600);
    check('teklif editörü açıldı', await page.isVisible('.offer-doc'));
    const hasRow = await page.isVisible('#offer-items-body tr[data-item-id]');
    if (hasRow) {
      const totalCell = await page.textContent('#offer-items-body .total-cell');
      check('kalem toplamı gösteriliyor', totalCell.trim().length > 0);
    }
    await page.click('[data-action=back]');
    await page.waitForTimeout(400);
  }

  console.log('10) Entegrasyon görünümü (Faz 3)');
  await page.click('#nav a[data-view=integration]');
  await page.waitForTimeout(800);
  check('ERP bağlantı kartı', (await page.textContent('#view-container')).includes('ERP Bağlantısı'));
  check('ERP bağlı rozeti', (await page.textContent('#view-container')).includes('Bağlı'));

  console.log('11) Takip görünümü (Faz 4)');
  await page.click('#nav a[data-view=followups]');
  await page.waitForTimeout(600);
  check('takip kuyruğu tablosu', await page.isVisible('[data-action=generate-followups]'));

  console.log('12) Kampanya görünümü (Faz 4)');
  await page.click('#nav a[data-view=campaigns]');
  await page.waitForTimeout(600);
  check('kampanya tablosu', (await page.textContent('#view-container')).includes('Yeni Kampanya'));
  await page.click('[data-action=new-campaign]');
  await page.waitForSelector('#campaign-form', { timeout: 5000 });
  check('kampanya modalı', await page.isVisible('#campaign-form'));
  await page.fill('#campaign-form input[name=name]', 'E2E Kampanya');
  await page.click('#campaign-form button[type=submit]');
  await page.waitForTimeout(600);
  check('kampanya oluşturuldu', (await page.textContent('#view-container')).includes('E2E Kampanya'));

  console.log('13) Rapor görünümü (Faz 5)');
  await page.click('#nav a[data-view=reports]');
  await page.waitForTimeout(800);
  check('rapor kartları', (await page.textContent('#view-container')).includes('Pipeline Dağılımı'));
  check('mutabakat raporu', (await page.textContent('#view-container')).includes('Gelir Mutabakatı'));

  console.log('14) Çıkış');
  await page.click('#logout-btn');
  await page.waitForSelector('#login-view:not(.hidden)', { timeout: 4000 });
  check('login sayfasına döndü', await page.isVisible('#login-view'));

  console.log('15) Console hataları yok');
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  check('pageerror yok', errors.length === 0);
} catch (e) {
  failures++;
  console.error('  ✗ E2E hatası:', e.message);
} finally {
  await browser.close();
}

console.log(failures ? `\n${failures} TEST BAŞARISIZ` : '\nE2E TÜM TESTLER GEÇTİ');
process.exit(failures ? 1 : 0);
