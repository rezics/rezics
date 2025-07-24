import c from "./c";
import { z } from "zod";
import { Chapter, ChapterOrder } from "../schema/Chapter";

export default c.router({
    list: {
        method: "GET",
        path: "/book/:bookId/chapters",
        responses: {
            200: z.object({
                chapters: z.array(Chapter.View),
                order: ChapterOrder,
            }),
        },
    },
    get: {
        method: "GET",
        path: "/book/:bookId/chapter/:chapterId",
        responses: { 200: Chapter.View },
    },
});
