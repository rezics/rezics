/**
 * Post-related TypeScript types and interfaces for the frontend
 * 前端的 post 相关 TypeScript 类型与接口。
 *
 * Posts are top-level discussion entities. Reply-tree reads and writes belong
 * to the comment domain.
 * Post 是顶层讨论实体。回复树的读写归属于 comment 域。
 */

import type {
  CreatePostInput,
  PostDTO,
  PostListQuery,
  PostListResponse,
  PostResponse,
  UpdatePostInput,
} from "@rezics/contract";

export type {
  CreatePostInput,
  PostDTO,
  PostListQuery,
  PostListResponse,
  PostResponse,
  UpdatePostInput,
};

export type CreateRootPostInput = CreatePostInput;

/**
 * Extended frontend types
 * 前端扩展类型。
 */
export type PostFormData = CreateRootPostInput;

export type PostFilters = Omit<Partial<PostListQuery>, "languages"> & {
  languages?: string | readonly string[];
};

export type PostSortOption = "createdAt" | "updatedAt" | "lastReplyAt";

export type PostView = "thread" | "flat";
