import c from "./c";
import { z } from "zod";
import { PaginationQuerySchema, PaginatedResponse } from "./common";
import {
    BookSchema,
    ChapterSchema,
    ChapterOrderSchema,
    ChapterContentSchema,
} from "../schema/Book";

export default c.router({
    get: {
        method: "GET",
        path: "/book/:bookId",
        responses: { 200: BookSchema, 404: z.object({ message: z.string() }) },
    },
    update: {
        method: "PUT",
        path: "/book/:id",
        body: BookSchema.partial().omit({ id: true }),
        responses: { 200: BookSchema, 404: z.object({ message: z.string() }) },
    },
    list: {
        method: "GET",
        path: "/book/list",
        query: PaginationQuerySchema.extend({ q: z.string().optional() }),
        responses: { 200: PaginatedResponse(BookSchema) },
    },
    search: {
        method: "GET",
        path: "/book/search",
        query: z
            .object({ query: z.string() })
            .merge(PaginationQuerySchema.partial()),
        responses: { 200: PaginatedResponse(BookSchema) },
    },
    top: {
        method: "GET",
        path: "/book/top",
        responses: { 200: z.array(BookSchema) },
    },
    chapter: c.router({
        list: {
            method: "GET",
            path: "/book/:bookId/chapters",
            responses: {
                200: z.object({
                    chapters: z.array(ChapterSchema),
                    order: ChapterOrderSchema,
                }),
            },
        },
        content: {
            method: "GET",
            path: "/book/:bookId/chapter/:chapterId",
            responses: { 200: ChapterContentSchema },
        },
    }),
});
