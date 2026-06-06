import { HttpResponse, http } from "msw";
import { chapterContent01 } from "../data/chapterContent01.ts";

const chapterList01 = {
  chapters: {
    143: { id: 143, title: "Chapter 1", noContent: true },
    144: { id: 144, title: "Chapter 2", noContent: false },
  },
  order: { 143: [144] },
};

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
  http.get("/api/book/:bookId/chapters", ({ params }) => {
    return chapterListHandler({
      parameter: { bookId: (params as any).bookId },
    } as any);
  }),
  http.get("/api/chapter/:id", ({ params }) => {
    return chapterReadHandler({
      parameter: { id: Number((params as any).id) },
    } as any);
  }),
  http.post("/api/chapter", async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as any;
    const created = {
      id: Math.floor(Math.random() * 100000),
      title: body?.title ?? "New Chapter",
      content: body?.content ?? "",
    };
    return HttpResponse.json(created, { status: 201 });
  }),
  http.patch("/api/chapter/:id", async ({ params, request }) => {
    const body = (await request.json().catch(() => ({}))) as any;
    const updated = { id: Number((params as any).id), ...(body as any) };
    return HttpResponse.json(updated, { status: 200 });
  }),
  http.delete("/api/chapter/:id", () => {
    return HttpResponse.json({}, { status: 204 });
  }),
];
