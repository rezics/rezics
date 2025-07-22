import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { PaginationQuerySchema, PaginatedResponse, id as idSchema, ThreadSchema } from "./common";

// ------------------------------------------------------------------
// Post & Category Type
// ------------------------------------------------------------------
export const PostSchema = ThreadSchema.extend({
    content: z.string(),
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
    }
});

export type PostRouter = typeof postRouter;
