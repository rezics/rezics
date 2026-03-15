import {
  createRemoteJWKSet,
  decodeProtectedHeader,
  importSPKI,
  jwtVerify,
  type JWTPayload,
  type JWTVerifyOptions,
} from 'jose';
import {
  type AuthIdentityTokenClaims,
  NormalizedTokenName,
  normalizedTokenTransportMap,
  type NormalizedTokenName as NormalizedTokenNameType,
} from '@package/contract';
import {env} from '@/env';
import type {KeyObject} from 'node:crypto';

type JwtKeySource =
  | {
      jwksUrl: string;
      verificationKey?: never;
      verificationKeyPem?: never;
    }
  | {
      jwksUrl?: never;
      verificationKey: CryptoKey | KeyObject | Uint8Array;
      verificationKeyPem?: never;
    }
  | {
      jwksUrl?: never;
      verificationKey?: never;
      verificationKeyPem: string;
    };

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
  protectedHeader: {
    alg?: string;
    kid?: string;
  };
  token: string;
};

const jwksStore = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
const pemStore = new Map<string, Promise<CryptoKey>>();

function getJwks(jwksUrl: string): ReturnType<typeof createRemoteJWKSet> {
  if (!jwksStore.has(jwksUrl)) {
    jwksStore.set(
      jwksUrl,
      createRemoteJWKSet(new URL(jwksUrl), {
        cooldownDuration: 1_000,
      }),
    );
  }

  return jwksStore.get(jwksUrl)!;
}

function getPemVerificationKey(verificationKeyPem: string): Promise<CryptoKey> {
  if (!pemStore.has(verificationKeyPem)) {
    pemStore.set(verificationKeyPem, importSPKI(verificationKeyPem, 'ES256'));
  }

  return pemStore.get(verificationKeyPem)!;
}

function parseTransportToken(
  input: string | undefined,
  tokenName: NormalizedTokenNameType,
  enforceTransport = true,
): string {
  if (!input) {
    const headerName = normalizedTokenTransportMap[tokenName].headerName;
    throw new Error(`Unauthorized: Missing ${headerName} header`);
  }

  const transport = normalizedTokenTransportMap[tokenName];
  if (transport.usesBearer) {
    if (input.startsWith('Bearer ')) {
      return input.slice('Bearer '.length);
    }
    if (enforceTransport) {
      throw new Error('Unauthorized: Missing Bearer token');
    }
    return input;
  }

  if (enforceTransport && input.startsWith('Bearer ')) {
    throw new Error('Unauthorized: Wrong token transport');
  }

  return input;
}

async function resolveVerificationKey(options: VerifyOptions) {
  if ('jwksUrl' in options && typeof options.jwksUrl === 'string') {
    return getJwks(options.jwksUrl);
  }
  if (
    'verificationKeyPem' in options &&
    typeof options.verificationKeyPem === 'string'
  ) {
    return getPemVerificationKey(options.verificationKeyPem);
  }
  return options.verificationKey;
}

function shouldRequireKid(options: VerifyOptions): boolean {
  return 'jwksUrl' in options && typeof options.jwksUrl === 'string';
}

function defaultVerifyOptions(
  overrides?: Partial<VerifyOptions>,
): VerifyOptions {
  const issuer =
    overrides?.issuer ?? env.AUTH_JWT_ISSUER ?? env.BETTER_AUTH_URL;
  const audience = overrides?.audience ?? env.AUTH_JWT_AUDIENCE ?? 'rezics-api';
  const jwksUrl =
    typeof overrides?.jwksUrl === 'string'
      ? overrides.jwksUrl
      : new URL('/api/auth/jwks', issuer).toString();

  if (!jwksUrl) {
    throw new Error('Unauthorized: Missing JWKS configuration');
  }

  return {
    issuer,
    audience,
    jwksUrl,
    tokenName: overrides?.tokenName ?? NormalizedTokenName.AUTH_IDENTITY,
    clockTolerance: overrides?.clockTolerance ?? 5,
    requiredScope: overrides?.requiredScope ?? 'user',
    enforceTransport: overrides?.enforceTransport ?? true,
  };
}

export async function verifyToken<TPayload extends JWTPayload = JWTPayload>(
  tokenInput: string | undefined,
  options: VerifyOptions,
): Promise<VerifiedToken<TPayload>> {
  const tokenName = options.tokenName ?? NormalizedTokenName.AUTH_IDENTITY;
  const token = parseTransportToken(
    tokenInput,
    tokenName,
    options.enforceTransport ?? true,
  );
  const protectedHeader = decodeProtectedHeader(token);

  if (protectedHeader.alg !== 'ES256') {
    throw new Error('Unauthorized: Invalid token algorithm');
  }

  if (shouldRequireKid(options) && !protectedHeader.kid) {
    throw new Error('Unauthorized: Missing key id');
  }

  const verifyOptions: JWTVerifyOptions = {
    issuer: options.issuer,
    audience: options.audience,
    clockTolerance: options.clockTolerance ?? 5,
  };

  const verificationKey = await resolveVerificationKey(options);

  // TODO 优化这里的代码
  let verified;
  try {
    if (typeof verificationKey === 'function') {
      // JWKS resolver
      verified = await jwtVerify(token, verificationKey, verifyOptions);
    } else {
      // static key
      verified = await jwtVerify(token, verificationKey, verifyOptions);
    }
  } catch (error) {
    const code = (error as {code?: string} | undefined)?.code;
    if (
      !('jwksUrl' in options) ||
      typeof options.jwksUrl !== 'string' ||
      code !== 'ERR_JWKS_NO_MATCHING_KEY'
    ) {
      throw error;
    }

    jwksStore.delete(options.jwksUrl);
    verified = await jwtVerify(token, getJwks(options.jwksUrl), verifyOptions);
  }

  if (
    options.requiredScope &&
    (!verified.payload.scope ||
      !String(verified.payload.scope).includes(options.requiredScope))
  ) {
    throw new Error('Unauthorized: Missing required scope');
  }

  return {
    token,
    payload: verified.payload as TPayload,
    protectedHeader: {
      alg: protectedHeader.alg,
      kid: protectedHeader.kid,
    },
  };
}

export async function verifyAuthIdentityToken<
  TPayload extends JWTPayload = AuthIdentityTokenClaims & JWTPayload,
>(
  authorization: string | undefined,
  options?: Partial<VerifyOptions>,
): Promise<VerifiedToken<TPayload>> {
  return verifyToken<TPayload>(authorization, defaultVerifyOptions(options));
}

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

export async function verifyBearerToken<
  TPayload extends JWTPayload = AuthIdentityTokenClaims & JWTPayload,
>(
  authorization: string | undefined,
  options: VerifyOptions,
): Promise<VerifiedToken<TPayload>> {
  return verifyToken<TPayload>(authorization, {
    ...options,
    tokenName: options.tokenName ?? NormalizedTokenName.AUTH_IDENTITY,
  });
}

function isVerifyOptions(value: unknown): value is Partial<VerifyOptions> {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    'issuer' in record ||
    'audience' in record ||
    'jwksUrl' in record ||
    'verificationKey' in record ||
    'verificationKeyPem' in record ||
    'tokenName' in record
  );
}

function isSetLike(value: unknown): value is {status?: number} {
  return Boolean(
    value &&
    typeof value === 'object' &&
    'status' in (value as Record<string, unknown>),
  );
}

export async function verifyAuth<
  TPayload extends JWTPayload = AuthIdentityTokenClaims & JWTPayload,
>(
  authorization: string | undefined,
  jwtOrSetOrOptions?: unknown,
  setOrOptions?: unknown,
  maybeOptions?: Partial<VerifyOptions>,
): Promise<TPayload> {
  let set: {status?: number} | undefined;
  let explicitOptions: Partial<VerifyOptions> | undefined;

  if (isVerifyOptions(jwtOrSetOrOptions)) {
    explicitOptions = jwtOrSetOrOptions;
  } else if (isSetLike(jwtOrSetOrOptions)) {
    set = jwtOrSetOrOptions;
  }

  if (isSetLike(setOrOptions)) {
    set = setOrOptions;
  } else if (isVerifyOptions(setOrOptions)) {
    explicitOptions = setOrOptions;
  }

  if (maybeOptions) {
    explicitOptions = maybeOptions;
  }

  try {
    const verified = await verifyAuthIdentityToken<TPayload>(
      authorization,
      explicitOptions,
    );
    return verified.payload;
  } catch (error) {
    if (set) {
      set.status = 401;
    }
    throw error;
  }
}
