import { bookInfo01 } from "../../data/bookinfo01.ts";
import { bookList01 } from "../../data/bookList01.ts";
import type { OffsetPaginated } from "../type";

import { pickRandomAllowRepeat } from "../utils";

export type Id = string;

export type BookListItem = {
  id: Id;
  title: string;
  coverUrl?: string;
};

export function listBooks(opts: {
  offset?: number;
  limit?: number;
}): OffsetPaginated<BookListItem> {
  const { offset = 0, limit = 10 } = opts ?? {};
  const items = pickRandomAllowRepeat(bookList01, limit).map((b: any) => ({
    id: String((b as any).id),
    title: String((b as any).title ?? ""),
    coverUrl: (b as any).coverUrl ?? (b as any).cover ?? undefined,
  }));
  // return paginateOffset(items, offset, limit);
  const totalItems = 100000;
  return { items, offset, totalItems: totalItems };
}

export function getBookById(id: Id) {
  return { ...(bookInfo01 as any), id: String(id) } as any;
}

export function createBook(payload: {
  title: string;
  coverUrl?: string;
  isbn?: string;
}) {
  const created = {
    id: Math.random().toString(36).slice(2, 10),
    title: payload?.title ?? "Untitled Book",
    coverUrl: payload?.coverUrl,
    isbn: payload?.isbn,
  } as any;
  return created;
}

export function updateBook(id: Id, patch: Record<string, unknown>) {
  return { id, ...(patch as any) } as any;
}

export function removeBook(_id: Id) {
  // no-op in pure mock service
}
