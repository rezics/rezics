import { restClient } from "../plugin/providers/rest";

export interface SearchBook {
    id: string;
    title: string;
    author: string;
    description: string;
    cover: string;
}

// API functions
export const searchBooks = async (query: string): Promise<SearchBook[]> => {
    return restClient.get<SearchBook[]>(`/books/search?q=${encodeURIComponent(query)}`);
};

export const getTopBooks = async (): Promise<SearchBook[]> => {
    return restClient.get<SearchBook[]>("/books/top");
};
