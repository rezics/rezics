// AuthIdentity type + core role helpers (isAdmin / isRoot / isBlocked / BasicAdminPermission)
export * from "./core";
// Legacy exports (still usable for direct role checks)
export * from "./main";

// Resource-specific permission helpers
export * from "./book"; // /books
export * from "./chapter"; // /chapters
export * from "./post"; // /posts (replaces comment + review)
export * from "./shelf"; // /shelves (replaces readlist)
export * from "./tag"; // /tags
export * from "./unit"; // /units
export * from "./user"; // /users

// Deprecated aliases (kept for migration)
export * from "./comment";
