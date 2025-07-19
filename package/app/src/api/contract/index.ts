import { initContract } from '@ts-rest/core';
import { authRouter } from './auth';
import { bookRouter } from './book';
import { reviewRouter } from './review';
import { tagRouter } from './tag';
import { postRouter } from './post';
import { readlistRouter } from './readList';
// zod not required in this file

const c = initContract();

export const contract = c.router({
  auth: authRouter,
  books: bookRouter,
  review: reviewRouter,
  tag: tagRouter,
  posts: postRouter,
  readlists: readlistRouter,
});

export type AppContract = typeof contract;
