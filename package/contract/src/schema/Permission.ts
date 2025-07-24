import { z } from "zod";

export const None = z.literal("none");
export const ReadOnly = z.literal("read-only");
export const ReadWrite = z.literal("read-write");
export const Access = z.union([None, ReadOnly, ReadWrite]);

export const Permission = z.object({
    root: z.boolean(),
    user: Access,
    book: Access,
    tag: Access,
});

export type Permission = z.infer<typeof Permission>;
