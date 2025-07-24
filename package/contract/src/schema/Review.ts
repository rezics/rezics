import { z } from "zod";
import { UserSchema } from "./User";
import { id as idSchema } from "./common";

// ------------------------------------------------------------------
// ANCHOR Review & Quote Type
// ------------------------------------------------------------------

export const QuoteExcerptSchema = z.object({
    id: idSchema,
    content: z.string(),
    createdAt: z.string(),
    author: UserSchema,
});
export type QuoteExcerpt = z.infer<typeof QuoteExcerptSchema>;

export const BookReviewSchema = z.object({
    id: idSchema,
    title: z.string(),
    content: z.string(),
    rating: z.number(),
    createdAt: z.string(),
    user: UserSchema,
});
export type BookReview = z.infer<typeof BookReviewSchema>;
