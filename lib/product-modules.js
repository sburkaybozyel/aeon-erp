const MODULES = {
  'restaurant-kitchen': {
    id: 'restaurant-kitchen',
    name: 'QR Menü + Restoran + Mutfak',
    summary: 'Misafir QR siparişi, restoran servis ekranı ve mutfak KDS akışını tek ürün olarak sunar.',
    customerFacing: ['guest-qr', 'restaurant', 'kitchen'],
    staffFacing: ['restaurant', 'kitchen'],
    sourceSurfaces: [
      'public/guest.html',
      'public/js/guest.js',
      'public/staff-restaurant.html',
      'public/js/restaurant-entry.js',
      'public/staff-kitchen.html',
      'public/js/kitchen-entry.js'
    ],
    excludedSurfaces: ['reception', 'crm', 'housekeeping', 'maintenance'],
    entryPath: '/products/restaurant-kitchen'
  },
  reception: {
    id: 'reception',
    name: 'Ön Büro / Resepsiyon',
    summary: 'Resepsiyon akışı, oda rack, check-in/check-out, folio ve ön check-in işlemlerini ayrı ürün olarak sunar.',
    customerFacing: ['precheckin'],
    staffFacing: ['reception'],
    sourceSurfaces: [
      'public/staff-reception.html',
      'public/js/reception-entry.js',
      'public/precheckin.html',
      'modules/reception.js',
      'modules/reception/*'
    ],
    excludedSurfaces: ['restaurant', 'kitchen', 'bar', 'crm'],
    entryPath: '/products/reception'
  }
};

export function getProductModule(id) {
  return MODULES[id] || null;
}

export function listProductModules() {
  return Object.values(MODULES).map(module => ({
    ...module,
    sourceSurfaces: [...module.sourceSurfaces],
    customerFacing: [...module.customerFacing],
    staffFacing: [...module.staffFacing],
    excludedSurfaces: [...module.excludedSurfaces]
  }));
}
