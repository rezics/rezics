import { restClient } from "../plugin/providers/rest";

export interface QuoteExcerpt {
    id: string;
    content: string;
    createdAt: string;
    author: {
        name: string;
        avatar: string;
    };
}

// API functions
export const getQuotes = async (bookId?: string): Promise<QuoteExcerpt[]> => {
    const endpoint = bookId ? `/books/${bookId}/quotes` : "/quotes";
    return restClient.get<QuoteExcerpt[]>(endpoint);
};
