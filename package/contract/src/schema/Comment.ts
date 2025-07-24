import { z } from "zod";
import { id, Auditable } from "./common";
import { UserSchema } from "./User";

// ------------------------------------------------------------------
// Comment Type
// ------------------------------------------------------------------
export type Comment = z.infer<typeof Auditable> & {
    id: string;
    content: string;
    author: z.infer<typeof UserSchema>;
    likes: number;
    replies: Comment[]; // 遞歸
};

export const CommentSchema: z.ZodSchema<Comment> = z.lazy(() =>
    z.object({
        id,
        ...Auditable.shape,
        content: z.string(),
        author: UserSchema,
        likes: z.number(),
        replies: z.array(CommentSchema),
    }),
);
