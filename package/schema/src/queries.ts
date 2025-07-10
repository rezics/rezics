import { gql } from "graphql-tag";

// ==================== 认证相关查询 ====================

export const LOGIN = gql`
    mutation Login($email: String!, $password: String!) {
        login(email: $email, password: $password) {
            token
            user {
                id
                name
                avatar
            }
        }
    }
`;

export const REGISTER = gql`
    mutation Register($email: String!, $password: String!) {
        register(email: $email, password: $password) {
            token
            user {
                id
                name
                avatar
            }
        }
    }
`;

export const VALIDATE_EMAIL = gql`
    mutation ValidateEmail($email: String!) {
        validateEmail(email: $email) {
            field
            message
        }
    }
`;

export const VALIDATE_PASSWORD = gql`
    mutation ValidatePassword($password: String!) {
        validatePassword(password: $password) {
            field
            message
        }
    }
`;

export const GET_ME = gql`
    query GetMe {
        me {
            id
            name
            avatar
        }
    }
`;

// ==================== 书籍相关查询 ====================

export const BOOK_INFO = gql`
    query BookInfo($id: ID!) {
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
            name
            avatar
            description
        }
    }
`;

export const CHAPTER_LIST = gql`
    query ChapterList($id: ID!) {
        chapters(id: $id) {
            id
            parentId
            chapterName
            noContent
        }
        chapterOrders(bookId: $id) {
            parentId
            childIds
        }
    }
`;

export const CHAPTER_CONTENT = gql`
    query ChapterContent($chapterId: ID!) {
        chapterContent(chapterId: $chapterId) {
            id
            content
            createdAt
            chapterName
            author {
                id
                name
                avatar
            }
        }
    }
`;

export const QUOTE_EXCERPTS = gql`
    query QuoteExcerpts($bookId: ID!) {
        quoteExcerpts(bookId: $bookId) {
            id
            content
            createdAt
            author {
                id
                name
                avatar
            }
        }
    }
`;

// ==================== 书单相关查询 ====================

export const BOOK_LISTS = gql`
    query BookLists($pagination: Pagination) {
        bookLists(pagination: $pagination) {
            items {
                id
                title
                description
                books
                creator {
                    id
                    name
                    avatar
                }
                likes
                commentsNumber
            }
            total
            page
            limit
            totalPages
        }
    }
`;

export const BOOK_LIST = gql`
    query BookList($id: ID!) {
        bookList(id: $id) {
            id
            title
            description
            books
            creator {
                id
                name
                avatar
            }
            likes
            commentsNumber
        }
    }
`;

export const COMMENTS = gql`
    query Comments($bookListId: ID!) {
        comments(bookListId: $bookListId) {
            id
            content
            createdAt
            likes
            user {
                id
                name
                avatar
            }
            replies {
                id
                content
                createdAt
                likes
                user {
                    id
                    name
                    avatar
                }
            }
        }
    }
`;

export const ADD_COMMENT = gql`
    mutation AddComment($bookListId: ID!, $content: String!) {
        addComment(bookListId: $bookListId, content: $content) {
            id
            content
            createdAt
            likes
            user {
                id
                name
                avatar
            }
        }
    }
`;

export const ADD_REPLY = gql`
    mutation AddReply($commentId: ID!, $content: String!) {
        addReply(commentId: $commentId, content: $content) {
            id
            content
            createdAt
            likes
            user {
                id
                name
                avatar
            }
        }
    }
`;

// ==================== 书评相关查询 ====================

export const BOOK_REVIEWS = gql`
    query BookReviews($bookId: ID!) {
        bookReviews(bookId: $bookId) {
            id
            content
            rating
            createdAt
            user {
                id
                name
                avatar
            }
        }
    }
`;

export const ADD_REVIEW = gql`
    mutation AddReview($bookId: ID!, $content: String!, $rating: Float!) {
        addReview(bookId: $bookId, content: $content, rating: $rating) {
            id
            content
            rating
            createdAt
            user {
                id
                name
                avatar
            }
        }
    }
`;

// ==================== 搜索相关查询 ====================

export const SEARCH_BOOKS = gql`
    query SearchBooks($query: String!) {
        searchBooks(query: $query) {
            id
            title
            author
            description
            cover
        }
    }
`;

export const TOP_BOOKS = gql`
    query TopBooks {
        topBooks {
            id
            title
            author
            description
            cover
        }
    }
`;