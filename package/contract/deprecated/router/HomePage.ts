import { z } from "zod";
import { HomePage } from "../schema/HomePage";
import c from "./c";

export default c.router({
    // Standard CRUD operations
    create: {
        method: "POST",
        path: "/homepage",
        body: HomePage.Create,
        responses: {
            201: HomePage.View,
        },
    },
    read: {
        method: "GET",
        path: "/homepage/:id",
        query: HomePage.Read,
        responses: {
            200: HomePage.View,
        },
    },
    update: {
        method: "PATCH",
        path: "/homepage/:id",
        body: HomePage.Update,
        responses: {
            200: HomePage.View,
        },
    },
    delete: {
        method: "DELETE",
        path: "/homepage/:id",
        body: c.body<null>(),
        responses: {
            204: c.response<null>(),
        },
    },

    // Extended homepage-specific endpoints
    getCurrentHomePage: {
        method: "GET",
        path: "/homepage/current",
        responses: {
            200: HomePage.View,
        },
    },
    getHomePageFeed: {
        method: "GET",
        path: "/homepage/feed",
        query: z.object({
            userId: z.string().optional(),
            includePersonalized: z.boolean().optional(),
            sections: z
                .array(
                    z.enum([
                        "featured_books",
                        "trending_posts",
                        "recent_reviews",
                        "recommended_readlists",
                        "popular_authors",
                        "new_releases",
                    ]),
                )
                .optional(),
        }),
        responses: {
            200: z.object({
                homepage: HomePage.View,
                sections: z.object({
                    featuredBooks: z
                        .array(
                            z.object({
                                id: z.string(),
                                name: z.string(),
                                cover: z.string().nullable(),
                                authors: z.array(z.string()),
                                rating: z.number().nullable(),
                                isNew: z.boolean(),
                            }),
                        )
                        .optional(),
                    trendingPosts: z
                        .array(
                            z.object({
                                id: z.string(),
                                title: z.string(),
                                authorName: z.string(),
                                excerpt: z.string(),
                                upvotes: z.number(),
                                commentCount: z.number(),
                            }),
                        )
                        .optional(),
                    recentReviews: z
                        .array(
                            z.object({
                                id: z.string(),
                                bookName: z.string(),
                                reviewerName: z.string(),
                                rating: z.number(),
                                excerpt: z.string(),
                                created_at: z.date(),
                            }),
                        )
                        .optional(),
                    recommendedReadlists: z
                        .array(
                            z.object({
                                id: z.string(),
                                name: z.string(),
                                creatorName: z.string(),
                                bookCount: z.number(),
                                description: z.string().nullable(),
                            }),
                        )
                        .optional(),
                    popularAuthors: z
                        .array(
                            z.object({
                                id: z.string(),
                                name: z.string(),
                                avatar: z.string().nullable(),
                                bookCount: z.number(),
                                followersCount: z.number(),
                            }),
                        )
                        .optional(),
                    newReleases: z
                        .array(
                            z.object({
                                id: z.string(),
                                name: z.string(),
                                cover: z.string().nullable(),
                                authors: z.array(z.string()),
                                publishDate: z.date(),
                            }),
                        )
                        .optional(),
                }),
            }),
        },
    },
    updateHomePageContent: {
        method: "PUT",
        path: "/homepage/content",
        body: z.object({
            content: z.string(),
            sections: z.array(z.string()).optional(),
            metadata: z.record(z.string(), z.any()).optional(),
        }),
        responses: {
            200: HomePage.View,
        },
    },
    getHomePageAnalytics: {
        method: "GET",
        path: "/homepage/analytics",
        query: z.object({
            timeframe: z.enum(["day", "week", "month"]).optional(),
            metrics: z
                .array(
                    z.enum([
                        "views",
                        "clicks",
                        "engagement",
                        "section_interactions",
                    ]),
                )
                .optional(),
        }),
        responses: {
            200: z.object({
                totalViews: z.number(),
                uniqueVisitors: z.number(),
                averageSessionTime: z.number(),
                sectionMetrics: z.record(
                    z.string(),
                    z.object({
                        views: z.number(),
                        clicks: z.number(),
                        engagementRate: z.number(),
                    }),
                ),
                popularContent: z.array(
                    z.object({
                        type: z.string(),
                        id: z.string(),
                        title: z.string(),
                        interactions: z.number(),
                    }),
                ),
            }),
        },
    },
    personalizeHomePage: {
        method: "POST",
        path: "/homepage/personalize",
        body: z.object({
            userId: z.string(),
            preferences: z.object({
                favoriteGenres: z.array(z.string()).optional(),
                followedAuthors: z.array(z.string()).optional(),
                readingGoals: z.array(z.string()).optional(),
                contentTypes: z
                    .array(
                        z.enum([
                            "books",
                            "reviews",
                            "posts",
                            "readlists",
                            "authors",
                        ]),
                    )
                    .optional(),
            }),
        }),
        responses: {
            200: z.object({
                personalizedHomepage: HomePage.View,
                recommendations: z.array(
                    z.object({
                        type: z.string(),
                        id: z.string(),
                        title: z.string(),
                        reason: z.string(),
                        score: z.number(),
                    }),
                ),
            }),
        },
    },
});
