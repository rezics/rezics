import { restClient } from "../plugin/providers/rest";

export interface BookReview {
    id: string;
    content: string;
    rating: number;
    createdAt: string;
    user: {
        id: string;
        name: string;
        avatar: string;
    };
}

// API functions
export const getBookReviews = async (bookId: string): Promise<BookReview[]> => {
    return restClient.get<BookReview[]>(`/books/${bookId}/reviews`);
};

export const addBookReview = async (bookId: string, content: string, rating: number): Promise<BookReview> => {
    return restClient.post<BookReview>(`/books/${bookId}/reviews`, { content, rating });
};
