import c from "./c";
import { z } from "zod";
import { Award, AwardStats } from "../schema/Award";

export const AwardRouter = c.router({
	// Standard CRUD operations
	create: {
		method: "POST",
		path: "/awards",
		body: Award.Create,
		responses: {
			201: Award.View,
		},
	},
	read: {
		method: "GET",
		path: "/awards/:id",
		responses: {
			200: Award.View,
		},
	},
	update: {
		method: "PATCH",
		path: "/awards/:id",
		body: Award.Update,
		responses: {
			200: Award.View,
		},
	},
	delete: {
		method: "DELETE",
		path: "/awards/:id",
		body: c.body<null>(),
		responses: {
			204: c.response<null>(),
		},
	},

	// Extended award-specific endpoints
	listByObject: {
		method: "GET",
		path: "/awards",
		query: z.object({
			objectType: z.string().optional(),
			objectId: z.string().optional(),
			type: z.string().optional(),
			userId: z.string().optional(),
			page: z.number().optional(),
			limit: z.number().optional(),
		}),
		responses: {
			200: z.object({
				awards: z.array(Award.View),
				total: z.number(),
			}),
		},
	},
	getAwardsByObjectType: {
		method: "GET",
		path: "/objects/:objectType/:objectId/awards",
		query: z.object({
			type: z.string().optional(),
			groupBy: z.enum(["type", "user"]).optional(),
		}),
		responses: {
			200: z.object({
				awards: z.array(Award.View),
				stats: AwardStats.View,
				total: z.number(),
			}),
		},
	},
	getUserAwards: {
		method: "GET",
		path: "/users/:userId/awards",
		query: z.object({
			objectType: z.string().optional(),
			type: z.string().optional(),
			page: z.number().optional(),
			limit: z.number().optional(),
		}),
		responses: {
			200: z.object({
				awards: z.array(Award.View),
				total: z.number(),
				summary: z.object({
					totalAwarded: z.number(),
					totalReceived: z.number(),
					byType: AwardStats.View,
				}),
			}),
		},
	},
	giveAward: {
		method: "POST",
		path: "/awards/give",
		body: z.object({
			objectType: z.string(),
			objectId: z.string(),
			type: z.string(),
			recipientId: z.string().optional(),
			note: z.string().optional(),
		}),
		responses: {
			201: z.object({
				award: Award.View,
				message: z.string(),
			}),
		},
	},
	removeAward: {
		method: "DELETE",
		path: "/awards/remove",
		body: z.object({
			objectType: z.string(),
			objectId: z.string(),
			type: z.string(),
			userId: z.string(),
		}),
		responses: {
			200: z.object({
				message: z.string(),
				removedCount: z.number(),
			}),
		},
	},
	getAwardStats: {
		method: "GET",
		path: "/awards/stats",
		query: z.object({
			objectType: z.string().optional(),
			objectId: z.string().optional(),
			userId: z.string().optional(),
			timeframe: z
				.enum(["day", "week", "month", "year", "all"])
				.optional(),
		}),
		responses: {
			200: z.object({
				totalAwards: z.number(),
				byType: AwardStats.View,
				topRecipients: z
					.array(
						z.object({
							userId: z.string(),
							userName: z.string(),
							count: z.number(),
						}),
					)
					.max(10),
				recentActivity: z.array(Award.View).max(20),
			}),
		},
	},
	getPopularAwardTypes: {
		method: "GET",
		path: "/awards/types/popular",
		query: z.object({
			objectType: z.string().optional(),
			limit: z.number().optional(),
		}),
		responses: {
			200: z.array(
				z.object({
					type: z.string(),
					count: z.number(),
					description: z.string().optional(),
				}),
			),
		},
	},
});

export default AwardRouter;
