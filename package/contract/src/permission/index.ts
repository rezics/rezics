// Core role helpers (isAdmin / isRoot / isBlocked / BasicAdminPermission)
export * from './core';

// Resource-specific permission helpers, grouped roughly by route prefix
export * from './book'; // /books
export * from './chapter'; // /chapters
export * from './readlist'; // /readlists
export * from './review'; // /reviews
export * from './user'; // /users
export * from './unit'; // /units
export * from './tag'; // /tags
export * from './comment'; // /comments

// Legacy exports (still usable for direct role checks)
export * from './main';
