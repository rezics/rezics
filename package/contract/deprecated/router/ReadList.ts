import c from "./c";
import { z } from "zod";
import { ReadList } from "../schema/ReadList";

export default c.router({
	// Standard CRUD operations
	create: {
		method: "POST",
		path: "/readlists",
		body: ReadList.Create,
		responses: {
			201: ReadList.View,
		},
	},
	read: {
		method: "GET",
		path: "/readlists/:id",
		query: ReadList.Read,
		responses: {
			200: ReadList.View,
		},
	},
	update: {
		method: "PATCH",
		path: "/readlists/:id",
		body: ReadList.Update,
		responses: {
			200: ReadList.View,
		},
	},
	delete: {
		method: "DELETE",
		path: "/readlists/:id",
		body: c.body<null>(),
		responses: {
			204: c.response<null>(),
		},
	},

	// Extended readlist-specific endpoints
	list: {
		method: "GET",
		path: "/readlists",
		query: z.object({
			page: z.number().optional(),
			limit: z.number().optional(),
			search: z.string().optional(),
			creatorId: z.string().optional(),
			sortBy: z.enum(["created_at", "name", "bookCount"]).optional(),
			order: z.enum(["asc", "desc"]).optional(),
		}),
		responses: {
			200: z.object({
				readlists: z.array(ReadList.View),
				total: z.number(),
			}),
		},
	},
	listByUser: {
		method: "GET",
		path: "/users/:userId/readlists",
		query: z.object({
			page: z.number().optional(),
			limit: z.number().optional(),
		}),
		responses: {
			200: z.object({
				readlists: z.array(ReadList.View),
				total: z.number(),
			}),
		},
	},
	addBook: {
		method: "POST",
		path: "/readlists/:id/books",
		body: z.object({
			bookId: z.string(),
		}),
		responses: {
			201: z.object({
				message: z.string(),
				readlist: ReadList.View,
			}),
		},
	},
	removeBook: {
		method: "DELETE",
		path: "/readlists/:id/books/:bookId",
		responses: {
			200: z.object({
				message: z.string(),
				readlist: ReadList.View,
			}),
		},
	},
	getBooks: {
		method: "GET",
		path: "/readlists/:id/books",
		query: z.object({
			page: z.number().optional(),
			limit: z.number().optional(),
		}),
		responses: {
			200: z.object({
				books: z.array(
					z.object({
						id: z.string(),
						name: z.string(),
						cover: z.string().nullable(),
						authors: z.array(
							z.object({
								id: z.string(),
								name: z.string(),
							}),
						),
						rating: z.number().nullable(),
						addedAt: z.date(),
					}),
				),
				total: z.number(),
			}),
		},
	},
	getReadListsContainingBook: {
		method: "GET",
		path: "/books/:bookId/readlists",
		query: z.object({
			page: z.number().optional(),
			limit: z.number().optional(),
		}),
		responses: {
			200: z.object({
				readlists: z.array(
					z.object({
						id: z.string(),
						name: z.string(),
						description: z.string().nullable(),
						creatorName: z.string(),
						bookCount: z.number(),
					}),
				),
				total: z.number(),
			}),
		},
	},
	cloneReadList: {
		method: "POST",
		path: "/readlists/:id/clone",
		body: z.object({
			name: z.string().optional(),
			description: z.string().optional(),
		}),
		responses: {
			201: ReadList.View,
		},
	},
});
