import { saveToDisk } from './persistence.js';

export class AsyncDb {
  constructor(dbInstance, tenantId) {
    this.db = dbInstance;
    this.tenantId = tenantId;
    this.suspendSave = false;
  }

  normalizeSql(sql) {
    if (!sql) return '';
    let normalized = sql
      .replace(/,\s*FOREIGN KEY\s*\([^)]*\)\s*REFERENCES\s*[a-zA-Z0-9_]*\([^)]*\)/gi, '')
      .replace(/INSERT OR IGNORE INTO/gi, 'INSERT INTO')
      .replace(/INSERT OR REPLACE INTO/gi, 'REPLACE INTO')
      .replace(/DATETIME\('now'\)/gi, 'CURRENT_TIMESTAMP')
      .replace(/DATETIME\('now', 'localtime'\)/gi, 'CURRENT_TIMESTAMP')
      .replace(/AUTOINCREMENT/gi, '');

    // Wrap key/value column names in brackets, avoiding PRIMARY KEY or FOREIGN KEY keywords
    normalized = normalized.replace(/\b(?<!PRIMARY\s+|FOREIGN\s+)(key|value)\b/gi, '[$1]');

    // Wrap tables table name in brackets, avoiding SHOW TABLES keyword
    normalized = normalized.replace(/\b(?<!SHOW\s+)(tables)\b/gi, '[$1]');
    return normalized;
  }

  run(sql, params = []) {
    return new Promise(async (resolve, reject) => {
      const normalized = this.normalizeSql(sql);
      try {
        if (normalized.includes('sqlite_master')) {
          const tableNames = Object.keys(this.db.tables || {});
          resolve({ lastID: null, changes: tableNames.length });
          return;
        }
        const res = this.db.exec(normalized, params);
        if (!this.suspendSave && /insert|update|delete|replace|create|drop|alter/i.test(normalized)) {
          await saveToDisk(this.tenantId, this.db);
        }
        // AlaSQL returns the actual affected-row count as a plain number for UPDATE/DELETE (and
        // an array of inserted rows for some INSERT forms). Previously any non-array result was
        // reported as changes:1 regardless of the real count, which silently broke any caller
        // using a conditional UPDATE (e.g. `... WHERE stock >= ?`) to detect whether the guard
        // condition actually matched.
        resolve({ lastID: null, changes: Array.isArray(res) ? res.length : (typeof res === 'number' ? res : 1) });
      } catch (err) {
        reject(err);
      }
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      const normalized = this.normalizeSql(sql);
      try {
        if (normalized.includes('sqlite_master')) {
          const tableNames = Object.keys(this.db.tables || {});
          const mapped = tableNames.map(name => ({ name }));
          resolve(mapped.length > 0 ? mapped[0] : null);
          return;
        }
        const res = this.db.exec(normalized, params);
        resolve(res && res.length > 0 ? res[0] : null);
      } catch (err) {
        reject(err);
      }
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      const normalized = this.normalizeSql(sql);
      try {
        if (normalized.includes('sqlite_master')) {
          const tableNames = Object.keys(this.db.tables || {});
          const mapped = tableNames.map(name => ({ name }));
          resolve(mapped);
          return;
        }
        const res = this.db.exec(normalized, params);
        resolve(res);
      } catch (err) {
        reject(err);
      }
    });
  }

  // Compensating "transaction" helper. AlaSQL has no real BEGIN/COMMIT/ROLLBACK, so this is not a
  // true ACID transaction — each statement still commits to disk/Firebase the moment it runs.
  // What this DOES guarantee: if any step inside `work` throws (a thrown error, or a guarded
  // step whose condition didn't match), every earlier step in the same call is automatically
  // undone, in reverse order, before the error is rethrown. Use it for any multi-step mutation
  // where a later step can fail after earlier steps already wrote data (stock deduction + order
  // creation, check-in's multiple table writes, etc.) instead of hand-rolling an undo array.
  //
  // Usage:
  //   await req.db.transaction(async (tx) => {
  //     await tx.run('UPDATE inventory SET stock = stock - ? WHERE id = ? AND stock >= ?', [qty, id, qty], {
  //       requireChange: true,                          // throws (and rolls back) if 0 rows matched
  //       failureMessage: 'Yeterli stok yok.',
  //       undoSql: 'UPDATE inventory SET stock = stock + ? WHERE id = ?', undoParams: [qty, id]
  //     });
  //     await tx.run('INSERT INTO requests (...) VALUES (...)', [...], {
  //       undoSql: 'DELETE FROM requests WHERE id = ?', undoParams: [requestId]
  //     });
  //     tx.onFailure(async () => { /* anything that isn't a plain SQL undo */ });
  //   });
  async transaction(work) {
    const undoLog = [];
    const tx = {
      run: async (sql, params = [], options = {}) => {
        const result = await this.run(sql, params);
        if (options.requireChange && !result.changes) {
          throw new Error(options.failureMessage || 'İşlem koşulu sağlanmadı (kayıt bulunamadı veya koşul tutmadı).');
        }
        if (options.undoSql) undoLog.push({ sql: options.undoSql, params: options.undoParams || [] });
        return result;
      },
      // Reads don't need undo tracking — pass straight through so existing helper functions that
      // take a single `db` handle (and call both .get/.all and .run on it) work unchanged whether
      // they're given `req.db` directly or a `tx` from inside a transaction.
      get: (sql, params = []) => this.get(sql, params),
      all: (sql, params = []) => this.all(sql, params),
      onFailure: fn => undoLog.push({ fn })
    };
    try {
      return await work(tx);
    } catch (error) {
      for (const step of undoLog.reverse()) {
        try {
          if (step.fn) await step.fn();
          else await this.run(step.sql, step.params);
        } catch (undoError) {
          console.error('[transaction] Compensating rollback step failed — manual data check may be needed:', undoError);
        }
      }
      throw error;
    }
  }

  exec(sql) {
    return new Promise(async (resolve, reject) => {
      const queries = sql.split(';').map(q => q.trim()).filter(Boolean);
      try {
        for (const query of queries) {
          const normalized = this.normalizeSql(query);
          this.db.exec(normalized);
        }
        if (!this.suspendSave) {
          await saveToDisk(this.tenantId, this.db);
        }
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  }
}

export class D1Db {
  constructor(dbInstance, tenantId) {
    this.db = dbInstance;
    this.tenantId = tenantId;
    this.suspendSave = false;
  }

  normalizeSql(sql) {
    if (!sql) return '';
    let normalized = sql
      .replace(/,\s*FOREIGN KEY\s*\([^)]*\)\s*REFERENCES\s*[a-zA-Z0-9_]*\([^)]*\)/gi, '')
      .replace(/DATETIME\('now'\)/gi, 'CURRENT_TIMESTAMP')
      .replace(/DATETIME\('now', 'localtime'\)/gi, 'CURRENT_TIMESTAMP')
      .replace(/AUTOINCREMENT/gi, '');
    normalized = normalized.replace(/\b(?<!PRIMARY\s+|FOREIGN\s+)(key|value)\b/gi, '[$1]');
    normalized = normalized.replace(/\b(?<!SHOW\s+)(tables)\b/gi, '[$1]');
    return normalized;
  }

  async run(sql, params = []) {
    const normalized = this.normalizeSql(sql);
    const result = await this.db.prepare(normalized).bind(...params).run();
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

  async transaction(work) {
    const undoLog = [];
    const tx = {
      run: async (sql, params = [], options = {}) => {
        const result = await this.run(sql, params);
        if (options.requireChange && !result.changes) throw new Error(options.failureMessage || 'İşlem koşulu sağlanmadı.');
        if (options.undoSql) undoLog.push({ sql: options.undoSql, params: options.undoParams || [] });
        return result;
      },
      get: (sql, params = []) => this.get(sql, params),
      all: (sql, params = []) => this.all(sql, params),
      onFailure: fn => undoLog.push({ fn })
    };
    try {
      return await work(tx);
    } catch (error) {
      for (const step of undoLog.reverse()) {
        try {
          if (step.fn) await step.fn();
          else await this.run(step.sql, step.params);
        } catch {}
      }
      throw error;
    }
  }
}
