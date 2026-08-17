export class D1Db {
  constructor(dbInstance, tenantId) {
    this.db = dbInstance;
    this.tenantId = tenantId;
  }

  normalizeSql(sql) {
    return String(sql || '')
      .replace(/DATETIME\('now'\)/gi, 'CURRENT_TIMESTAMP')
      .replace(/DATETIME\('now', 'localtime'\)/gi, 'CURRENT_TIMESTAMP')
      .replace(/\b(?<!PRIMARY\s+|FOREIGN\s+)(key|value)\b/gi, '[$1]')
      .replace(/\b(?<!SHOW\s+)(tables)\b/gi, '[$1]');
  }

  async run(sql, params = []) {
    const result = await this.db.prepare(this.normalizeSql(sql)).bind(...params).run();
    return { lastID: result.meta?.last_row_id || null, changes: Number(result.meta?.changes || 0) };
  }

  async get(sql, params = []) {
    return this.db.prepare(this.normalizeSql(sql)).bind(...params).first();
  }

  async all(sql, params = []) {
    const result = await this.db.prepare(this.normalizeSql(sql)).bind(...params).all();
    return result.results || [];
  }

  async exec(sql) {
    for (const statement of this.normalizeSql(sql).split(';').map(value => value.trim()).filter(Boolean)) {
      await this.db.prepare(statement).run();
    }
  }
}
