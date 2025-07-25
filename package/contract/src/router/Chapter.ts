import { z } from "zod";
import c from "./c";
import { Chapter } from "../schema/Chapter";

export const ChapterRouter = c.router({
    // Standard CRUD operations
    create: {
        method: "POST",
        path: "/chapters",
        body: Chapter.Create,
        responses: {
            201: Chapter.View,
        },
    },
    read: {
        method: "GET",
        path: "/chapters/:id",
        responses: {
            200: Chapter.View,
        },
    },
    update: {
        method: "PATCH",
        path: "/chapters/:id",
        body: Chapter.Update,
        responses: {
            200: Chapter.View,
        },
    },
    delete: {
        method: "DELETE",
        path: "/chapters/:id",
        body: c.body<null>(),
        responses: {
            204: c.response<null>(),
        },
    },
    
    // Extended chapter-specific endpoints
    listByBook: {
        method: "GET",
        path: "/books/:bookId/chapters",
        query: z.object({
            orderBy: z.enum(["created_at", "name"]).optional(),
            order: z.enum(["asc", "desc"]).optional(),
        }),
        responses: {
            200: z.array(Chapter.View),
        },
    },
    getChapterContent: {
        method: "GET",
        path: "/chapters/:id/content",
        responses: {
            200: z.object({
                id: z.string(),
                name: z.string(),
                content: z.string(),
                bookId: z.string(),
                wordCount: z.number(),
            }),
        },
    },
    updateChapterOrder: {
        method: "PUT",
        path: "/books/:bookId/chapters/order",
        body: z.object({
            chapterIds: z.array(z.string()),
        }),
        responses: {
            200: z.object({
                message: z.string(),
                updatedOrder: z.array(z.string()),
            }),
        },
    },
    getChapterQuotes: {
        method: "GET",
        path: "/chapters/:id/quotes",
        query: z.object({
            page: z.number().optional(),
            limit: z.number().optional(),
        }),
        responses: {
            200: z.object({
                quotes: z.array(z.object({
                    id: z.string(),
                    content: z.string(),
                    userId: z.string(),
                    userName: z.string(),
                    created_at: z.date(),
                })),
                total: z.number(),
            }),
        },
    },
    getChapterStats: {
        method: "GET",
        path: "/chapters/:id/stats",
        responses: {
            200: z.object({
                wordCount: z.number(),
                readTime: z.number(), // in minutes
                totalQuotes: z.number(),
                averageRating: z.number().nullable(),
            }),
        },
    },
});
