import { initContract } from "@ts-rest/core";
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

// ------------------------------------------------------------------
// Router Definition
// ------------------------------------------------------------------
const c = initContract();

export const reactionRouter = c.router({
    listReactions: {
        method: "GET",
        path: "/objects/:objectType/:objectId/reaction",
        responses: { 200: z.array(ReactionSchema) },
    },
    createReaction: {
        method: "POST",
        path: "/objects/:objectType/:objectId/reaction",
        body: ReactionSchema.omit({ id: true, createdAt: true, user: true }).extend({
            userId: idSchema, // pass current user id
        }),
        responses: { 201: ReactionSchema },
    },
    // delete or undo
    deleteReaction: {
        method: "DELETE",
        path: "/objects/:objectType/:objectId/reaction/:reactionId",
        responses: { 204: z.null() },
    },
    // group by type
    statsReactions: {
        method: "GET",
        path: "/objects/:objectType/:objectId/reaction/stats",
        responses: { 200: ReactionStatsSchema },
    },
});

export type ReactionRouter = typeof reactionRouter;
