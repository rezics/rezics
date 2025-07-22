import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { id as idSchema } from "./common";

// ------------------------------------------------------------------
// Tag Type
// ------------------------------------------------------------------
export const TagGroupSchema = z.object({
    id: idSchema,
    key: z.string().optional(), // key作为英文键
    name: z.string(), // 怎样让 name 实现国际化？
    tags: z.array(z.string()), // 标签本身也要注重国际化实现
});
export type TagGroup = z.infer<typeof TagGroupSchema>;

const c = initContract();

export const tagRouter = c.router({
    // 完全没有设计
    list: {
        method: "GET",
        path: "/tags",
        responses: { 200: z.array(TagGroupSchema) },
    },
    get: {
        method: "GET",
        path: "/tags/:tagId",
        responses: { 200: TagGroupSchema },
    },
});

export type TagRouter = typeof tagRouter;
