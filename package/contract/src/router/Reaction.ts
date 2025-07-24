import c from "./c";
import { z } from "zod";
import { id as idSchema } from "./common";
import { ReactionSchema, ReactionStatsSchema } from "../schema/Reaction";

export default c.router({
    listReactions: {
        method: "GET",
        path: "/objects/:objectType/:objectId/reaction",
        responses: { 200: z.array(ReactionSchema) },
    },
    createReaction: {
        method: "POST",
        path: "/objects/:objectType/:objectId/reaction",
        body: ReactionSchema.omit({
            id: true,
            createdAt: true,
            user: true,
        }).extend({
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
