import { gql } from 'graphql-tag'

export const SEARCH_BOOKS = gql`
    query SearchBooks($query: String!) {
        searchBooks(query: $query) {
            id
            title
            author
            description
            imageUrl
        }
    }
`

export const TOP_BOOKS = gql`
    query TopBooks {
        topBooks {
            id
            title
            author
            description
            imageUrl
        }
    }
`