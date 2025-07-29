import c from "./c";
import { z } from "zod";
import { Book } from "../schema/Book";

export const BookRouter = c.router({
    // Standard CRUD operations
    create: {
        method: "POST",
        path: "/books",
        body: Book.Create,
        responses: {
            201: Book.View,
        },
    },
    read: {
        method: "GET",
        path: "/books/:id",
        query: Book.Read,
        responses: {
            200: Book.View,
        },
    },
    update: {
        method: "PATCH",
        path: "/books/:id",
        body: Book.Update,
        responses: {
            200: Book.View,
        },
    },
    delete: {
        method: "DELETE",
        path: "/books/:id",
        body: c.body<null>(),
        responses: {
            204: c.response<null>(),
        },
    },

    // Extended book-specific endpoints
    list: {
        method: "GET",
        path: "/books",
        query: z.object({
            page: z.number().optional(),
            limit: z.number().optional(),
            search: z.string().optional(),
            authorId: z.string().optional(),
            tagId: z.string().optional(),
            minRating: z.number().optional(),
            maxRating: z.number().optional(),
        }),
        responses: {
            200: z.object({
                books: z.array(Book.View),
                total: z.number(),
            }),
        },
    },
    getBookChapters: {
        method: "GET",
        path: "/books/:id/chapters",
        responses: {
            200: z.array(
                z.object({
                    id: z.string(),
                    name: z.string(),
                    bookId: z.string(),
                    created_at: z.date(),
                }),
            ),
        },
    },
    getBookReviews: {
        method: "GET",
        path: "/books/:id/reviews",
        query: z.object({
            page: z.number().optional(),
            limit: z.number().optional(),
            rating: z.number().optional(),
        }),
        responses: {
            200: z.object({
                reviews: z.array(
                    z.object({
                        id: z.string(),
                        title: z.string(),
                        content: z.string(),
                        rating: z.number(),
                        userId: z.string(),
                        userName: z.string(),
                        created_at: z.date(),
                    }),
                ),
                total: z.number(),
                averageRating: z.number(),
            }),
        },
    },
    getBookTags: {
        method: "GET",
        path: "/books/:id/tags",
        responses: {
            200: z.array(
                z.object({
                    id: z.string(),
                    name: z.string(),
                    color: z.string(),
                    type: z.enum(["book", "thread"]),
                }),
            ),
        },
    },
    addBookTag: {
        method: "POST",
        path: "/books/:id/tags",
        body: z.object({
            tagId: z.string(),
        }),
        responses: {
            201: z.object({
                message: z.string(),
                tag: z.object({
                    id: z.string(),
                    name: z.string(),
                }),
            }),
        },
    },
    removeBookTag: {
        method: "DELETE",
        path: "/books/:id/tags/:tagId",
        responses: {
            200: z.object({
                message: z.string(),
            }),
        },
    },
    getBookStats: {
        method: "GET",
        path: "/books/:id/stats",
        responses: {
            200: z.object({
                totalReviews: z.number(),
                averageRating: z.number(),
                totalChapters: z.number(),
                readListCount: z.number(),
                totalQuotes: z.number(),
            }),
        },
    },
    searchBooks: {
        method: "GET",
        path: "/books/search",
        query: z.object({
            query: z.string(),
            limit: z.number().optional(),
            includeAuthors: z.boolean().optional(),
            includeTags: z.boolean().optional(),
        }),
        responses: {
            200: z.array(
                z.object({
                    id: z.string(),
                    name: z.string(),
                    cover: z.string().nullable(),
                    authors: z.array(
                        z.object({
                            id: z.string(),
                            name: z.string(),
                        }),
                    ),
                    rating: z.number().nullable(),
                }),
            ),
        },
    },
    getRecommendations: {
        method: "GET",
        path: "/books/:id/recommendations",
        query: z.object({
            limit: z.number().optional(),
        }),
        responses: {
            200: z.array(
                z.object({
                    id: z.string(),
                    name: z.string(),
                    cover: z.string().nullable(),
                    rating: z.number().nullable(),
                    similarity: z.number(),
                }),
            ),
        },
    },
});

export default BookRouter;
