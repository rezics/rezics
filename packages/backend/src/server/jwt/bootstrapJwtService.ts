import { defaultJwtCryptoProvider } from "@rezics/jwt";
import { count, eq } from "drizzle-orm";
import { Jwks, JwtService } from "../db/schema";

type BootstrapDefaults = {
  issuer: string;
  audience: string;
  jwksUrl: string;
  jwksPath: string;
  isLocalIssuer: boolean;
};

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

export async function bootstrapJwtServiceRecord(
  serviceKey: string,
  defaults: BootstrapDefaults,
): Promise<void> {
  const db = await getServerDb();
  const now = new Date();
  const [createdService] = await db
    .insert(JwtService)
    .values({
      serviceKey,
      issuer: defaults.issuer,
      audience: defaults.audience,
      jwksUrl: defaults.jwksUrl,
      jwksPath: defaults.jwksPath,
      isLocalIssuer: defaults.isLocalIssuer,
      isActive: true,
      updatedAt: now,
    })
    .onConflictDoNothing({ target: JwtService.serviceKey })
    .returning({ id: JwtService.id });

  const service =
    createdService ??
    (
      await db
        .select({ id: JwtService.id })
        .from(JwtService)
        .where(eq(JwtService.serviceKey, serviceKey))
        .limit(1)
    )[0];

  if (!service) {
    throw new Error(`JwtService not found for serviceKey: ${serviceKey}`);
  }

  if (defaults.isLocalIssuer) {
    const [existingKeysRow] = await db
      .select({ total: count() })
      .from(Jwks)
      .where(eq(Jwks.jwtServiceId, service.id));
    const existingKeys = existingKeysRow?.total ?? 0;

    if (existingKeys === 0) {
      const keyPair = await defaultJwtCryptoProvider.generateKey();
      const kid = `jwt-${new Date().toISOString()}`;
      await db.insert(Jwks).values({
        id: kid,
        jwtServiceId: service.id,
        publicJwk: {
          ...keyPair.publicJwk,
          kid,
        },
        privateJwk: {
          ...keyPair.privateJwk,
          kid,
        },
        alg: "ES256",
      });
    }
  }
}
