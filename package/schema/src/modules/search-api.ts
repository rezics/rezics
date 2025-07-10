import { z } from 'zod/v4';
import { SearchBookSchema } from './book';
import { SuccessResponseSchema } from '../base';

// 搜索相关请求
export const SearchBooksRequestSchema = z.object({
  query: z.string().min(1),
});

export const GetTopBooksRequestSchema = z.object({});

// 搜索相关响应
export const SearchBooksResponseSchema = SuccessResponseSchema(z.array(SearchBookSchema));
export const TopBooksResponseSchema = SuccessResponseSchema(z.array(SearchBookSchema));

// 导出类型
export type SearchBooksRequest = z.infer<typeof SearchBooksRequestSchema>;
export type GetTopBooksRequest = z.infer<typeof GetTopBooksRequestSchema>;
export type SearchBooksResponse = z.infer<typeof SearchBooksResponseSchema>;
export type TopBooksResponse = z.infer<typeof TopBooksResponseSchema>;