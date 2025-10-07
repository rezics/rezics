// Book contracts
export type PublicUser = {
  id: string;
  slug?: string;
  name: string;
  avatar?: string | null;
  description?: string;
};

export type BookDTO = {
  id: string;
  title: string;
  authors?: PublicUser[];
  coverUrl?: string;
  isbn?: string;
  description?: string;
  chaptersIndex?: string;
  extra?: Record<string, unknown> | null;
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
