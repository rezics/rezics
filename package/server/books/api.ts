import {api, Query} from 'encore.dev/api';
import type {
  BookListResponse,
  BookResponse,
  CreateBookInput,
  UpdateBookInput,
} from 'contract';
import {bookService} from './service';
import {mapBookToDTO} from './mapper';
import type {BookCreateRequest, BookUpdateRequest} from './types';

/**
 * Query parameters for book list endpoint
 */
interface BookListParams {
  q?: Query<string>; // search in title/isbn
  tag?: Query<string>; // single tag
  tags?: Query<string>; // comma-separated list
  authorId?: Query<string>;
  authorIds?: Query<string>; // comma-separated list
  userId?: Query<string>;
  isbn?: Query<string>;
  page?: Query<number>; // 1-based
  limit?: Query<number>; // default 20
}

/**
 * Get all books with filters and pagination
 */
export const list = api(
  {expose: true, method: 'GET', path: '/books'},
  async (params: BookListParams): Promise<BookListResponse> => {
    const {books, total} = await bookService.list({
      q: params.q,
      tag: params.tag,
      tags: params.tags,
      authorId: params.authorId,
      authorIds: params.authorIds,
      userId: params.userId,
      isbn: params.isbn,
      page: params.page,
      limit: params.limit,
    });

    return {
      books: books.map(mapBookToDTO),
      total,
    };
  },
);

/**
 * Get book by postId
 */
export const get = api(
  {expose: true, method: 'GET', path: '/books/:postId'},
  async ({postId}: {postId: string}): Promise<BookResponse> => {
    const book = await bookService.getByPostId(postId);
    return mapBookToDTO(book);
  },
);

/**
 * Create new book
 */
export const create = api(
  {expose: true, method: 'POST', path: '/books'},
  async (req: CreateBookInput): Promise<BookResponse> => {
    const bookReq: BookCreateRequest = {
      userId: req.userId,
      title: req.title,
      authorIds: req.authorIds,
      coverUrl: req.coverUrl,
      isbn: req.isbn,
      chaptersIndex: req.chaptersIndex,
      extra: req.extra,
    };

    const book = await bookService.create(bookReq);
    return mapBookToDTO(book);
  },
);

/**
 * Update book
 */
export const update = api(
  {expose: true, method: 'PUT', path: '/books/:postId'},
  async ({
    postId,
    ...req
  }: {postId: string} & UpdateBookInput): Promise<BookResponse> => {
    const bookReq: BookUpdateRequest = {
      title: req.title,
      authorIds: req.authorIds,
      coverUrl: req.coverUrl,
      isbn: req.isbn,
      chaptersIndex: req.chaptersIndex,
      extra: req.extra,
    };

    const book = await bookService.update(postId, bookReq);
    return mapBookToDTO(book);
  },
);

/**
 * Delete book
 */
export const remove = api(
  {expose: true, method: 'DELETE', path: '/books/:postId'},
  async ({postId}: {postId: string}): Promise<{message: string}> => {
    await bookService.delete(postId);
    return {message: 'Book and related post deleted successfully'};
  },
);
