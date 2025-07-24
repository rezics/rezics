import { z } from "zod";
import { UserSchema } from "./User";
import { id as idSchema } from "./common";

// ------------------------------------------------------------------
// Reaction Type & Schema
// ------------------------------------------------------------------
export const ReactionSchema = z.object({
    id: idSchema,
    objectType: z.string(), // e.g. "Comment", "Post", ...
    objectId: idSchema,
    type: z.enum(["like", "dislike", "funny"]),
    user: UserSchema,
    createdAt: z.string(),
});
export type Reaction = z.infer<typeof ReactionSchema>;

// ------------------------------------------------------------------
// Reaction Stats Schema
// ------------------------------------------------------------------
export const ReactionStatsItemSchema = z.object({
    type: ReactionSchema.shape.type,
    count: z.number(),
});
export const ReactionStatsSchema = z.array(ReactionStatsItemSchema);
export type ReactionStats = z.infer<typeof ReactionStatsSchema>;
