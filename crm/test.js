// CRM uçtan uca smoke testi — Faz 1 akışları doğrular
const BASE = process.env.CRM_BASE_URL || 'http://localhost:3100';

let failures = 0;
function check(name, cond, extra = '') {
  if (cond) {
    console.log(`  ✓ ${name}`);
  } else {
    failures++;
    console.error(`  ✗ ${name} ${extra}`);
  }
}

async function api(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

let token;
let firmId, contactId, leadId, oppId, taskId, activityId, offerId;

async function main() {
  console.log('1) Auth');
  let r = await api('/api/auth/login', { method: 'POST', body: { email: 'admin@aeon.local', password: 'admin123' } });
  check('login', r.status === 200 && r.data.success, JSON.stringify(r.data));
  token = r.data.token;

  r = await api('/api/auth/session', { token });
  check('session', r.status === 200 && r.data.user.role === 'yönetici');

  console.log('2) Config');
  r = await api('/api/crm/config', { token });
  check('config pipeline stages', r.data.config.pipeline_stages.includes('won'));

  console.log('3) Firma');
  r = await api('/api/crm/firms', { token, method: 'POST', body: { name: 'Smoke Travel', type: 'acente', city: 'Muğla', commission_rate: 12 } });
  check('firma oluştur', r.status === 200 && r.data.success, JSON.stringify(r.data));
  firmId = r.data.id;

  console.log('4) Kontak');
  r = await api('/api/crm/contacts', { token, method: 'POST', body: { firm_id: firmId, first_name: 'Test', last_name: 'Kontak', email: 'test@smoke.com', is_primary: true, marketing_consent: true } });
  check('kontak oluştur', r.status === 200 && r.data.success, JSON.stringify(r.data));
  contactId = r.data.id;

  console.log('5) Lead');
  r = await api('/api/crm/leads', { token, method: 'POST', body: { firm_id: firmId, contact_id: contactId, source: 'telefon', notes: 'Otel talebi' } });
  check('lead oluştur', r.status === 200 && r.data.success, JSON.stringify(r.data));
  leadId = r.data.id;

  console.log('6) Fırsat');
  r = await api('/api/crm/opportunities', { token, method: 'POST', body: { lead_id: leadId, firm_id: firmId, contact_id: contactId, title: '5 Gece Bozburun', amount: 2500, currency: 'EUR', pipeline_stage: 'inquiry' } });
  check('fırsat oluştur', r.status === 200 && r.data.success, JSON.stringify(r.data));
  oppId = r.data.id;

  r = await api('/api/crm/opportunities', { token });
  check('fırsat listele', r.data.some(o => o.id === oppId));

  console.log('7) Pipeline aşaması');
  r = await api(`/api/crm/opportunities/${oppId}/stage`, { token, method: 'POST', body: { pipeline_stage: 'offer' } });
  check('aşama: offer', r.status === 200, JSON.stringify(r.data));
  r = await api(`/api/crm/opportunities/${oppId}/stage`, { token, method: 'POST', body: { pipeline_stage: 'lost', lost_reason: 'fiyat' } });
  check('aşama: lost (nedenli)', r.status === 200, JSON.stringify(r.data));
  r = await api(`/api/crm/opportunities/${oppId}/stage`, { token, method: 'POST', body: { pipeline_stage: 'won' } });
  check('aşama: won', r.status === 200, JSON.stringify(r.data));

  console.log('8) Görev');
  r = await api('/api/crm/tasks', { token, method: 'POST', body: { title: 'Teklif gönder', priority: 'high', related_type: 'opportunity', related_id: oppId } });
  check('görev oluştur', r.status === 200 && r.data.success, JSON.stringify(r.data));
  taskId = r.data.id;
  r = await api(`/api/crm/tasks/${taskId}`, { token, method: 'PATCH', body: { status: 'done' } });
  check('görev tamamla', r.status === 200, JSON.stringify(r.data));

  console.log('9) Aktivite');
  r = await api('/api/crm/activities', { token, method: 'POST', body: { opportunity_id: oppId, subject: 'Teklif e-postayla gönderildi', type: 'email', notes: '3. versiyon' } });
  check('aktivite oluştur', r.status === 200 && r.data.success, JSON.stringify(r.data));
  activityId = r.data.id;

  console.log('10) Teklif (Faz 2)');
  r = await api('/api/crm/offers', { token, method: 'POST', body: { opportunity_id: oppId, title: 'Bozburun Paketi', discount_rate: 5, tax_rate: 10, check_in: '2026-09-10', check_out: '2026-09-16', guests: 2, board_type: 'HB', commission_rate: 8 } });
  check('teklif oluştur', r.status === 200 && r.data.success, JSON.stringify(r.data));
  offerId = r.data.id;
  r = await api('/api/crm/offers', { token });
  check('teklif listele', r.data.some(o => o.id === offerId));

  r = await api(`/api/crm/offers/${offerId}`, { token });
  check('teklif detay + gece hesabı', r.status === 200 && r.data.nights === 6 && r.data.opportunity_title.length > 0, JSON.stringify(r.data));

  r = await api(`/api/crm/offers/${offerId}/items`, { token, method: 'POST', body: { category: 'konaklama', description: '6 gece oda', qty: 6, unit_price: 150 } });
  check('kalem ekle (konaklama)', r.status === 200 && r.data.success, JSON.stringify(r.data));
  const itemId = r.data.id;
  r = await api(`/api/crm/offers/${offerId}/items`, { token, method: 'POST', body: { category: 'transfer', description: 'Havalimanı transfer', qty: 2, unit_price: 40 } });
  check('kalem ekle (transfer)', r.status === 200, JSON.stringify(r.data));

  r = await api(`/api/crm/offers/${offerId}`, { token });
  check('toplam hesabı (ara 980, toplam 1024.1)', r.data.totals.subtotal === 980 && Math.abs(r.data.totals.total - 1024.1) < 1e-9, JSON.stringify(r.data.totals));

  r = await api(`/api/crm/offer-items/${itemId}`, { token, method: 'PATCH', body: { qty: 7 } });
  check('kalem güncelle', r.status === 200, JSON.stringify(r.data));

  r = await api(`/api/crm/offers/${offerId}/status`, { token, method: 'POST', body: { status: 'lost' } });
  check('lost nedensiz reddedilir', r.status === 400, `status=${r.status}`);
  r = await api(`/api/crm/offers/${offerId}/status`, { token, method: 'POST', body: { status: 'sent' } });
  check('draft → sent', r.status === 200, JSON.stringify(r.data));
  r = await api(`/api/crm/offers/${offerId}/status`, { token, method: 'POST', body: { status: 'waiting' } });
  check('sent → waiting', r.status === 200, JSON.stringify(r.data));
  r = await api(`/api/crm/offers/${offerId}/status`, { token, method: 'POST', body: { status: 'approved' } });
  check('waiting → approved', r.status === 200, JSON.stringify(r.data));
  r = await api(`/api/crm/offers/${offerId}/status`, { token, method: 'POST', body: { status: 'revised' } });
  check('approved terminal (409)', r.status === 409, `status=${r.status}`);

  r = await api(`/api/crm/offers/${offerId}/revision`, { token, method: 'POST' });
  check('revizyon oluştur', r.status === 200 && r.data.version === 2, JSON.stringify(r.data));
  const revId = r.data.id;
  r = await api(`/api/crm/offers/${revId}`, { token });
  check('revizyon kalemleri kopyalanır', r.data.items.length === 2 && r.data.versions.length === 2, JSON.stringify(r.data));
  r = await api(`/api/crm/offers/${revId}/status`, { token, method: 'POST', body: { status: 'lost', lost_reason: 'rakip' } });
  check('revizyon lost (nedenli)', r.status === 200, JSON.stringify(r.data));
  r = await api(`/api/crm/offer-items/${itemId}`, { token, method: 'DELETE' });
  check('kalem sil', r.status === 200, JSON.stringify(r.data));

  console.log('11) CRM → ERP entegrasyonu (Faz 3)');
  // won olmayan fırsat dönüştürülemez
  r = await api(`/api/crm/integration/opportunities/${oppId}/convert`, { token, method: 'POST' });
  check('won olmayan dönüşüm reddi', r.status === 400, `status=${r.status}`);

  // müsaitlik sorgusu
  r = await api('/api/crm/integration/availability', { token, method: 'POST', body: { check_in: '2026-09-10', check_out: '2026-09-16', room_type: 'rt_dlx', board: 'HB', guests: 2, currency: 'EUR' } });
  check('müsaitlik + fiyat', r.status === 200 && r.data.available && r.data.total > 0, JSON.stringify(r.data));

  // yeni fırsat (won) + onaylı teklif
  r = await api('/api/crm/opportunities', { token, method: 'POST', body: { title: 'Faz3 Dönüşüm', firm_id: firmId, contact_id: contactId, currency: 'EUR' } });
  const opp3Id = r.data.id;
  r = await api('/api/crm/offers', { token, method: 'POST', body: { opportunity_id: opp3Id, title: 'ERP Teklif', check_in: '2026-11-01', check_out: '2026-11-04', room_type: 'rt_dlx', board_type: 'HB', guests: 2, currency: 'EUR' } });
  const erpOfferId = r.data.id;
  await api(`/api/crm/offers/${erpOfferId}/status`, { token, method: 'POST', body: { status: 'sent' } });
  await api(`/api/crm/offers/${erpOfferId}/status`, { token, method: 'POST', body: { status: 'waiting' } });
  r = await api(`/api/crm/offers/${erpOfferId}/status`, { token, method: 'POST', body: { status: 'approved' } });
  check('fırsat won', r.status === 200 && (await api(`/api/crm/opportunities/${opp3Id}`, { token })).data.pipeline_stage === 'won');

  // dönüştür
  r = await api(`/api/crm/integration/opportunities/${opp3Id}/convert`, { token, method: 'POST' });
  check('ERP dönüşümü', r.status === 200 && r.data.reservation_no && r.data.duplicate === false, JSON.stringify(r.data));
  const erpNo = r.data.reservation_no;

  // idempotency
  r = await api(`/api/crm/integration/opportunities/${opp3Id}/convert`, { token, method: 'POST' });
  check('idempotent tekrar', r.status === 200 && r.data.duplicate === true && r.data.reservation_no === erpNo, JSON.stringify(r.data));

  // fırsata ERP bilgisi yazıldı
  r = await api(`/api/crm/opportunities/${opp3Id}`, { token });
  check('fırsatta ERP no + durum', r.data.erp_reservation_no === erpNo && r.data.integration_status === 'synced', JSON.stringify(r.data));

  // durum geri çekme
  r = await api(`/api/crm/integration/opportunities/${opp3Id}/refresh-status`, { token, method: 'POST' });
  check('ERP durum geri çekme', r.status === 200 && typeof r.data.erp_status === 'string', JSON.stringify(r.data));

  // günlükler + yapılandırma
  r = await api('/api/crm/integration/logs', { token });
  check('entegrasyon günlüğü', r.status === 200 && r.data.length >= 1, JSON.stringify(r.data));
  r = await api('/api/crm/integration/config', { token });
  check('yapılandırma + bağlantı', r.status === 200 && r.data.reachable === true && r.data.erp_url.includes('3200'), JSON.stringify(r.data));

  console.log('12) Satış sonrası + kampanya (Faz 4)');
  // kontaklara Faz 4 alanları
  r = await api('/api/crm/contacts', { token, method: 'POST', body: { first_name: 'Kampanya', last_name: 'Misafir', email: 'kampanya@test.com', marketing_consent: 1, vip: 1, segment: 'vip' } });
  check('kontak (vip, segment)', r.status === 200 && r.data.success, JSON.stringify(r.data));
  const campContactId = r.data.id;
  r = await api('/api/crm/contacts', { token, method: 'POST', body: { first_name: 'İzinsiz', last_name: 'Kisi', email: 'izinsiz@test.com', marketing_consent: 0 } });
  const noConsentId = r.data.id;

  // kampanya çalıştırma: izinli kişi sent, izinsiz kişi asla gönderilmez
  r = await api('/api/crm/campaigns', { token, method: 'POST', body: { name: 'Test Kampanya', segment: 'direkt' } });
  const campId = r.data.id;
  r = await api(`/api/crm/campaigns/${campId}/run`, { token, method: 'POST' });
  check('kampanya çalıştı', r.status === 200 && r.data.sent >= 1, JSON.stringify(r.data));
  r = await api(`/api/crm/campaigns/${campId}/contacts`, { token });
  const consentCheck = r.data.find(x => x.contact_id === noConsentId);
  const sentCheck = r.data.find(x => x.contact_id === campContactId);
  check('izinsiz kişi skipped', consentCheck && consentCheck.status === 'skipped', JSON.stringify(consentCheck));
  check('izinli kişi sent', sentCheck && sentCheck.status === 'sent', JSON.stringify(sentCheck));

  // VIP segment hedefleme: yalnız vip kontaklar hedeflenir
  r = await api('/api/crm/campaigns', { token, method: 'POST', body: { name: 'VIP Kampanya', segment: 'vip' } });
  r = await api(`/api/crm/campaigns/${r.data.id}/run`, { token, method: 'POST' });
  check('vip segment hedefi', r.status === 200 && r.data.sent >= 1 && r.data.skipped === 0, JSON.stringify(r.data));

  // takip üretimi: ERP'de check-out yapılmış rezervasyon
  r = await api('/api/crm/contacts', { token, method: 'POST', body: { first_name: 'Takip', last_name: 'Misafir', email: 'takip@test.com', marketing_consent: 1 } });
  const f4ContactId = r.data.id;
  r = await api('/api/crm/firms', { token, method: 'POST', body: { name: 'Faz4 Acente', type: 'acente' } });
  const f4FirmId = r.data.id;
  r = await api('/api/crm/opportunities', { token, method: 'POST', body: { title: 'Faz4 Konaklama', firm_id: f4FirmId, contact_id: f4ContactId, currency: 'EUR' } });
  const f4OppId = r.data.id;
  r = await api('/api/crm/offers', { token, method: 'POST', body: { opportunity_id: f4OppId, title: 'Faz4 Teklif', check_in: '2026-10-01', check_out: '2026-10-05', room_type: 'rt_dlx', board_type: 'HB', guests: 2, currency: 'EUR' } });
  const f4OfferId = r.data.id;
  await api(`/api/crm/offers/${f4OfferId}/status`, { token, method: 'POST', body: { status: 'sent' } });
  await api(`/api/crm/offers/${f4OfferId}/status`, { token, method: 'POST', body: { status: 'waiting' } });
  await api(`/api/crm/offers/${f4OfferId}/status`, { token, method: 'POST', body: { status: 'approved' } });
  r = await api(`/api/crm/integration/opportunities/${f4OppId}/convert`, { token, method: 'POST' });
  check('Faz4 ERP dönüşümü', r.status === 200 && r.data.erp_reservation_id, JSON.stringify(r.data));
  await fetch(`http://localhost:3200/api/erp/reservations/${r.data.erp_reservation_id}/check-out`, { method: 'POST' });
  r = await api('/api/crm/followups/generate', { token, method: 'POST' });
  check('takip üretimi', r.status === 200 && r.data.created >= 1, JSON.stringify(r.data));
  r = await api('/api/crm/followups?stage=pending', { token });
  const postFollow = r.data.find(f => f.type === 'post_stay' && f.opportunity_id === f4OppId);
  check('post_stay takibi', postFollow && postFollow.erp_reservation_no.length > 0 && postFollow.marketing_consent === 1, JSON.stringify(postFollow));
  r = await api(`/api/crm/followups/${postFollow.id}/create-opportunity`, { token, method: 'POST' });
  check('tekrar konaklama fırsatı', r.status === 200 && r.data.id, JSON.stringify(r.data));
  r = await api(`/api/crm/followups/${postFollow.id}/action`, { token, method: 'POST', body: { action: 'done', notes: 'Memnun' } });
  check('takip tamamla', r.status === 200, JSON.stringify(r.data));
  r = await api('/api/crm/followups/summary', { token });
  check('takip özeti', r.status === 200 && typeof r.data.pending === 'number', JSON.stringify(r.data));

  console.log('13) Raporlar (Faz 5)');
  r = await api('/api/crm/reports/pipeline', { token });
  check('pipeline dağılımı', r.status === 200 && Array.isArray(r.data.breakdown) && r.data.total_opportunities >= 1, JSON.stringify(r.data));
  check('won satırı var', r.data.breakdown.some(x => x.pipeline_stage === 'won' && x.cnt >= 1), JSON.stringify(r.data.breakdown));
  r = await api('/api/crm/reports/conversion', { token });
  check('dönüşüm hunisi', r.status === 200 && r.data.won >= 1 && r.data.win_rate > 0 && r.data.win_rate <= 100, JSON.stringify(r.data));
  r = await api('/api/crm/reports/performance', { token });
  check('performans (temsilci)', r.status === 200 && Array.isArray(r.data.by_owner), JSON.stringify(r.data.by_owner));
  r = await api('/api/crm/reports/timing', { token });
  check('ortalama süreler', r.status === 200 && typeof r.data.avg_opportunity_to_won_days === 'number', JSON.stringify(r.data));
  r = await api('/api/crm/reports/lost-analysis', { token });
  check('kayıp analizi', r.status === 200 && typeof r.data.total_lost_amount === 'number', JSON.stringify(r.data));
  r = await api('/api/crm/reports/reconciliation', { token });
  check('mutabakat raporu', r.status === 200 && r.data.count >= 1 && typeof r.data.difference === 'number', JSON.stringify(r.data));
  check('mutabakat fark tespiti', r.data.unreconciled >= 1, JSON.stringify(r.data.unreconciled));

  console.log('14) Dashboard');
  r = await api('/api/crm/dashboard', { token });
  check('dashboard', r.status === 200 && typeof r.data.won_opportunities === 'number', JSON.stringify(r.data));

  console.log('15) Arama');
  r = await api('/api/crm/search?q=smoke', { token });
  check('global arama', r.status === 200 && r.data.firms.length >= 1, JSON.stringify(r.data));

  console.log('16) Firma detay');
  r = await api(`/api/crm/firms/${firmId}`, { token });
  check('firma detay + kontaklar', r.status === 200 && r.data.contacts.length === 1, JSON.stringify(r.data));

  console.log('17) Yetki: yönetici kullanıcı listesi');
  r = await api('/api/crm/users', { token });
  check('kullanıcı listesi (admin)', r.status === 200, JSON.stringify(r.data));

  console.log('18) Auth olmadan erişim reddi');
  r = await api('/api/crm/firms');
  check('401 koruması', r.status === 401, `status=${r.status}`);

  console.log('19) Kalıcılık (dosya tabanlı veri)');
  const fs = await import('fs');
  const savePath = new URL('./crm_data/crm_alasql.json', import.meta.url).pathname;
  const dump = JSON.parse(fs.readFileSync(savePath, 'utf8'));
  check('veri dosyasında fırsat var', (dump.opportunities || []).length >= 1, JSON.stringify(dump.opportunities?.length));
  check('veri dosyasında teklif var', (dump.offers || []).length >= 1, JSON.stringify(dump.offers?.length));
  check('veri dosyasında kontak var', (dump.contacts || []).length >= 1, JSON.stringify(dump.contacts?.length));

  console.log('');
  if (failures) {
    console.log(`${failures} TEST BAŞARISIZ`);
    process.exit(1);
  }
  console.log('TÜM TESTLER GEÇTİ');
}

main().catch(e => { console.error(e); process.exit(1); });
