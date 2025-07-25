import s from "./s";
import c from "contract";

// Mock books data
const mockBooks = new Map<string, {
    id: string;
    name: string;
    description: string | null;
    cover: string | null;
    length: number | null;
    released_at: string | null;
    real_updated_at: string | null;
    grabbed_from: string;
    created_at: string;
    updated_at: string;
    author: Array<{ id: string; name: string; description?: string }>;
    tags: Array<{ id: string; name: string; color: string; type: string }>;
    up: Array<{ id: string; name: string }>;
    down: Array<{ id: string; name: string }>;
    favorites: Array<{ id: string; name: string }>;
}>();

// Initialize with some mock data
const sampleBook = {
    id: "book_1",
    name: "Sample Book",
    description: "This is a sample book for testing",
    cover: "https://via.placeholder.com/300x400",
    length: 250,
    released_at: "2023-01-01T00:00:00Z",
    real_updated_at: "2023-12-01T00:00:00Z",
    grabbed_from: "sample-source",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    author: [{ id: "author_1", name: "Sample Author", description: "A sample author" }],
    tags: [{ id: "tag_1", name: "Fiction", color: "blue", type: "book" }],
    up: [],
    down: [],
    favorites: []
};

mockBooks.set(sampleBook.id, sampleBook);

export default s.router(c.Book, {
    get: async ({ params }: { params: any }) => {
        try {
            const { bookId } = params;
            
            const book = mockBooks.get(bookId);

            if (!book) {
                return {
                    status: 404,
                    body: { message: "Book not found" }
                };
            }

            return {
                status: 200,
                body: book
            };
        } catch (error) {
            console.error("Get book error:", error);
            return {
                status: 404,
                body: { message: "Book not found" }
            };
        }
    },

    update: async ({ params, body }: { params: any; body: any }) => {
        try {
            const { id } = params;
            const updateData = body;

            const book = mockBooks.get(id);
            if (!book) {
                return {
                    status: 404,
                    body: { message: "Book not found" }
                };
            }

            // Update fields
            if (updateData.name !== undefined) book.name = updateData.name;
            if (updateData.description !== undefined) book.description = updateData.description;
            if (updateData.cover !== undefined) book.cover = updateData.cover;
            if (updateData.length !== undefined) book.length = updateData.length;
            
            book.updated_at = new Date().toISOString();
            mockBooks.set(id, book);

            return {
                status: 200,
                body: book
            };
        } catch (error) {
            console.error("Update book error:", error);
            return {
                status: 404,
                body: { message: "Book not found" }
            };
        }
    },

    list: async ({ query }: { query: any }) => {
        try {
            const { page = 1, limit = 20, q } = query;
            const offset = (page - 1) * limit;

            let books = Array.from(mockBooks.values());

            // Filter by search query
            if (q) {
                books = books.filter(book => 
                    book.name.toLowerCase().includes(q.toLowerCase()) ||
                    (book.description && book.description.toLowerCase().includes(q.toLowerCase()))
                );
            }

            // Pagination
            const totalItems = books.length;
            const paginatedBooks = books.slice(offset, offset + limit);

            return {
                status: 200,
                body: {
                    items: paginatedBooks,
                    page,
                    totalItems
                }
            };
        } catch (error) {
            console.error("List books error:", error);
            return {
                status: 200,
                body: {
                    items: [],
                    page: 1,
                    totalItems: 0
                }
            };
        }
    },
});