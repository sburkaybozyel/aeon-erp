import crypto from 'crypto';
import { hashPin, savePersistentSession, revokePersistentSession, hasD1Persistence } from '../db.js';
import {
  isSecureRequest, loginAttempts, loginAttemptKey, isLoginRateLimited, recordFailedLogin,
  readSessionTokens, sessionTokenHash
} from '../server-middleware.js';

// Login/session/logout routes, extracted verbatim from server.js — no behavior change.
export function registerAuthRoutes(app) {
  app.post('/api/auth/login', async (req, res) => {
    const { pin } = req.body;
    if (!pin) {
      return res.status(400).json({ error: 'PIN is required' });
    }
    if (isLoginRateLimited(req)) {
      return res.status(429).json({ error: 'Çok fazla hatalı giriş denemesi yapıldı. Lütfen daha sonra tekrar deneyin.' });
    }

    try {
      const user = await req.db.get("SELECT id, name, role, department FROM staff WHERE pin = ?", [hashPin(pin)]);
      if (!user) {
        recordFailedLogin(req);
        return res.status(401).json({ error: 'Geçersiz PIN.' });
      }

      const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
      const token = crypto.randomBytes(32).toString('base64url');
      await req.db.run("DELETE FROM sessions WHERE revoked_at IS NOT NULL OR expires_at <= ?", [new Date().toISOString()]);
      await req.db.run(
        "INSERT INTO sessions (id, staff_id, tenant_id, expires_at) VALUES (?, ?, ?, ?)",
        [sessionTokenHash(token), user.id, req.tenantId, expiresAt]
      );
      if (!hasD1Persistence()) {
        await savePersistentSession(req.tenantId, sessionTokenHash(token), {
          id: sessionTokenHash(token),
          staff_id: user.id,
          tenant_id: req.tenantId,
          expires_at: expiresAt,
          revoked_at: null
        });
      }
      loginAttempts.delete(loginAttemptKey(req));
      res.cookie('aeon_session', token, {
        httpOnly: true,
        sameSite: 'strict',
        secure: isSecureRequest(req),
        maxAge: 90 * 24 * 60 * 60 * 1000,
        path: '/'
      });

      res.json({
        success: true,
        token,
        expires_at: expiresAt,
        user: { ...user, tenant_id: req.tenantId }
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/auth/session', async (req, res) => {
    if (!req.actor) return res.status(401).json({ error: 'Oturum bulunamadı.' });
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
    await req.db.run('UPDATE sessions SET expires_at = ? WHERE id = ?', [expiresAt, req.session.id]);
    const token = readSessionTokens(req)[0];
    if (token) res.cookie('aeon_session', token, { httpOnly: true, sameSite: 'strict', secure: isSecureRequest(req), maxAge: 90 * 24 * 60 * 60 * 1000, path: '/' });
    res.json({ user: req.actor, expires_at: expiresAt });
  });

  app.post('/api/auth/logout', async (req, res) => {
    const tokens = readSessionTokens(req);
    const revokedAt = new Date().toISOString();
    for (const token of tokens) {
      const tokenHash = sessionTokenHash(token);
      await req.db.run("UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE id = ?", [tokenHash]);
      if (!hasD1Persistence()) await revokePersistentSession(req.tenantId, tokenHash, revokedAt);
    }
    res.clearCookie('aeon_session', { httpOnly: true, sameSite: 'strict', secure: isSecureRequest(req), path: '/' });
    res.status(204).end();
  });
}
