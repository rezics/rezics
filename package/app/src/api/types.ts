export type OffsetPaginationParams = {
  offset?: number;
  limit?: number;
};

export type OffsetPaginated<TItem> = {
  items: TItem[];
  offset: number;
  totalItems?: number;
};

export type Identifier = string | number;

export type CursorPaginationParams = {
  cursor?: string;
  limit?: number;
};

export type CursorPaginated<TItem> = {
  items: TItem[];
  cursor?: string;
  hasMore: boolean;
};
