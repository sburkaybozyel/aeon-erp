import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');
const hotels = JSON.parse(fs.readFileSync(path.join(here, 'hotels.json'), 'utf8'));
const facts = JSON.parse(fs.readFileSync(path.join(here, 'facts.json'), 'utf8'));
const factBySlug = new Map(facts.map((item) => [item.slug, item]));
const decor = path.join(projectRoot, 'new-demos/anfora/media/decor.mp4');
const fallbackDir = path.join(projectRoot, 'new-demos/anfora/media');
const visualAssetRoot = path.join(here, 'visual-assets');
const versions = ['v1', 'v2'];

const siteCopy = {
  'anfora-hotel': {
    siteDescriptor: 'TAŞ MİMARİ · ÖZEL İSKELE', locationLine: 'DENİZ SIFIR · BOZBURUN',
    detailStay: '32 m² taş oda · deniz manzaralı balkon', detailDining: 'Organik Ege kahvaltısı · çatı terası',
    storyTitle1: 'Taşın serinliği', storyTitle2: 'kıyıya açılır.', storySupport: 'Zeytin avlusu, özel iskele ve organik Ege kahvaltısıyla kıyıda başlayan bir Bozburun sabahı.',
    feature1: '32 m² deniz manzaralı taş oda', feature2: 'Özel iskele ve zeytin avlusu', feature3: 'Organik Ege kahvaltısı',
    experienceEyebrow: 'ANFORA’DA BİR GÜN', experienceTitle1: 'Avludan iskeleye', experienceTitle2: 'uzayan bir gün.', route1: 'Taş odada yavaş sabah', route2: 'Özel iskelede deniz molası', route3: 'Çatı terasında gün batımı',
    lastEyebrow: 'İSKELEDE BİR AKŞAM', lastTitle1: 'Tarihinizi bırakın.', lastTitle2: 'Koyda buluşalım.', bookingTitle1: 'Anfora’da bir', bookingTitle2: 'gün planlayalım.', bookingText: 'İskele, taş oda ve Ege sofrası için tarihlerinizi bırakın; Anfora ekibi size dönüş yapsın.', footerLine: 'Taş avludan Ege kıyısına.'
  },
  'buena-vista-hotel': {
    siteDescriptor: 'APART KONAKLAMA · EGE TERASI', locationLine: 'MERKEZ MAHALLESİ · BOZBURUN',
    detailStay: '2 apart · açık mutfak · balkon/patio', detailDining: 'Ege terası · kendi saatinizde',
    storyTitle1: 'Manzaraya bakan', storyTitle2: 'bir ev.', storySupport: 'İki apart, açık mutfak ve Ege Denizi’ne bakan teras; otel ritminden uzak, bağımsız bir konaklama.',
    feature1: 'Balkonlu apart yaşamı', feature2: 'Açık mutfak ve buzdolabı', feature3: 'Ege Denizi manzaralı teras',
    experienceEyebrow: 'BUENA VISTA’DA BİR GÜN', experienceTitle1: 'Kahveni kendin yap,', experienceTitle2: 'manzarayı paylaş.', route1: 'Balkonda sabah kahvesi', route2: 'Apart mutfağında kendi sofran', route3: 'Ege terasında gün batımı',
    lastEyebrow: 'MANZARAYA AÇILAN BİR AKŞAM', lastTitle1: 'Kendi ritminizi seçin.', lastTitle2: 'Bozburun’da kalın.', bookingTitle1: 'Buena Vista’da', bookingTitle2: 'bir apart planlayalım.', bookingText: 'Apartınızın tarihlerini ve ihtiyaçlarınızı bırakın; Buena Vista ekibi size uygun seçeneği paylaşsın.', footerLine: 'Kendi evin, Bozburun ufku.'
  },
  'defne-lorina': {
    siteDescriptor: 'BOTANİK BAHÇE · ÖZEL İSKELE', locationLine: 'YEŞİLOVA KOYU · BOZBURUN',
    detailStay: '45 m² taş ev süiti · veranda', detailDining: 'Bahçe kahvaltısı · kıyı sofrası',
    storyTitle1: 'Bahçeden denize', storyTitle2: 'ağır ağır açılın.', storySupport: 'Taş mimari, botanik bahçe ve verandalı odalar; günün temposu Yeşilova Koyu’nda yavaşlar.',
    feature1: '45 m² taş ev süiti', feature2: 'Botanik bahçe ve veranda', feature3: 'Özel iskeleye yakınlık',
    experienceEyebrow: 'DEFNE LORİNA’DA BİR GÜN', experienceTitle1: 'Yeşilin içinden', experienceTitle2: 'koyun ışığına.', route1: 'Verandada sessiz bir sabah', route2: 'Botanik bahçede kısa bir mola', route3: 'Özel iskelede akşam serinliği',
    lastEyebrow: 'YEŞİLİN KIYISINDA', lastTitle1: 'Bir tarih seçin.', lastTitle2: 'Koyda yavaşlayın.', bookingTitle1: 'Defne Lorina’da', bookingTitle2: 'sakin bir gün kuralım.', bookingText: 'Taş ev süiti ve koydaki günler için tarihlerinizi bırakın; Defne Lorina ekibi dönüş yapsın.', footerLine: 'Bahçeden kıyıya, sessizce.'
  },
  'dinc-otel': {
    siteDescriptor: 'DENİZ SIFIR · KORDON', locationLine: 'KORDON CADDESİ · BOZBURUN',
    detailStay: 'Deniz önü balkonlu oda · 30 m²', detailDining: 'Kordon kahvaltısı · taze balık',
    storyTitle1: 'İskeleye yakın', storyTitle2: 'sade günler.', storySupport: 'Kordon’un içinde; deniz önündeki odalar, samimi karşılama ve kıyıda kurulan taze sofralar.',
    feature1: '30 m² deniz önü oda', feature2: 'Denize bakan balkon', feature3: 'Kordon kahvaltısı ve taze balık',
    experienceEyebrow: 'DİNÇ OTEL’DE BİR GÜN', experienceTitle1: 'Sabah kıyıda,', experienceTitle2: 'akşam Kordon’da.', route1: 'Deniz önünde güne başla', route2: 'İskelede serin bir mola', route3: 'Kordon’da taze balık',
    lastEyebrow: 'KORDONDA BİR YER', lastTitle1: 'Tarihinizi bırakın.', lastTitle2: 'Denize yakın kalın.', bookingTitle1: 'Dinç Otel’de', bookingTitle2: 'kıyıya inelim.', bookingText: 'Deniz önü odanız ve Kordon’daki günleriniz için tarihlerinizi bırakın; ekip size dönüş yapsın.', footerLine: 'Kordonun içinden, denizin yanından.'
  },
  'hotel-melisa': {
    siteDescriptor: 'ÖZEL İSKELE · EV YAPIMI', locationLine: 'CUMHURİYET CADDESİ · BOZBURUN',
    detailStay: '36 m² oda · 12 m² deniz balkonu', detailDining: 'Ev yapımı kahvaltı · kıyı sofrası',
    storyTitle1: 'Kahvaltıdan denize', storyTitle2: 'uzanan bir gün.', storySupport: 'Deniz manzaralı odalar, özel iskele ve ev yapımı ürünlerle; Melisa’da tatil kolay ve içten ilerler.',
    feature1: '36 m² deniz manzaralı oda', feature2: '12 m² balkon ve özel iskele', feature3: 'Ev yapımı reçel ve hamur işleri',
    experienceEyebrow: 'MELİSA’DA BİR GÜN', experienceTitle1: 'İlk ışıkta kahvaltı,', experienceTitle2: 'son ışıkta deniz.', route1: 'Ev yapımı kahvaltıyla başla', route2: 'Ücretsiz şezlongda dinlen', route3: 'Kıyıda akşam sofrası',
    lastEyebrow: 'DENİZ KIYISINDA BİR AKŞAM', lastTitle1: 'Bir tarih seçin.', lastTitle2: 'Kıyıya yerleşin.', bookingTitle1: 'Hotel Melisa’da', bookingTitle2: 'bir kıyı günü planlayalım.', bookingText: 'Deniz balkonunuzu ve özel iskele günlerinizi planlamak için tarihlerinizi bırakın.', footerLine: 'Kahvaltıdan gün batımına.'
  },
  'mete-otel-bozburun': {
    siteDescriptor: '30 ODA · 60 YATAK', locationLine: 'YEŞİLOVA MEVKİİ · BOZBURUN',
    detailStay: '54 m² king suite · 18 m² teras', detailDining: 'Yarım pansiyon · deniz sıfır',
    storyTitle1: 'Koyun içinde', storyTitle2: 'panoramik bir durak.', storySupport: 'Otuz oda, özel iskele ve deniz manzarası; Mete Otel’de gün açık havada, kıyının içinde geçer.',
    feature1: '54 m² panoramik king suite', feature2: '18 m² özel deniz terası', feature3: 'Yarım pansiyon Ege düzeni',
    experienceEyebrow: 'METE OTEL’DE BİR GÜN', experienceTitle1: 'İskeleye in,', experienceTitle2: 'koyda kal.', route1: 'Panoramik terasta sabah', route2: 'Özel iskelede deniz', route3: 'Yarım pansiyon akşamı',
    lastEyebrow: 'KOYUN İÇİNDE BİR ODA', lastTitle1: 'Tarihinizi bırakın.', lastTitle2: 'Denize sıfır yaşayın.', bookingTitle1: 'Mete Otel’de', bookingTitle2: 'koydaki yerinizi seçin.', bookingText: 'Panoramik suite ve yarım pansiyon konaklama için tarihlerinizi bırakın; Mete Otel ekibi dönüş yapsın.', footerLine: 'İskele, deniz ve Bozburun rüzgârı.'
  },
  'metto-bozburun': {
    siteDescriptor: 'BUNGALOV · ÖZEL PLAJ', locationLine: 'CUMHURİYET CADDESİ · BOZBURUN',
    detailStay: 'Deniz manzaralı bungalov · özel teras', detailDining: 'Ev yapımı kahvaltı · günlük taze ürün',
    storyTitle1: 'Verandadan denize', storyTitle2: 'geçen bir hayat.', storySupport: 'Bungalov, özel bahçe, ücretsiz kahvaltı ve iskele; Metto’da konaklama doğayla aynı çizgide durur.',
    feature1: 'Deniz manzaralı bungalov', feature2: 'Özel teras ve bahçe', feature3: 'Özel plaj ve iskele',
    experienceEyebrow: 'METTO’DA BİR GÜN', experienceTitle1: 'Bungalovda kahve,', experienceTitle2: 'iskelede serinlik.', route1: 'Özel bahçede sabah', route2: 'Plajda uzun bir öğle', route3: 'İskelede gün batımı',
    lastEyebrow: 'BUNGALOVDA BİR AKŞAM', lastTitle1: 'Kendi alanınızı seçin.', lastTitle2: 'Kıyıya yerleşin.', bookingTitle1: 'Metto Bozburun’da', bookingTitle2: 'bungalovunuzu planlayalım.', bookingText: 'Deniz manzaralı bungalov ve özel plaj için tarihlerinizi bırakın; Metto ekibi size dönüş yapsın.', footerLine: 'Bungalovdan özel kıyıya.'
  },
  'moonlight-butik-hotel': {
    siteDescriptor: 'ALTI ODA · AY IŞIĞI', locationLine: 'APSUN KOYU · BOZBURUN',
    detailStay: 'King yatak · özel deniz terası', detailDining: 'Kıyı balığı · bahçe otları',
    storyTitle1: 'Gündüz deniz,', storyTitle2: 'gece gökyüzü.', storySupport: 'Altı odalı butik yapı, özel teraslar ve koyun gece ışıkları; Moonlight’ta zaman sessizce akar.',
    feature1: 'Altı odalı butik yapı', feature2: 'King yatak ve özel teras', feature3: 'Koyun gece ışıklarına bakan manzara',
    experienceEyebrow: 'MOONLIGHT’TA BİR GÜN', experienceTitle1: 'Gün batımıyla başlar,', experienceTitle2: 'ay ışığıyla sürer.', route1: 'Koyda sakin bir sabah', route2: 'Özel terasta uzun öğle', route3: 'Ay ışığında küçük tabaklar',
    lastEyebrow: 'APSUN KOYU’NDA BİR GECE', lastTitle1: 'Tarihinizi bırakın.', lastTitle2: 'Ay ışığında buluşalım.', bookingTitle1: 'Moonlight’ta', bookingTitle2: 'gecenizi planlayalım.', bookingText: 'Moon Suite ve koyun gece ritmi için tarihlerinizi bırakın; Moonlight ekibi size dönüş yapsın.', footerLine: 'Gündüz deniz, gece gökyüzü.'
  },
  'ozgur-otel-bozburun': {
    siteDescriptor: 'MUTFAKLI APART · İSKELE', locationLine: 'İSKELE MEYDANI · BOZBURUN',
    detailStay: 'Kendi mutfağı · ferah yaşam alanı', detailDining: 'Kendi sofranız · kıyı restoranları',
    storyTitle1: 'Kendi alanın,', storyTitle2: 'kendi saatin.', storySupport: 'Mutfaklı apart, bağımsız giriş ve iskeleye yakınlık; Özgür Apart’ta tatilin programı size ait.',
    feature1: 'Kendi mutfağı ve yaşam alanı', feature2: 'İskele Meydanı’na yakınlık', feature3: 'Uzun konaklamaya uygun apart',
    experienceEyebrow: 'ÖZGÜR APART’TA BİR GÜN', experienceTitle1: 'Pazardan mutfağa,', experienceTitle2: 'kıyıdan eve.', route1: 'Kendi mutfağında kahve', route2: 'İskelede kısa yüzme', route3: 'Kıyıda seçtiğin akşam',
    lastEyebrow: 'KENDİ RİTMİNİZDE', lastTitle1: 'Tarihinizi bırakın.', lastTitle2: 'Evinizi Bozburun’a taşıyın.', bookingTitle1: 'Özgür Apart’ta', bookingTitle2: 'kendi gününüzü kuralım.', bookingText: 'Mutfaklı apartınız için tarihleri bırakın; Özgür Apart ekibi konaklama seçenekleriyle dönüş yapsın.', footerLine: 'Kendi mutfağın, Bozburun kıyısı.'
  },
  'rosario-hotel': {
    siteDescriptor: 'BEGONVİL · TAŞ KEMER', locationLine: 'LİMAN ARKASI · BOZBURUN',
    detailStay: '46 m² begonvil süiti · deniz manzarası', detailDining: 'Taze ürünler · açık hava sofrası',
    storyTitle1: 'Taş kemerlerin', storyTitle2: 'altında renkli günler.', storySupport: 'Begonvil avlusu, taş detaylar ve deniz manzaralı odalar; Rosario’da kıyının renkleri içeri taşar.',
    feature1: '46 m² deniz manzaralı süit', feature2: 'Begonvil avlusu ve taş mimari', feature3: 'Açık havada akşam sofrası',
    experienceEyebrow: 'ROSARIO’DA BİR GÜN', experienceTitle1: 'Avluda renk,', experienceTitle2: 'kıyıda serinlik.', route1: 'Begonviller arasında kahve', route2: 'Liman arkasında keşif', route3: 'Açık havada uzun sohbet',
    lastEyebrow: 'LİMAN ARKASINDA BİR ODA', lastTitle1: 'Tarihinizi bırakın.', lastTitle2: 'Renkli bir kaçışa çıkın.', bookingTitle1: 'Rosario’da', bookingTitle2: 'kıyının rengini seçin.', bookingText: 'Begonvil avlusu ve deniz manzaralı süit için tarihlerinizi bırakın; Rosario ekibi dönüş yapsın.', footerLine: 'Begonvil avlusundan liman ışığına.'
  },
  'sound-of-silence-suite': {
    siteDescriptor: 'ÖZEL TEKNE · PANORAMİK SÜİT', locationLine: 'ADATEPE MEVKİİ · BOZBURUN',
    detailStay: '45 m² suite · 20 m² özel teras', detailDining: 'Günlük taze balık · organik kahvaltı',
    storyTitle1: 'Karayolunun bittiği', storyTitle2: 'yerde sessizlik.', storySupport: 'Özel tekneyle ulaşılan kıyı, panoramik deniz süitleri ve özel iskele; burada günün sesi azalır.',
    feature1: '45 m² panoramik deniz suite', feature2: '20 m² özel teras', feature3: 'Özel tekneyle ulaşım',
    experienceEyebrow: 'SOUND OF SILENCE’TA BİR GÜN', experienceTitle1: 'Dünyayı geride bırak,', experienceTitle2: 'denize yaklaş.', route1: 'Tekneyle sakin varış', route2: 'Özel iskelede sessizlik', route3: 'Kıyıda taze balık',
    lastEyebrow: 'SESSİZLİĞE AYRILAN BİR GECE', lastTitle1: 'Tarihinizi bırakın.', lastTitle2: 'Ulaşımınızı birlikte planlayalım.', bookingTitle1: 'Sound of Silence’ta', bookingTitle2: 'sessizliği seçin.', bookingText: 'Özel tekne ulaşımı ve panoramik suite için tarihlerinizi bırakın; ekip size ulaşım detaylarıyla dönüş yapsın.', footerLine: 'Karayolunun bittiği yerde.'
  },
  'suna-pansiyon': {
    siteDescriptor: 'AİLE PANSİYONU · DENİZ BAHÇESİ', locationLine: 'CUMHURİYET CADDESİ · BOZBURUN',
    detailStay: '32 m² bahçe verandası · deniz bahçesi', detailDining: 'Ev yapımı ekmek · taze reçeller',
    storyTitle1: 'Ev sıcaklığı', storyTitle2: 'iskeleye çıkar.', storySupport: 'Aile işletmesi, deniz bahçesi ve ahşap güneşlenme iskelesi; Suna’da misafirlik tanıdık bir sofrayla başlar.',
    feature1: '32 m² bahçe verandası', feature2: 'Deniz bahçesi ve ahşap iskele', feature3: 'Ev yapımı ekmek ve reçeller',
    experienceEyebrow: 'SUNA’DA BİR GÜN', experienceTitle1: 'Ev ekmeğiyle başlar,', experienceTitle2: 'iskelede ağırlaşır.', route1: 'Bahçede ev yapımı kahvaltı', route2: 'Ahşap iskelede yüzme', route3: 'Aile sofrasında akşam',
    lastEyebrow: 'İSKELE KIYISINDA EV SICAKLIĞI', lastTitle1: 'Tarihinizi bırakın.', lastTitle2: 'Sofraya misafir olun.', bookingTitle1: 'Suna Pansiyon’da', bookingTitle2: 'ev sıcaklığını planlayalım.', bookingText: 'Bahçe verandası ve deniz bahçesi için tarihlerinizi bırakın; Suna ailesi size dönüş yapsın.', footerLine: 'Ev ekmeğinden iskele kıyısına.'
  },
  'trakheia-bozburun': {
    siteDescriptor: 'DOĞAL TAŞ · KAYALIK KIYI', locationLine: 'ANTİK TRAKHEIA YOLU · BOZBURUN',
    detailStay: '52 m² taş süit · panoramik deniz', detailDining: 'Kıyı ürünleri · yerel tatlar',
    storyTitle1: 'Taşın hafızası', storyTitle2: 'uzun yazlara açılır.', storySupport: 'Doğal taş mimari, kayalık kıyı terası ve yarımadanın ışığı; Trakheia’da doğayla aynı çizgide kalınır.',
    feature1: '52 m² doğal taş süit', feature2: 'Panoramik deniz ve taş şömine', feature3: 'Antik Trakheia yoluna yakınlık',
    experienceEyebrow: 'TRAKHEIA’DA BİR GÜN', experienceTitle1: 'Taş duvarların gölgesinden', experienceTitle2: 'koylara doğru.', route1: 'Taş süitte yavaş sabah', route2: 'Yarımada koylarına keşif', route3: 'Kayalık kıyıda akşam',
    lastEyebrow: 'YARIMADANIN TAŞ HAFIZASI', lastTitle1: 'Tarihinizi bırakın.', lastTitle2: 'Uzun bir yaz başlatın.', bookingTitle1: 'Trakheia’da', bookingTitle2: 'yarımadaya açılalım.', bookingText: 'Doğal taş süit ve yarımada günleri için tarihlerinizi bırakın; Trakheia ekibi dönüş yapsın.', footerLine: 'Taş, deniz ve uzun yazlar.'
  },
  'valentina-boutique-hotel': {
    siteDescriptor: 'BEYAZ MİMARİ · BAHÇE', locationLine: 'DEĞİRMENBURNU · BOZBURUN',
    detailStay: '38 m² oda · geniş deniz balkonu', detailDining: 'Taze kahvaltı · Akdeniz esintisi',
    storyTitle1: 'Bahçeden denize', storyTitle2: 'ışıkla geçin.', storySupport: 'Beyaz mimari, begonvil pergolası, bahçe ve deniz balkonu; Valentina’da gün ışığı uzun sürer.',
    feature1: '38 m² deniz kenarı oda', feature2: 'Geniş deniz balkonu', feature3: 'Begonvil pergolası ve bahçe',
    experienceEyebrow: 'VALENTİNA’DA BİR GÜN', experienceTitle1: 'Bahçede kahve,', experienceTitle2: 'kıyıda uzun akşam.', route1: 'Begonvil altında sabah', route2: 'Deniz balkonunda öğle', route3: 'Akdeniz esintili akşam',
    lastEyebrow: 'BAHÇEDE BAŞLAYAN BİR KONAKLAMA', lastTitle1: 'Tarihinizi bırakın.', lastTitle2: 'Denize yakın kalın.', bookingTitle1: 'Valentina’da', bookingTitle2: 'ışıklı bir gün seçin.', bookingText: 'Deniz balkonlu odanız ve bahçedeki günleriniz için tarihlerinizi bırakın; Valentina ekibi dönüş yapsın.', footerLine: 'Beyaz mimariden Ege sabahına.'
  },
  'yagiz-apart-otel': {
    siteDescriptor: 'MUTFAKLI APART · 2–4 YETİŞKİN', locationLine: 'ADATEPE CADDESİ · BOZBURUN',
    detailStay: '50 m² apart · 12 m² balkon', detailDining: 'Tam mutfak · pazar alışverişi',
    storyTitle1: 'Kendi evin gibi', storyTitle2: 'Bozburun’da.', storySupport: 'Bağımsız giriş, tam mutfak ve balkon; Yağız Apart uzun kalışta ev rahatlığını korur.',
    feature1: '50 m² mutfaklı apart', feature2: '12 m² balkon ve bağımsız giriş', feature3: '2–4 yetişkinlik aile düzeni',
    experienceEyebrow: 'YAĞIZ APART’TA BİR GÜN', experienceTitle1: 'Pazardan mutfağa,', experienceTitle2: 'evden koya.', route1: 'Balkonda sabah kahvesi', route2: 'Tam mutfakta kendi öğünün', route3: 'Merkezden kısa bir akşam yürüyüşü',
    lastEyebrow: 'BOZBURUN MERKEZİNDE APART YAŞAMI', lastTitle1: 'Tarihinizi bırakın.', lastTitle2: 'Evinizi yanınıza alın.', bookingTitle1: 'Yağız Apart’ta', bookingTitle2: 'kendi gününüzü planlayın.', bookingText: '2–4 yetişkinlik mutfaklı apart için tarihlerinizi bırakın; Yağız Apart ekibi size dönüş yapsın.', footerLine: 'Kendi evin, Bozburun’da.'
  },
  'yilmaz-kaptan-otel': {
    siteDescriptor: 'ÖZEL İSKELE · DENİZ KÜLTÜRÜ', locationLine: 'SAHİL YÜRÜYÜŞ YOLU · BOZBURUN',
    detailStay: '46 m² suite · 14 m² balkon', detailDining: 'Kıyı lezzetleri · açık hava',
    storyTitle1: 'Kaptanın kıyısında', storyTitle2: 'denize alışın.', storySupport: 'Deniz manzaralı odalar, özel iskele ve 24 saat bilgi desteği; Yılmaz Kaptan’da koyu keşfetmek kolaydır.',
    feature1: '46 m² panoramik deniz süiti', feature2: '14 m² balkon ve özel iskele', feature3: '24 saat bilgi ve resepsiyon desteği',
    experienceEyebrow: 'YILMAZ KAPTAN’DA BİR GÜN', experienceTitle1: 'Denizcilerin bildiği', experienceTitle2: 'koyda uzun bir gün.', route1: 'Sahil yürüyüş yolunda sabah', route2: 'Özel iskelede deniz molası', route3: 'Hikâyelerle uzayan akşam',
    lastEyebrow: 'DENİZCİLERİN BİLDİĞİ KOY', lastTitle1: 'Tarihinizi bırakın.', lastTitle2: 'Kaptanın kıyısında buluşalım.', bookingTitle1: 'Yılmaz Kaptan’da', bookingTitle2: 'kıyı gününüzü seçin.', bookingText: 'Panoramik deniz süiti ve özel iskele için tarihlerinizi bırakın; Yılmaz Kaptan ekibi dönüş yapsın.', footerLine: 'Deniz, iskele ve uzun hikâyeler.'
  },
  'sirin-haus': {
    siteDescriptor: 'MUTFAKLI APART · ÖZEL İSKELE', locationLine: 'BOZBURUN · MUĞLA',
    detailStay: 'Mutfaklı oda · bazılarında deniz balkonu', detailDining: 'Köy kahvaltısı · deniz manzaralı teras',
    storyTitle1: 'Kendi mutfağından', storyTitle2: 'iskeleye 100 metre.', storySupport: 'Migros’a 300 metre, özel iskeleye 100 metre; Şirin Haus’ta hem kendi düzeninizi kurar hem denize yakın kalırsınız.',
    feature1: 'Klimalı, mutfaklı oda', feature2: 'Bazı odalarda deniz manzaralı balkon', feature3: 'Özel iskele (100 m) ve günlük tekne turları',
    experienceEyebrow: 'ŞİRİN HAUS’TA BİR GÜN', experienceTitle1: 'Terastan iskeleye,', experienceTitle2: 'kendi ritminde bir gün.', route1: 'Terasta köy kahvaltısı', route2: 'Özel iskelede deniz molası', route3: 'Kendi mutfağında akşam sofrası',
    lastEyebrow: 'İSKELEYE 100 METRE', lastTitle1: 'Tarihinizi bırakın.', lastTitle2: 'Bozburun’da yerleşin.', bookingTitle1: 'Şirin Haus’ta', bookingTitle2: 'bir gün planlayalım.', bookingText: 'Mutfaklı odanız ve özel iskele günleriniz için tarihlerinizi bırakın; Şirin Haus ekibi size dönüş yapsın.', footerLine: 'Kendi mutfağından denize, 100 metre.'
  }
};

const v2HeroCopy = {
  'anfora-hotel': { title1: 'Koyun sessizliğinde', title2: 'taş avluya dönün.', lead: 'Anfora’da sabah denizle, öğleden sonra zeytin avlusunun serinliğiyle; akşam özel iskelede tamamlanır.' },
  'buena-vista-hotel': { title1: 'Ufka bakan', title2: 'kendi eviniz.', lead: 'Buena Vista’da açık mutfak, balkon ve Ege manzarası; Bozburun’da günün ritmini size bırakır.' },
  'defne-lorina': { title1: 'Yeşilin içinden', title2: 'koya inin.', lead: 'Defne Lorina’da taş evin verandasından botanik bahçeye, oradan Yeşilova Koyu’nun sakin suyuna geçilir.' },
  'dinc-otel': { title1: 'Kordonun içinde', title2: 'denize yakın kalın.', lead: 'Dinç Otel’de sabah kapınızın önünde kıyı, akşam birkaç adım ötede Bozburun’un sahil masaları var.' },
  'hotel-melisa': { title1: 'İlk ışıkta', title2: 'iskeleye inin.', lead: 'Hotel Melisa’da ev yapımı kahvaltı, deniz balkonu ve gün boyu kıyıda kalmanın sade rahatlığı buluşur.' },
  'mete-otel-bozburun': { title1: 'Otuz odadan', title2: 'koya bakın.', lead: 'Mete Otel’de panoramik suite, özel iskele ve yarım pansiyon düzeniyle Bozburun’un denizine yerleşilir.' },
  'metto-bozburun': { title1: 'Bungalovdan çıkın,', title2: 'özel kıyıya inin.', lead: 'Metto’da kendi terasınızdan güne başlayıp özel plajın ve iskelenin yavaş ritmine karışırsınız.' },
  'moonlight-butik-hotel': { title1: 'Gün batınca', title2: 'ay ışığına kalın.', lead: 'Moonlight’ın altı odasında gün koyda, gece özel terasta; Bozburun’un karanlığı yıldızlarla tamamlanır.' },
  'ozgur-otel-bozburun': { title1: 'Kendi mutfağınız,', title2: 'kendi Bozburun’unuz.', lead: 'Özgür Apart’ta mutfaklı yaşam alanı, bağımsız giriş ve iskeleye yakınlık tatili sizin programınıza bırakır.' },
  'rosario-hotel': { title1: 'Begonvillerin altında', title2: 'renkli bir kıyı.', lead: 'Rosario’da taş kemerler, begonvil avlusu ve liman arkasının deniz manzarası aynı yavaş güne açılır.' },
  'sound-of-silence-suite': { title1: 'Tekneyle varın,', title2: 'dünyayı sessize alın.', lead: 'Sound of Silence Suite’te karayolunun bittiği yerde panoramik deniz, özel teras ve gerçek bir kıyı sessizliği başlar.' },
  'suna-pansiyon': { title1: 'Ev ekmeğinden', title2: 'iskele sabahına.', lead: 'Suna Pansiyon’da aile sofrası, deniz bahçesi ve ahşap güneşlenme iskelesi misafirliği içten tutar.' },
  'trakheia-bozburun': { title1: 'Taş duvarların gölgesinden', title2: 'koylara açılın.', lead: 'Trakheia’da doğal taş süit, kayalık kıyı ve Antik Trakheia Yolu yarımadanın uzun yazlarına eşlik eder.' },
  'valentina-boutique-hotel': { title1: 'Beyaz mimariden', title2: 'Ege ışığına.', lead: 'Valentina’da begonvil bahçesi, geniş deniz balkonu ve kıyıya yakın sakinlik günün tonunu belirler.' },
  'yagiz-apart-otel': { title1: 'Evinizi yanınıza alın,', title2: 'Bozburun’a yerleşin.', lead: 'Yağız Apart’ta tam mutfak, balkon ve bağımsız giriş; iki ila dört yetişkin için kendi düzeninizi kurar.' },
  'yilmaz-kaptan-otel': { title1: 'Kaptanın bildiği', title2: 'kıyıda uzun kalın.', lead: 'Yılmaz Kaptan’da deniz manzaralı suite, özel iskele ve sahil yürüyüş yolu Bozburun’un deniz kültürünü taşır.' },
  'sirin-haus': { title1: 'Kendi mutfağınız,', title2: 'iskeleye 100 metre.', lead: 'Şirin Haus’ta klimalı, mutfaklı odalar; özel iskele ve günlük tekne turlarıyla Bozburun’un kıyısına yerleşirsiniz.' }
};

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const read = (file) => fs.readFileSync(file, 'utf8');
const ensure = (dir) => fs.mkdirSync(dir, { recursive: true });
const copyAsset = (source, target) => { ensure(path.dirname(target)); fs.copyFileSync(source, target); };

const assetNotes = {
  'anfora-hotel': 'Property listing imagery: Jolly Tur Anfora Pansiyon, refreshed for this sales demo.',
  'buena-vista-hotel': 'Property listing imagery: Buena Vista Restaurant & Hotel and the Buena Vista apartment listing.',
  'defne-lorina': 'Property imagery: Defne Lorina source archive.',
  'dinc-otel': 'Property imagery: Dinç Otel source archive.',
  'hotel-melisa': 'Property listing imagery: Booking.com and Odamax Hotel Melisa Bozburun listings.',
  'mete-otel-bozburun': 'Property listing imagery: Tatilsepeti, Enuygun and Odamax Mete Otel listings.',
  'metto-bozburun': 'Demo concept imagery created for Metto Bozburun; replace with owner-approved property photos before public launch.',
  'moonlight-butik-hotel': 'Property listing imagery: Otelz and Moonlight Bozburun listing references.',
  'ozgur-otel-bozburun': 'Demo concept imagery created for Özgür Apart; replace with owner-approved property photos before public launch.',
  'rosario-hotel': 'Exterior property image: Tripadvisor Rosario Hotel listing. Interior and dining panels are demo concepts because the listing has limited current imagery.',
  'sound-of-silence-suite': 'Demo concept imagery created for the Sound of Silence Suite; replace with owner-approved property photos before public launch.',
  'suna-pansiyon': 'Property imagery: Suna Pansiyon source archive and Tripadvisor guest photo listing.',
  'trakheia-bozburun': 'Property imagery: Trakheia Bozburun source archive.',
  'valentina-boutique-hotel': 'Property listing imagery: Booking.com and Tatildenince Valentina Boutique Hotel listings.',
  'yagiz-apart-otel': 'Demo concept imagery created for Yağız Apart; replace with owner-approved property photos before public launch.',
  'yilmaz-kaptan-otel': 'Property listing imagery: Odamax and Tatilkaresi Yılmaz Kaptan Otel listings.',
  'sirin-haus': 'Placeholder demo imagery (shared concept asset) — Şirin Haus is a real, active listing (Tripadvisor/Etstur/Otelz) but no property photos or logo are in this repo yet; swap in owner-approved photos and the Gemini-made logo before using this demo with the property.'
};

for (const version of versions) {
  const templateDir = path.join(here, 'templates', version);
  const targetRoot = path.join(here, 'generated-sites');
  const htmlTemplate = read(path.join(templateDir, 'index.html'));
  const css = read(path.join(templateDir, 'styles.css'));
  const js = read(path.join(templateDir, 'app.js'));
  for (const hotel of hotels) {
    const content = { ...hotel, ...(factBySlug.get(hotel.slug) ?? {}) };
    const out = path.join(targetRoot, `${hotel.slug}-${version}`);
    ensure(path.join(out, 'media'));
    const sourceDir = path.join(projectRoot, hotel.sourceDir, 'dist/client');
    const visualDir = path.join(visualAssetRoot, hotel.slug);
    const resolveAsset = (role, filename, fallback) => {
      const visual = path.join(visualDir, `${role}.jpg`);
      if (fs.existsSync(visual)) return visual;
      const candidate = filename && path.join(sourceDir, filename);
      return candidate && fs.existsSync(candidate) ? candidate : path.join(fallbackDir, fallback);
    };
    copyAsset(resolveAsset('hero', hotel.hero, 'hero.png'), path.join(out, 'media/hero.jpg'));
    copyAsset(resolveAsset('room', hotel.roomImage, hotel.hero ? 'hero.png' : 'room.png'), path.join(out, 'media/room.jpg'));
    copyAsset(resolveAsset('dining', hotel.diningImage, hotel.hero ? 'hero.png' : 'dining.png'), path.join(out, 'media/dining.jpg'));
    copyAsset(decor, path.join(out, 'media/decor.mp4'));
    copyAsset(resolveAsset('logo', hotel.logo ?? 'logo.jpg', hotel.hero ? 'hero.png' : 'hero.png'), path.join(out, 'media/logo.jpg'));
    const tailored = siteCopy[content.slug] ?? {
      siteDescriptor: `${content.name} · BOZBURUN`, locationLine: content.address?.split(',')[0] ?? 'BOZBURUN',
      detailStay: content.roomText, detailDining: content.diningText,
      storyTitle1: content.title1, storyTitle2: content.title2, storySupport: content.lead,
      feature1: content.room, feature2: content.roomText, feature3: content.diningTitle,
      experienceEyebrow: `${content.name}’DA BİR GÜN`, experienceTitle1: content.title1, experienceTitle2: content.title2,
      route1: content.lead, route2: content.roomText, route3: content.diningText,
      lastEyebrow: 'BİR TARİH BIRAKIN', lastTitle1: 'Tarihinizi bırakın.', lastTitle2: 'Bozburun’da buluşalım.',
      bookingTitle1: `${content.name}’DA`, bookingTitle2: 'bir gün planlayalım.', bookingText: `${content.name} için tarihlerinizi bırakın; işletme ekibi size dönüş yapsın.`,
      footerLine: content.diningTitle
    };
    const values = {
      name: escapeHtml(content.name), mark: escapeHtml(content.mark), eyebrow: escapeHtml(content.eyebrow),
      title1: escapeHtml(content.title1), title2: escapeHtml(content.title2), lead: escapeHtml(content.lead),
      heroTitle1: escapeHtml(version === 'v2' ? (v2HeroCopy[content.slug]?.title1 ?? content.title1) : content.title1),
      heroTitle2: escapeHtml(version === 'v2' ? (v2HeroCopy[content.slug]?.title2 ?? content.title2) : content.title2),
      heroLead: escapeHtml(version === 'v2' ? (v2HeroCopy[content.slug]?.lead ?? content.lead) : content.lead),
      story: escapeHtml(content.story), room: escapeHtml(content.room), roomText: escapeHtml(content.roomText),
      diningTitle: escapeHtml(content.diningTitle), diningText: escapeHtml(content.diningText),
      address: escapeHtml(content.address ?? 'Bozburun · Muğla · Türkiye'),
      phone: escapeHtml(content.phone ?? 'Rezervasyon formu'),
      phoneHref: escapeHtml(content.phoneHref ?? '#booking'),
      whatsapp: escapeHtml(content.whatsapp ?? content.phone ?? '+90 252 456 20 00'),
      whatsappHref: escapeHtml(content.whatsappHref ?? 'https://wa.me/902524562000'),
      locationNote: escapeHtml(content.locationNote ?? 'Bozburun Koyu, Marmaris / Muğla'),
      mapsQuery: escapeHtml(content.mapsQuery ?? content.name + ' Bozburun Marmaris'),
      mapsEmbedUrl: content.mapsEmbedUrl ?? ('https://maps.google.com/maps?q=' + encodeURIComponent(content.name + ' Bozburun Marmaris') + '&t=&z=15&ie=UTF8&iwloc=&output=embed'),
      mapsDirectUrl: content.mapsDirectUrl ?? ('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(content.name + ' Bozburun Marmaris')),
      checkin: escapeHtml(content.checkin ?? '14:00'),
      checkout: escapeHtml(content.checkout ?? '12:00'),
      transport: escapeHtml(content.transport ?? 'Özel iskele, otopark ve sahil yürüyüş yolu konumu'),
      ...Object.fromEntries(Object.entries(tailored).map(([key, value]) => [key, escapeHtml(value)]))
    };
    const html = htmlTemplate.replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] ?? '');
    fs.writeFileSync(path.join(out, 'index.html'), html);
    fs.writeFileSync(path.join(out, 'styles.css'), css);
    fs.writeFileSync(path.join(out, 'app.js'), js);
    fs.writeFileSync(path.join(out, '.nojekyll'), '');
    fs.writeFileSync(path.join(out, 'media/SOURCE.txt'), `Decorative video: https://coverr.co/stock-video-footage/ocean\n${assetNotes[content.slug] ?? 'Hotel imagery: property demo asset archive.'}\n`);
  }
}

const manifest = hotels.flatMap((hotel) => versions.map((version) => ({
  hotel: hotel.name, slug: hotel.slug, version,
  directory: `generated-sites/${hotel.slug}-${version}`,
  repository: `bozburun-${hotel.slug}-${version}`,
  pages: `https://sburkaybozyel.github.io/bozburun-${hotel.slug}-${version}/`
})));
fs.writeFileSync(path.join(here, 'manifest.json'), JSON.stringify({ generatedAt: new Date().toISOString(), templates: { v1: 'templates/v1', v2: 'templates/v2' }, sites: manifest }, null, 2));
console.log(`Generated ${manifest.length} sites from two independent templates.`);
