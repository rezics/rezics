import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { PaginationQuerySchema, PaginatedResponse, id as idSchema} from "./common";
import { UserSchema } from "./User";
import { TagSchema } from "./Tag";

// ------------------------------------------------------------------
// Book & related Type
// ------------------------------------------------------------------

export const AuthorSchema = z.object({
    id: idSchema,
    name: z.string(),
    avatar: z.url().optional(),
    description: z.string().optional(),
});
export type Author = z.infer<typeof AuthorSchema>;

export const BookSchema = z.object({
    id: idSchema,
    title: z.string(),
    cover: z.url().optional(),
    author: AuthorSchema,
    rating: z.number().optional(),
    publisher: z.string().optional(),
    publishDate: z.string().optional(),
    isbn: z.string().optional(),
    // tags: TagGroupSchema, // association ICSBookTag group
    tags: z.array(TagSchema), // * 应当注意，查询的时候只查询 ICSBookTag group，或者不查询 tags
    description: z.string().optional(),
});
export type Book = z.infer<typeof BookSchema>;

export const ChapterSchema = z.object({
    id: idSchema,
    title: z.string(),
    noContent: z.boolean().optional(),
});
export type Chapter = z.infer<typeof ChapterSchema>;

export const ChapterOrderSchema = z.map(z.string(), z.array(z.string()));
export type ChapterOrder = z.infer<typeof ChapterOrderSchema>;

export const ChapterContentSchema = z.object({
    id: idSchema,
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
        path: "/book",
        query: PaginationQuerySchema.extend({ q: z.string().optional() }),
        responses: { 200: PaginatedResponse(BookSchema) },
    },
    search: {
        method: "GET",
        path: "/book/search",
        query: z.object({ query: z.string() }).merge(PaginationQuerySchema.partial()),
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
            responses: { 200: z.object({ chapters: z.array(ChapterSchema), order: ChapterOrderSchema }) },
        },
        content: {
            method: "GET",
            path: "/book/:bookId/chapter/:chapterId",
            responses: { 200: ChapterContentSchema },
        },
    }),
});

export type BookRouter = typeof bookRouter;
