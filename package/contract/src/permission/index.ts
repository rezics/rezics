// Core role helpers (isAdmin / isRoot / isBlocked / BasicAdminPermission)

// Resource-specific permission helpers, grouped roughly by route prefix
export * from "./book"; // /books
export * from "./chapter"; // /chapters
export * from "./comment"; // /comments
export * from "./core";
// Legacy exports (still usable for direct role checks)
export * from "./main";
export * from "./readlist"; // /readlists
export * from "./review"; // /reviews
export * from "./tag"; // /tags
export * from "./unit"; // /units
export * from "./user"; // /users
