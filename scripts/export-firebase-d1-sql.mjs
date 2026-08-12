import { writeFile } from 'node:fs/promises';
import { cert, deleteApp, initializeApp } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

const output = process.argv[2];
if (!output) throw new Error('Output path is required.');
const required = ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY', 'FIREBASE_DATABASE_URL'];
const missing = required.filter(key => !process.env[key]);
if (missing.length) throw new Error(`Missing Firebase configuration: ${missing.join(', ')}`);
const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
  }),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});
const root = String(process.env.AEON_FIREBASE_ROOT || 'aeon_erp').replace(/^\/+|\/+$/g, '');
const snapshot = await getDatabase(app).ref(`${root}/tenants/aeon`).get();
if (!snapshot.exists()) throw new Error('AEON Firebase tenant data was not found.');
const dump = snapshot.val() || {};
delete dump.updatedAt;
const quote = value => {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? '1' : '0';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return `'${text.replaceAll("'", "''")}'`;
};
const lines = ['PRAGMA foreign_keys=OFF;'];
let rowCount = 0;
let tableCount = 0;
for (const [table, rows] of Object.entries(dump)) {
  if (!Array.isArray(rows) || rows.length === 0 || !/^[a-z0-9_]+$/i.test(table)) continue;
  tableCount += 1;
  lines.push(`DELETE FROM [${table}];`);
  for (const row of rows) {
    const keys = Object.keys(row).filter(key => /^[a-z0-9_]+$/i.test(key));
    if (!keys.length) continue;
    lines.push(`INSERT INTO [${table}] (${keys.map(key => `[${key}]`).join(', ')}) VALUES (${keys.map(key => quote(row[key])).join(', ')});`);
    rowCount += 1;
  }
}
lines.push("INSERT OR REPLACE INTO config ([key], [value]) VALUES ('cloudflare_d1_imported', 'true');", 'PRAGMA foreign_keys=ON;');
await writeFile(output, lines.join('\n'), { mode: 0o600 });
console.log(JSON.stringify({ tables: tableCount, rows: rowCount }));
await deleteApp(app);
