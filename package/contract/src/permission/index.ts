// Permission type + core role helpers (isAdmin / isRoot / isBlocked / BasicAdminPermission)
// 权限类型 + 核心角色辅助函数（isAdmin / isRoot / isBlocked / BasicAdminPermission）

// Resource-specific permission helpers
// 针对具体资源的权限辅助函数
export * from "./action";
export * from "./book"; // /books
export * from "./capability";
export * from "./chapter"; // /chapters
export * from "./core";
export * from "./decision";
export * from "./main";
export * from "./policy";
export * from "./post"; // /posts (replaces comment + review) — /posts（取代 comment + review）
export * from "./realm-role";
export * from "./shelf"; // /shelves (replaces readlist) — /shelves（取代 readlist）
export * from "./tag"; // /tags
export * from "./unit"; // /units
export * from "./user"; // /users
