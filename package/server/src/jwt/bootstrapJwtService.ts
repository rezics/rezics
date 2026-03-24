import {prisma, Prisma} from '@/prisma/client';
import {
  asJwtPrivateJwk,
  asJwtPublicJwk,
  type JwtPrivateJwk,
  type JwtPublicJwk,
} from '@package/jwt';
import {env} from '@/env';

type BootstrapDefaults = {
  issuer: string;
  audience: string;
  jwksUrl: string;
  jwksPath: string;
  isLocalIssuer: boolean;
};

type SeededKeyPair = {
  privateJwk: JwtPrivateJwk;
  publicJwk: JwtPublicJwk;
};

function parseSeededJwk<TJwk extends JwtPublicJwk | JwtPrivateJwk>(
  value: string | undefined,
): TJwk | null {
  if (!value) return null;
  return JSON.parse(value) as TJwk;
}

function getSeededKeyPair(): SeededKeyPair | null {
  const privateJwk = parseSeededJwk<JwtPrivateJwk>(
    env.MAIN_SESSION_JWT_PRIVATE_JWK,
  );
  const publicJwk = parseSeededJwk<JwtPublicJwk>(
    env.MAIN_SESSION_JWT_PUBLIC_JWK,
  );

  if (!privateJwk || !publicJwk) return null;

  return {
    privateJwk: asJwtPrivateJwk(privateJwk),
    publicJwk: asJwtPublicJwk(publicJwk),
  };
}

export async function bootstrapJwtServiceRecord(
  serviceKey: string,
  defaults: BootstrapDefaults,
): Promise<void> {
  const service = await prisma.jwtService.upsert({
    where: {serviceKey},
    update: {},
    create: {
      serviceKey,
      issuer: defaults.issuer,
      audience: defaults.audience,
      jwksUrl: defaults.jwksUrl,
      jwksPath: defaults.jwksPath,
      isLocalIssuer: defaults.isLocalIssuer,
      isActive: true,
    },
  });

  if (serviceKey === 'server-local') {
    const seeded = getSeededKeyPair();
    if (seeded) {
      const existingKeys = await prisma.jwks.count({
        where: {jwtServiceId: service.id},
      });

      if (existingKeys === 0) {
        const kid = `jwt-${new Date().toISOString()}`;
        await prisma.jwks.create({
          data: {
            id: kid,
            jwtServiceId: service.id,
            publicJwk: {
              ...seeded.publicJwk,
              kid,
            } as unknown as Prisma.InputJsonValue,
            privateJwk: {
              ...seeded.privateJwk,
              kid,
            } as unknown as Prisma.InputJsonValue,
            alg: 'ES256',
          },
        });
      }
    }
  }
}
