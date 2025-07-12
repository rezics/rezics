import { http, HttpResponse } from "msw";
import { bookInfo01, authorInfo01 } from "../data/bookinfo01";
import chapterList01 from "../data/chapterlist01.json";

export const bookInfoHandlers = [
    // ANCHOR 🟢 REST: GET /books/:id/info
    http.get("/books/:id/info", ({ params }) => {
        return HttpResponse.json({
            book: bookInfo01,
            author: authorInfo01,
        });
    }),

    // ANCHOR 🟢 REST: GET /books/:id/chapters
    http.get("/books/:id/chapters", ({ params }) => {
        return HttpResponse.json({
            chapters: Object.values(chapterList01.chapters), // ✅ 保证是 Chapter[]
            chapterOrders: chapterList01.order,
        });
    }),
];
