import { graphql, HttpResponse } from "msw";
import { bookInfo01, authorInfo01 } from "../data/bookinfo01";
import chapterList01 from "../data/chapterlist01.json";

export const bookInfoHandlers = [
    // ANCHOR 🟢 Query: BookInfoQuery
    graphql.query("BookInfoQuery", ({ variables }) => {
        return HttpResponse.json({
            data: {
                book: bookInfo01,
                author: authorInfo01,
            },
        });
    }),

    // ANCHOR 🟢 Query: GetChapterList
    graphql.query("ChapterListQuery", ({ variables }) => {
        return HttpResponse.json({
            data: {
                chapters: Object.values(chapterList01.chapters), // ✅ 保证是 Chapter[]
                chapterOrders: chapterList01.order,
                // Object.entries(chapterList01.order).map(([parentId, childIds]) => ({
                //   parentId: parentId === "null" ? null : Number(parentId),
                //   childIds,
                // })), // ✅ 转为 ChapterOrder[]
            },
        });
    }),
];
