import c from "./c";
import { z } from "zod";
import { Comment } from "../schema/Comment";

export default c.router({
	// Standard CRUD operations
	create: {
		method: "POST",
		path: "/comments",
		body: Comment.Create,
		responses: {
			201: Comment.View,
		},
	},
	read: {
		method: "GET",
		path: "/comments/:id",
		query: Comment.Read,
		responses: {
			200: Comment.View,
		},
	},
	update: {
		method: "PATCH",
		path: "/comments/:id",
		body: Comment.Update,
		responses: {
			200: Comment.View,
		},
	},
	delete: {
		method: "DELETE",
		path: "/comments/:id",
		body: c.body<null>(),
		responses: {
			204: c.response<null>(),
		},
	},

	// Extended comment-specific endpoints
	listByParent: {
		method: "GET",
		path: "/comments",
		query: z.object({
			parentId: z.string().optional(),
			authorId: z.string().optional(),
			page: z.number().optional(),
			limit: z.number().optional(),
			sortBy: z.enum(["created_at", "rating"]).optional(),
			order: z.enum(["asc", "desc"]).optional(),
		}),
		responses: {
			200: z.object({
				comments: z.array(Comment.View),
				total: z.number(),
			}),
		},
	},
	createReply: {
		method: "POST",
		path: "/comments/:parentId/replies",
		body: z.object({
			content: z.string(),
			authorId: z.string(),
		}),
		responses: {
			201: Comment.View,
		},
	},
	getReplies: {
		method: "GET",
		path: "/comments/:parentId/replies",
		query: z.object({
			page: z.number().optional(),
			limit: z.number().optional(),
			depth: z.number().optional(), // How deep to fetch nested replies
		}),
		responses: {
			200: z.object({
				replies: z.array(Comment.View),
				total: z.number(),
				hasMore: z.boolean(),
			}),
		},
	},
	getCommentThread: {
		method: "GET",
		path: "/comments/:id/thread",
		query: z.object({
			maxDepth: z.number().optional(),
		}),
		responses: {
			200: z.object({
				rootComment: Comment.View,
				totalReplies: z.number(),
				maxDepthReached: z.number(),
			}),
		},
	},
	getCommentsByAuthor: {
		method: "GET",
		path: "/users/:authorId/comments",
		query: z.object({
			page: z.number().optional(),
			limit: z.number().optional(),
			hasReplies: z.boolean().optional(),
		}),
		responses: {
			200: z.object({
				comments: z.array(Comment.View),
				total: z.number(),
			}),
		},
	},
	searchComments: {
		method: "GET",
		path: "/comments/search",
		query: z.object({
			query: z.string(),
			authorId: z.string().optional(),
			dateFrom: z.date().optional(),
			dateTo: z.date().optional(),
			limit: z.number().optional(),
		}),
		responses: {
			200: z.array(Comment.View),
		},
	},
	getCommentStats: {
		method: "GET",
		path: "/comments/:id/stats",
		responses: {
			200: z.object({
				totalReplies: z.number(),
				directReplies: z.number(),
				maxDepth: z.number(),
				popularReplies: z.array(Comment.View).max(3),
			}),
		},
	},
});
