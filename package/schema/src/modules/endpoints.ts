export const AUTH_ENDPOINTS = {
  LOGIN: '/auth/login',
  REGISTER: '/auth/register',
  VALIDATE_EMAIL: '/auth/validate-email',
  VALIDATE_PASSWORD: '/auth/validate-password',
} as const;

export const USER_ENDPOINTS = {
  ME: '/user/me',
} as const;

export const BOOK_ENDPOINTS = {
  INFO: '/book/:id',
  CHAPTER_LIST: '/book/:id/chapters',
  CHAPTER_CONTENT: '/chapter/:chapterId',
  QUOTE_EXCERPTS: '/book/:bookId/quote-excerpts',
  SEARCH: '/books/search',
  TOP_BOOKS: '/books/top',
} as const;

export const BOOKLIST_ENDPOINTS = {
  LIST: '/booklist/:id',
  LISTS: '/booklists',
  COMMENTS: '/booklist/:bookListId/comments',
  ADD_COMMENT: '/booklist/:bookListId/comments',
  ADD_REPLY: '/comment/:commentId/replies',
} as const;

export const REVIEW_ENDPOINTS = {
  BOOK_REVIEWS: '/book/:bookId/reviews',
  ADD_REVIEW: '/book/:bookId/reviews',
} as const;

export const SEARCH_ENDPOINTS = {
  BOOKS: '/search/books',
} as const;