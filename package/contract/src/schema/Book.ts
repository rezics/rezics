import { z } from "zod";
import { id as idSchema, created_at, icsid } from "./common";
import { UserSchema } from "./User";

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
    icsid: icsid,
    cover: z.url().optional(),
    author: AuthorSchema,
    rating: z.number().optional(),
    publisher: z.string().optional(),
    publishDate: z.string().optional(),
    isbn: z.string().optional(),
    // tags: TagGroupSchema, // association ICSBookTag group
    tags: z.array(z.any()), // 使用any避免循环依赖，实际使用时会在router中正确关联TagSchema
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
    createdAt: created_at,
    chapterName: z.string(),
    author: UserSchema,
});
export type ChapterContent = z.infer<typeof ChapterContentSchema>;
