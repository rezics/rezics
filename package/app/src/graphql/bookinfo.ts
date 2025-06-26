import { gql } from "urql";

export const BookInfoQuery = gql`
    query BookInfoQuery($id: ID!) {
        book(id: $id) {
            id
            title
            cover
            author
            rating
            publisher
            publishDate
            isbn
            tags
            description
        }
        author(id: $id) {
            id
            name
            avatar
            description
        }
    }
`;
