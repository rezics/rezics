import { z } from "zod";
import {
    id as idSchema,
    InternationalizedNameSchema,
    ThreadSchema,
    created_at,
    updated_at,
} from "./common";
import { UserSchema } from "./User";

// ------------------------------------------------------------------
// Tag Type
// -----------------------------------------------------------------

export const TagSchema = z.object({
    id: idSchema,
    groupId: idSchema, // 维护groupId就够了，权限组必须由后端查询
    key: z.string(),
    name: InternationalizedNameSchema,
    color: z.string(),
    createdAt: created_at,
    updatedAt: updated_at,
});
export type Tag = z.infer<typeof TagSchema>;

export const TagGroupSchema = z.object({
    id: idSchema,
    type: z.enum(["community", "book"]).default("community"),
    key: z.string(), // key is a required English key, for the sake of humanity.
    name: InternationalizedNameSchema,
    maintainer: idSchema, // Organization ID 实际上应该改成权限组
    tags: z.array(TagSchema),
    createdAt: created_at,
    updatedAt: updated_at,
});
export type TagGroup = z.infer<typeof TagGroupSchema>;

// Link Schema, Tracking creation information for evaluation purposes
// ensure cascading deletion
export const TagBookLinkSchema = z.object({
    id: idSchema,
    tag: z.lazy(() => TagSchema),
    book: z.lazy(() => z.any()), // 使用any来避免循环依赖，在router中会正确使用BookSchema
    createdAt: created_at,
    updatedAt: updated_at,
    createdBy: UserSchema,
});
export type TagBookLink = z.infer<typeof TagBookLinkSchema>;

export const TagThreadLinkSchema = z.object({
    id: idSchema,
    tag: z.lazy(() => TagSchema),
    thread: z.lazy(() => ThreadSchema),
    createdAt: created_at,
    updatedAt: updated_at,
    createdBy: UserSchema,
});
export type TagThreadLink = z.infer<typeof TagThreadLinkSchema>;

// auditing schema
export const TagAuditingSchema = z.object({
    id: idSchema,
    tag: z.lazy(() => TagSchema),
    createdAt: created_at,
    updatedAt: updated_at,
    createdBy: UserSchema,
    maintainer: idSchema, // Organization ID
});
export type TagAuditing = z.infer<typeof TagAuditingSchema>;
