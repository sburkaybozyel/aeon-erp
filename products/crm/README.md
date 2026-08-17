# AEON Tourism CRM

AEON Reception portalıyla konuşan **ayrı ve bağımsız** Turizm CRM uygulaması.

> **Bağımsızlık kuralı:** Bu klasör ana AEON ERP'ye yönlendirme yapmaz. Kendi Worker'ı,
> kendi D1 veritabanı, kendi public arayüzü ve yalnızca bağımsız `aeon-reception`
> service binding'i vardır.

## Çalıştırma

```bash
cd products/crm
npm install        # express + alasql (kök node_modules'ten de çözülebilir)
npm start          # http://localhost:3100 (yalnızca CRM)
```

Varsayılan giriş: `admin@aeon.local` / `admin123`
(env ile değiştirilebilir: `CRM_ADMIN_EMAIL`, `CRM_ADMIN_PASSWORD`, `CRM_PORT`)

## Reception entegrasyonu

CRM; müsaitlik, kazanılmış fırsat, rezervasyon güncellemesi ve kişi kartını Reception'a
aktarır. Reception; rezervasyon, ön check-in, konaklama, oda değişimi, çıkış, folyo,
ödeme, fatura ve misafir taleplerini CRM'e event olarak gönderir. Ayrıntılı sözleşme:
`docs/RECEPTION_INTEGRATION.md`.

## Test

```bash
npm test              # Worker ve CRM route sözdizimi kontrolü
```

## Kapsam

- Faz 1: giriş/rol, firma, kontak, lead, fırsat pipeline'ı, aktivite, görev, arama, dashboard
- Faz 2: turizm teklifleri — tarih/gece/oda/pansiyon, kalemler, indirim/vergi, versiyonlar, revizyon, durum akışı (draft→sent→waiting→revised→approved/lost), kayıp nedeni, yazdır/PDF
- Reception bağlantısı: müsaitlik/fiyat, kazanılan fırsatın bağımsız resepsiyon rezervasyonuna dönüşümü (idempotent), rezervasyon/kişi güncellemesi, operasyon event günlüğü ve resepsiyon ekranı
- Faz 4: otomatik takip kuyruğu (konaklama öncesi/sonrası), tekrar konaklama fırsatı, VIP/segment/alerji alanları, izin kontrollü kampanyalar (izinsiz kişiye gönderilmez)
- Faz 5: raporlama (pipeline dağılımı, dönüşüm hunisi, performans, süreler, kayıp analizi, CRM↔Resepsiyon gelir mutabakatı) + dosya tabanlı kalıcılık düzeltmesi

## Veri modeli

`docs/DATA_CONTRACT.md` — tablolar: `users`, `firms`, `contacts`, `leads`,
`opportunities`, `offers`, `offer_items`, `activities`, `tasks`, `sessions`, `integration_logs`, `config`.
