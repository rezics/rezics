import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { PaginationQuerySchema, PaginatedResponse, UserSchema } from "./common";

// ------------------------------------------------------------------
// Comment Type
// ------------------------------------------------------------------
export type Comment = {
    id: string;
    content: string;
    createdAt: string;
    author: z.infer<typeof UserSchema>;
    likes: number;
    replies: Comment[]; // 遞歸
};

export const CommentSchema: z.ZodSchema<Comment> = z.lazy(() =>
    z.object({
        id: z.string(),
        content: z.string(),
        createdAt: z.string(),
        author: UserSchema,
        likes: z.number(),
        replies: z.array(CommentSchema),
    }),
);

// ANCHOR CommentRouter
const c = initContract();

const commentListResponse = PaginatedResponse(CommentSchema);
export const commentRouter = c.router({
    list: {
        method: "GET",
        path: "/comment/list/:commentId",
        query: PaginationQuerySchema,
        responses: { 200: commentListResponse },
    },
});
