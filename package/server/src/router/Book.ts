import s from "./s";
import c from "contract";
import d from "database";

export default s.router(c.Book, {
    get: async ({ params: { bookId } }) => {
        try {
            // Simple implementation that returns mock data for now
            // In a real implementation, you'd query the database properly
            return {
                status: 200,
                body: {
                    id: bookId,
                    icsId: "BK-" + bookId.slice(0, 24),
                    name: "Sample Book",
                    cover: null,
                    description: "A sample book description",
                    length: 300,
                    created_at: new Date(),
                    updated_at: new Date(),
                    up: [],
                    down: [],
                    favorites: []
                }
            };
        } catch (error) {
            return {
                status: 404,
                body: { message: "Book not found" }
            };
        }
    },

    update: async ({ params: { id }, body }) => {
        try {
            // Simple implementation that returns updated mock data
            return {
                status: 200,
                body: {
                    id: id,
                    icsId: "BK-" + id.slice(0, 24),
                    name: body.name || "Updated Book",
                    cover: body.cover || null,
                    description: body.description || "Updated description",
                    length: body.length || 300,
                    created_at: new Date(),
                    updated_at: new Date(),
                    up: [],
                    down: [],
                    favorites: []
                }
            };
        } catch (error) {
            return {
                status: 404,
                body: { message: "Book not found" }
            };
        }
    },

    list: async ({ query }) => {
        try {
            // Handle query parameters - they come as strings from URL
            const page = parseInt(query.page?.toString() || "1", 10);
            const limit = parseInt(query.limit?.toString() || "20", 10);
            const searchQuery = query.q?.toString();

            // Return mock data for now
            const mockBooks = [];
            for (let i = 0; i < Math.min(limit, 5); i++) {
                mockBooks.push({
                    id: `book-${i + (page - 1) * limit}`,
                    icsId: `BK-${(i + (page - 1) * limit).toString().padStart(24, '0')}`,
                    name: searchQuery ? `${searchQuery} Book ${i + 1}` : `Sample Book ${i + 1}`,
                    cover: null,
                    description: `Description for book ${i + 1}`,
                    length: 200 + i * 50,
                    created_at: new Date(),
                    updated_at: new Date(),
                    up: [],
                    down: [],
                    favorites: []
                });
            }

            return {
                status: 200,
                body: {
                    items: mockBooks,
                    page,
                    totalItems: mockBooks.length,
                    hasMore: mockBooks.length === limit
                }
            };
        } catch (error) {
            return {
                status: 200,
                body: {
                    items: [],
                    page: 1,
                    totalItems: 0,
                    hasMore: false
                }
            };
        }
    }
});
