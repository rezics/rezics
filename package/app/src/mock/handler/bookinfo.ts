import { graphql, HttpResponse } from "msw";
import { bookInfo01, authorInfo01 } from "../data/bookinfo01";

export const bookInfoHandlers = [
    // ANCHOR 🟢 Query: BookInfoQuery
    graphql.query("BookInfoQuery", ({ variables }) => {
        return HttpResponse.json({
            data: {
                book: bookInfo01,
                author: authorInfo01,
            },
        });
    }),
]
