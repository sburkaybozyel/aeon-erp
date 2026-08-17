# AEON CRM ↔ AEON Reception

Bu kopya, ana AEON ERP uygulamasından bağımsız bir Worker ve D1 veritabanıdır.

## Bağlantı yönleri

CRM'den Reception'a:

- uygunluk ve fiyat sorgusu
- kazanılmış fırsatı rezervasyona dönüştürme
- dönüştürülmüş rezervasyonun tarih, oda, pansiyon, tutar, misafir ve durum güncellemesi
- CRM kişi kartının resepsiyon misafir kartına aktarılması
- idempotent kaynak/fırsat eşleşmesi

Reception'dan CRM'e:

- rezervasyon oluşturma ve güncelleme
- ön check-in ve kimlik/iletişim bilgileri
- check-in, oda değişimi ve check-out
- folyo işlemi, ödeme, folyo iptali
- fatura kesme ve fatura iptali
- oda/masa misafir talepleri, sipariş teslimi ve talep durumu değişiklikleri

Olaylar `reception_event_log` tablosunda idempotent olarak tutulur. Rezervasyonlar `reception_reservations` tablosuna, misafirler CRM `contacts` tablosuna yazılır. Worker'lar arası çağrılar Cloudflare service binding ve iki tarafta da bulunan `CRM_MODULE_TOKEN` ile korunur; URL fallback'i yalnızca yerel/harici kurulum içindir.

## Canlı yüzeyler

- CRM: `https://aeon-crm.aeon-global.workers.dev`
- Reception: `https://aeon-reception.aeon-global.workers.dev`
