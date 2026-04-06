import { HttpResponse, http } from "msw";
import { safeString, toInt, toNonNegativeInt } from "../lib";
import {
  createBook,
  getBookById,
  listBooks,
  removeBook,
  updateBook,
} from "./service";

export const bookHttpHandlers = [
  // GET /api/book?offset=&limit=
  http.get("/api/book/list", ({ request }) => {
    const url = new URL(request.url);
    const offset = toNonNegativeInt(url.searchParams.get("offset"), 0);
    const limit = toInt(url.searchParams.get("limit"), 10);
    const data = listBooks({ offset, limit });
    return HttpResponse.json(data, { status: 200 });
  }),

  // GET /api/book/:id
  http.get("/api/book/:id", ({ params }) => {
    const id = safeString((params as any).id);
    const payload = getBookById(id);
    return HttpResponse.json(payload, { status: 200 });
  }),

  // POST /api/books
  http.post("/api/books", async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as any;
    const created = createBook({
      title: body?.title ?? "Untitled Book",
      coverUrl: body?.coverUrl,
      isbn: body?.isbn,
    });
    return HttpResponse.json(created, { status: 201 });
  }),

  // PATCH /api/book/:id
  http.patch("/api/book/:id", async ({ params, request }) => {
    const id = safeString((params as any).id);
    const body = (await request.json().catch(() => ({}))) as any;
    const updated = updateBook(id, body as any);
    return HttpResponse.json(updated, { status: 200 });
  }),

  // DELETE /api/book/:id
  http.delete("/api/book/:id", ({ params }) => {
    const id = safeString((params as any).id);
    removeBook(id);
    return HttpResponse.json({}, { status: 204 });
  }),
];
