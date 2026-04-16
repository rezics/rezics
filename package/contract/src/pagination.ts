import { t } from "elysia";

/** Shared pagination limit: 1–100, defaults to 20. */
export const paginationLimitSchema = t.Optional(
  t.Number({ minimum: 1, maximum: 100, default: 20 }),
);

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
