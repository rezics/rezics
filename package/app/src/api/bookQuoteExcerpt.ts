import { gql } from "urql";

export interface QuoteExcerpt {
    id: string;
    content: string;
    createdAt: string;
    author: {
        name: string;
        avatar: string;
    };
}

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
