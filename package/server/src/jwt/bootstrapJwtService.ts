import { defaultJwtCryptoProvider } from "@rezics/jwt";
import { type Prisma, prisma } from "#/prisma/client";

type BootstrapDefaults = {
  issuer: string;
  audience: string;
  jwksUrl: string;
  jwksPath: string;
  isLocalIssuer: boolean;
};

export async function bootstrapJwtServiceRecord(
  serviceKey: string,
  defaults: BootstrapDefaults,
): Promise<void> {
  const service = await prisma.jwtService.upsert({
    where: { serviceKey },
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

  if (defaults.isLocalIssuer) {
    const existingKeys = await prisma.jwks.count({
      where: { jwtServiceId: service.id },
    });

    if (existingKeys === 0) {
      const keyPair = await defaultJwtCryptoProvider.generateKey();
      const kid = `jwt-${new Date().toISOString()}`;
      await prisma.jwks.create({
        data: {
          id: kid,
          jwtServiceId: service.id,
          publicJwk: {
            ...keyPair.publicJwk,
            kid,
          } as unknown as Prisma.InputJsonValue,
          privateJwk: {
            ...keyPair.privateJwk,
            kid,
          } as unknown as Prisma.InputJsonValue,
          alg: "ES256",
        },
      });
    }
  }
}
