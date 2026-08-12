import { readFile, writeFile } from 'node:fs/promises';

const [input, output, excluded = ''] = process.argv.slice(2);
if (!input || !output) throw new Error('Input and output paths are required.');
const dump = JSON.parse(await readFile(input, 'utf8'));
const excludedTables = new Set(excluded.split(',').map(value => value.trim()).filter(Boolean));
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
  if (excludedTables.has(table)) continue;
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
