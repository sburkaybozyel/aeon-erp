# V2 — Gemini üretimi ve araştırma kaplaması

V2, V1’den bağımsız görsel ve içerik yaklaşımını korur; ancak gerçek bilgi katmanı artık
`../hotel-research-detail.json` içindeki tesis bazlı araştırma kaydından üretilir.

Başlamadan önce:

1. Üst klasördeki `GEMINI_BRIEF.md` dosyasını oku.
2. `hotel-research-v2.json` içindeki ilgili konsept kaydını ve `hotel-research-detail.json` içindeki kaynak kaydını birlikte kullan.
3. Araştırma bulgusu ile demo konsepti ayrımını görünür biçimde koru.
4. V2’yi V1’den bağımsız bir klasörde tut; V1 dosyalarını ezme.
5. Siteyi yerel medya ve yerel dosyalarla çalışacak şekilde hazırla. Hosting veya modem gerektiren bir akış ekleme.

Önerilen yapı: `v2-gemini/mi-amor-selimiye/`.

## Güncel veri kuralı

`build-v2-sites.mjs` 24 V2 kaydını üretirken adres, telefon, puan, oda kayıtları,
olanaklar, yemek/giriş-çıkış bilgileri ve kaynak bağlantılarını `hotel-research-detail.json`
dosyasından alır. Bu araştırma katmanı içerik üretiminde kullanılır; müşteri karşısına
çıkan sayfada araştırma raporu veya teyit uyarısı gösterilmez.

Oda kartları, ritüeller, keşif anlatısı ve SSS bölümleri otel satış demosunun marka
anlatısı olarak hazırlanır. Kaynaklarda tek telefon bulunan işletmelerde doğrudan
iletişim bağlantısı kullanılır; diğerlerinde rezervasyon talebi akışı gösterilir.
