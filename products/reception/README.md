# AEON Ön Büro / Resepsiyon

Bu ticari kopya resepsiyonun bağımsız ürünüdür:

- Resepsiyon akışı ve aktif talepler
- Oda rack ve misafir görünümü
- Check-in/check-out
- Ön check-in inceleme
- Folio, ödeme, vardiya ve fatura adayları

QR restoran, mutfak, bar ve CRM bu kopyanın kapsamı dışındadır.

Kaynak yüzeyler `lib/product-modules.js` içindeki `sourceSurfaces` alanında kayıtlıdır. Satış demosu `/products/reception` girişinden açılır. Operasyon ekranları, ilk aşamada doğrulanmış AEON backend sözleşmesini kullanır; müşteri tesliminde bu ürünün ayrı deploy ve veri sınırı oluşturulmalıdır.
