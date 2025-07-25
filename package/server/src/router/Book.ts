import s from "./s";
import c from "contract";
import d from "database";

export default s.router(c.Book, {
    get: async ({ params: { bookId } }) => {
        try {
            const book = await d.select(d.Book, (book) => ({
                id: true,
                icsId: true,
                name: true,
                cover: true,
                description: true,
                length: true,
                created_at: true,
                updated_at: true,
                author: {
                    id: true,
                    name: true,
                },
                tags: {
                    id: true,
                    name: true,
                },
                filter: d.op(book.id, '=', d.uuid(bookId))
            }));

            if (!book[0]) {
                return {
                    status: 404,
                    body: { message: "Book not found" }
                };
            }

            return {
                status: 200,
                body: book[0]
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
            const updatedBook = await d.update(d.Book, (book) => ({
                filter: d.op(book.id, '=', d.uuid(id)),
                set: {
                    name: body.name,
                    cover: body.cover,
                    description: body.description,
                    length: body.length,
                    updated_at: new Date(),
                }
            }));

            if (!updatedBook[0]) {
                return {
                    status: 404,
                    body: { message: "Book not found" }
                };
            }

            return {
                status: 200,
                body: updatedBook[0]
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
            const { page = 1, limit = 20, q } = query;
            const offset = (page - 1) * limit;

            let books;
            if (q) {
                // Search by name if query provided
                books = await d.select(d.Book, (book) => ({
                    id: true,
                    icsId: true,
                    name: true,
                    cover: true,
                    description: true,
                    length: true,
                    created_at: true,
                    updated_at: true,
                    author: {
                        id: true,
                        name: true,
                    },
                    tags: {
                        id: true,
                        name: true,
                    },
                    filter: d.op(book.name, 'ilike', `%${q}%`),
                    offset,
                    limit
                }));
            } else {
                books = await d.select(d.Book, (book) => ({
                    id: true,
                    icsId: true,
                    name: true,
                    cover: true,
                    description: true,
                    length: true,
                    created_at: true,
                    updated_at: true,
                    author: {
                        id: true,
                        name: true,
                    },
                    tags: {
                        id: true,
                        name: true,
                    },
                    offset,
                    limit
                }));
            }

            return {
                status: 200,
                body: {
                    items: books,
                    page,
                    totalItems: books.length,
                    hasMore: books.length === limit
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
