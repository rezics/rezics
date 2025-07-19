import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { UserSchema, PaginationQuerySchema, PaginatedResponse } from './common';

// ------------------------------------------------------------------
// Readlist Type
// ------------------------------------------------------------------
export const BookListSchema = z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    books: z.array(z.string()),
    creator: UserSchema,
    likes: z.number(),
    commentsNumber: z.number().optional(),
});
export type BookList = z.infer<typeof BookListSchema>;

const c = initContract();

export const readlistRouter = c.router({
    get: {
      method: 'GET',
      path: '/book-lists/:id',
      responses: { 200: BookListSchema },
    },
    create: {
      method: 'POST',
      path: '/book-lists',
      body: BookListSchema.omit({ id: true, creator: true, commentsNumber: true }),
      responses: { 201: BookListSchema },
    },
    list: {
      method: 'GET',
      path: '/book-lists',
      query: PaginationQuerySchema,
      responses: { 200: PaginatedResponse(BookListSchema) },
    },
  });