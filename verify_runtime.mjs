import { existsSync, readFileSync } from 'node:fs';

const removedPaths = [
  'public/staff.html',
  'public/admin_mobile.html',
  'public/js/staff.js',
  'public/js/dining.js',
  'public/js/stay.js',
  'public/js/cruise.js',
  'public/js/request-notifications.js',
  'public/js_mobile'
];
const sourceFiles = [
  'server.js',
  'db.js',
  'public/index.html',
  'public/login.html',
  'public/sw.js',
  'public/manifest.json',
  'public/js/boot.js',
  'public/js/state.js',
  'public/js/manager-entry.js',
  'public/js/admin.js',
  'public/js/guest.js'
];
const forbidden = [
  'admin_mobile.html',
  'js_mobile',
  '/staff.html',
  'AEON_USE_MOCK_FIREBASE',
  'seedDemoData',
  '/api/system/reset',
  'setupGuestSimulator',
  'loadGuestSimulatorData'
];
const failures = [];

for (const file of removedPaths) {
  if (existsSync(file)) failures.push(`removed path exists: ${file}`);
}
for (const file of sourceFiles) {
  const contents = readFileSync(file, 'utf8');
  for (const token of forbidden) {
    if (contents.includes(token)) failures.push(`legacy token ${token} in ${file}`);
  }
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('Canonical runtime verification passed');
