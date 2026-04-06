import { HttpResponse, http } from "msw";
import { genId, toInt, toNonNegativeInt } from "../lib";

const tagStore = new Map<string, any>();

export const tagHttpHandlers = [
  // GET /api/tags?offset=&limit=
  http.get("/api/tags", ({ request }) => {
    const url = new URL(request.url);
    const offset = toNonNegativeInt(url.searchParams.get("offset"), 0);
    const limit = toInt(url.searchParams.get("limit"), 20);
    const list = Array.from(tagStore.values());
    const totalItems = list.length;
    const items = list.slice(offset, offset + limit);
    return HttpResponse.json({ items, offset, totalItems }, { status: 200 });
  }),

  // GET /api/tags/:id
  http.get("/api/tags/:id", ({ params }) => {
    const id = String((params as any).id);
    const found = tagStore.get(id);
    if (!found)
      return HttpResponse.json({ message: "Not Found" }, { status: 404 });
    return HttpResponse.json(found, { status: 200 });
  }),

  // POST /api/tags
  http.post("/api/tags", async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as any;
    const id = genId();
    const now = new Date().toISOString();
    const created = {
      id,
      name: body?.name ?? "New Tag",
      type: body?.type ?? "general",
      created_at: now,
      updated_at: now,
    } as any;
    tagStore.set(id, created);
    return HttpResponse.json(created, { status: 201 });
  }),

  // PATCH /api/tags/:id
  http.patch("/api/tags/:id", async ({ params, request }) => {
    const id = String((params as any).id);
    const prev = tagStore.get(id) ?? { id };
    const payload = (await request.json().catch(() => ({}))) as any;
    const next = {
      ...prev,
      ...(payload as any),
      updated_at: new Date().toISOString(),
    };
    tagStore.set(id, next);
    return HttpResponse.json(next, { status: 200 });
  }),

  // DELETE /api/tags/:id
  http.delete("/api/tags/:id", ({ params }) => {
    const id = String((params as any).id);
    tagStore.delete(id);
    return HttpResponse.json({}, { status: 204 });
  }),
];
