/**
 * Users Service - Main exports
 * 用户服务 —— 主导出入口
 *
 * This service manages user entities with full CRUD operations,
 * authentication, search, filtering, and JWT token management.
 * 该服务管理用户实体，提供完整的 CRUD 操作、认证、搜索、过滤
 * 以及 JWT 令牌管理。
 */

export { userApi } from "./api/user.api";
export { userBatchApi } from "./api/user-batch.api";
export { userBriefApi } from "./api/user-brief.api";
export { mapUserToDTO, mapUserToPublicProfile } from "./models/mapper";

export type {
  JWTPayload,
  UserFilterOptions,
  UserWithRelations,
} from "./models/types";
export { UserService, userService } from "./service/user.service";
