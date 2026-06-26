import { getAuthJwtIssuer } from "./options";
import { authJwtPersistence } from "./storage-adapter";

export async function listAuthJwtKeys() {
  return authJwtPersistence.listKeys({ issuer: getAuthJwtIssuer() });
}

export async function getAuthPublicJwks() {
  const keys = await listAuthJwtKeys();
  const now = Date.now();
  const published = keys.filter(
    (key) => key.expiresAt === null || key.expiresAt.getTime() > now,
  );

  return {
    keys: published.map((key) => key.publicJwk),
  };
}
