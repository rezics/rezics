import {createRemoteJWKSet, decodeProtectedHeader, jwtVerify, type JWTPayload, type JWTVerifyOptions} from 'jose';

export type VerifyOptions = {
  issuer: string;
  audience: string | string[];
  jwksUrl: string;
  clockTolerance?: number;
};

export type VerifiedToken = {
  payload: JWTPayload;
  protectedHeader: {
    alg?: string;
    kid?: string;
  };
};

const jwksStore = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

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

function parseBearer(authorization: string | undefined): string {
  if (!authorization) {
    throw new Error('Unauthorized: Missing Authorization header');
  }

  return authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : authorization;
}

export async function verifyBearerToken(
  authorization: string | undefined,
  options: VerifyOptions,
): Promise<VerifiedToken> {
  const token = parseBearer(authorization);
  const protectedHeader = decodeProtectedHeader(token);

  if (protectedHeader.alg !== 'ES256') {
    throw new Error('Unauthorized: Invalid token algorithm');
  }

  if (!protectedHeader.kid) {
    throw new Error('Unauthorized: Missing key id');
  }

  const verifyOptions: JWTVerifyOptions = {
    issuer: options.issuer,
    audience: options.audience,
    clockTolerance: options.clockTolerance ?? 5,
  };

  let verified;
  try {
    verified = await jwtVerify(token, getJwks(options.jwksUrl), verifyOptions);
  } catch (error) {
    const code = (error as {code?: string} | undefined)?.code;
    if (code !== 'ERR_JWKS_NO_MATCHING_KEY') {
      throw error;
    }

    // Unknown kid: force-refresh JWKS and retry once.
    jwksStore.delete(options.jwksUrl);
    verified = await jwtVerify(token, getJwks(options.jwksUrl), verifyOptions);
  }

  if (!verified.payload.scope || !String(verified.payload.scope).includes('user')) {
    throw new Error('Unauthorized: Missing required scope');
  }

  return {
    payload: verified.payload,
    protectedHeader: {
      alg: protectedHeader.alg,
      kid: protectedHeader.kid,
    },
  };
}
