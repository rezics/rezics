import { http, HttpResponse } from "msw";

import { bookList01 } from "../data/bookList01";

export const bookHandlers = [
    // ANCHOR 🟢 REST: GET /books
    http.get("/books", () => {
        return HttpResponse.json([
            { id: "1", title: "Mock Book 1", author: "Author A" },
            { id: "2", title: "Mock Book 2", author: "Author B" },
        ]);
    }),

    // ANCHOR 🟢 REST: POST /books
    http.post("/books", async ({ request }) => {
        const { title, author } = await request.json();

        return HttpResponse.json({
            id: String(Math.floor(Math.random() * 10000)),
            title,
            author,
        });
    }),

    // ANCHOR 🟢 REST: GET /books/search
    http.get("/books/search", ({ request }) => {
        const url = new URL(request.url);
        const query = url.searchParams.get('q');
        console.log("SearchBooks", { query });

        return HttpResponse.json(bookList01);
    }),
];
