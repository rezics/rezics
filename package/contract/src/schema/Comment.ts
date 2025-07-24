// import { z } from "zod";
// import { id as idSchema, createdAt } from "./common";
// import { UserSchema } from "./User";

// // ------------------------------------------------------------------
// // Comment Type
// // ------------------------------------------------------------------
// export type Comment = {
//     id: string;
//     content: string;
//     createdAt: string;
//     author: z.infer<typeof UserSchema>;
//     likes: number;
//     replies: Comment[]; // 遞歸
// };

// export const CommentSchema: z.ZodSchema<Comment> = z.lazy(() =>
//     z.object({
//         id: idSchema,
//         content: z.string(),
//         createdAt: createdAt,
//         author: UserSchema,
//         likes: z.number(),
//         replies: z.array(CommentSchema),
//     }),
// );
