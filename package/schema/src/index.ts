import { z } from 'zod/v4';
import { 
  BaseResponseSchema, 
  ErrorResponseSchema, 
  SuccessResponseSchema, 
  PaginatedResponseSchema,
  PaginationSchema 
} from './base';
import {
  UserSchema,
  BookSchema,
  BookInfoSchema,
  ChapterSchema,
  ChapterOrderSchema,
  ChapterContentSchema,
  BookListSchema,
  CommentSchema,
  ReviewSchema,
  QuoteExcerptSchema,
  AuthPayloadSchema,
  ValidationErrorSchema,
  SearchBookSchema,
} from './types';

// ==================== 认证相关 API ====================

// 登录请求
export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

// 注册请求
export const RegisterRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

// 邮箱验证请求
export const ValidateEmailRequestSchema = z.object({
  email: z.string().email(),
});

// 密码验证请求
export const ValidatePasswordRequestSchema = z.object({
  password: z.string().min(6),
});

// 认证响应
export const AuthResponseSchema = SuccessResponseSchema(AuthPayloadSchema);
export const ValidationResponseSchema = SuccessResponseSchema(z.array(ValidationErrorSchema));

// ==================== 书籍相关 API ====================

// 获取书籍信息请求
export const GetBookInfoRequestSchema = z.object({
  id: z.string().min(1),
});

// 获取章节列表请求
export const GetChapterListRequestSchema = z.object({
  id: z.string().min(1),
});

// 获取章节内容请求
export const GetChapterContentRequestSchema = z.object({
  chapterId: z.string().min(1),
});

// 获取书籍引用摘录请求
export const GetQuoteExcerptRequestSchema = z.object({
  bookId: z.string().min(1),
});

// 书籍信息响应
export const BookInfoResponseSchema = SuccessResponseSchema(BookInfoSchema);

// 章节列表响应
export const ChapterListResponseSchema = SuccessResponseSchema(z.object({
  chapters: z.array(ChapterSchema),
  chapterOrders: z.array(ChapterOrderSchema),
}));

// 章节内容响应
export const ChapterContentResponseSchema = SuccessResponseSchema(ChapterContentSchema);

// 引用摘录响应
export const QuoteExcerptResponseSchema = SuccessResponseSchema(z.array(QuoteExcerptSchema));

// ==================== 书单相关 API ====================

// 获取书单请求
export const GetBookListRequestSchema = z.object({
  id: z.string().min(1),
});

// 获取书单列表请求
export const GetBookListsRequestSchema = PaginationSchema;

// 获取书单评论请求
export const GetCommentsRequestSchema = z.object({
  bookListId: z.string().min(1),
});

// 添加评论请求
export const AddCommentRequestSchema = z.object({
  bookListId: z.string().min(1),
  content: z.string().min(1),
});

// 添加回复请求
export const AddReplyRequestSchema = z.object({
  commentId: z.string().min(1),
  content: z.string().min(1),
});

// 书单响应
export const BookListResponseSchema = SuccessResponseSchema(BookListSchema);
export const BookListsResponseSchema = SuccessResponseSchema(PaginatedResponseSchema(BookListSchema));
export const CommentsResponseSchema = SuccessResponseSchema(z.array(CommentSchema));
export const CommentResponseSchema = SuccessResponseSchema(CommentSchema);

// ==================== 书评相关 API ====================

// 获取书评请求
export const GetBookReviewsRequestSchema = z.object({
  bookId: z.string().min(1),
});

// 添加书评请求
export const AddReviewRequestSchema = z.object({
  bookId: z.string().min(1),
  content: z.string().min(1),
  rating: z.number().min(0).max(5),
});

// 书评响应
export const BookReviewsResponseSchema = SuccessResponseSchema(z.array(ReviewSchema));
export const ReviewResponseSchema = SuccessResponseSchema(ReviewSchema);

// ==================== 搜索相关 API ====================

// 搜索书籍请求
export const SearchBooksRequestSchema = z.object({
  query: z.string().min(1),
});

// 获取热门书籍请求
export const GetTopBooksRequestSchema = z.object({});

// 搜索响应
export const SearchBooksResponseSchema = SuccessResponseSchema(z.array(SearchBookSchema));
export const TopBooksResponseSchema = SuccessResponseSchema(z.array(SearchBookSchema));

// ==================== 用户相关 API ====================

// 获取当前用户请求
export const GetMeRequestSchema = z.object({});

// 用户响应
export const MeResponseSchema = SuccessResponseSchema(UserSchema);

// ==================== 导出所有类型 ====================

// 请求类型
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;
export type ValidateEmailRequest = z.infer<typeof ValidateEmailRequestSchema>;
export type ValidatePasswordRequest = z.infer<typeof ValidatePasswordRequestSchema>;
export type GetBookInfoRequest = z.infer<typeof GetBookInfoRequestSchema>;
export type GetChapterListRequest = z.infer<typeof GetChapterListRequestSchema>;
export type GetChapterContentRequest = z.infer<typeof GetChapterContentRequestSchema>;
export type GetQuoteExcerptRequest = z.infer<typeof GetQuoteExcerptRequestSchema>;
export type GetBookListRequest = z.infer<typeof GetBookListRequestSchema>;
export type GetBookListsRequest = z.infer<typeof GetBookListsRequestSchema>;
export type GetCommentsRequest = z.infer<typeof GetCommentsRequestSchema>;
export type AddCommentRequest = z.infer<typeof AddCommentRequestSchema>;
export type AddReplyRequest = z.infer<typeof AddReplyRequestSchema>;
export type GetBookReviewsRequest = z.infer<typeof GetBookReviewsRequestSchema>;
export type AddReviewRequest = z.infer<typeof AddReviewRequestSchema>;
export type SearchBooksRequest = z.infer<typeof SearchBooksRequestSchema>;
export type GetTopBooksRequest = z.infer<typeof GetTopBooksRequestSchema>;
export type GetMeRequest = z.infer<typeof GetMeRequestSchema>;

// 响应类型
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
export type ValidationResponse = z.infer<typeof ValidationResponseSchema>;
export type BookInfoResponse = z.infer<typeof BookInfoResponseSchema>;
export type ChapterListResponse = z.infer<typeof ChapterListResponseSchema>;
export type ChapterContentResponse = z.infer<typeof ChapterContentResponseSchema>;
export type QuoteExcerptResponse = z.infer<typeof QuoteExcerptResponseSchema>;
export type BookListResponse = z.infer<typeof BookListResponseSchema>;
export type BookListsResponse = z.infer<typeof BookListsResponseSchema>;
export type CommentsResponse = z.infer<typeof CommentsResponseSchema>;
export type CommentResponse = z.infer<typeof CommentResponseSchema>;
export type BookReviewsResponse = z.infer<typeof BookReviewsResponseSchema>;
export type ReviewResponse = z.infer<typeof ReviewResponseSchema>;
export type SearchBooksResponse = z.infer<typeof SearchBooksResponseSchema>;
export type TopBooksResponse = z.infer<typeof TopBooksResponseSchema>;
export type MeResponse = z.infer<typeof MeResponseSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

// ==================== GraphQL 查询导出 ====================

export * from './queries';

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