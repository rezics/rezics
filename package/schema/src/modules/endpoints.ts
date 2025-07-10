// ==================== API 端点定义 ====================

export const API_ENDPOINTS = {
  // 认证
  AUTH: {
    LOGIN: '/api/auth/login',
    REGISTER: '/api/auth/register',
    VALIDATE_EMAIL: '/api/auth/validate-email',
    VALIDATE_PASSWORD: '/api/auth/validate-password',
  },
  // 用户
  USER: {
    ME: '/api/user/me',
  },
  // 书籍
  BOOK: {
    INFO: '/api/book/:id',
    CHAPTERS: '/api/book/:id/chapters',
    CONTENT: '/api/chapter/:chapterId/content',
    QUOTES: '/api/book/:bookId/quotes',
  },
  // 书单
  BOOKLIST: {
    GET: '/api/booklist/:id',
    LIST: '/api/booklists',
    COMMENTS: '/api/booklist/:bookListId/comments',
    ADD_COMMENT: '/api/booklist/:bookListId/comments',
    ADD_REPLY: '/api/comment/:commentId/replies',
  },
  // 书评
  REVIEW: {
    LIST: '/api/book/:bookId/reviews',
    ADD: '/api/book/:bookId/reviews',
  },
  // 搜索
  SEARCH: {
    BOOKS: '/api/search/books',
    TOP_BOOKS: '/api/search/top-books',
  },
} as const;