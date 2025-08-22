import { z } from "zod";
import { Quote, Review } from "../schema/Review";
import c from "./c";

export default c.router({
	// Standard CRUD operations for reviews
	create: {
		method: "POST",
		path: "/reviews",
		body: Review.Create,
		responses: {
			201: Review.View,
		},
	},
	read: {
		method: "GET",
		path: "/reviews/:id",
		query: Review.Read,
		responses: {
			200: Review.View,
		},
	},
	update: {
		method: "PATCH",
		path: "/reviews/:id",
		body: Review.Update,
		responses: {
			200: Review.View,
		},
	},
	delete: {
		method: "DELETE",
		path: "/reviews/:id",
		body: c.body<null>(),
		responses: {
			204: c.response<null>(),
		},
	},

	// Extended review-specific endpoints
	listByBook: {
		method: "GET",
		path: "/books/:bookId/reviews",
		query: z.object({
			page: z.number().optional(),
			limit: z.number().optional(),
			minRating: z.number().optional(),
			maxRating: z.number().optional(),
			sortBy: z.enum(["created_at", "rating", "helpful"]).optional(),
			order: z.enum(["asc", "desc"]).optional(),
		}),
		responses: {
			200: z.object({
				reviews: z.array(Review.View),
				total: z.number(),
				averageRating: z.number(),
			}),
		},
	},
	listByUser: {
		method: "GET",
		path: "/users/:userId/reviews",
		query: z.object({
			page: z.number().optional(),
			limit: z.number().optional(),
		}),
		responses: {
			200: z.object({
				reviews: z.array(Review.View),
				total: z.number(),
			}),
		},
	},
	createQuote: {
		method: "POST",
		path: "/quotes",
		body: Quote.Create,
		responses: {
			201: Quote.View,
		},
	},
	getQuote: {
		method: "GET",
		path: "/quotes/:id",
		responses: {
			200: Quote.View,
		},
	},
	updateQuote: {
		method: "PATCH",
		path: "/quotes/:id",
		body: Quote.Update,
		responses: {
			200: Quote.View,
		},
	},
	deleteQuote: {
		method: "DELETE",
		path: "/quotes/:id",
		body: c.body<null>(),
		responses: {
			204: c.response<null>(),
		},
	},
	listQuotesByBook: {
		method: "GET",
		path: "/books/:bookId/quotes",
		query: z.object({
			page: z.number().optional(),
			limit: z.number().optional(),
			chapterId: z.string().optional(),
		}),
		responses: {
			200: z.object({
				quotes: z.array(Quote.View),
				total: z.number(),
			}),
		},
	},
	listQuotesByChapter: {
		method: "GET",
		path: "/chapters/:chapterId/quotes",
		query: z.object({
			page: z.number().optional(),
			limit: z.number().optional(),
		}),
		responses: {
			200: z.object({
				quotes: z.array(Quote.View),
				total: z.number(),
			}),
		},
	},
	markReviewHelpful: {
		method: "POST",
		path: "/reviews/:id/helpful",
		body: c.body<null>(),
		responses: {
			200: z.object({
				message: z.string(),
				helpfulCount: z.number(),
			}),
		},
	},
});
