import z from "zod";
import { id, Nameable } from "./common";

export const AuthorSchema = z.object({
    id,
    ...Nameable.shape,
    avatar: z.url().nullable(),
    description: z.string(),
});

export type Author = z.infer<typeof AuthorSchema>;
