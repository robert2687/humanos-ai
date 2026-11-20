import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';

export type ClientSurface = 'web' | 'ios' | 'android' | 'desktop' | 'extension' | 'watch';

export interface GatewaySessionPayload {
  sid: string;
  surface: ClientSurface;
  role: 'member';
  iat: number;
  exp: number;
}

export interface SessionRecord {
  sid: string;
  surface: ClientSurface;
  createdAt: string;
  lastSeenAt: string;
  requestCount: number;
  revoked: boolean;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  sessionHash: string;
  surface: ClientSurface;
  endpoint: string;
  routedAgent: string;
  safetyStatus: 'nominal' | 'elevated-distress' | 'crisis-override';
  httpStatus: number;
  latencyMs: number;
}

export interface GatewayRequest extends Request {
  humanosSession?: GatewaySessionPayload;
  rateLimitInfo?: {
    limit: number;
    remaining: number;
    resetAt: number;
  };
}

const VALID_SURFACES: readonly ClientSurface[] = [
  'web',
  'ios',
  'android',
  'desktop',
  'extension',
  'watch',
];

const SIGNING_SECRET =
  process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours
const AI_RATE_WINDOW_MS = 1000 * 60 * 5; // 5 minutes
const AI_RATE_MAX_REQUESTS = 40;

const activeSessions = new Map<string, SessionRecord>();
const rateBuckets = new Map<string, number[]>();
const auditLog: AuditLogEntry[] = [];

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(padded, 'base64').toString('utf8');
}

function signPayload(encodedPayload: string): string {
  return base64UrlEncode(
    crypto.createHmac('sha256', SIGNING_SECRET).update(encodedPayload).digest()
  );
}

export function hashSessionId(sid: string): string {
  return crypto.createHash('sha256').update(sid).digest('hex').slice(0, 12);
}

export function normalizeSurface(raw: unknown): ClientSurface {
  if (typeof raw === 'string' && VALID_SURFACES.includes(raw as ClientSurface)) {
    return raw as ClientSurface;
  }
  return 'web';
}

export function issueSessionToken(surface: ClientSurface = 'web'): {
  token: string;
  session: GatewaySessionPayload;
  record: SessionRecord;
} {
  const now = Date.now();
  const sid = `hs_${crypto.randomBytes(12).toString('hex')}`;
  const payload: GatewaySessionPayload = {
    sid,
    surface,
    role: 'member',
    iat: now,
    exp: now + SESSION_TTL_MS,
  };

  const encoded = base64UrlEncode(JSON.stringify(payload));
  const signature = signPayload(encoded);
  const token = `${encoded}.${signature}`;

  const record: SessionRecord = {
    sid,
    surface,
    createdAt: new Date(now).toISOString(),
    lastSeenAt: new Date(now).toISOString(),
    requestCount: 0,
    revoked: false,
  };
  activeSessions.set(sid, record);

  return { token, session: payload, record };
}

export function verifySessionToken(token: string): GatewaySessionPayload | null {
  if (!token || !token.includes('.')) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [encoded, signature] = parts;
  const expectedSig = signPayload(encoded);

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(base64UrlDecode(encoded)) as GatewaySessionPayload;
    if (!parsed.sid || !parsed.exp || Date.now() > parsed.exp) {
      return null;
    }
    const existing = activeSessions.get(parsed.sid);
    if (existing && existing.revoked) {
      return null;
    }
    if (!existing) {
      // Rehydrate session record cleanly across server restarts if HMAC signature is valid
      activeSessions.set(parsed.sid, {
        sid: parsed.sid,
        surface: normalizeSurface(parsed.surface),
        createdAt: new Date(parsed.iat).toISOString(),
        lastSeenAt: new Date().toISOString(),
        requestCount: 0,
        revoked: false,
      });
    }
    return parsed;
  } catch {
    return null;
  }
}

export function revokeSession(sid: string): void {
  const existing = activeSessions.get(sid);
  if (existing) {
    existing.revoked = true;
  }
}

export function getSessionRecord(sid: string): SessionRecord | null {
  return activeSessions.get(sid) ?? null;
}

export function extractBearerToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    return auth.slice(7).trim();
  }
  const alt = req.headers['x-humanos-session'];
  if (typeof alt === 'string' && alt.trim()) {
    return alt.trim();
  }
  return null;
}

export function requireGatewaySession(
  req: GatewayRequest,
  res: Response,
  next: NextFunction
) {
  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json({
      error: 'Missing gateway session token. Initialize a session via POST /api/gateway/session.',
    });
  }

  const verified = verifySessionToken(token);
  if (!verified) {
    return res.status(401).json({
      error: 'Gateway session token is invalid or expired. Please refresh your session.',
    });
  }

  const record = activeSessions.get(verified.sid);
  if (record) {
    record.lastSeenAt = new Date().toISOString();
    record.requestCount += 1;
  }

  req.humanosSession = verified;
  next();
}

export function checkRateLimit(key: string): {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
} {
  const now = Date.now();
  const cutoff = now - AI_RATE_WINDOW_MS;
  const timestamps = (rateBuckets.get(key) || []).filter((t) => t > cutoff);

  if (timestamps.length >= AI_RATE_MAX_REQUESTS) {
    const oldest = timestamps[0];
    const resetAt = oldest + AI_RATE_WINDOW_MS;
    const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - now) / 1000));
    rateBuckets.set(key, timestamps);
    return {
      allowed: false,
      limit: AI_RATE_MAX_REQUESTS,
      remaining: 0,
      resetAt,
      retryAfterSeconds,
    };
  }

  timestamps.push(now);
  rateBuckets.set(key, timestamps);
  const resetAt = (timestamps[0] || now) + AI_RATE_WINDOW_MS;
  return {
    allowed: true,
    limit: AI_RATE_MAX_REQUESTS,
    remaining: Math.max(0, AI_RATE_MAX_REQUESTS - timestamps.length),
    resetAt,
    retryAfterSeconds: 0,
  };
}

export function inspectRateLimit(key: string): {
  limit: number;
  remaining: number;
  resetAt: number;
} {
  const now = Date.now();
  const cutoff = now - AI_RATE_WINDOW_MS;
  const timestamps = (rateBuckets.get(key) || []).filter((t) => t > cutoff);
  const resetAt = (timestamps[0] || now) + AI_RATE_WINDOW_MS;
  return {
    limit: AI_RATE_MAX_REQUESTS,
    remaining: Math.max(0, AI_RATE_MAX_REQUESTS - timestamps.length),
    resetAt,
  };
}

export function rateLimitAI(
  req: GatewayRequest,
  res: Response,
  next: NextFunction
) {
  const key = req.humanosSession?.sid || req.ip || 'anonymous';
  const result = checkRateLimit(key);

  res.setHeader('X-RateLimit-Limit', String(result.limit));
  res.setHeader('X-RateLimit-Remaining', String(result.remaining));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)));

  req.rateLimitInfo = {
    limit: result.limit,
    remaining: result.remaining,
    resetAt: result.resetAt,
  };

  if (!result.allowed) {
    res.setHeader('Retry-After', String(result.retryAfterSeconds));
    return res.status(429).json({
      error: `Gateway rate limit reached (${result.limit} requests per 5 minutes). Please retry in ${result.retryAfterSeconds}s.`,
    });
  }

  next();
}

export function recordAudit(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): void {
  auditLog.unshift({
    ...entry,
    id: `aud_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    timestamp: new Date().toISOString(),
  });
  if (auditLog.length > 100) {
    auditLog.length = 100;
  }
}

export function getAuditLogsForSession(sid: string): AuditLogEntry[] {
  const targetHash = hashSessionId(sid);
  return auditLog.filter((item) => item.sessionHash === targetHash).slice(0, 40);
}

export function clearAuditLogsForSession(sid: string): void {
  const targetHash = hashSessionId(sid);
  for (let i = auditLog.length - 1; i >= 0; i--) {
    if (auditLog[i].sessionHash === targetHash) {
      auditLog.splice(i, 1);
    }
  }
}
