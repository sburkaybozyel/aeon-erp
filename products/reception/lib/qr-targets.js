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
  ...sectionTargets('garden', 'Garden', 4),
  ...sectionTargets('terrace', 'Terrace', 4),
  ...sectionTargets('bar', 'Bar', 4),
  {
    code: 'bar-qr-01',
    label: 'Bar QR 1',
    target: 'Table-Bar QR 1',
    type: 'restaurant'
  },
  ...Array.from({ length: 12 }, (_, index) => {
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
