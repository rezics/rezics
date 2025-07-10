export { BOOK_REVIEWS as GET_BOOK_REVIEWS } from "schema";

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
