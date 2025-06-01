import { gql } from 'graphql-tag'

export const GET_BOOKLISTS = gql`
  query GetBookLists {
    bookLists {
      id
      title
      description
      books
      creator {
        name
        avatar
      }
      likes
    }
  }
` 