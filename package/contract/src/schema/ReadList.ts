import { z } from "zod";
import { id as idSchema } from "./common";
import { UserSchema } from "./User";

// ------------------------------------------------------------------
// Readlist Type
// ------------------------------------------------------------------
export const ReadListSchema = z.object({
    id: idSchema,
    title: z.string(),
    description: z.string(),
    books: z.array(z.string()),
    creator: UserSchema,
    likes: z.number(),
    commentsNumber: z.number().optional(),
});
export type ReadList = z.infer<typeof ReadListSchema>;
