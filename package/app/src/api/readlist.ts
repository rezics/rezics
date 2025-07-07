import { gql } from "urql";

export interface BookList {
    id: string;
    title: string;
    description: string;
    books: string[];
    creator: {
        name: string;
        avatar: string;
    };
    likes: number;
}

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
            author {
                name
                avatar
            }
            likes
            replies {
                id
                content
                createdAt
                author {
                    name
                    avatar
                }
                likes
            }
        }
    }
`;

// Get book lists list
export const bookListsQuery = gql`
    query bookListsQuery {
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
`;
