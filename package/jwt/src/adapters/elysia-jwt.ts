import type { JwtKeyRecord } from "../contracts/persistence";

export function createElysiaJwtConfig(input: {
  name?: string;
  issuer: string;
  audience: string | string[];
  ttlSeconds: number;
  key: JwtKeyRecord;
}) {
  return {
    name: input.name ?? "jwt",
    secret: input.key.privateJwk,
    alg: input.key.algorithm,
    iss: input.issuer,
    aud: input.audience,
    exp: `${input.ttlSeconds}s`,
  } as const;
}
