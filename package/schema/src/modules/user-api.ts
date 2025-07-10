import { z } from 'zod/v4';
import { UserSchema } from './user';
import { SuccessResponseSchema } from '../base';

// 用户相关请求
export const GetMeRequestSchema = z.object({});

// 用户相关响应
export const MeResponseSchema = SuccessResponseSchema(UserSchema);

// 导出类型
export type GetMeRequest = z.infer<typeof GetMeRequestSchema>;
export type MeResponse = z.infer<typeof MeResponseSchema>;