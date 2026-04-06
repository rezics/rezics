import type { JwtKeyRecord } from "../contracts/persistence";
import type { JwtJwks } from "../core/jwks";

export type JwtClock = {
  now(): Date;
};

export type RotationSchedule = {
  checkedAt: Date;
  nextCheckAt: Date;
  nextRotationAt: Date | null;
  isRotationDue: boolean;
};

export type JwtRotationEngine = {
  ensureActiveKey(): Promise<JwtKeyRecord>;
  rotateIfDue(): Promise<JwtKeyRecord>;
  getActiveSigningKey(): Promise<JwtKeyRecord>;
  getPublicJwks(): Promise<JwtJwks>;
  getSchedule(): Promise<RotationSchedule>;
};
