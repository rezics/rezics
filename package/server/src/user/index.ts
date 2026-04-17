/**
 * Users Service - Main exports
 *
 * This service manages user entities with full CRUD operations,
 * authentication, search, filtering, and JWT token management.
 */

// API endpoints
export { userApi } from "./api/user.api";
export { userBriefApi } from "./api/user-brief.api";
// Utilities
export { mapUserToDTO, mapUserToPublicProfile } from "./model/mapper";

// Types for internal use
export type {
  JWTPayload,
  UserFilterOptions,
  UserWithRelations,
} from "./model/types";
// Service layer for internal use
export { UserService, userService } from "./service/user.service";

export * from "./util";
