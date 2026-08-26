# Gemini için çalışma brief'i

Bu klasördeki her site, Selimiye’de fiziksel ziyaret öncesi hazırlanmış satış demosudur. Tasarım üretmeden önce `hotel-research.json` ve `hotel-research-detail.json` dosyalarındaki ilgili otel kayıtlarını oku. `verifiedFacts`, `amenities`, `rooms`, `conflicts` ve `fieldVerification` alanları, araştırma verisini tasarıma aktarmak için ana kaynaktır.

## Tasarım yaklaşımı

- Modern, lüks, editorial butik otel hissi.
- Büyük boşluklarla içeriği seyrekleştirme. İlk ekranda güçlü hero, bilgi rayı, çağrı aksiyonu ve konaklama özeti birlikte görünmeli.
- Zengin ama sakin yoğunluk: kartlar, kısa bilgi satırları, fotoğraf blokları, oda/deneyim detayları ve konum anlatısı kullanılmalı.
- Otelin gerçek verisi yoksa özellik uydurma. “Demo konsepti”, “işletme teyidi bekliyor” veya “örnek içerik” notu kullan.
- Her mülkün tasarımı farklılaşmalı. Mi Amor için romantik, sıcak, koyu vişne ve taş tonları; başka oteller için aynı paleti kopyalama.
- Mobile-first responsive tasarım; telefon ekranında da bilgi yoğunluğu korunmalı.
- Rezervasyon düğmesi telefon/WhatsApp bilgisi teyit edilene kadar “Müsaitlik iste” veya “Ziyaret notu bırak” gibi güvenli bir demo aksiyonu olabilir.

## Mi Amor Selimiye verisi

- Tesis: Mi Amor Selimiye
- Bölge: Selimiye, Marmaris / Muğla
- Durum: Faal olduğuna dair güncel Etstur ve Google Hotels kayıtları var.
- Güncel üçüncü taraf sinyali: Google Hotels kaydı 4,8/5 civarında; puan ve yorum sayısını `hotel-research-detail.json` içindeki kaynak bağlantısından güncel bağlamıyla oku.
- Telefon: 0534 689 32 32 — işletme ziyaretinde tekrar teyit edilmeden ana CTA’ya bağlama.
- Bağımsız tanıtım sitesi: Bulunamadı; ancak güncel bir rezervasyon alt alan adı bulundu ve bu alan adı resmi tanıtım sitesi gibi sunulmadan araştırma notu olarak gösterilmelidir.
- Güvenli içerik: Selimiye kıyı konaklaması, yavaş Ege ritmi, çiftler için romantik kaçış, gün batımı, sade lüks.
- Sahada teyit edilecek alanlar: oda envanteri/metrekareleri, işletme tarafından sunulan hizmetlerin kapsamı, fotoğraf kullanım izni, rezervasyon akışı, fiyatlar ve iletişim bilgilerinin güncelliği. Çelişkili üçüncü taraf kayıtlarını kesin gerçek gibi birleştirme; araştırma panelinde “saha teyidi” etiketiyle göster.

## Tüm V1 kapsamı

V1 klasöründe 24 tesisin tamamı için ayrı yerel `index.html` bulunur. Her sayfa, ilgili detay araştırma kaydını “araştırma dosyası” panelinde gösterir; tasarım metni ile işletme tarafından teyit edilmesi gereken bilgi birbirinden ayrılır.

## İlk ziyaret hedefi

Mi Amor demosu, işletme sahibine “web sitesi + rezervasyon talebi + konaklama hikâyesi + yerel keşif rehberi” paketini tek ekranda gösterecek şekilde hazırlanır. Gerçek telefon, adres, oda adları ve fotoğraflar ziyarette alınır; demo verisi sonradan gerçek içerikle değiştirilir.
