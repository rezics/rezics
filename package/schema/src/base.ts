import { z } from 'zod/v4';

export const ID = z.string().min(1);
export const String = z.string();
export const Int = z.number().int();
export const Float = z.number();
export const Boolean = z.boolean();
export const DateString = z.string().datetime();

export const SuccessResponse = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
  });

export const ErrorResponse = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

export const ApiResponse = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.union([SuccessResponse(dataSchema), ErrorResponse]);

export const Pagination = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(10),
});

export const PaginatedResponse = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    total: z.number().int().min(0),
    page: z.number().int().min(1),
    limit: z.number().int().min(1),
    totalPages: z.number().int().min(0),
  });

export type ID = z.infer<typeof ID>;
export type ApiResponse<T> = z.infer<ReturnType<typeof ApiResponse<z.ZodType<T>>>>;
export type Pagination = z.infer<typeof Pagination>;
export type PaginatedResponse<T> = z.infer<ReturnType<typeof PaginatedResponse<z.ZodType<T>>>>;