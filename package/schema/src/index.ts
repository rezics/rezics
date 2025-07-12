import { z } from "zod";

// User schema
export const User = z.object({
    id: z.string(),
    name: z.string(),
    avatar: z.string(),
});

// Review schema
export const Review = z.object({
    id: z.string(),
    content: z.string(),
    rating: z.number(),
    createdAt: z.string(),
    user: User,
});

// BookList schema
export const BookList = z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    books: z.array(z.string()),
    creator: User,
    likes: z.number(),
    commentsNumber: z.number(),
});

// Comment schema
export const Comment = z.object({
    id: z.string(),
    content: z.string(),
    createdAt: z.string(),
    user: User,
    likes: z.number(),
    replies: z.array(z.lazy(() => Comment)).optional(),
});

// AuthPayload schema
export const AuthPayload = z.object({
    token: z.string(),
    user: User,
});

// ValidationError schema
export const ValidationError = z.object({
    field: z.string(),
    message: z.string(),
});

// Export types
export type User = z.infer<typeof User>;
export type Review = z.infer<typeof Review>;
export type BookList = z.infer<typeof BookList>;
export type Comment = z.infer<typeof Comment>;
export type AuthPayload = z.infer<typeof AuthPayload>;
export type ValidationError = z.infer<typeof ValidationError>;