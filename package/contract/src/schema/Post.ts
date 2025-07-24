import { z } from "zod";
import { id, Auditable } from "./common";

// ------------------------------------------------------------------
// Post & Category Type
// ------------------------------------------------------------------
// export const PostSchema = ThreadSchema.extend({
export const Post = z.object({
    id,
    ...Auditable.shape,
    content: z.string(),
});

export type Post = z.infer<typeof Post>;
