import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { id as idSchema } from "./common";

// ------------------------------------------------------------------
// Tag Type
// ------------------------------------------------------------------
export const TagSchema = z.object({
    id: idSchema,
    groupId: idSchema,
    key: z.string().optional(),
    name: z.string(),
    color: z.string(),
    createdAt: z.date(),
    updatedAt: z.date(),
});

export const TagGroupSchema = z.object({
    id: idSchema,
    type: z.enum(["community", "book"]).default("community"),
    key: z.string().optional(), // key作为英文键
    name: z.string(), // 怎样让 name 实现国际化？
    // owner: 权限管理
    tags: z.array(TagSchema),
});

// 其中 key 和 name 是为了国际化而设计的

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
