import c from "./c";
import { z } from "zod";
import { User } from "../schema/User";

export default c.router({
	// Standard CRUD operations
	create: {
		method: "POST",
		path: "/users",
		body: User.Create,
		responses: {
			201: User.View,
		},
	},
	read: {
		method: "GET",
		path: "/users/:id",
		query: User.Read,
		responses: {
			200: User.View,
		},
	},
	update: {
		method: "PATCH",
		path: "/users/:id",
		body: User.Update,
		responses: {
			200: User.View,
		},
	},
	delete: {
		method: "DELETE",
		path: "/users/:id",
		body: c.body<null>(),
		responses: {
			204: c.response<null>(),
		},
	},

	// Extended user-specific endpoints
	signup: {
		method: "POST",
		path: "/auth/signup",
		body: User.Signup,
		responses: {
			201: User.View,
		},
	},
	login: {
		method: "POST",
		path: "/auth/login",
		body: User.Login,
		responses: {
			200: z.object({
				user: User.View,
				token: z.string(),
			}),
		},
	},
	profile: {
		method: "GET",
		path: "/auth/profile",
		responses: {
			200: User.View,
		},
	},
	list: {
		method: "GET",
		path: "/users",
		query: z.object({
			page: z.number().optional(),
			limit: z.number().optional(),
			search: z.string().optional(),
		}),
		responses: {
			200: z.object({
				users: z.array(User.Preview),
				total: z.number(),
			}),
		},
	},
	getUserBooks: {
		method: "GET",
		path: "/users/:id/books",
		responses: {
			200: z.array(
				z.object({
					id: z.string(),
					name: z.string(),
					cover: z.string().nullable(),
				}),
			),
		},
	},
	getUserReadLists: {
		method: "GET",
		path: "/users/:id/readlists",
		responses: {
			200: z.array(
				z.object({
					id: z.string(),
					name: z.string(),
					description: z.string().nullable(),
					bookCount: z.number(),
				}),
			),
		},
	},
	getUserReviews: {
		method: "GET",
		path: "/users/:id/reviews",
		query: z.object({
			page: z.number().optional(),
			limit: z.number().optional(),
		}),
		responses: {
			200: z.object({
				reviews: z.array(
					z.object({
						id: z.string(),
						title: z.string(),
						content: z.string(),
						rating: z.number(),
						bookId: z.string(),
						bookName: z.string(),
						created_at: z.date(),
					}),
				),
				total: z.number(),
			}),
		},
	},
});
