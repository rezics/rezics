import { initContract } from "@ts-rest/core";
import { z } from "zod";

// ------------------------------------------------------------------
// Tag Type
// ------------------------------------------------------------------
export const TagGroupSchema = z.object({
    key: z.string(),
    name: z.string(),
    tags: z.array(z.string()),
});
export type TagGroup = z.infer<typeof TagGroupSchema>;

const c = initContract();

export const tagRouter = c.router({
    list: {
        method: "GET",
        path: "/tags",
        responses: { 200: z.array(TagGroupSchema) },
    },
    get: {
        method: "GET",
        path: "/tags/:key",
        responses: { 200: TagGroupSchema },
    },
});

export type TagRouter = typeof tagRouter;
