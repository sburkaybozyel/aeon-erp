# AEON QR Menü + Restoran + Mutfak

Bu ticari kopya üç yüzeyi tek modül olarak taşır:

- Misafir QR menüsü ve sipariş
- Restoran servis ekranı
- Mutfak KDS, üretim, stok, reçete, fire ve satın alma akışı

Resepsiyon, CRM, housekeeping ve teknik servis bu kopyanın kapsamı dışındadır.

Kaynak yüzeyler `lib/product-modules.js` içindeki `sourceSurfaces` alanında kayıtlıdır. Satış demosu `/products/restaurant-kitchen` girişinden açılır. Operasyon ekranları, ilk aşamada doğrulanmış AEON backend sözleşmesini kullanır; müşteri tesliminde bu ürünün ayrı deploy ve veri sınırı oluşturulmalıdır.
