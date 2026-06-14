// Drizzle Kit reads this thin server-only schema entry; public consumers use
// index.ts, which also exposes relations, aliases, and row helper types.
// Drizzle Kit 读取这个精简的、仅服务端使用的 schema 入口；公共消费方使用
// index.ts，它还额外暴露关系、别名以及行的辅助类型。

export * from "./alias";
export * from "./attribution";
export * from "./book";
export * from "./progress";
export * from "./columns";
export * from "./comment";
export * from "./content-structure";
export * from "./custom-types";
export * from "./engagement";
export * from "./entity";
export * from "./game";
export * from "./governance";
export * from "./identity";
export * from "./jwt";
export * from "./link";
export * from "./media";
export * from "./misc";
export * from "./moderation";
export * from "./poll";
export * from "./post";
export * from "./realm";
export * from "./score";
export * from "./series";
export * from "./shelf";
export * from "./tagging";
export * from "./translation";
export * from "./unit";
export * from "./user";
export * from "./zone";
