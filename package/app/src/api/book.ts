import { gql } from "urql";

export interface Book {
    id: string;
    title: string;
    cover: string;
    author: string;
    rating: number;
    publisher: string;
    publishDate: string;
    isbn: string;
    // tags: TagGroupObject[];
    tags: string[];
    description: string;
}

export interface Author {
    name: string;
    avatar: string;
    description: string;
}


export interface BookInfo {
    book: Book;
    author: Author;
    loading: boolean;
    error: string | null;
}


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

export const ChapterListQuery = gql`
    query ChapterListQuery($id: ID!) {
        chapters(id: $id) {
            ID
            ParentID
            ChapterName
            NoContent
        }
        chapterOrders(bookId: $id) {
            parentId
            childIds
        }
    }
`;
