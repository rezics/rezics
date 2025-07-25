import c from "./c";
import { z } from "zod";
import { Reaction, ReactionStats } from "../schema/Reaction";

export const ReactionRouter = c.router({
    // Standard CRUD operations
    create: {
        method: "POST",
        path: "/reactions",
        body: Reaction.Create,
        responses: {
            201: Reaction.View,
        },
    },
    read: {
        method: "GET",
        path: "/reactions/:id",
        query: Reaction.Read,
        responses: {
            200: Reaction.View,
        },
    },
    update: {
        method: "PATCH",
        path: "/reactions/:id",
        body: Reaction.Update,
        responses: {
            200: Reaction.View,
        },
    },
    delete: {
        method: "DELETE",
        path: "/reactions/:id",
        body: c.body<null>(),
        responses: {
            204: c.response<null>(),
        },
    },
    
    // Extended reaction-specific endpoints
    listByObject: {
        method: "GET",
        path: "/objects/:objectType/:objectId/reactions",
        query: z.object({
            type: z.enum(["like", "dislike", "funny"]).optional(),
            userId: z.string().optional(),
            page: z.number().optional(),
            limit: z.number().optional(),
        }),
        responses: {
            200: z.object({
                reactions: z.array(Reaction.View),
                total: z.number(),
                stats: ReactionStats.View,
            }),
        },
    },
    createReactionForObject: {
        method: "POST",
        path: "/objects/:objectType/:objectId/reactions",
        body: z.object({
            type: z.enum(["like", "dislike", "funny"]),
            userId: z.string(),
        }),
        responses: {
            201: Reaction.View,
        },
    },
    removeReactionFromObject: {
        method: "DELETE",
        path: "/objects/:objectType/:objectId/reactions",
        body: z.object({
            type: z.enum(["like", "dislike", "funny"]),
            userId: z.string(),
        }),
        responses: {
            200: z.object({
                message: z.string(),
                remainingStats: ReactionStats.View,
            }),
        },
    },
    getReactionStats: {
        method: "GET",
        path: "/objects/:objectType/:objectId/reactions/stats",
        responses: {
            200: z.object({
                stats: ReactionStats.View,
                total: z.number(),
                userReaction: z.object({
                    type: z.enum(["like", "dislike", "funny"]),
                    created_at: z.date(),
                }).nullable(),
            }),
        },
    },
    getUserReactions: {
        method: "GET",
        path: "/users/:userId/reactions",
        query: z.object({
            objectType: z.string().optional(),
            type: z.enum(["like", "dislike", "funny"]).optional(),
            page: z.number().optional(),
            limit: z.number().optional(),
        }),
        responses: {
            200: z.object({
                reactions: z.array(Reaction.View),
                total: z.number(),
                summary: z.object({
                    totalReactions: z.number(),
                    byType: ReactionStats.View,
                    byObjectType: z.array(z.object({
                        objectType: z.string(),
                        count: z.number(),
                    })),
                }),
            }),
        },
    },
    toggleReaction: {
        method: "POST",
        path: "/reactions/toggle",
        body: z.object({
            objectType: z.string(),
            objectId: z.string(),
            type: z.enum(["like", "dislike", "funny"]),
            userId: z.string(),
        }),
        responses: {
            200: z.object({
                action: z.enum(["added", "removed", "changed"]),
                reaction: Reaction.View.nullable(),
                newStats: ReactionStats.View,
            }),
        },
    },
    getPopularObjects: {
        method: "GET",
        path: "/reactions/popular",
        query: z.object({
            objectType: z.string(),
            reactionType: z.enum(["like", "dislike", "funny"]).optional(),
            timeframe: z.enum(["hour", "day", "week", "month", "all"]).optional(),
            limit: z.number().optional(),
        }),
        responses: {
            200: z.array(z.object({
                objectId: z.string(),
                objectType: z.string(),
                totalReactions: z.number(),
                reactionStats: ReactionStats.View,
                recentActivity: z.number(),
            })),
        },
    },
    bulkCreateReactions: {
        method: "POST",
        path: "/reactions/bulk",
        body: z.object({
            reactions: z.array(Reaction.Create),
        }),
        responses: {
            201: z.object({
                created: z.array(Reaction.View),
                failed: z.array(z.object({
                    index: z.number(),
                    error: z.string(),
                })),
                summary: z.object({
                    total: z.number(),
                    successful: z.number(),
                    failed: z.number(),
                }),
            }),
        },
    },
});

export default ReactionRouter