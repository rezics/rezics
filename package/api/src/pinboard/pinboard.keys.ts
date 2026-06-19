export const pinboardKeys = {
  all: ["pinboard"] as const,
  realm: (realmId: string, placement = "home") =>
    [...pinboardKeys.all, realmId, placement] as const,
  list: (realmId: string, placement = "home") =>
    [...pinboardKeys.realm(realmId, placement), "list"] as const,
  admin: (realmId: string, placement = "home") =>
    [...pinboardKeys.realm(realmId, placement), "admin"] as const,
};
