export const JwtAlgorithm = {
  ES256: 'ES256',
} as const;

export type JwtAlgorithm = (typeof JwtAlgorithm)[keyof typeof JwtAlgorithm];
