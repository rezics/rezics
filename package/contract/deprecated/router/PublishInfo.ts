import { z } from "zod";
import { PublishInfo } from "../schema/PublishInfo";
import c from "./c";

export default c.router({
    // Standard CRUD operations
    create: {
        method: "POST",
        path: "/publish-info",
        body: PublishInfo.Create,
        responses: {
            201: PublishInfo.View,
        },
    },
    read: {
        method: "GET",
        path: "/publish-info/:id",
        query: PublishInfo.Read,
        responses: {
            200: PublishInfo.View,
        },
    },
    update: {
        method: "PATCH",
        path: "/publish-info/:id",
        body: PublishInfo.Update,
        responses: {
            200: PublishInfo.View,
        },
    },
    delete: {
        method: "DELETE",
        path: "/publish-info/:id",
        body: c.body<null>(),
        responses: {
            204: c.response<null>(),
        },
    },

    // Extended publish info-specific endpoints
    list: {
        method: "GET",
        path: "/publish-info",
        query: z.object({
            publisherId: z.string().optional(),
            bookId: z.string().optional(),
            dateFrom: z.date().optional(),
            dateTo: z.date().optional(),
            hasIsbn: z.boolean().optional(),
            page: z.number().optional(),
            limit: z.number().optional(),
        }),
        responses: {
            200: z.object({
                publishInfo: z.array(PublishInfo.View),
                total: z.number(),
            }),
        },
    },
    getByPublisher: {
        method: "GET",
        path: "/publishers/:publisherId/publish-info",
        query: z.object({
            page: z.number().optional(),
            limit: z.number().optional(),
            sortBy: z.enum(["date", "created_at"]).optional(),
            order: z.enum(["asc", "desc"]).optional(),
        }),
        responses: {
            200: z.object({
                publishInfo: z.array(PublishInfo.View),
                total: z.number(),
                publisher: z.object({
                    id: z.string(),
                    name: z.string(),
                    totalPublications: z.number(),
                }),
            }),
        },
    },
    searchByIsbn: {
        method: "GET",
        path: "/publish-info/search/isbn/:isbn",
        responses: {
            200: z.object({
                publishInfo: PublishInfo.View,
                book: z
                    .object({
                        id: z.string(),
                        name: z.string(),
                        authors: z.array(z.string()),
                    })
                    .optional(),
            }),
        },
    },
    validateIsbn: {
        method: "POST",
        path: "/publish-info/validate-isbn",
        body: z.object({
            isbn: z.string(),
        }),
        responses: {
            200: z.object({
                valid: z.boolean(),
                format: z.enum(["ISBN-10", "ISBN-13", "invalid"]),
                normalized: z.string().optional(),
                errors: z.array(z.string()).optional(),
            }),
        },
    },
    getPublishingHistory: {
        method: "GET",
        path: "/books/:bookId/publishing-history",
        responses: {
            200: z.object({
                book: z.object({
                    id: z.string(),
                    name: z.string(),
                }),
                publications: z.array(PublishInfo.View),
                timeline: z.array(
                    z.object({
                        date: z.date(),
                        publisher: z.string(),
                        edition: z.string().optional(),
                        isbn: z.string().optional(),
                    }),
                ),
                firstPublished: z.date().optional(),
                latestPublished: z.date().optional(),
            }),
        },
    },
    getPublishingStats: {
        method: "GET",
        path: "/publish-info/stats",
        query: z.object({
            publisherId: z.string().optional(),
            year: z.number().optional(),
            groupBy: z.enum(["publisher", "year", "month"]).optional(),
        }),
        responses: {
            200: z.object({
                totalPublications: z.number(),
                uniqueBooks: z.number(),
                uniquePublishers: z.number(),
                publicationsByPeriod: z.array(
                    z.object({
                        period: z.string(),
                        count: z.number(),
                    }),
                ),
                topPublishers: z
                    .array(
                        z.object({
                            publisherId: z.string(),
                            publisherName: z.string(),
                            publicationCount: z.number(),
                        }),
                    )
                    .max(10),
            }),
        },
    },
    duplicateIsbnCheck: {
        method: "GET",
        path: "/publish-info/duplicates/isbn",
        query: z.object({
            isbn: z.string().optional(),
        }),
        responses: {
            200: z.object({
                duplicates: z.array(
                    z.object({
                        isbn: z.string(),
                        publications: z.array(
                            z.object({
                                id: z.string(),
                                bookName: z.string(),
                                publisherName: z.string(),
                                publishDate: z.date(),
                            }),
                        ),
                        count: z.number(),
                    }),
                ),
                total: z.number(),
            }),
        },
    },
    updateIsbn: {
        method: "PUT",
        path: "/publish-info/:id/isbn",
        body: z.object({
            isbn: z.string(),
            reason: z.string().optional(),
        }),
        responses: {
            200: z.object({
                publishInfo: PublishInfo.View,
                previousIsbn: z.string().nullable(),
                validated: z.boolean(),
            }),
        },
    },
});
