import { z } from "zod";
import { id } from "./common";

export const PublishInfoSchema = z.object({
    publisher: id,
    date: z.date(),
    isbn: z.string().nullable(),
});

export type PublishInfo = z.infer<typeof PublishInfoSchema>;
