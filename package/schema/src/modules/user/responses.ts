import { z } from 'zod/v4';
import { SuccessResponseSchema } from '../../base';
import { UserSchema } from './types';

// 用户相关响应
export const MeResponseSchema = SuccessResponseSchema(UserSchema);

// 导出类型
export type MeResponse = z.infer<typeof MeResponseSchema>;