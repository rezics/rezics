import { blogPostHandlers } from './blogPost';
import { categoryHandlers } from './category';
import { authHandlers } from './auth';
import { bookHandlers } from './book';
import { reviewHandlers } from './review';
import { bookListHandlers } from './bookList';
import { commentHandlers } from './comment';

export const handlers = [
  ...authHandlers,
  ...bookHandlers,
  ...reviewHandlers,
  ...bookListHandlers,
  ...commentHandlers,
  ...blogPostHandlers,
  ...categoryHandlers
]; 