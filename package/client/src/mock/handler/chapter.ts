import { HttpResponse } from "msw";
import chapterList01 from "../data/chapterlist01.json" with { type: "json" };
import { chapterContent01 } from "../data/chapterContent01.ts";

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
