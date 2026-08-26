# Selimiye Web Sitesiz Oteller — Demo Serisi

Bu klasör, Selimiye’de bağımsız web sitesi bulunamayan aktif konaklama işletmeleri için fiziksel ziyaret demosu hazırlama alanıdır.

## Çalışma kuralı

1. Önce `hotel-research.json`, `hotel-research-detail.json` ve `GEMINI_BRIEF.md` okunur; ikinci dosya her tesisin genişletilmiş araştırma kaydıdır.
2. Her otel için yalnızca o işletmeye ait doğrulanmış bilgiler kullanılır.
3. Bağımsız domaini olmayan işletmeler öncelikli hedef kabul edilir.
4. OTA, Google Hotels, Etstur, Setur, oBilet ve rehber sayfaları resmi web sitesi sayılmaz; yalnızca aktiflik ve içerik araştırma kaynağıdır.
5. Araştırmada bulunan adres, iletişim, puan, olanak ve konaklama bilgileri müşteri karşısına çıkan demo sitenin gerçek içerik katmanında kullanılır; bulunamayan bilgiler uydurulmaz.
6. Her otel ayrı klasörde, ayrı marka diliyle tasarlanır. Şablon kopyalansa bile başlık, renk, tipografi, hikâye ve içerik ritmi mülkün karakterine göre değişir.

## Sürüm ayrımı

- `v1/`: Codex’in hazırladığı sürüm.
- `v2-gemini/`: Gemini’nin hazırladığı bağımsız ikinci sürüm; güncel detay kaydı müşteriye dönük içerik üretiminde kullanılır.

İki sürüm aynı araştırma dosyasını okur ancak birbirinin dosyalarını ezmez.

## İlk demo

`v1/mi-amor-selimiye/` ilk fiziksel ziyaret demosudur. Yerel medya varlıkları, ERP içindeki mevcut Bozburun demo medya havuzundan göreli yollarla yeniden kullanılır; yeni medya kopyası oluşturulmaz.

## Doğrulama seviyesi

Araştırma kaydı 21 Ağustos 2026, V2 web kontrolü 25 Ağustos 2026’dır. İlk aday listesi 24 tesis için yeniden tarandı. Mi Amor için rezervasyon alt alan adı, Selimiye Saklı Bahçe için resmi domain ve Çoban için `cobanotel.com` kaydı ayrıca bulundu; bu üç kayıt artık “bağımsız site kesin yok” diye sunulmaz. Diğer kayıtlar için “web sitesi yok” ifadesi, açık web taramasında bağımsız resmi tanıtım domaini bulunamadığı anlamına gelir; kesin saha teyidi işletme ziyareti sırasında yapılacaktır.
