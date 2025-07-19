import { z } from 'zod';

// ------------------------------------------------------------------
// User
// ------------------------------------------------------------------

export const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  avatar: z.string().url().optional(),
});
export type User = z.infer<typeof UserSchema>;

// ------------------------------------------------------------------
// Pagination helper
// ------------------------------------------------------------------

export const PaginationQuerySchema = z.object({
  page: z.number().int().optional().default(1),
  limit: z.number().int().optional().default(20),
});

export const PaginatedResponse = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    items: z.array(item),
    page: z.number(),
    totalPages: z.number(),
    total: z.number(),
  });

