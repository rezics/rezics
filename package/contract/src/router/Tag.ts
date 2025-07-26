import c from "./c";
import { z } from "zod";
import { Tag } from "../schema/Tag";

export default c.router({
    // Standard CRUD operations
    create: {
        method: "POST",
        path: "/tags",
        body: Tag.Create,
        responses: {
            201: Tag.View,
        },
    },
    read: {
        method: "GET",
        path: "/tags/:id",
        query: Tag.Read,
        responses: {
            200: Tag.View,
        },
    },
    update: {
        method: "PATCH",
        path: "/tags/:id",
        body: Tag.Update,
        responses: {
            200: Tag.View,
        },
    },
    delete: {
        method: "DELETE",
        path: "/tags/:id",
        body: c.body<null>(),
        responses: {
            204: c.response<null>(),
        },
    },

    // Extended tag-specific endpoints
    list: {
        method: "GET",
        path: "/tags",
        query: z.object({
            page: z.number().optional(),
            limit: z.number().optional(),
            search: z.string().optional(),
            type: z.enum(["book", "thread"]).optional(),
            color: z.string().optional(),
        }),
        responses: {
            200: z.object({
                tags: z.array(Tag.View),
                total: z.number(),
            }),
        },
    },

    // Tag groups management
    createTagGroup: {
        method: "POST",
        path: "/tag-groups",
        body: Tag.Create,
        responses: {
            201: Tag.View,
        },
    },
    updateTagGroup: {
        method: "PUT",
        path: "/tag-groups/:id",
        body: Tag.Update,
        responses: {
            200: Tag.View,
        },
    },
    deleteTagGroup: {
        method: "DELETE",
        path: "/tag-groups/:id",
        responses: {
            200: z.object({
                message: z.string(),
            }),
        },
    },

    // Sub-tags based on book and tag (as requested)
    getSubTagsForBookAndTag: {
        method: "GET",
        path: "/books/:bookId/tags/:tagId/sub-tags",
        responses: {
            200: z.array(Tag.View),
        },
    },

    // Tag-added event recording (as requested)
    recordTagAddedEvent: {
        method: "POST",
        path: "/tags/events/tag-added",
        body: z.object({
            tagId: z.string(),
            targetType: z.enum(["book", "thread", "user"]),
            targetId: z.string(),
            userId: z.string(),
            metadata: z.record(z.string(), z.any()).optional(),
        }),
        responses: {
            201: z.object({
                message: z.string(),
                eventId: z.string(),
                timestamp: z.date(),
            }),
        },
    },

    // Book-tag relationships
    getBookTags: {
        method: "GET",
        path: "/books/:bookId/tags",
        responses: {
            200: z.array(Tag.View),
        },
    },
    getTagsInTagGroup: {
        method: "GET",
        path: "/books/:bookId/tags/tag-group/:tagGroupId",
        responses: {
            200: z.array(Tag.View),
        },
    },
    getTagsFromMultipleTagGroups: {
        method: "GET",
        path: "/books/:bookId/tags/tag-groups",
        query: z.object({
            tagGroupIds: z.array(z.string()),
        }),
        responses: {
            200: z.array(Tag.View),
        },
    },

    // Thread-tag relationships
    getThreadTags: {
        method: "GET",
        path: "/threads/:threadId/tags",
        responses: {
            200: z.array(Tag.View),
        },
    },

    // Tag relationship management
    addTagToBook: {
        method: "POST",
        path: "/books/:bookId/tags",
        body: z.object({
            tagId: z.string(),
        }),
        responses: {
            201: z.object({
                message: z.string(),
                tag: Tag.View,
            }),
        },
    },
    removeTagFromBook: {
        method: "DELETE",
        path: "/books/:bookId/tags/:tagId",
        responses: {
            200: z.object({
                message: z.string(),
            }),
        },
    },
    addTagToThread: {
        method: "POST",
        path: "/threads/:threadId/tags",
        body: z.object({
            tagId: z.string(),
        }),
        responses: {
            201: z.object({
                message: z.string(),
                tag: Tag.View,
            }),
        },
    },
    removeTagFromThread: {
        method: "DELETE",
        path: "/threads/:threadId/tags/:tagId",
        responses: {
            200: z.object({
                message: z.string(),
            }),
        },
    },

    // Tag analytics and statistics
    getTagStats: {
        method: "GET",
        path: "/tags/:id/stats",
        responses: {
            200: z.object({
                usageCount: z.number(),
                bookCount: z.number(),
                threadCount: z.number(),
                popularBooks: z
                    .array(
                        z.object({
                            id: z.string(),
                            name: z.string(),
                            cover: z.string().nullable(),
                        }),
                    )
                    .max(5),
            }),
        },
    },
    getPopularTags: {
        method: "GET",
        path: "/tags/popular",
        query: z.object({
            type: z.enum(["book", "thread"]).optional(),
            limit: z.number().optional(),
        }),
        responses: {
            200: z.array(
                z.object({
                    tag: Tag.View,
                    usageCount: z.number(),
                }),
            ),
        },
    },
});
