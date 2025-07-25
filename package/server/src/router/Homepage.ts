import s from "./s";
import c from "contract";
import d from "database";

export default s.router(c.Homepage, {
    get: async () => {
        try {
            // Get featured books, recent books, popular tags, etc.
            const recentBooks = await d.select(d.Book, (book) => ({
                id: true,
                name: true,
                cover: true,
                author: {
                    id: true,
                    name: true,
                },
                created_at: true,
                order: {
                    by: book.created_at,
                    direction: 'desc'
                },
                limit: 10
            }));

            const popularTags = await d.select(d.CustomTag, (tag) => ({
                id: true,
                name: true,
                limit: 20
            }));

            return {
                status: 200,
                body: {
                    recentBooks,
                    popularTags,
                    featuredBooks: recentBooks.slice(0, 5), // Use recent books as featured for now
                    stats: {
                        totalBooks: 0,
                        totalUsers: 0,
                        totalReviews: 0
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
