import { createRemoteJWKSet, jwtVerify } from 'jose';

const AUTH_ERROR = {
  error: 'Authentication required',
  code: 'ERR_AUTH_001',
};

let cachedJwks = null;
let cachedJwksUrl = null;

function getSupabaseUrl() {
  return process.env.SUPABASE_URL?.replace(/\/$/, '') || '';
}

function getIssuer() {
  const configuredIssuer = process.env.SUPABASE_JWT_ISSUER?.replace(/\/$/, '');
  if (configuredIssuer) return configuredIssuer;

  const supabaseUrl = getSupabaseUrl();
  return supabaseUrl ? `${supabaseUrl}/auth/v1` : '';
}

function getJwks() {
  const issuer = getIssuer();
  const jwksUrl = issuer ? `${issuer}/.well-known/jwks.json` : '';

  if (!jwksUrl) return null;
  if (!cachedJwks || cachedJwksUrl !== jwksUrl) {
    cachedJwks = createRemoteJWKSet(new URL(jwksUrl));
    cachedJwksUrl = jwksUrl;
  }
  return cachedJwks;
}

export function getBearerToken(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1]?.trim() || null;
}

export async function verifySupabaseJwt(token) {
  const issuer = getIssuer();
  const jwks = getJwks();

  if (!issuer || !jwks) {
    return {
      ok: false,
      status: 500,
      body: {
        error: 'Authentication service is not configured',
        code: 'ERR_CONFIG_001',
      },
    };
  }

  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer,
      audience: 'authenticated',
    });

    return {
      ok: true,
      user: {
        id: payload.sub,
        email: payload.email || null,
        claims: payload,
        token,
      },
    };
  } catch {
    return {
      ok: false,
      status: 401,
      body: AUTH_ERROR,
    };
  }
}

export async function authenticateRequest(req) {
  const token = getBearerToken(req);
  if (!token) {
    return {
      ok: false,
      status: 401,
      body: AUTH_ERROR,
    };
  }

  return verifySupabaseJwt(token);
}
