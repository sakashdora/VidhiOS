import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const IS_PROD = process.env.NODE_ENV === 'production';

// Never derive SESSION_SECRET from DATABASE_URL or a hardcoded production literal.
// If SESSION_SECRET is unset, generate a CSPRNG secret per process and warn in production.
const ENV_SECRET = (process.env.SESSION_SECRET ?? '').trim();
const SESSION_SECRET = (() => {
  if (ENV_SECRET.length >= 16) {
    return ENV_SECRET;
  }
  if (IS_PROD) {
    console.warn(
      '[VidhiOS Security Warning] SESSION_SECRET is unset or < 16 chars in production. Using ephemeral CSPRNG secret; set SESSION_SECRET in environment variables for persistent multi-instance sessions.'
    );
  }
  return crypto.randomBytes(32).toString('hex');
})();

export const SESSION_COOKIE_NAME = 'vidhios_session';
export const CSRF_COOKIE_NAME = 'vidhios_csrf';
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

// In-memory revocation list (backed by Neon user_sessions table when Neon is enabled)
const revokedTokenIds = new Map<string, number>();

export interface SessionPayload {
  jti: string;
  userId: string;
  email: string;
  organizationId?: string;
  exp: number;
}

export interface AuthRequest extends Request {
  authUser?: SessionPayload;
  authTokenRaw?: string;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  if (!salt || !keyHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const storedBuf = Buffer.from(keyHex, 'hex');
  if (derived.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(derived, storedBuf);
}

export function signSessionToken(
  userId: string,
  email: string,
  organizationId?: string
): { token: string; jti: string; exp: number; csrfToken: string } {
  const jti = crypto.randomUUID();
  const exp = Date.now() + TOKEN_TTL_MS;
  const payload: SessionPayload = {
    jti,
    userId,
    email,
    organizationId,
    exp,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');
  const csrfToken = crypto.randomBytes(24).toString('base64url');
  return { token: `${encoded}.${sig}`, jti, exp, csrfToken };
}

export function revokeSessionTokenId(jti: string, exp: number): void {
  revokedTokenIds.set(jti, exp);
  const now = Date.now();
  for (const [id, expiresAt] of revokedTokenIds.entries()) {
    if (expiresAt < now) revokedTokenIds.delete(id);
  }
}

export function isSessionTokenRevoked(jti: string): boolean {
  const exp = revokedTokenIds.get(jti);
  if (!exp) return false;
  if (Date.now() > exp) {
    revokedTokenIds.delete(jti);
    return false;
  }
  return true;
}

export function verifySessionToken(token: string): SessionPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, providedSig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');

  const a = Buffer.from(providedSig, 'utf8');
  const b = Buffer.from(expectedSig, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    if (!parsed.userId || !parsed.email || typeof parsed.exp !== 'number') return null;
    if (Date.now() > parsed.exp) return null;
    if (parsed.jti && isSessionTokenRevoked(parsed.jti)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  for (const pair of cookieHeader.split(';')) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    if (key) {
      try {
        result[key] = decodeURIComponent(val);
      } catch {
        result[key] = val;
      }
    }
  }
  return result;
}

export function setAuthCookies(res: Response, token: string, csrfToken: string): void {
  const maxAgeSec = Math.floor(TOKEN_TTL_MS / 1000);
  const secureFlag = IS_PROD ? '; Secure' : '';
  res.append(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${secureFlag}`
  );
  res.append(
    'Set-Cookie',
    `${CSRF_COOKIE_NAME}=${encodeURIComponent(csrfToken)}; Path=/; SameSite=Lax; Max-Age=${maxAgeSec}${secureFlag}`
  );
}

export function clearAuthCookies(res: Response): void {
  const secureFlag = IS_PROD ? '; Secure' : '';
  res.append(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureFlag}`
  );
  res.append(
    'Set-Cookie',
    `${CSRF_COOKIE_NAME}=; Path=/; SameSite=Lax; Max-Age=0${secureFlag}`
  );
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  let token = '';
  let usedCookie = false;

  if (header && header.startsWith('Bearer ')) {
    token = header.slice('Bearer '.length).trim();
  } else {
    const cookies = parseCookies(req.headers.cookie);
    if (cookies[SESSION_COOKIE_NAME]) {
      token = cookies[SESSION_COOKIE_NAME];
      usedCookie = true;
      // Enforce double-submit CSRF verification for state-changing requests authenticated via cookie
      const method = req.method.toUpperCase();
      if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
        const csrfHeader = String(req.headers['x-csrf-token'] ?? '');
        const csrfCookie = cookies[CSRF_COOKIE_NAME] ?? '';
        if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie) {
          res.status(403).json({ error: 'CSRF validation failed.' });
          return;
        }
      }
    }
  }

  if (!token) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }

  const payload = verifySessionToken(token);
  if (!payload) {
    if (usedCookie) clearAuthCookies(res);
    res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
    return;
  }
  req.authUser = payload;
  req.authTokenRaw = token;
  next();
}

export function isUserAdminRole(user: {
  isAdmin?: boolean;
  role?: string;
  email?: string;
}): boolean {
  // Demo user (chambers@vidhios.in) is NEVER treated as an administrator
  if (user.email === 'chambers@vidhios.in') return false;
  return Boolean(
    user.isAdmin ||
      user.role?.toLowerCase() === 'admin' ||
      user.role?.toLowerCase() === 'administrator' ||
      user.email === 'vidhios@admin.com'
  );
}

export function createRateLimiter(options: {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
}) {
  const buckets = new Map<string, { count: number; resetAt: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    if (process.env.DISABLE_RATE_LIMIT === 'true') {
      next();
      return;
    }
    const now = Date.now();
    const ip =
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      'unknown';
    const key = `${options.keyPrefix}:${ip}`;
    const existing = buckets.get(key);

    if (!existing || now > existing.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      if (buckets.size > 5000) {
        for (const [k, v] of buckets.entries()) {
          if (now > v.resetAt) buckets.delete(k);
        }
      }
      next();
      return;
    }

    existing.count += 1;
    if (existing.count > options.maxRequests) {
      const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      res.status(429).json({
        error: `Too many requests. Please retry in ${retryAfterSec}s.`,
      });
      return;
    }
    next();
  };
}
