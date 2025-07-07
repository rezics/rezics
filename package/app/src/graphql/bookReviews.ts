import { gql } from 'graphql-tag'

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

export const GET_BOOK_REVIEWS = gql`
  query GetBookReviews($bookId: ID!) {
    bookReviews(bookId: $bookId) {
      id
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
` 