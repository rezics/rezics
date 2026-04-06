import { HttpResponse, http } from "msw";
import { mockABookList01 } from "../../data/abooklist01.ts";
import { mockBookLists } from "../../data/booklists.ts";
import { toInt, toNonNegativeInt } from "../lib";

export const readlistHttpHandlers = [
  // GET /api/readlists?offset=&limit=
  http.get("/api/readlists", ({ request }) => {
    const url = new URL(request.url);
    const offset = toNonNegativeInt(url.searchParams.get("offset"), 0);
    const limit = toInt(url.searchParams.get("limit"), 20);
    const totalItems = mockBookLists.length;
    const items = mockBookLists.slice(offset, offset + limit);
    return HttpResponse.json({ items, offset, totalItems }, { status: 200 });
  }),

  // GET /api/readlists/:id
  http.get("/api/readlists/:id", () =>
    HttpResponse.json({ ...mockABookList01 }, { status: 200 }),
  ),

  // POST /api/readlists
  http.post("/api/readlists", async ({ request }) => {
    const payload = (await request.json().catch(() => ({}))) as any;
    const newList = {
      id: String(mockBookLists.length + 1),
      title: payload?.title ?? "Untitled List",
      coverUrl: payload?.coverUrl,
      creator: {
        name: "Mock User",
        avatar: "https://api.dicebear.com/9.x/pixel-art/svg?seed=user",
      },
      likes: 0,
    } as any;
    mockBookLists.push(newList);
    return HttpResponse.json(newList, { status: 201 });
  }),

  // PATCH /api/readlists/:id
  http.patch("/api/readlists/:id", async ({ params, request }) => {
    const body = (await request.json().catch(() => ({}))) as any;
    return HttpResponse.json(
      { id: String((params as any).id), ...(body as any) },
      { status: 200 },
    );
  }),

  // DELETE /api/readlists/:id
  http.delete("/api/readlists/:id", () =>
    HttpResponse.json({}, { status: 204 }),
  ),
];
