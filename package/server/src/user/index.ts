/**
 * Users Service - Main exports
 *
 * This service manages user entities with full CRUD operations,
 * authentication, search, filtering, and JWT token management.
 */

// API endpoints
export {userApi} from './user.api';

// Service layer for internal use
export {userService, UserService} from './user.service';

// Types for internal use
export type {UserWithRelations, UserFilterOptions, JWTPayload} from './types';

// Utilities
export {mapUserToDTO, mapUserToPublicProfile} from './mapper';

export * from './utils';
