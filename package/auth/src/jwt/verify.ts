import {
  createRemoteJWKSet,
  decodeProtectedHeader,
  importSPKI,
  jwtVerify,
  type JWTPayload,
  type JWTVerifyOptions,
} from 'jose';
import {
  NormalizedTokenName,
  normalizedTokenTransportMap,
  type NormalizedTokenName as NormalizedTokenNameType,
} from '@package/contract';
import type {KeyObject} from 'node:crypto';

type JwtKeySource =
  | {jwksUrl: string; verificationKey?: never; verificationKeyPem?: never}
  | {
      jwksUrl?: never;
      verificationKey: CryptoKey | KeyObject | Uint8Array;
      verificationKeyPem?: never;
    }
  | {jwksUrl?: never; verificationKey?: never; verificationKeyPem: string};

export type VerifyOptions = JwtKeySource & {
  issuer: string;
  audience: string | string[];
  tokenName?: NormalizedTokenNameType;
  clockTolerance?: number;
  requiredScope?: string;
  enforceTransport?: boolean;
};

export type VerifiedToken<TPayload extends JWTPayload = JWTPayload> = {
  payload: TPayload;
  protectedHeader: {alg?: string; kid?: string};
  token: string;
};

// ---------------------------------------------------------------------------
// Internal caches
// ---------------------------------------------------------------------------

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
const pemCache = new Map<string, Promise<CryptoKey>>();

function getOrCreateJwks(url: string): ReturnType<typeof createRemoteJWKSet> {
  let resolver = jwksCache.get(url);
  if (!resolver) {
    resolver = createRemoteJWKSet(new URL(url), {cooldownDuration: 1_000});
    jwksCache.set(url, resolver);
  }
  return resolver;
}

function getOrImportPem(pem: string): Promise<CryptoKey> {
  let key = pemCache.get(pem);
  if (!key) {
    key = importSPKI(pem, 'ES256');
    pemCache.set(pem, key);
  }
  return key;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract the raw JWT string from a transport-layer header value.
 * Handles Bearer prefix stripping and transport enforcement based on
 * the token name's registered transport configuration.
 */
function extractRawToken(
  input: string | undefined,
  tokenName: NormalizedTokenNameType,
  enforceTransport: boolean,
): string {
  const transport = normalizedTokenTransportMap[tokenName];

  if (!input) {
    throw new Error(`Unauthorized: Missing ${transport.headerName} header`);
  }

  if (transport.usesBearer) {
    if (input.startsWith('Bearer ')) return input.slice(7);
    if (enforceTransport) throw new Error('Unauthorized: Missing Bearer token');
    return input;
  }

  if (enforceTransport && input.startsWith('Bearer ')) {
    throw new Error('Unauthorized: Wrong token transport');
  }
  return input;
}

/**
 * Resolve the verification key / JWKS function from the provided options.
 */
async function resolveKey(
  options: VerifyOptions,
): Promise<
  CryptoKey | KeyObject | Uint8Array | ReturnType<typeof createRemoteJWKSet>
> {
  if (options.jwksUrl !== undefined) return getOrCreateJwks(options.jwksUrl);
  if (options.verificationKeyPem !== undefined)
    return getOrImportPem(options.verificationKeyPem);
  return options.verificationKey;
}

// ---------------------------------------------------------------------------
// Public API — env-free, usable by any service
// ---------------------------------------------------------------------------

/**
 * Verify a JWT token with full control over verification parameters.
 *
 * This is the foundational verification function. It handles:
 * - Transport-layer extraction (Bearer prefix, custom headers)
 * - Algorithm enforcement (ES256 only)
 * - Key resolution (JWKS URL, PEM, or raw key)
 * - Automatic JWKS cache refresh on key-not-found errors
 * - Optional scope enforcement
 *
 * @param tokenInput - Raw header value (may include "Bearer " prefix)
 * @param options    - Verification parameters (key source, issuer, audience, etc.)
 * @returns Verified token payload, protected header, and raw JWT string
 */
export async function verifyToken<TPayload extends JWTPayload = JWTPayload>(
  tokenInput: string | undefined,
  options: VerifyOptions,
): Promise<VerifiedToken<TPayload>> {
  const tokenName = options.tokenName ?? NormalizedTokenName.AUTH_IDENTITY;
  const token = extractRawToken(
    tokenInput,
    tokenName,
    options.enforceTransport ?? true,
  );

  const header = decodeProtectedHeader(token);
  if (header.alg !== 'ES256') {
    throw new Error('Unauthorized: Invalid token algorithm');
  }
  if (options.jwksUrl !== undefined && !header.kid) {
    throw new Error('Unauthorized: Missing key id');
  }

  const jwtOptions: JWTVerifyOptions = {
    issuer: options.issuer,
    audience: options.audience,
    clockTolerance: options.clockTolerance ?? 5,
  };

  const key = await resolveKey(options);

  let result;
  try {
    result = await jwtVerify(
      token,
      key as Parameters<typeof jwtVerify>[1],
      jwtOptions,
    );
  } catch (error) {
    // On JWKS key-miss, invalidate cache and retry once
    if (
      options.jwksUrl !== undefined &&
      (error as {code?: string} | undefined)?.code ===
        'ERR_JWKS_NO_MATCHING_KEY'
    ) {
      jwksCache.delete(options.jwksUrl);
      result = await jwtVerify(
        token,
        getOrCreateJwks(options.jwksUrl),
        jwtOptions,
      );
    } else {
      throw error;
    }
  }

  if (
    options.requiredScope &&
    !String(result.payload.scope ?? '').includes(options.requiredScope)
  ) {
    throw new Error('Unauthorized: Missing required scope');
  }

  return {
    token,
    payload: result.payload as TPayload,
    protectedHeader: {alg: header.alg, kid: header.kid},
  };
}

/**
 * Verify a Bearer-transported identity token (Authorization header).
 * Defaults tokenName to AUTH_IDENTITY.
 */
export async function verifyBearerToken<
  TPayload extends JWTPayload = JWTPayload,
>(
  authorization: string | undefined,
  options: VerifyOptions,
): Promise<VerifiedToken<TPayload>> {
  return verifyToken<TPayload>(authorization, {
    ...options,
    tokenName: options.tokenName ?? NormalizedTokenName.AUTH_IDENTITY,
  });
}

/**
 * Verify a session token transported via a custom header.
 * Defaults tokenName to REZICS_SESSION and disables scope enforcement.
 */
export async function verifySessionToken<
  TPayload extends JWTPayload = JWTPayload,
>(
  tokenHeader: string | undefined,
  options: VerifyOptions,
): Promise<VerifiedToken<TPayload>> {
  return verifyToken<TPayload>(tokenHeader, {
    ...options,
    tokenName: options.tokenName ?? NormalizedTokenName.REZICS_SESSION,
    requiredScope: undefined,
  });
}
