export const realmExtraKeys = {
  all: () => ["realm-extra"] as const,
  list: (realmId: string, key: string) =>
    [...realmExtraKeys.all(), realmId, key] as const,
  admin: (realmId: string, key: string) =>
    [...realmExtraKeys.all(), realmId, key, "admin"] as const,
} as const;
