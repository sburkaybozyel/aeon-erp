const tenantId = new URLSearchParams(window.location.search).get('tenant_id') || 'reception';
const form = document.getElementById('precheckin-form');
const message = document.getElementById('precheckin-message');
const summary = document.getElementById('precheckin-summary');
const nationality = document.getElementById('nationality');
const identityNumber = document.getElementById('identity-number');
const passportWrap = document.getElementById('passport-wrap');
const passportNumber = document.getElementById('passport-number');
const languagePicker = document.getElementById('precheckin-language');
const nationalityList = document.getElementById('nationality-list');
const fallbackRegions = 'AF,AL,DZ,AD,AO,AG,AR,AM,AU,AT,AZ,BS,BH,BD,BB,BY,BE,BZ,BJ,BT,BO,BA,BW,BR,BN,BG,BF,BI,CV,KH,CM,CA,CF,TD,CL,CN,CO,KM,CG,CD,CR,CI,HR,CU,CY,CZ,DK,DJ,DM,DO,EC,EG,SV,GQ,ER,EE,SZ,ET,FJ,FI,FR,GA,GM,GE,DE,GH,GR,GD,GT,GN,GW,GY,HT,HN,HU,IS,IN,ID,IR,IQ,IE,IL,IT,JM,JP,JO,KZ,KE,KI,KP,KR,KW,KG,LA,LV,LB,LS,LR,LY,LI,LT,LU,MG,MW,MY,MV,ML,MT,MH,MR,MU,MX,FM,MD,MC,MN,ME,MA,MZ,MM,NA,NR,NP,NL,NZ,NI,NE,NG,MK,NO,OM,PK,PW,PA,PG,PY,PE,PH,PL,PT,QA,RO,RU,RW,KN,LC,VC,WS,SM,ST,SA,SN,RS,SC,SL,SG,SK,SI,SB,SO,ZA,SS,ES,LK,SD,SR,SE,CH,SY,TJ,TZ,TH,TL,TG,TO,TT,TN,TR,TM,TV,UG,UA,AE,GB,US,UY,UZ,VU,VA,VE,VN,YE,ZM,ZW,XK'.split(',');
const regionCodes = fallbackRegions;
const translations = {
  tr: { language: 'Dil', title: 'Online Ön Giriş', summary: 'Bilgilerinizi gönderin; resepsiyon ekibimiz rezervasyon, oda ve ödeme ayrıntılarını sizinle ayrıca teyit edecektir.', first_name: 'Ad', last_name: 'Soyad', phone: 'Telefon', email: 'E-posta', nationality: 'Uyruk', identity_number: 'T.C. Kimlik No', passport_number: 'Pasaport No', date_of_birth: 'Doğum Tarihi', address: 'Adres', vehicle_plate: 'Araç Plakası', special_requests: 'Özel İstekler', special_placeholder: 'Alerji, transfer veya oda tercihi', privacy: 'Kişisel bilgilerimin rezervasyon ve konaklama talebimin değerlendirilmesi için resepsiyon tarafından işlenmesine onay veriyorum.', marketing: 'Kampanya ve pazarlama iletileri için isteğe bağlı onay veriyorum.', submit: 'Bilgilerimi Resepsiyona Gönder', note: 'Bu form tek başına rezervasyon oluşturmaz. Oda, tarih, fiyat ve ödeme bilgileri resepsiyon tarafından tamamlanır.', sent: 'Bilgileriniz resepsiyon ekibine gönderildi.', failed: 'Gönderim başarısız.' },
  en: { language: 'Language', title: 'Online Pre Check-in', summary: 'Send your details and our reception team will confirm your reservation, room and payment details with you.', first_name: 'First name', last_name: 'Last name', phone: 'Phone', email: 'Email', nationality: 'Nationality', identity_number: 'Turkish ID number', passport_number: 'Passport number', date_of_birth: 'Date of birth', address: 'Address', vehicle_plate: 'Vehicle plate', special_requests: 'Special requests', special_placeholder: 'Allergies, transfer or room preference', privacy: 'I consent to reception processing my personal information to assess my reservation and accommodation request.', marketing: 'I optionally consent to receiving campaigns and marketing messages.', submit: 'Send My Details to Reception', note: 'This form does not create a reservation on its own. Reception will complete room, date, price and payment details.', sent: 'Your details have been sent to the reception team.', failed: 'Submission failed.' }
};
function show(text, type = 'warning') { message.textContent = text; message.className = `pms-banner ${type}`; message.hidden = false; }
function countryCode() { const match = String(nationality.value || '').match(/^([A-Z]{2})\b/); return match && regionCodes.includes(match[1]) ? match[1] : 'other'; }
function buildCountries(code) { const locale = code === 'tr' ? 'tr-TR' : 'en'; const names = new Intl.DisplayNames([locale], { type: 'region' }); const current = countryCode(); const deviceRegion = String(navigator.language || '').match(/-([a-z]{2})$/i)?.[1]?.toUpperCase(); const selected = current !== 'other' ? current : (deviceRegion && regionCodes.includes(deviceRegion) ? deviceRegion : ''); nationalityList.innerHTML = regionCodes.map(region => `<option value="${region} — ${names.of(region)}"></option>`).join(''); nationality.value = selected ? `${selected} — ${names.of(selected)}` : ''; }
function fields() { const turkish = countryCode() === 'TR'; identityNumber.required = turkish; passportWrap.hidden = turkish; passportNumber.required = !turkish; }
function setLanguage(code) {
  const copy = translations[code] || translations.tr;
  document.documentElement.lang = code;
  document.getElementById('precheckin-title').textContent = copy.title;
  summary.textContent = copy.summary;
  document.querySelectorAll('[data-field]').forEach(label => {
    const control = label.querySelector('input, select, textarea');
    const text = copy[label.dataset.field];
    if (control && text) label.firstChild.textContent = text;
  });
  document.querySelector('[name="language"]').closest('label').firstChild.textContent = copy.language;
  document.querySelector('[name="special_requests"]').placeholder = copy.special_placeholder;
  document.getElementById('privacy-consent').textContent = copy.privacy;
  document.getElementById('marketing-consent').textContent = copy.marketing;
  document.getElementById('precheckin-submit').textContent = copy.submit;
  document.getElementById('precheckin-note').textContent = copy.note;
  form.elements.language.value = code;
  buildCountries(code);
  languagePicker.querySelectorAll('[data-language]').forEach(button => button.classList.toggle('btn-primary', button.dataset.language === code));
  languagePicker.querySelectorAll('[data-language]').forEach(button => button.classList.toggle('btn-secondary', button.dataset.language !== code));
}
nationality.addEventListener('change', fields);
nationality.addEventListener('input', fields);
languagePicker.querySelectorAll('[data-language]').forEach(button => button.addEventListener('click', () => setLanguage(button.dataset.language)));
fields();
setLanguage(String(navigator.language || '').toLowerCase().startsWith('tr') ? 'tr' : 'en');
form.hidden = false;
form.addEventListener('submit', async event => {
  event.preventDefault();
  const submitButton = document.getElementById('precheckin-submit');
  if (submitButton.disabled) return;
  submitButton.disabled = true;
  const formValues = new FormData(form);
  const data = Object.fromEntries(formValues.entries());
  data.nationality = countryCode();
  data.kvkk_consent = formValues.has('kvkk_consent');
  data.marketing_consent = formValues.has('marketing_consent');
  const copy = translations[languagePicker.value] || translations.tr;
  try {
    const response = await fetch(`/api/guest/precheckin?tenant_id=${encodeURIComponent(tenantId)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || copy.failed);
    form.hidden = true;
    summary.hidden = true;
    show(copy.sent, 'success');
  } catch (error) {
    submitButton.disabled = false;
    show(error.message);
  }
});
