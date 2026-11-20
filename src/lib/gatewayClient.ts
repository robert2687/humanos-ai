export type ClientSurface = 'web' | 'ios' | 'android' | 'desktop' | 'extension' | 'watch';

export interface GatewaySessionInfo {
  idHash: string;
  surface: ClientSurface;
  expiresAt: string;
  requestCount: number;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetAt: number;
}

export interface AuditEntry {
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

const TOKEN_STORAGE_KEY = 'humanos_gateway_token_v1';

let memoryToken: string | null = null;
let pendingSessionPromise: Promise<string> | null = null;

function readStoredToken(): string | null {
  if (memoryToken) return memoryToken;
  try {
    const stored = sessionStorage.getItem(TOKEN_STORAGE_KEY);
    if (stored) {
      memoryToken = stored;
      return stored;
    }
  } catch {
    // Ignore storage unavailability
  }
  return null;
}

function writeStoredToken(token: string | null): void {
  memoryToken = token;
  try {
    if (token) {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage unavailability
  }
}

export async function issueNewGatewaySession(surface: ClientSurface = 'web'): Promise<{
  token: string;
  session: GatewaySessionInfo;
  rateLimit: RateLimitInfo;
}> {
  const res = await fetch('/api/gateway/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ surface }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to initialize gateway session.');
  }
  writeStoredToken(data.token);
  return data;
}

export async function ensureGatewayToken(surface: ClientSurface = 'web'): Promise<string> {
  const existing = readStoredToken();
  if (existing) return existing;

  if (!pendingSessionPromise) {
    pendingSessionPromise = issueNewGatewaySession(surface)
      .then((res) => res.token)
      .finally(() => {
        pendingSessionPromise = null;
      });
  }
  return pendingSessionPromise;
}

export async function gatewayFetch(
  input: string,
  init: RequestInit = {},
  surface: ClientSurface = 'web'
): Promise<Response> {
  let token = await ensureGatewayToken(surface);

  const buildHeaders = (t: string): HeadersInit => ({
    'Content-Type': 'application/json',
    ...(init.headers || {}),
    Authorization: `Bearer ${t}`,
  });

  let response = await fetch(input, {
    ...init,
    headers: buildHeaders(token),
  });

  if (response.status === 401) {
    writeStoredToken(null);
    token = await ensureGatewayToken(surface);
    response = await fetch(input, {
      ...init,
      headers: buildHeaders(token),
    });
  }

  return response;
}
