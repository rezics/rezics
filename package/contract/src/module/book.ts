import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { PaginationQuerySchema, PaginatedResponse, UserSchema } from "./common";

// ------------------------------------------------------------------
// Book & related Type
// ------------------------------------------------------------------

export const BookSchema = z.object({
    id: z.string(),
    title: z.string(),
    cover: z.string().url().optional(),
    author: z.string(),
    rating: z.number().optional(),
    publisher: z.string().optional(),
    publishDate: z.string().optional(),
    isbn: z.string().optional(),
    tags: z.array(z.string()).optional(),
    description: z.string().optional(),
});
export type Book = z.infer<typeof BookSchema>;

export const ChapterSchema = z.object({
    ID: z.string(),
    ParentID: z.string().nullable(),
    ChapterName: z.string(),
    NoContent: z.boolean().optional(),
});
export type Chapter = z.infer<typeof ChapterSchema>;

export const ChapterContentSchema = z.object({
    id: z.string(),
    content: z.string(),
    createdAt: z.string(),
    chapterName: z.string(),
    author: UserSchema,
});
export type ChapterContent = z.infer<typeof ChapterContentSchema>;

// ANCHOR BookRouter
const c = initContract();

export const bookRouter = c.router({
    get: {
        method: "GET",
        path: "/books/:id",
        responses: { 200: BookSchema, 404: z.object({ message: z.string() }) },
    },
    update: {
        method: "PUT",
        path: "/books/:id",
        body: BookSchema.partial().omit({ id: true }),
        responses: { 200: BookSchema, 404: z.object({ message: z.string() }) },
    },
    list: {
        method: "GET",
        path: "/books",
        query: PaginationQuerySchema.extend({ q: z.string().optional() }),
        responses: { 200: PaginatedResponse(BookSchema) },
    },
    search: {
        method: "GET",
        path: "/books/search",
        query: z.object({ query: z.string() }).merge(PaginationQuerySchema.partial()),
        responses: { 200: PaginatedResponse(BookSchema) },
    },
    top: {
        method: "GET",
        path: "/books/top",
        responses: { 200: z.array(BookSchema) },
    },
    chapters: c.router({
        list: {
            method: "GET",
            path: "/books/:id/chapters",
            responses: { 200: z.array(ChapterSchema) },
        },
        content: {
            method: "GET",
            path: "/books/:id/chapters/:chapterId",
            responses: { 200: ChapterContentSchema },
        },
    }),
});

export type BookRouter = typeof bookRouter;
