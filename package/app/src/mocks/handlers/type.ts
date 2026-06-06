export type OffsetPaginationParams = {
  offset?: number;
  limit?: number;
};

export type OffsetPaginated<TItem> = {
  items: TItem[];
  offset: number;
  totalItems?: number;
};
