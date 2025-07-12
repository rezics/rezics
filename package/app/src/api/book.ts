import { restClient } from "../plugin/providers/rest";

export interface Book {
    id: string;
    title: string;
    cover: string;
    author: string;
    rating: number;
    publisher: string;
    publishDate: string;
    isbn: string;
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

export interface Chapter {
    ID: string;
    ParentID: string;
    ChapterName: string;
    NoContent: boolean;
}

export interface ChapterOrder {
    parentId: string;
    childIds: string[];
}

export interface ChapterData {
    chapters: Chapter[];
    chapterOrders: ChapterOrder[];
}

// API functions
export const getBookInfo = async (id: string): Promise<{ book: Book; author: Author }> => {
    return restClient.get<{ book: Book; author: Author }>(`/books/${id}/info`);
};

export const getChapterList = async (id: string): Promise<ChapterData> => {
    return restClient.get<ChapterData>(`/books/${id}/chapters`);
};

export const getBooks = async (): Promise<Book[]> => {
    return restClient.get<Book[]>("/books");
};

export const searchBooks = async (query: string): Promise<Book[]> => {
    return restClient.get<Book[]>(`/books/search?q=${encodeURIComponent(query)}`);
};

export const addBook = async (title: string, author: string): Promise<Book> => {
    return restClient.post<Book>("/books", { title, author });
};
