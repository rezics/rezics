import { z } from 'zod/v4';

// 用户相关请求
export const GetMeRequestSchema = z.object({});

// 导出类型
export type GetMeRequest = z.infer<typeof GetMeRequestSchema>;