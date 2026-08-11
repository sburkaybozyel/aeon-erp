# AEON Tourism CRM

AEON ERP'nin yanında çalışan **ayrı ve bağımsız** Turizm CRM uygulaması.
`CRM_ERP_ROADMAP.md`'deki Faz 1–3 kapsamıdır.

> **Bağımsızlık kuralı:** Bu klasör hiçbir ERP dosyasına dokunmaz. Kendi sunucusu,
> kendi veri tabanı (`crm/crm_data/crm_alasql.json`) ve kendi public arayüzü vardır.
> ERP ile iletişim Faz 3'te `integration_logs` üzerinden kontrollü API katmanıyla yapılır.

## Çalıştırma

```bash
cd crm
npm install        # express + alasql (kök node_modules'ten de çözülebilir)
npm start          # http://localhost:3100 (ERP sandbox otomatik: http://localhost:3200)
```

Varsayılan giriş: `admin@aeon.local` / `admin123`
(env ile değiştirilebilir: `CRM_ADMIN_EMAIL`, `CRM_ADMIN_PASSWORD`, `CRM_PORT`)

## ERP entegrasyonu (Faz 3)

CRM, ERP ile **gerçek HTTP** üzerinden konuşur. Sunucu başlarken yerel bir
**sandbox ERP** (`crm/erp_server.js`, port 3200) otomatik başlar ve AEON ERP API'sini
simüle eder: müsaitlik/fiyat, rezervasyon oluşturma (idempotent), durum sorgulama, check-in.

Gerçek AEON ERP'sine geçmek için sadece env değişkenini değiştirin; istemci kodu aynı kalır:

```bash
ERP_API_URL=http://aeon-egitim:8080/api/erp CRM_PORT=3100 node server.js
```

Sandbox'ı kapatmak için: `CRM_ERP_DISABLE=true`

Sözleşme ve rota listesi: `docs/DATA_CONTRACT.md` → "CRM → ERP entegrasyon sözleşmesi (Faz 3 uygulandı)".

## Test

```bash
npm test              # API smoke testi (Faz 1–3; sunucu çalışıyorken)
node e2e.test.mjs     # Playwright uçtan uca test
```

## Kapsam

- Faz 1: giriş/rol, firma, kontak, lead, fırsat pipeline'ı, aktivite, görev, arama, dashboard
- Faz 2: turizm teklifleri — tarih/gece/oda/pansiyon, kalemler, indirim/vergi, versiyonlar, revizyon, durum akışı (draft→sent→waiting→revised→approved/lost), kayıp nedeni, yazdır/PDF
- Faz 3: ERP müsaitlik/fiyat sorgusu, kazanılan fırsatın ERP rezervasyonuna dönüşümü (idempotent), ERP rezervasyon numarasının fırsata geri yazılması, durum geri çekme, hata günlüğü + güvenli retry, ERP durum rozetleri
- Faz 4: otomatik takip kuyruğu (konaklama öncesi/sonrası), tekrar konaklama fırsatı, VIP/segment/alerji alanları, izin kontrollü kampanyalar (izinsiz kişiye gönderilmez)
- Faz 5: raporlama (pipeline dağılımı, dönüşüm hunisi, performans, süreler, kayıp analizi, CRM↔ERP gelir mutabakatı) + dosya tabanlı kalıcılık düzeltmesi

## Veri modeli

`docs/DATA_CONTRACT.md` — tablolar: `users`, `firms`, `contacts`, `leads`,
`opportunities`, `offers`, `offer_items`, `activities`, `tasks`, `sessions`, `integration_logs`, `config`.
