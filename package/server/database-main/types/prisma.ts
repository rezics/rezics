// Handwritten lightweight types mirroring Prisma models/enums without advanced generics.
// Use these types in Encore endpoints to avoid unsupported advanced types.

// Enums
export enum PostType {
  BOOK = 'BOOK',
  COMMENT = 'COMMENT',
  NOTE = 'NOTE',
  REVIEW = 'REVIEW',
  QUOTE = 'QUOTE',
  READLIST = 'READLIST',
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  CHAPTER = 'CHAPTER',
}

export enum PostStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  DELETED = 'DELETED',
  FROZEN = 'FROZEN',
}

export enum UserType {
  USER = 'USER',
  AUTHOR = 'AUTHOR',
}

// Core models
export interface User {
  id: string;
  email: string;
  slug: string;
  passwordHash: string;
  type: UserType;
  name: string;
  avatar: string | null;
  bio: string | null;
  joinDate: Date | null;
  // Relations (optional for convenience)
  posts?: Post[];
  books?: Book[];
  domainPosts?: Post[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Post {
  id: string;
  userId: string;
  user?: User; // relation
  domains?: User[]; // relation
  type: PostType;
  status: PostStatus;
  title: string | null;
  content: string | null;
  metadata: unknown; // JSON
  targetPostId: string | null;
  targetPost?: Post | null; // self relation
  targetedBy?: Post[]; // reverse relation
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  // Book/Tag/Stats/Reactions relations
  book?: Book | null;
  tag?: Tag | null;
  tags?: Tag[];
  stats?: PostStats | null;
  reactions?: PostReactions | null;
  // CommentIndex relations
  commentIndex?: CommentIndex | null;
  commentRoots?: CommentIndex[];
  childCommentIndexes?: CommentIndex[];
}

export interface Book {
  postId: string;
  post?: Post; // relation
  title: string;
  authors?: User[]; // relation
  coverUrl: string | null;
  isbn: string | null;
  chaptersIndex: string | null;
  extra: unknown | null; // JSON
  createdAt: Date;
  updatedAt: Date;
}

export interface CommentIndex {
  postId: string;
  post?: Post; // relation
  rootPostId: string;
  rootPost?: Post; // relation
  parentCommentId: string | null;
  parentComment?: Post | null; // relation
  depth: number;
}

export interface PostStats {
  postId: string;
  post?: Post; // relation
  commentCount: number;
  viewCount: number;
  updatedAt: Date;
}

export interface PostReactions {
  postId: string;
  post?: Post; // relation
  likeCount: number;
  dislikeCount: number;
  loveCount: number;
  updatedAt: Date;
}

export interface Rating {
  postId: string;
  userId: string;
  totalScore: number;
  totalCount: number;
  updatedAt: Date;
}

export interface Tag {
  postId: string;
  post?: Post; // relation
  name: string;
  type: string | null; // e.g. general / genre / author / system
  posts?: Post[]; // relation
  createdAt: Date;
  updatedAt: Date;
}

// Minimal Prisma-like surface (flat exports; avoid namespaces per lint rule)
export type JsonValue = unknown;
export type JsonObject = Record<string, unknown>;
export type JsonArray = unknown[];
export type InputJsonValue = unknown;

// Common where inputs used around the codebase
export type BookWhereInput = Record<string, unknown>;
export type PostWhereInput = Record<string, unknown>;
export type UserWhereInput = Record<string, unknown>;
export type TagWhereInput = Record<string, unknown>;
export type CommentIndexWhereInput = Record<string, unknown>;
export type PostStatsWhereInput = Record<string, unknown>;
export type PostReactionsWhereInput = Record<string, unknown>;
export type RatingWhereInput = Record<string, unknown>;

export type SortOrder = 'asc' | 'desc';
