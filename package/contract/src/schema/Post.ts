import { z } from "zod";
import { ThreadSchema } from "./common";

// ------------------------------------------------------------------
// Post & Category Type
// ------------------------------------------------------------------
export const PostSchema = ThreadSchema.extend({
    content: z.string(),
});
export type Post = z.infer<typeof PostSchema>;
