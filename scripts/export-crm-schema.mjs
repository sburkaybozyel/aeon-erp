import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { SCHEMA } from '../crm/db.js';

const output = resolve(process.argv[2] || 'crm/schema.sql');
await writeFile(output, `${SCHEMA.trim()}\n`, 'utf8');
console.log(output);
