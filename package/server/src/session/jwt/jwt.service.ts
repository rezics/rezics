import { getJwtService } from "@/jwt";

export async function getMainSessionPublicJwks() {
  const service = await getJwtService("server-local").catch(() => null);
  if (!service) {
    return { keys: [] };
  }
  return {
    keys: service.jwks.map((k) => k.publicJwk),
  };
}
