import type { ServerRelationsBuilder } from "./types";

export function jwtRelations(r: ServerRelationsBuilder) {
  return {
    Jwks: {
      JwtService: r.one.JwtService({
        from: r.Jwks.jwtServiceId,
        to: r.JwtService.id,
      }),
    },
    JwtService: {
      Jwks: r.many.Jwks(),
    },
  };
}
