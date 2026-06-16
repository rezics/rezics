/**
 * Books Service - Main exports
 * 图书服务 - 主要导出。
 *
 * This service manages book entities with full CRUD operations,
 * search, filtering, and relationship management.
 * 该服务管理图书实体，提供完整的 CRUD 操作、搜索、筛选和关系管理。
 */

// API endpoints
// API 端点。
export { bookApi } from "./book.api";

// Service layer for internal use
// 供内部使用的服务层。
export { BookService, bookService } from "./book.service";

// Utilities
// 工具函数。
export { mapBaseBookToDTO, mapBookToDTO } from "./mapper";

// Types for internal use
// 供内部使用的类型。
export type { BookWithRelations } from "./types";
export { bookInclude } from "./types";
