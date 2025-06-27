import { graphql, HttpResponse } from "msw";
import { mockQuotes } from "../data/mockQuotes";

export const bookQuoteExcerptHandlers = [
    // ANCHOR 🟢 Query: QuoteExcerptQuery
    graphql.query("QuoteExcerptQuery", ({ variables }) => {
        return HttpResponse.json({
            data: {
                quotes: mockQuotes,
            },
        });
    }),
] 