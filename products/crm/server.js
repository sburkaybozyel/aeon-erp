import express from 'express';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { hashPassword } from './db.js';
import { getCrmDbForRequest } from './runtime-db.js';
import { initCrm } from './modules/crm.js';
import { initIntegration } from './modules/integration.js';
import { initAfterSales } from './modules/after_sales.js';
import { initReports } from './modules/reports.js';

const __dirname = process.env.CLOUDFLARE_WORKER === '1' ? '/tmp/crm' : dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.CRM_PORT || 3100;
const secureCookies = process.env.NODE_ENV === 'production' || process.env.CRM_SECURE_COOKIES === 'true';
const getDbForRequest = req => getCrmDbForRequest(req);

app.use(express.json());

app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

const sseClients = new Set();

function broadcastSSE(eventName, data) {
  const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    try { res.write(payload); } catch (e) { sseClients.delete(res); }
  }
}

function sessionTokenHash(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function readSessionTokens(req) {
  const tokens = [];
  const authorization = req.get('authorization') || '';
  if (authorization.startsWith('Bearer ')) tokens.push(authorization.slice(7).trim());
  const headerToken = req.get('x-crm-session');
  if (headerToken) tokens.push(headerToken);
  const cookie = String(req.get('cookie') || '').split(';').map(v => v.trim()).find(v => v.startsWith('crm_session='));
  if (cookie) tokens.push(decodeURIComponent(cookie.slice('crm_session='.length)));
  return [...new Set(tokens.filter(Boolean))];
}

const PUBLIC_PATHS = ['/auth/login', '/system/health'];

async function resolveSession(req, res, next) {
  try {
    const db = await getDbForRequest(req);
    const tokens = readSessionTokens(req);
    if (tokens.length > 0) {
      for (const token of tokens) {
        const session = await db.get(
          "SELECT s.id, s.user_id, s.expires_at, s.revoked_at, u.name, u.email, u.role FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?",
          [sessionTokenHash(token)]
        );
        if (session && !session.revoked_at && new Date(session.expires_at).getTime() > Date.now() && Number(session.active !== 0)) {
          req.crmUser = { id: session.user_id, name: session.name, email: session.email, role: session.role };
          break;
        }
      }
    }
    next();
  } catch (err) {
    next(err);
  }
}

function requireAuth(req, res, next) {
  if (PUBLIC_PATHS.includes(req.path)) return next();
  if (!req.crmUser) return res.status(401).json({ error: 'Oturum gerekli veya oturum süresi dolmuş.' });
  next();
}

function isManagement(user) {
  return String(user?.role || '').toLocaleLowerCase('tr-TR') === 'yönetici';
}

function requireManagement(req, res, next) {
  if (!isManagement(req.crmUser)) return res.status(403).json({ error: 'Bu işlem yönetici yetkisi gerektirir.' });
  next();
}

app.use('/api', resolveSession, requireAuth);

// Auth
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'E-posta ve parola zorunludur.' });
  try {
    const db = await getDbForRequest(req);
    const user = await db.get("SELECT * FROM users WHERE email = ?", [String(email).toLowerCase().trim()]);
    const candidateHash = hashPassword(password);
    const storedHash = user?.password_hash || '';
    // Constant-time comparison: even though the hash is looked up by email (not by secret), a
    // naive !== compares byte-by-byte and short-circuits on the first mismatch, which is exactly
    // the kind of timing signal password-comparison code should never leak.
    const storedBuf = Buffer.from(storedHash);
    const candidateBuf = Buffer.from(candidateHash);
    const matches = storedBuf.length === candidateBuf.length && crypto.timingSafeEqual(storedBuf, candidateBuf);
    if (!user || !matches) {
      return res.status(401).json({ error: 'Geçersiz e-posta veya parola.' });
    }
    if (Number(user.active) !== 1) return res.status(403).json({ error: 'Hesap pasif durumda.' });
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
    const token = crypto.randomBytes(32).toString('base64url');
    await db.run("DELETE FROM sessions WHERE revoked_at IS NOT NULL OR expires_at <= ?", [new Date().toISOString()]);
    await db.run("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)", [sessionTokenHash(token), user.id, expiresAt]);
    res.cookie('crm_session', token, { httpOnly: true, sameSite: 'strict', secure: secureCookies, maxAge: 8 * 60 * 60 * 1000, path: '/' });
    res.json({ success: true, token, expires_at: expiresAt, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/session', (req, res) => {
  if (!req.crmUser) return res.status(401).json({ error: 'Oturum bulunamadı.' });
  res.json({ user: req.crmUser });
});

app.post('/api/auth/logout', async (req, res) => {
  try {
    const db = await getDbForRequest(req);
    for (const token of readSessionTokens(req)) {
      await db.run("UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE id = ?", [sessionTokenHash(token)]);
    }
  } catch (e) {}
  res.clearCookie('crm_session', { httpOnly: true, sameSite: 'strict', secure: secureCookies, path: '/' });
  res.status(204).end();
});

app.get('/api/system/health', async (req, res) => {
  const db = await getDbForRequest(req);
  const configCount = await db.get("SELECT COUNT(*) AS cnt FROM config");
  res.json({ ok: true, crm: 'aeon-tourism-crm', tables: Object.keys(db.db.tables || {}).length });
});

// SSE
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
  sseClients.add(res);
  res.write(': ping\n\n');
  const heartbeat = setInterval(() => { try { res.write(': ping\n\n'); } catch (e) { clearInterval(heartbeat); } }, 20000);
  req.on('close', () => { clearInterval(heartbeat); sseClients.delete(res); });
});

// CRM module routes
initCrm({ app, getCrmDb: getDbForRequest, broadcastSSE, isManagement, requireManagement });
initIntegration({ app, getCrmDb: getDbForRequest, broadcastSSE, isManagement, requireManagement });
initAfterSales({ app, getCrmDb: getDbForRequest, broadcastSSE, isManagement, requireManagement });
initReports({ app, getCrmDb: getDbForRequest, broadcastSSE, isManagement, requireManagement });

app.use('/api', (req, res) => res.status(404).json({ error: 'not_found' }));

app.use(express.static(join(__dirname, 'public')));

app.get('*', (req, res) => {
  const hasExtension = join(req.path).split('.').length > 1;
  if (hasExtension) return res.status(404).end();
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error('CRM hata:', err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'İşlem şu anda tamamlanamadı.' });
});

if (process.env.CRM_DISABLE_LISTEN !== 'true') {
  app.listen(PORT, () => {
    console.log(`AEON Tourism CRM running on http://localhost:${PORT}`);
  });
}

export default app;
