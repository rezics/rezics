export type OffsetPaginated<TItem> = {
  items: TItem[];
  offset: number;
  totalItems?: number;
};
