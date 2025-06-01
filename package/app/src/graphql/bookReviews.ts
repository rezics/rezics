import { gql } from 'graphql-tag'

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