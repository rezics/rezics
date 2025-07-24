import z from "zod";
import { id, Nameable } from "./common";

export const AuthorSchema = z.object({
    ...Nameable.shape,
    avatar: z.url().nullable(),
    description: z.string(),
    id,
});

export type Author = z.infer<typeof AuthorSchema>;
