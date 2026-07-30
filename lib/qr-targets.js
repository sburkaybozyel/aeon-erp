const sectionTargets = (prefix, label, count) => Array.from({ length: count }, (_, index) => {
  const number = index + 1;
  return {
    code: `${prefix}-${String(number).padStart(2, '0')}`,
    label: `${label} ${number}`,
    target: `Table-${label} ${number}`,
    type: 'restaurant'
  };
});

export const qrTargets = [
  ...sectionTargets('reception', 'Resepsiyon', 7),
  ...sectionTargets('bahce', 'Bahçe', 9),
  ...Array.from({ length: 11 }, (_, index) => {
    const number = index + 1;
    return {
      code: `iskele-${String(number).padStart(2, '0')}`,
      label: `İskele Masa ${number}`,
      target: `Table-İskele ${number}`,
      type: 'restaurant'
    };
  }),
  ...sectionTargets('sezlong-sol', 'Şezlong Sol', 11),
  ...sectionTargets('sezlong-sag', 'Şezlong Sağ', 11),
  ...Array.from({ length: 24 }, (_, index) => {
    const number = index + 1;
    return {
      code: `oda-${String(number).padStart(2, '0')}`,
      label: `Oda ${number}`,
      target: `Room-${number}`,
      type: 'room'
    };
  })
];

const targetByCode = new Map(qrTargets.map(target => [target.code, target]));

export function getQrTarget(code) {
  return targetByCode.get(String(code || '').trim().toLocaleLowerCase('tr-TR')) || null;
}
