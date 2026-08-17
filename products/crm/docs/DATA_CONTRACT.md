# Turizm CRM — Veri Sözleşmesi (Faz 0)

**Tarih:** 2026-08-02
**Kaynak:** bağımsız CRM ↔ Reception entegrasyon sözleşmesi
**Kapsam:** AEON Reception portalıyla konuşan ayrı Turizm CRM uygulamasının veri modeli ve iki yönlü entegrasyon sözleşmesi.
**Bağımsızlık kuralı:** CRM, kendi D1 veritabanı ve Worker'ı ile ana AEON ERP'den tamamen ayrıdır. Sadece bağımsız `aeon-reception` Worker'ına service binding üzerinden bağlanır.

---

## 1. Veri modeli sınırı

CRM kendi D1 veritabanını yönetir. Ana AEON ERP tablolarına yazmaz ve onlardan okumaz. Reception ile iletişim yalnızca kontrollü service binding/API entegrasyon katmanı üzerinden yapılır ve bu katman `integration_logs`, `reception_reservations` ve `reception_event_log` tablolarına loglanır.

| Tablo | Amaç | Sahip |
|---|---|---|
| `users` | CRM kullanıcıları, roller, aktiflik | CRM |
| `firms` | Acente / kurumsal firma / direkt hesap kartları | CRM |
| `contacts` | Kişi/kontak kartları, birim firma ilişkisi | CRM |
| `leads` | Potansiyel müşteri havuzu, kaynak ve durum | CRM |
| `opportunities` | Satış fırsatı + pipeline aşaması | CRM |
| `offers` | Turizm odaklı teklif, versiyonlar, kalemler | CRM |
| `activities` | Görüşme, e-posta, toplantı, not, WhatsApp | CRM |
| `tasks` | Görev, son takip tarihi, öncelik | CRM |
| `sessions` | Oturum/token yönetimi | CRM |
| `integration_logs` | Reception ile senkronizasyon işlem günlüğü, hata ve retry | CRM |
| `config` | Pipeline aşamaları, para birimleri gibi sabitler | CRM |

## 2. Pipeline aşamaları

Varsayılan aşamalar (config tablosundan değiştirilebilir):

1. `inquiry` — Yeni talep / bilgi istendi
2. `option` — Opsiyon (tarih + ürün rezerve edildi)
3. `offer` — Teklif gönderildi
4. `negotiation` — Pazarlık / revizyon
5. `won` — Kazanıldı (→ Reception rezervasyonu)
6. `lost` — Kaybedildi (kayıp nedeni zorunlu)

## 3. CRM → Reception entegrasyon sözleşmesi

1. CRM'deki her firma, kontak, fırsat ve teklifin benzersiz CRM kimliği (`crm_id`) vardır.
2. Reception'a aktarılan kayıt `source_system=crm` ve `source_id` ile işaretlenir.
3. Aynı fırsatın iki kez rezervasyona dönüşmesini önlemek için idempotency anahtarı kullanılır (`source_system + source_id`; ikinci çağrı mevcut rezervasyonu döner).
4. Teklif "kazanıldı" olduğunda doğrudan ödeme alınmış sayılmaz; Reception rezervasyonu `confirmed` durumuyla başlar.
5. Fiyat ve müsaitlik son onaydan önce Reception'dan yeniden sorgulanır.
6. Reception'da oluşan rezervasyon numarası CRM fırsatına geri yazılır (`erp_reservation_id`, `erp_reservation_no`, `erp_status`, `integration_status`, `erp_total_amount`, `erp_currency`, `erp_check_in`, `erp_check_out`). Alan adları eski raporlarla uyumluluk için korunur; değer kaynağı yalnızca bağımsız Reception'dır.
7. Senkronizasyon hataları silinmez; `integration_logs` üzerinden tekrar deneme (`POST /api/crm/integration/logs/:id/retry`) ve manuel eşleştirme ekranında tutulur.
8. AEON ana veri alanı ile müşteri kopyalarının verileri CRM'de karışmaz; tenant izolasyonu ve müşteri deployment ayarı ilk sürümden itibaren korunur.

### 3.1 Reception service binding sözleşmesi

CRM, Reception'a Cloudflare service binding üzerinden konuşur. Dış URL yalnızca fallback/yerel kurulum içindir; ana AEON ERP'e yönlendirme yoktur.

| Endpoint | Yön | Amaç |
|---|---|---|
| `GET /api/module/crm/health` | CRM → Reception | Bağlantı sağlığı |
| `POST /api/module/crm/availability` | CRM → Reception | Müsaitlik + fiyat sorgulama |
| `POST /api/module/crm/reservations` | CRM → Reception | Rezervasyon oluşturma |
| `PATCH /api/module/crm/reservations/:id` | CRM → Reception | Durum/tarih/oda/misafir güncelleme |
| `POST /api/module/crm/guests/upsert` | CRM → Reception | Kişi kartı eşitleme |

### 3.2 CRM tarafı entegrasyon rotaları

| Endpoint | Yetki | Amaç |
|---|---|---|
| `GET /api/crm/integration/config` | yönetici | Reception URL + bağlantı sağlığı + bekleyen hata sayısı |
| `POST /api/crm/integration/availability` | oturum | Reception müsaitlik/fiyat sorgusu (proxy) |
| `POST /api/crm/integration/opportunities/:id/convert` | oturum | Kazanılmış fırsatı Reception rezervasyonuna çevirir (idempotent) |
| `POST /api/crm/integration/opportunities/:id/refresh-status` | oturum | Reception rezervasyon/konaklama durumunu fırsata geri çeker |
| `POST /api/crm/integration/logs/:id/retry` | yönetici | Hatalı senkronizasyonu güvenli şekilde tekrar dener |
| `GET /api/crm/integration/logs` | yönetici | Senkronizasyon günlüğü |
| `GET /api/crm/integration/opportunities` | oturum | Reception bağlantısı olan fırsatlar |

Fırsat `won` olduğunda ve onaylı bir teklif varsa `convert` çağrılabilir; aksi halde 400. Dönüşümde fiyat/müsaitlik Reception'dan yeniden sorgulanır, müsait değilse 409. Başarılı dönüşüm fırsata Reception rezervasyon kimliğini yazar ve bir aktivite ekler. Reservation event'leri aynı fırsatın `erp_status` ve tarih/tutar alanlarını da günceller.

### 3.3 Satış sonrası ve kampanya sözleşmesi (Faz 4 uygulandı)

| Tablo | Amaç |
|---|---|
| `followups` | Konaklama öncesi (`pre_stay`) / sonrası (`post_stay`) takip kuyruğu; aşamalar `pending` / `done` / `skipped`, erteleme (`snooze`) +3 gün |
| `campaigns` | Segment hedefli kampanya; durum `draft` → `sent` |
| `campaign_contacts` | Gönderim sonucu: `sent` veya `skipped` (+ neden: `marketing_consent`, `email_yok`) |
| `contacts.vip/segment/preferences/allergies/birthday` | VIP, segment (`direkt`, `acente`, `kurumsal`, `vip`, `tekrar_gelen`, `kaybedilen`), alerji, doğum günü |

**İzin kuralı (kabul kanıtı):** `marketing_consent=0` olan kişiye kampanya **asla** gönderilmez; `campaign_contacts`'e `skipped` olarak nedenle yazılır. Aynı şekilde satış sonrası takip yalnızca izinli misafirler için üretilir.

**Takip üretimi:** `POST /api/crm/followups/generate`, CRM'e senkronize Reception rezervasyonlarını kullanır; `checked_out`/`in_house` rezervasyonlardan izinli kontaklar için `post_stay`, 3 gün içinde check-in olanlar için `pre_stay` takibi oluşturur. Tamamlanan bir `post_stay` takibinden `POST /api/crm/followups/:id/create-opportunity` ile tekrar konaklama fırsatı (`source=tekrar_konaklama`) oluşturulabilir.

**Faz 4 rotaları:** `GET/POST /api/crm/campaigns`, `POST /api/crm/campaigns/:id/run`, `GET /api/crm/campaigns/:id/contacts`, `DELETE /api/crm/campaigns/:id` (yönetici), `GET/POST /api/crm/followups` + `/generate`, `POST /api/crm/followups/:id/action` (done/skip/snooze), `POST /api/crm/followups/:id/create-opportunity`, `GET /api/crm/followups/summary`.

### 3.4 Raporlama (Faz 5 uygulandı)

| Endpoint | Yetki | Amaç |
|---|---|---|
| `GET /api/crm/reports/pipeline` | oturum | Aşama bazlı dağılım + toplam tutar |
| `GET /api/crm/reports/conversion` | oturum | Lead → fırsat → teklif → kazanılan hunisi + oranlar |
| `GET /api/crm/reports/performance` | oturum | Kaynak / acente / temsilci bazlı fırsat-tutar-kazanım |
| `GET /api/crm/reports/timing` | oturum | Ortalama lead→fırsat ve fırsat→satış süresi (gün) |
| `GET /api/crm/reports/lost-analysis` | oturum | Kayıp nedeni bazlı analiz |
| `GET /api/crm/reports/reconciliation` | yönetici | CRM fırsat tutarı vs Reception rezervasyon tutarı, fark + mutabakatsız sayısı |

### 3.5 Kalıcılık

Veri, her yazma işleminde `crm/crm_data/crm_alasql.json` dosyasına senkron yazılır. Sunucu başlangıcında dosya şemadan önce yüklenir; böylece restart veri kaybına yol açmaz (Faz 5'te doğrulandı ve test #19 ile korunur).

## 4. KVKK / pazarlama izni

- `contacts` tablosunda `kvkk_consent` ve `marketing_consent` alanları zorunlu tutulur (varsayılan 0).
- İletişim tercihi olmayan kişiye kampanya gönderilmez (Faz 4 kabul kanıtı).
- Veri saklama, export/delete politikası Faz 4'te detaylandırılır.

## 5. Kabul edilmiş kararlar (bu MVP için)

| Karar | Seçim |
|---|---|
| CRM domain | Ayrı `aeon-crm` Worker ve D1; ana AEON ERP'den bağımsız |
| Teklif PDF | İlk sürümde indirilebilir/ekranda belge; e-posta sonraki genişletme |
| WhatsApp | MVP dışı (Faz 4'te resmi sağlayıcı kararı) |
| Rezervasyon dönüşümünde varsayılan durum | `confirmed` (Reception tarafında atanır) |
| Giriş | E-posta + parola (satış ekibi için PIN'den uygundur), rol bazlı yetki |
