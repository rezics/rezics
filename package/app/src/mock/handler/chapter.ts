import { HttpResponse, http } from "msw";
import { chapterContent01 } from "../data/chapterContent01.ts";
import chapterList01 from "../data/chapterlist01.json" with { type: "json" };

// Chapter ops – keep here for backward compatibility with previous file structure
export function chapterListHandler(_body: any) {
  const data: any = { chapters: [], order: [] };
  data.order = (chapterList01 as any).order;
  data.chapters = Object.values((chapterList01 as any).chapters);
  return HttpResponse.json({ ...data }, { status: 200 });
}

export function chapterReadHandler(_body: any) {
  return HttpResponse.json({ ...chapterContent01 }, { status: 200 });
}

// =========================
// Chapter REST (MSW http handlers)
// =========================
export const chapterHttpHandlers = [
  http.get("/api/books/:bookId/chapters", ({ params }) => {
    return chapterListHandler({
      parameter: { bookId: (params as any).bookId },
    } as any);
  }),
  http.get("/api/chapters/:id", ({ params }) => {
    return chapterReadHandler({
      parameter: { id: Number((params as any).id) },
    } as any);
  }),
  http.post("/api/chapters", async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as any;
    const created = {
      id: Math.floor(Math.random() * 100000),
      title: body?.title ?? "New Chapter",
      content: body?.content ?? "",
    };
    return HttpResponse.json(created, { status: 201 });
  }),
  http.patch("/api/chapters/:id", async ({ params, request }) => {
    const body = (await request.json().catch(() => ({}))) as any;
    const updated = { id: Number((params as any).id), ...(body as any) };
    return HttpResponse.json(updated, { status: 200 });
  }),
  http.delete("/api/chapters/:id", () => {
    return HttpResponse.json({}, { status: 204 });
  }),
];
