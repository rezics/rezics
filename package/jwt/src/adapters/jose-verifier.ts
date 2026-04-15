import type { KeyObject } from "node:crypto";
import {
  NormalizedTokenName,
  type NormalizedTokenName as NormalizedTokenNameType,
  normalizedTokenTransportMap,
} from "@rezics/contract";
import {
  createLocalJWKSet,
  createRemoteJWKSet,
  decodeProtectedHeader,
  importSPKI,
  type JWK,
  type JWTPayload,
  type JWTVerifyOptions,
  jwtVerify,
} from "jose";
import type {
  JwtKeySource,
  JwtVerifier,
  JwtVerifyInput,
} from "../contracts/verifier";
import type { JwtJwks } from "../core/jwks";
import { JwtAlgorithm } from "../core/jwt-algorithm";
import { JwtTransportError, JwtVerificationError } from "../core/jwt-errors";
import type { VerifiedJwt } from "../core/verification";

type JwksResolver =
  | ReturnType<typeof createRemoteJWKSet>
  | ReturnType<typeof createLocalJWKSet>;

const remoteJwksCache = new Map<
  string,
  ReturnType<typeof createRemoteJWKSet>
>();
const pemCache = new Map<string, Promise<CryptoKey>>();

function getOrCreateRemoteJwks(
  url: string,
  cooldownDuration = 1_000,
): ReturnType<typeof createRemoteJWKSet> {
  let resolver = remoteJwksCache.get(url);
  if (!resolver) {
    resolver = createRemoteJWKSet(new URL(url), { cooldownDuration });
    remoteJwksCache.set(url, resolver);
  }
  return resolver;
}

async function getOrImportPem(pem: string): Promise<CryptoKey> {
  let key = pemCache.get(pem);
  if (!key) {
    key = importSPKI(pem, JwtAlgorithm.ES256);
    pemCache.set(pem, key);
  }
  return key;
}

function normalizeJwks(value: JwtJwks | { keys: JWK[] }) {
  return { keys: value.keys as JWK[] };
}

function extractRawToken(
  input: string | undefined,
  tokenName: NormalizedTokenNameType,
  enforceTransport: boolean,
): string {
  const transport = normalizedTokenTransportMap[tokenName];

  if (!input) {
    throw new JwtTransportError(
      `Unauthorized: Missing ${transport.headerName} header`,
    );
  }

  if (transport.usesBearer) {
    if (input.startsWith("Bearer ")) return input.slice(7);
    if (enforceTransport) {
      throw new JwtTransportError("Unauthorized: Missing Bearer token");
    }
    return input;
  }

  if (enforceTransport && input.startsWith("Bearer ")) {
    throw new JwtTransportError("Unauthorized: Wrong token transport");
  }

  return input;
}

function assertJwtFormat(token: string): void {
  const parts = token.split(".");
  if (
    parts.length !== 3 ||
    parts.some((part) => part.length === 0) ||
    parts.some((part) => !/^[A-Za-z0-9_-]+$/.test(part))
  ) {
    throw new JwtVerificationError("Unauthorized: Invalid JWT format");
  }
}

async function resolveKeySource(
  options: JwtKeySource,
): Promise<CryptoKey | KeyObject | Uint8Array | JwksResolver> {
  if ("jwksUrl" in options) {
    return getOrCreateRemoteJwks(options.jwksUrl!);
  }
  if ("jwks" in options) {
    return createLocalJWKSet(normalizeJwks(options.jwks!));
  }
  if ("verificationKeyPem" in options) {
    return getOrImportPem(options.verificationKeyPem!);
  }
  return options.verificationKey;
}

async function verifyTokenInput<TPayload extends JWTPayload = JWTPayload>(
  tokenInput: string | undefined,
  options: JwtVerifyInput,
): Promise<VerifiedJwt<TPayload>> {
  const tokenName = options.tokenName ?? NormalizedTokenName.AUTH_SESSION;
  const token = extractRawToken(
    tokenInput,
    tokenName,
    options.enforceTransport ?? true,
  );

  assertJwtFormat(token);

  let header: ReturnType<typeof decodeProtectedHeader>;
  try {
    header = decodeProtectedHeader(token);
  } catch (error) {
    throw new JwtVerificationError("Unauthorized: Invalid JWT format", error);
  }

  if (header.alg !== JwtAlgorithm.ES256) {
    throw new JwtVerificationError("Unauthorized: Invalid token algorithm");
  }
  if ("jwksUrl" in options && !header.kid) {
    throw new JwtVerificationError("Unauthorized: Missing key id");
  }

  const jwtOptions: JWTVerifyOptions = {
    issuer: options.issuer,
    audience: options.audience,
    clockTolerance: options.clockToleranceSeconds ?? 5,
  };

  const key = await resolveKeySource(options);

  let result: Awaited<ReturnType<typeof jwtVerify>>;
  try {
    result = await jwtVerify(
      token,
      key as Parameters<typeof jwtVerify>[1],
      jwtOptions,
    );
  } catch (error) {
    if (
      "jwksUrl" in options &&
      (error as { code?: string } | undefined)?.code ===
        "ERR_JWKS_NO_MATCHING_KEY"
    ) {
      remoteJwksCache.delete(options.jwksUrl!);
      result = await jwtVerify(
        token,
        getOrCreateRemoteJwks(options.jwksUrl!),
        jwtOptions,
      );
    } else {
      throw error;
    }
  }

  if (
    options.requiredScope &&
    !String(result.payload.scope ?? "").includes(options.requiredScope)
  ) {
    throw new JwtVerificationError("Unauthorized: Missing required scope");
  }

  return {
    token,
    payload: result.payload as TPayload,
    protectedHeader: {
      alg: header.alg,
      kid: header.kid,
    },
  };
}

export function createRemoteJwksCache(input: {
  jwksUrl: string;
  cooldownDuration?: number;
}) {
  return getOrCreateRemoteJwks(input.jwksUrl, input.cooldownDuration);
}

export function createJwtVerifier<TPayload extends JWTPayload = JWTPayload>(
  options: JwtVerifyInput,
): JwtVerifier<TPayload> {
  return (tokenInput) => verifyTokenInput<TPayload>(tokenInput, options);
}

export async function verifyBearerToken<
  TPayload extends JWTPayload = JWTPayload,
>(authorization: string | undefined, options: JwtVerifyInput) {
  return verifyTokenInput<TPayload>(authorization, {
    ...options,
    tokenName: options.tokenName ?? NormalizedTokenName.AUTH_SESSION,
  });
}

export async function verifyTokenFromHeader<
  TPayload extends JWTPayload = JWTPayload,
>(tokenInput: string | undefined, options: JwtVerifyInput) {
  return verifyTokenInput<TPayload>(tokenInput, options);
}

export async function verifySessionToken<
  TPayload extends JWTPayload = JWTPayload,
>(tokenHeader: string | undefined, options: JwtVerifyInput) {
  return verifyTokenInput<TPayload>(tokenHeader, {
    ...options,
    tokenName: options.tokenName ?? NormalizedTokenName.AUTH_SESSION,
    requiredScope: undefined,
  });
}
