// “业务服务层”：只依赖数据与纯函数，不关心 MSW/HTTP
import type { OffsetPaginated } from "../type";
import { genId, paginateOffset, pickRandom } from "./lib";
import type { Id, Quote, Review, ReviewRow, User } from "./types";

// 直接使用你的 mock 数据（保持原路径）
import { mockQuotes } from "@/mock/data/mockQuotes";
import { mockBookShortReviews, mockReviews, mockUsers } from "@/mock/data/reviews";

function joinReview(row: ReviewRow, users: User[]): Review {
  const user = users.find((u) => String(u.id) === String(row.userId))
    ?? ({ id: String(row.userId), name: "Unknown", avatar: "" } as User);
  const { userId, ...rest } = row;
  return { ...rest, user };
}

// ========== Queries ==========
export function listReviews(opts: { bookId?: Id; offset?: number; limit?: number }): OffsetPaginated<Review> {
  const { bookId, offset = 0, limit = 10 } = opts ?? {};
  const rows = Array.isArray(mockReviews) ? mockReviews : [];
  const filtered = bookId ? rows.filter((r) => String(r.bookId) === String(bookId)) : rows;
  const joined = filtered.map((r) => joinReview(r, mockUsers));
  return paginateOffset(joined, offset, limit);
}

export function getReviewById(id: Id): Review | undefined {
  const row = (Array.isArray(mockReviews) ? mockReviews : []).find((x) => String(x.id) === String(id));
  return row ? joinReview(row, mockUsers) : undefined;
}

export function listQuotes(opts: { limit?: number; bookId?: Id }): Quote[] {
  const { limit = 5, bookId } = opts ?? {};
  const source: Quote[] = Array.isArray(mockQuotes) ? mockQuotes : [];
  const filtered = bookId ? source.filter((q) => String(q?.bookId ?? "") === String(bookId)) : source;
  return pickRandom(filtered.length ? filtered : source, limit);
}

// 评论摘要（你原来从 mockBookShortReviews 里抽样）
export function listCommentsByBook(opts: { bookId: Id; limit?: number }) {
  const { limit = 5 } = opts ?? {};
  const source = Array.isArray(mockBookShortReviews) ? mockBookShortReviews : [];
  const items = pickRandom(source, limit);
  return { items, offset: 0, totalItems: items.length };
}

// ========== Mutations ==========
export function createReview(payload: {
  bookId: Id;
  title?: string;
  content?: string;
  rating?: number;
  userId?: Id; // 不传则默认用第一个 mock 用户
}) {
  const id = genId();
  const now = new Date().toISOString();
  const user = mockUsers[0] ?? ({ id: "1", name: "John Doe", avatar: "" } as User);
  const row: ReviewRow = {
    id,
    bookId: payload.bookId ?? ("1" as Id),
    content: payload.content ?? "",
    rating: payload.rating ?? 0,
    created_at: now,
    userId: payload.userId ?? user.id,
  };
  mockReviews.push(row);
  // 返回“创建回执”可以附带 Author 信息等（按你的需要）
  return {
    id,
    title: payload.title ?? "",
    content: row.content,
    rating: row.rating,
    created_at: now,
    user,
  };
}

export function patchReview(id: Id, updates: Partial<ReviewRow>) {
  const idx = mockReviews.findIndex((x) => String(x.id) === String(id));
  if (idx >= 0) {
    mockReviews[idx] = { ...mockReviews[idx], ...updates };
  }
  return { id, ...updates };
}

export function removeReview(id: Id) {
  const idx = mockReviews.findIndex((x) => String(x.id) === String(id));
  if (idx >= 0) mockReviews.splice(idx, 1);
}
