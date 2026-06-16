export const pinboardKeys = {
  all: ["pinboard"] as const,
  realm: (realmId: string, key = "home") =>
    [...pinboardKeys.all, realmId, key] as const,
  list: (realmId: string, key = "home") =>
    [...pinboardKeys.realm(realmId, key), "list"] as const,
  admin: (realmId: string, key = "home") =>
    [...pinboardKeys.realm(realmId, key), "admin"] as const,
};
