import { http, HttpResponse } from "msw";

import { chapterContent01 } from "../data/chapterContent01";
import chapterList01 from "../data/chapterlist01.json";

export const chapterHandlers = [
    // ANCHOR 🟢 REST: GET /chapters/:id/content
    http.get("/chapters/:id/content", ({ params }) => {
        let chapterContent = chapterContent01;
        // chapterContent.content = chapterContent01.content.repeat(100);
        // chapterContent.content += "\n\n\n\n\n"
        // chapterContent.content = chapterContent.content.repeat(10);
        const chapterId = Math.floor(Math.random() * 1800);
        const chapters = new Map(Object.entries(chapterList01.chapters));
        if (chapters.has(chapterId.toString())) {
            chapterContent.chapterName = chapters.get(chapterId.toString())!.title || "章节名称";
        } else {
            chapterContent.chapterName = "章节名称";
        }

        return HttpResponse.json(chapterContent);
    }),
];
