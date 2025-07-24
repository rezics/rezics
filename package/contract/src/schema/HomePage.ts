import { z } from "zod";
import { id as idSchema } from "./common";

// ------------------------------------------------------------------
// HomePage Type
// ------------------------------------------------------------------
export const HomePageSchema = z.object({
    id: idSchema,
    content: z.string(),
});
export type HomePage = z.infer<typeof HomePageSchema>;
