import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { PaginationQuerySchema, PaginatedResponse } from "../../types";

// ------------------------------------------------------------------
// Post & Category Type
// ------------------------------------------------------------------
export const PostCategorySchema = z.object({
    id: z.string(),
    title: z.string(),
});
export type PostCategory = z.infer<typeof PostCategorySchema>;

export const PostSchema = z.object({
    id: z.string(),
    title: z.string(),
    status: z.string().optional(),
    content: z.string(),
    category: PostCategorySchema,
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
});
export type Post = z.infer<typeof PostSchema>;

const c = initContract();

export const postRouter = c.router({
    list: {
        method: "GET",
        path: "/posts",
        query: PaginationQuerySchema,
        responses: { 200: PaginatedResponse(PostSchema) },
    },
    get: {
        method: "GET",
        path: "/posts/:id",
        responses: { 200: PostSchema, 404: z.object({ message: z.string() }) },
    },
    create: {
        method: "POST",
        path: "/posts",
        body: PostSchema.omit({ id: true, createdAt: true, updatedAt: true }),
        responses: { 201: PostSchema },
    },
    update: {
        method: "PUT",
        path: "/posts/:id",
        body: PostSchema.partial().omit({ id: true, createdAt: true, updatedAt: true }),
        responses: { 200: PostSchema },
    },
    categories: {
        method: "GET",
        path: "/categories",
        responses: { 200: z.array(PostCategorySchema) },
    },
});

export type PostRouter = typeof postRouter;
