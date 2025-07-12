import { initContract } from '@ts-rest/core';
import { z } from 'zod';

// Define schemas directly here to avoid import issues
const User = z.object({
    id: z.string(),
    name: z.string(),
    avatar: z.string(),
});

const Review = z.object({
    id: z.string(),
    content: z.string(),
    rating: z.number(),
    createdAt: z.string(),
    user: User,
});

const BookList = z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    books: z.array(z.string()),
    creator: User,
    likes: z.number(),
    commentsNumber: z.number(),
});

const Comment = z.object({
    id: z.string(),
    content: z.string(),
    createdAt: z.string(),
    user: User,
    likes: z.number(),
    replies: z.array(z.lazy(() => Comment)).optional(),
});

const AuthPayload = z.object({
    token: z.string(),
    user: User,
});

const ValidationError = z.object({
    field: z.string(),
    message: z.string(),
});

const c = initContract();

// Input schemas for API requests
const LoginInput = z.object({
    email: z.string().email(),
    password: z.string(),
});

const RegisterInput = z.object({
    email: z.string().email(),
    password: z.string(),
});

const EmailValidationInput = z.object({
    email: z.string().email(),
});

const PasswordValidationInput = z.object({
    password: z.string(),
});

// API contract
export const contract = c.router({
    // Authentication routes
    auth: {
        login: {
            method: 'POST',
            path: '/auth/login',
            body: LoginInput,
            responses: {
                200: AuthPayload,
                400: z.array(ValidationError),
            },
        },
        register: {
            method: 'POST',
            path: '/auth/register',
            body: RegisterInput,
            responses: {
                200: AuthPayload,
                400: z.array(ValidationError),
            },
        },
        me: {
            method: 'GET',
            path: '/auth/me',
            responses: {
                200: User,
                401: z.object({ message: z.string() }),
            },
        },
    },
    
    // Validation routes
    validation: {
        email: {
            method: 'POST',
            path: '/validation/email',
            body: EmailValidationInput,
            responses: {
                200: z.array(ValidationError),
            },
        },
        password: {
            method: 'POST',
            path: '/validation/password',
            body: PasswordValidationInput,
            responses: {
                200: z.array(ValidationError),
            },
        },
    },
    
    // Book routes
    books: {
        reviews: {
            method: 'GET',
            path: '/books/:bookId/reviews',
            pathParams: z.object({ bookId: z.string() }),
            responses: {
                200: z.array(Review),
            },
        },
        addReview: {
            method: 'POST',
            path: '/books/:bookId/reviews',
            pathParams: z.object({ bookId: z.string() }),
            body: z.object({
                content: z.string(),
                rating: z.number(),
            }),
            responses: {
                200: Review,
                400: z.object({ message: z.string() }),
            },
        },
    },
    
    // BookList routes
    bookLists: {
        getAll: {
            method: 'GET',
            path: '/booklists',
            responses: {
                200: z.array(BookList),
            },
        },
        getOne: {
            method: 'GET',
            path: '/booklists/:id',
            pathParams: z.object({ id: z.string() }),
            responses: {
                200: BookList,
                404: z.object({ message: z.string() }),
            },
        },
        comments: {
            method: 'GET',
            path: '/booklists/:bookListId/comments',
            pathParams: z.object({ bookListId: z.string() }),
            responses: {
                200: z.array(Comment),
            },
        },
        addComment: {
            method: 'POST',
            path: '/booklists/:bookListId/comments',
            pathParams: z.object({ bookListId: z.string() }),
            body: z.object({
                content: z.string(),
            }),
            responses: {
                200: Comment,
                400: z.object({ message: z.string() }),
            },
        },
    },
    
    // Comment routes
    comments: {
        addReply: {
            method: 'POST',
            path: '/comments/:commentId/replies',
            pathParams: z.object({ commentId: z.string() }),
            body: z.object({
                content: z.string(),
            }),
            responses: {
                200: Comment,
                400: z.object({ message: z.string() }),
            },
        },
    },
});

// Export types
export type User = z.infer<typeof User>;
export type Review = z.infer<typeof Review>;
export type BookList = z.infer<typeof BookList>;
export type Comment = z.infer<typeof Comment>;
export type AuthPayload = z.infer<typeof AuthPayload>;
export type ValidationError = z.infer<typeof ValidationError>;