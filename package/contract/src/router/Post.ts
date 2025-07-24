import c from "./c";
import { z } from "zod";
import { PaginationQuerySchema, PaginatedResponse } from "./common";
import { PostSchema } from "../schema/Post";

export default c.router({
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
        body: PostSchema.partial().omit({
            id: true,
            createdAt: true,
            updatedAt: true,
        }),
        responses: { 200: PostSchema },
    },
});
