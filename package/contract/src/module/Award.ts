import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { UserPreviewSchema } from "./User";

// ------------------------------------------------------------------
// Award Type & Schema
// ------------------------------------------------------------------
export const AwardSchema = z.object({
    id: z.string(),
    objectType: z.string(), // e.g. "Comment", "Post", ...
    objectId: z.string(), // UUID
    type: z.enum(["award1", "award2", "award3"]),
    user: UserPreviewSchema,
    createdAt: z.string(),
});
export type Award = z.infer<typeof AwardSchema>;

// ------------------------------------------------------------------
// Award Stats Schema
// ------------------------------------------------------------------
export const AwardStatsItemSchema = z.object({
    type: AwardSchema.shape.type,
    count: z.number(),
});
export const AwardStatsSchema = z.array(AwardStatsItemSchema);
export type AwardStats = z.infer<typeof AwardStatsSchema>;

// ------------------------------------------------------------------
// Router Definition
// ------------------------------------------------------------------
const c = initContract();

export const awardRouter = c.router({
    listReactions: {
        method: "GET",
        path: "/objects/:objectType/:objectId/award",
        responses: { 200: z.array(AwardSchema) },
    },
    createReaction: {
        method: "POST",
        path: "/objects/:objectType/:objectId/award",
        body: AwardSchema.omit({ id: true, createdAt: true, user: true }).extend({
            userId: z.string(), // pass current user id
        }),
        responses: { 201: AwardSchema },
    },
    // delete or undo
    deleteReaction: {
        method: "DELETE",
        path: "/objects/:objectType/:objectId/award/:awardId",
        responses: { 204: z.null() },
    },
    // group by type
    statsReactions: {
        method: "GET",
        path: "/objects/:objectType/:objectId/award/stats",
        responses: { 200: AwardStatsSchema },
    },
});

export type AwardRouter = typeof awardRouter;
