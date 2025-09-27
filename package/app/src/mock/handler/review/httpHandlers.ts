import { http, HttpResponse } from "msw";
import { safeString, toInt, toNonNegativeInt } from "./lib";
import {
  createReview,
  getReviewById,
  listCommentsByBook,
  listQuotes,
  listReviews,
  patchReview,
  removeReview,
} from "./service";

// =========================
// Review REST (MSW http handlers)
// =========================
export const reviewHttpHandlers = [
  // GET /api/review?bookId=&offset=&limit=
  http.get("/api/review", ({ request }) => {
    const url = new URL(request.url);
    const bookId = url.searchParams.get("bookId") ?? undefined;
    const offset = toNonNegativeInt(url.searchParams.get("offset"), 0);
    const limit = toInt(url.searchParams.get("limit"), 10);
    const data = listReviews({ bookId: bookId ?? undefined, offset, limit });
    return HttpResponse.json(data, { status: 200 });
  }),

  // GET /api/review/:id
  http.get("/api/review/:id", ({ params }) => {
    const id = safeString((params as any).id);
    const r = getReviewById(id);
    if (!r) return HttpResponse.json({ message: "Not Found" }, { status: 404 });
    return HttpResponse.json(r, { status: 200 });
  }),

  // POST /api/review
  http.post("/api/review", async ({ request }) => {
    const body = await request.json().catch(() => ({}));
    const created = createReview({
      bookId: safeString((body as any)?.bookId ?? "1"),
      title: safeString((body as any)?.title ?? ""),
      content: safeString((body as any)?.content ?? ""),
      rating: toInt((body as any)?.rating, 0),
      userId: (body as any)?.userId ? safeString((body as any)?.userId) : undefined,
    });
    return HttpResponse.json(created, { status: 201 });
  }),

  // PATCH /api/review/:id
  http.patch("/api/review/:id", async ({ params, request }) => {
    const id = safeString((params as any).id);
    const payload = (await request.json().catch(() => ({}))) as any;
    const result = patchReview(id, payload);
    return HttpResponse.json(result, { status: 200 });
  }),

  // DELETE /api/review/:id
  http.delete("/api/review/:id", ({ params }) => {
    const id = safeString((params as any).id);
    removeReview(id);
    return HttpResponse.json({}, { status: 204 });
  }),

  // GET /api/quote?limit=
  http.get("/api/quote", ({ request }) => {
    const url = new URL(request.url);
    const limit = toInt(url.searchParams.get("limit"), 5);
    const items = listQuotes({ limit });
    return HttpResponse.json(items, { status: 200 });
  }),

  // GET /api/quote/book/:bookId?limit=
  http.get("/api/quote/book/:bookId", ({ params, request }) => {
    const url = new URL(request.url);
    const limit = toInt(url.searchParams.get("limit"), 5);
    const bookId = safeString((params as any).bookId);
    const items = listQuotes({ limit, bookId });
    return HttpResponse.json(items, { status: 200 });
  }),

  // GET /api/review/comment/book/:bookId?limit=
  http.get("/api/review/comment/book/:bookId", ({ params, request }) => {
    const url = new URL(request.url);
    const limit = toInt(url.searchParams.get("limit"), 5);
    const bookId = safeString((params as any).bookId);
    const result = listCommentsByBook({ bookId, limit });
    return HttpResponse.json(result, { status: 200 });
  }),
];
