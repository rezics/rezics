import { graphql, http, HttpResponse } from "msw";

import { bookList01 } from "../data/bookList01";

import { bookRouter } from "contract/module/book";

export const bookHandlers = [
    http.get(bookRouter.list.path, () => {
        return HttpResponse.json({
            data: {
                books: bookList01,
            },
        });
    }),
    
    // ANCHOR 🟢 Query: GetBooks
    graphql.query("GetBooksDocument", ({ variables }) => {
        return HttpResponse.json({
            data: {
                books: [
                    { id: "1", title: "Mock Book 1", author: "Author A" },
                    { id: "2", title: "Mock Book 2", author: "Author B" },
                ],
            },
        });
    }),

    // ANCHOR 🟢 Mutation: AddBook
    graphql.mutation("AddBookDocument", async ({ variables }) => {
        const { title, author } = variables;

        return HttpResponse.json({
            data: {
                addBook: {
                    id: String(Math.floor(Math.random() * 10000)),
                    title,
                    author,
                },
            },
        });
    }),

    // ANCHOR 🟢 Query: SearchBooks
    graphql.query("SearchBooks", ({ variables }) => {
        console.log("SearchBooks", variables);

        return HttpResponse.json({
            data: {
                searchBooks: bookList01,
            },
        });
    }),
];
