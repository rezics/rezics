import c from "./c";
import { z } from "zod";
import { PaginationQuerySchema, PaginatedResponse } from "./common";
import { Post } from "../schema/Post";

export default c.router({
    list: {
        method: "GET",
        path: "/posts",
        query: PaginationQuerySchema,
        responses: { 200: PaginatedResponse(Post) },
    },
    get: {
        method: "GET",
        path: "/posts/:id",
        responses: { 200: Post, 404: z.object({ message: z.string() }) },
    },
    create: {
        method: "POST",
        path: "/posts",
        body: Post.omit({ id: true, created_at: true, updated_at: true }),
        responses: { 201: Post },
    },
    update: {
        method: "PUT",
        path: "/posts/:id",
        body: Post.partial().omit({
            id: true,
            created_at: true,
            updated_at: true,
        }),
        responses: { 200: Post },
    },
});
