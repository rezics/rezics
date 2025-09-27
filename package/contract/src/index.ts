// Base pagination contracts
export type OffsetPaginationParams = {
  offset?: number;
  limit?: number;
};

export type OffsetPaginated<TItem> = {
  items: TItem[];
  offset: number;
  totalItems?: number;
};

export type CursorPaginationParams = {
  cursor?: string;
  limit?: number;
};

export type CursorPaginated<TItem> = {
  items: TItem[];
  cursor?: string;
  hasMore: boolean;
};

// Book contracts
export type PublicUser = {
  id: string;
  slug?: string;
  name: string;
  avatar?: string | null;
  description?: string;
};

export type BookDTO = {
  id: string; // postId or bookId string as exposed to clients
  title: string;
  authors?: PublicUser[];
  coverUrl?: string;
  isbn?: string;
  description?: string;
  chaptersIndex?: string;
  extra?: Record<string, unknown> | null | undefined;
  userId?: string;
  user?: PublicUser;
  createdAt?: string | Date;
  updatedAt?: string | Date;
};

export type CreateBookInput = {
  userId?: string;
  title: string;
  authorIds?: string[];
  coverUrl?: string;
  isbn?: string;
  chaptersIndex?: string | null;
  extra?: Record<string, unknown> | null;
};

export type UpdateBookInput = Partial<CreateBookInput>;

// Server response contracts for Books
export type BookResponse = {
  postId: string;
  title: string;
  authors: PublicUser[];
  coverUrl?: string;
  isbn?: string;
  chaptersIndex?: string;
  extra?: unknown;
  userId: string;
  user?: PublicUser;
  createdAt: string | Date;
  updatedAt: string | Date;
};

export type BookListResponse = {
  books: BookResponse[];
};

// Chapter contracts
export type ChapterListDTO = {
  order: number[] | number[][];
  chapters: { id: number; title: string; noContent: boolean }[];
};

export type ChapterDetailDTO = {
  id: number;
  title: string;
  content?: string;
};

export type CreateChapterInput = {
  bookId: string;
  title: string;
  content?: string;
  parentId?: number | null;
};

export type UpdateChapterInput = Partial<Omit<CreateChapterInput, 'bookId'>>;

// Comment contracts
export type CommentDTO = {
  id: string;
  rootPostId: string;
  parentCommentId?: string | null;
  depth: number;
  content?: string | null;
  created_at?: string;
  user?: { id: string; name: string; avatar?: string };
};

