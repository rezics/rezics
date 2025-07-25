import s from "./s";
import c from "contract";
import d from "database";

export default s.router(c.Homepage, {
    get: async () => {
        try {
            // Return mock homepage data
            const mockRecentBooks = [
                {
                    id: "book-1",
                    name: "The Great Adventure",
                    cover: null,
                    author: {
                        id: "author-1",
                        name: "John Doe"
                    },
                    created_at: new Date()
                },
                {
                    id: "book-2",
                    name: "Mystery of the Ancient",
                    cover: null,
                    author: {
                        id: "author-2",
                        name: "Jane Smith"
                    },
                    created_at: new Date()
                }
            ];

            const mockPopularTags = [
                {
                    id: "tag-1",
                    name: "Fiction"
                },
                {
                    id: "tag-2",
                    name: "Adventure"
                },
                {
                    id: "tag-3",
                    name: "Mystery"
                }
            ];

            return {
                status: 200,
                body: {
                    recentBooks: mockRecentBooks,
                    popularTags: mockPopularTags,
                    featuredBooks: mockRecentBooks.slice(0, 1),
                    stats: {
                        totalBooks: 42,
                        totalUsers: 100,
                        totalReviews: 150
                    }
                }
            };
        } catch (error) {
            return {
                status: 200,
                body: {
                    recentBooks: [],
                    popularTags: [],
                    featuredBooks: [],
                    stats: {
                        totalBooks: 0,
                        totalUsers: 0,
                        totalReviews: 0
                    }
                }
            };
        }
    }
});
