import { gql } from "urql";

export const QuoteExcerptQuery = gql`
    query QuoteExcerptQuery($bookId: ID!) {
        quotes(bookId: $bookId) {
            id
            content
            createdAt
            author {
                name
                avatar
            }
        }
    }
`;
