export { QUOTE_EXCERPTS as QuoteExcerptQuery } from "schema";

export interface QuoteExcerpt {
    id: string;
    content: string;
    createdAt: string;
    author: {
        name: string;
        avatar: string;
    };
}
