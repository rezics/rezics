// Book contracts
export type PublicUser = {
  id: string;
  slug?: string;
  name: string;
  avatar?: string | null;
  description?: string;
};

export type BookDTO = {
  postId: string;
  title: string;
  authors?: PublicUser[];
  coverUrl?: string;
  isbn?: string;
  chaptersIndex?: string;
  extra?: Record<string, unknown> | null;
  userId?: string;
  user?: PublicUser;
  description?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
};

export type CreateBookInput = {
  userId: string;
  title: string;
  authorIds?: string[];
  coverUrl?: string;
  isbn?: string;
  chaptersIndex?: string | null;
  extra?: Record<string, unknown> | null;
};

export type UpdateBookInput = {
  title?: string;
  authorIds?: string[];
  coverUrl?: string;
  isbn?: string;
  chaptersIndex?: string | null;
  extra?: Record<string, unknown> | null;
};

export type BookListResponse = {
  books: BookDTO[];
  total?: number;
};

export type BookResponse = BookDTO;

export type BookSearchParams = {
  q?: string;
  tag?: string;
  tags?: string;
  authorId?: string;
  authorIds?: string;
  userId?: string;
  isbn?: string;
  page?: number;
  limit?: number;
};
