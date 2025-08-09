import c from "./c";
import { z } from "zod";
import { Post } from "../schema/Post";

export default c.router({
    // Standard CRUD operations
    create: {
        method: "POST",
        path: "/posts",
        body: Post.Create,
        responses: {
            201: Post.View,
        },
    },
    read: {
        method: "GET",
        path: "/posts/:id",
        query: Post.Read,
        responses: {
            200: Post.View,
        },
    },
    update: {
        method: "PATCH",
        path: "/posts/:id",
        body: Post.Update,
        responses: {
            200: Post.View,
        },
    },
    delete: {
        method: "DELETE",
        path: "/posts/:id",
        body: c.body<null>(),
        responses: {
            204: c.response<null>(),
        },
    },

    // Extended post-specific endpoints
    list: {
        method: "GET",
        path: "/posts",
        query: z.object({
            page: z.number().optional(),
            limit: z.number().optional(),
            search: z.string().optional(),
            authorId: z.string().optional(),
            tagId: z.string().optional(),
            sortBy: z
                .enum(["created_at", "updated_at", "rating", "name"])
                .optional(),
            order: z.enum(["asc", "desc"]).optional(),
        }),
        responses: {
            200: z.object({
                posts: z.array(Post.View),
                total: z.number(),
            }),
        },
    },
    listByAuthor: {
        method: "GET",
        path: "/users/:authorId/posts",
        query: z.object({
            page: z.number().optional(),
            limit: z.number().optional(),
            includePrivate: z.boolean().optional(),
        }),
        responses: {
            200: z.object({
                posts: z.array(Post.View),
                total: z.number(),
            }),
        },
    },
    getPostTags: {
        method: "GET",
        path: "/posts/:id/tags",
        responses: {
            200: z.array(
                z.object({
                    id: z.string(),
                    name: z.string(),
                    color: z.string(),
                    type: z.enum(["book", "thread"]),
                }),
            ),
        },
    },
    addTagToPost: {
        method: "POST",
        path: "/posts/:id/tags",
        body: z.object({
            tagId: z.string(),
        }),
        responses: {
            201: z.object({
                message: z.string(),
                tag: z.object({
                    id: z.string(),
                    name: z.string(),
                }),
            }),
        },
    },
    removeTagFromPost: {
        method: "DELETE",
        path: "/posts/:id/tags/:tagId",
        responses: {
            200: z.object({
                message: z.string(),
            }),
        },
    },
    getPostComments: {
        method: "GET",
        path: "/posts/:id/comments",
        query: z.object({
            page: z.number().optional(),
            limit: z.number().optional(),
            sortBy: z.enum(["created_at", "rating"]).optional(),
            order: z.enum(["asc", "desc"]).optional(),
        }),
        responses: {
            200: z.object({
                comments: z.array(
                    z.object({
                        id: z.string(),
                        content: z.string(),
                        authorId: z.string(),
                        authorName: z.string(),
                        created_at: z.date(),
                        replyCount: z.number(),
                    }),
                ),
                total: z.number(),
            }),
        },
    },
    searchPosts: {
        method: "GET",
        path: "/posts/search",
        query: z.object({
            query: z.string(),
            tagIds: z.array(z.string()).optional(),
            authorId: z.string().optional(),
            dateFrom: z.date().optional(),
            dateTo: z.date().optional(),
            limit: z.number().optional(),
        }),
        responses: {
            200: z.array(Post.View),
        },
    },
    getPostStats: {
        method: "GET",
        path: "/posts/:id/stats",
        responses: {
            200: z.object({
                viewCount: z.number(),
                upvotes: z.number(),
                downvotes: z.number(),
                favorites: z.number(),
                commentCount: z.number(),
                shareCount: z.number(),
            }),
        },
    },
    getTrendingPosts: {
        method: "GET",
        path: "/posts/trending",
        query: z.object({
            timeframe: z.enum(["hour", "day", "week", "month"]).optional(),
            limit: z.number().optional(),
            tagId: z.string().optional(),
        }),
        responses: {
            200: z.array(
                z.object({
                    post: Post.View,
                    trendScore: z.number(),
                    changeRate: z.number(),
                }),
            ),
        },
    },
});
