import type { JwtRotationEngine } from "../rotation/rotation-types";

export function createBetterAuthJwksHandler(engine: JwtRotationEngine) {
  return async function getJwksResponse() {
    return Response.json(await engine.getPublicJwks());
  };
}
