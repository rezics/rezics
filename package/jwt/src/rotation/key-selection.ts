import type { JwtKeyRecord } from "../contracts/persistence";

export function isKeyExpired(key: JwtKeyRecord, now: Date): boolean {
  return key.expiresAt !== null && key.expiresAt.getTime() <= now.getTime();
}

export function isKeyActive(key: JwtKeyRecord, now: Date): boolean {
  return (
    key.activatesAt.getTime() <= now.getTime() &&
    (key.retiresAt === null || key.retiresAt.getTime() > now.getTime()) &&
    !isKeyExpired(key, now)
  );
}

export function selectActiveKey(
  keys: JwtKeyRecord[],
  now: Date,
): JwtKeyRecord | null {
  return (
    [...keys]
      .filter((key) => isKeyActive(key, now))
      .sort(
        (left, right) =>
          right.activatesAt.getTime() - left.activatesAt.getTime(),
      )[0] ?? null
  );
}

export function selectPublishedKeys(
  keys: JwtKeyRecord[],
  now: Date,
): JwtKeyRecord[] {
  return [...keys]
    .filter((key) => !isKeyExpired(key, now))
    .sort(
      (left, right) => right.activatesAt.getTime() - left.activatesAt.getTime(),
    );
}
