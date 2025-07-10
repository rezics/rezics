export { BOOK_INFO as BookInfoQuery, CHAPTER_LIST as ChapterListQuery } from "schema";

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
