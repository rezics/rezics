import { restClient } from "../plugin/providers/rest";

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
    commentsNumber: number;
}

export interface Comment {
    id: string;
    content: string;
    createdAt: string;
    user: {
        name: string;
        avatar: string;
    };
    likes: number;
    replies?: Comment[];
}

// API functions
export const getBookList = async (id: string): Promise<BookList> => {
    return restClient.get<BookList>(`/booklists/${id}`);
};

export const getComments = async (bookListId: string): Promise<Comment[]> => {
    return restClient.get<Comment[]>(`/booklists/${bookListId}/comments`);
};

export const getBookLists = async (): Promise<BookList[]> => {
    return restClient.get<BookList[]>("/booklists");
};

export const addComment = async (bookListId: string, content: string): Promise<Comment> => {
    return restClient.post<Comment>(`/booklists/${bookListId}/comments`, { content });
};

export const addReply = async (commentId: string, content: string): Promise<Comment> => {
    return restClient.post<Comment>(`/comments/${commentId}/replies`, { content });
};
