import z from "zod";
import { content, created_at, id, updated_at } from "./common";

export const Post = z.object({
    author: id,
    content: content.short,

    created_at,
    updated_at,
});
