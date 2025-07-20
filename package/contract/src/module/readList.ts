import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { UserSchema, PaginationQuerySchema, PaginatedResponse } from './common';

// ------------------------------------------------------------------
// Readlist Type
// ------------------------------------------------------------------
export const ReadListSchema = z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    books: z.array(z.string()),
    creator: UserSchema,
    likes: z.number(),
    commentsNumber: z.number().optional(),
});
export type ReadList = z.infer<typeof ReadListSchema>;

const c = initContract();

export const readlistRouter = c.router({
    get: {
      method: 'GET',
      path: '/readlists/:readlistId',
      responses: { 200: ReadListSchema },
    },
    create: {
      method: 'POST',
      path: '/readlists',
      body: ReadListSchema.omit({ id: true, creator: true, commentsNumber: true }),
      responses: { 201: ReadListSchema },
    },
    listByBook: {
      method: 'GET',
      path: '/readlists/book/:bookId',
      query: PaginationQuerySchema,
      responses: { 200: PaginatedResponse(ReadListSchema) },
    },
  });