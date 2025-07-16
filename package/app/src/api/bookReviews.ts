import { gql } from "graphql-tag";

export interface BookReview {
    id: string;
    title: string;
    content: string;
    rating: number;
    createdAt: string;
    user: {
        id: string;
        name: string;
        avatar: string;
    };
}

export const GET_BOOK_REVIEWS = gql`
    query GetBookReviews($bookId: ID!) {
        bookReviews(bookId: $bookId) {
            id
            title
            content
            rating
            createdAt
            user {
                id
                name
                avatar
            }
        }
    }
`;

export const GET_BOOK_SHORT_REVIEWS = gql`
    query GetBookShortReviews($bookId: ID!) {
        bookShortReviews(bookId: $bookId) {
            id
            title
            content
            rating
            createdAt
            user {
                id
                name
                avatar
            }
        }
    }
`;