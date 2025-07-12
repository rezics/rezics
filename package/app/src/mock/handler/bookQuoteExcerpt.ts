import { http, HttpResponse } from "msw";
import { mockQuotes } from "../data/mockQuotes";

export const bookQuoteExcerptHandlers = [
    // ANCHOR 🟢 REST: GET /quotes
    http.get("/quotes", () => {
        return HttpResponse.json(mockQuotes);
    }),
];
