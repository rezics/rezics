import c from "./c";
import { z } from "zod";
import { Author } from "../schema/Author";

export const AuthorRouter = c.router({
    // Standard CRUD operations
    create: {
        method: "POST",
        path: "/authors",
        body: Author.Create,
        responses: {
            201: Author.View,
        },
    },
    read: {
        method: "GET",
        path: "/authors/:id",
        responses: {
            200: Author.View,
        },
    },
    update: {
        method: "PATCH",
        path: "/authors/:id",
        body: Author.Update,
        responses: {
            200: Author.View,
        },
    },
    delete: {
        method: "DELETE",
        path: "/authors/:id",
        body: c.body<null>(),
        responses: {
            204: c.response<null>(),
        },
    },
    
    // Extended author-specific endpoints
    list: {
        method: "GET",
        path: "/authors",
        query: z.object({
            page: z.number().optional(),
            limit: z.number().optional(),
            search: z.string().optional(),
        }),
        responses: {
            200: z.object({
                authors: z.array(Author.View),
                total: z.number(),
            }),
        },
    },
    getAuthorBooks: {
        method: "GET",
        path: "/authors/:id/books",
        query: z.object({
            page: z.number().optional(),
            limit: z.number().optional(),
        }),
        responses: {
            200: z.object({
                books: z.array(z.object({
                    id: z.string(),
                    name: z.string(),
                    cover: z.string().nullable(),
                    rating: z.number().nullable(),
                    publishInfo: z.array(z.object({
                        publishedAt: z.date(),
                        publisher: z.string(),
                    })),
                })),
                total: z.number(),
            }),
        },
    },
    getAuthorStats: {
        method: "GET",
        path: "/authors/:id/stats",
        responses: {
            200: z.object({
                totalBooks: z.number(),
                averageRating: z.number().nullable(),
                totalReviews: z.number(),
                genres: z.array(z.object({
                    name: z.string(),
                    count: z.number(),
                })),
            }),
        },
    },
    searchByName: {
        method: "GET",
        path: "/authors/search",
        query: z.object({
            name: z.string(),
            limit: z.number().optional(),
        }),
        responses: {
            200: z.array(z.object({
                id: z.string(),
                name: z.string(),
                avatar: z.string().nullable(),
                bookCount: z.number(),
            })),
        },
    },
});
