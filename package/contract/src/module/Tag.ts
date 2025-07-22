import { initContract } from "@ts-rest/core";
import { z } from "zod";

// Tag Schema aligned with the `Tag` type from the database schema
// ------------------------------------------------------------------
import { id as idSchema } from "./common";

export const TagSchema = z.object({
    id: idSchema,
    name: z.string(),
});
export type Tag = z.infer<typeof TagSchema>;

const c = initContract();

export const tagRouter = c.router({
    list: {
        method: "GET",
        path: "/tags",
        responses: { 200: z.array(TagSchema) },
    },
    get: {
        method: "GET",
        path: "/tags/:tagId",
        responses: { 200: TagSchema },
    },
});

export type TagRouter = typeof tagRouter;
