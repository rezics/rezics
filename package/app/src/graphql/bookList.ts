import { gql } from "urql";

export const GET_BOOKLIST = gql`
    query GetBookList($id: ID!) {
        bookList(id: $id) {
            id
            title
            description
            books
            creator {
                name
                avatar
            }
            likes
            commentsNumber
        }
    }
`;

export const GET_COMMENTS = gql`
    query GetComments($bookListId: ID!) {
        comments(bookListId: $bookListId) {
            id
            content
            createdAt
            user {
                name
                avatar
            }
            likes
            replies {
                id
                content
                createdAt
                user {
                    name
                    avatar
                }
                likes
            }
        }
    }
`;
