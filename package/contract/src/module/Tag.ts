import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { id as idSchema, InternationalizedNameSchema, PaginationQuerySchema, ThreadSchema, created_at, updated_at } from "./common";
import { BookSchema } from "./Book";
import { UserSchema } from "./User";
import { PostSchema } from "./Post";

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
    tag: TagSchema,
    book: BookSchema,
    createdAt: created_at,
    updatedAt: updated_at,
    createdBy: UserSchema,
});
export type TagBookLink = z.infer<typeof TagBookLinkSchema>;

export const TagThreadLinkSchema = z.object({
    id: idSchema,
    tag: TagSchema,
    thread: ThreadSchema,
    createdAt: created_at,
    updatedAt: updated_at,
    createdBy: UserSchema,
});
export type TagThreadLink = z.infer<typeof TagThreadLinkSchema>;

// auditing schema
export const TagAuditingSchema = z.object({
    id: idSchema,
    tag: TagSchema,
    createdAt: created_at,
    updatedAt: updated_at,
    createdBy: UserSchema,
    maintainer: idSchema, // Organization ID
});

// TODO 完善 auditing 逻辑

const c = initContract();

const bookSpecificTagGroupListTagQuery = z.object({
    tagGroupId: z.array(idSchema),
});

export const tagRouter = c.router({
    // single tag and tag group
    list: {
        method: "GET",
        path: "/tag",
        query: PaginationQuerySchema,
        responses: { 200: z.array(TagGroupSchema) },
    },
    get: {
        method: "GET",
        path: "/tag/:tagId",
        responses: { 200: TagGroupSchema },
    },
    create: {
        method: "POST",
        path: "/tag",
        body: TagSchema.omit({ id: true, createdAt: true, updatedAt: true }),
        responses: { 200: TagSchema },
    },
    createTagGroup: {
        method: "POST",
        path: "/taggroup",
        body: TagGroupSchema.omit({ id: true, createdAt: true, updatedAt: true }),
        responses: { 200: TagGroupSchema },
    },
    updateTag: {
        method: "PUT",
        path: "/tag/:tagId",
        body: TagSchema.omit({ id: true, createdAt: true, updatedAt: true }),
        responses: { 200: TagSchema },
    },
    updateTagGroup: {
        method: "PUT",
        path: "/taggroup/:tagGroupId",
        body: TagGroupSchema.omit({ id: true, createdAt: true, updatedAt: true }),
        responses: { 200: TagGroupSchema },
    },
    // Delete need to ensure cascading deletion
    deleteTag: {
        method: "DELETE",
        path: "/tag/:tagId",
        responses: { 200: z.object({ message: z.string() }) },
    },
    deleteTagGroup: {
        method: "DELETE",
        path: "/taggroup/:tagGroupId",
        responses: { 200: z.object({ message: z.string() }) },
    },
    // Related
    createTagRelatedBook: {
        method: "POST",
        path: "/tag/:tagId/book/:bookId",
        body: TagBookLinkSchema.omit({ id: true, createdAt: true, updatedAt: true }),
        responses: { 200: TagBookLinkSchema },
    },
    createTagRelatedThread: {
        method: "POST",
        path: "/tag/:tagId/thread/:threadId",
        body: TagThreadLinkSchema.omit({ id: true, createdAt: true, updatedAt: true }),
        responses: { 200: TagThreadLinkSchema },
    },
    deleteTagRelatedBook: {
        method: "DELETE",
        path: "/tag/:tagId/book/:bookId",
        responses: { 200: z.object({ message: z.string() }) },
    },
    deleteTagRelatedThread: {
        method: "DELETE",
        path: "/tag/:tagId/thread/:threadId",
        responses: { 200: z.object({ message: z.string() }) },
    },
    updateTagRelatedBook: {
        method: "PUT",
        path: "/tag/:tagId/book/:bookId",
        body: TagBookLinkSchema.omit({ id: true, createdAt: true, updatedAt: true }),
        responses: { 200: TagBookLinkSchema },
    },
    updateTagRelatedThread: {
        method: "PUT",
        path: "/tag/:tagId/thread/:threadId",
        body: TagThreadLinkSchema.omit({ id: true, createdAt: true, updatedAt: true }),
        responses: { 200: TagThreadLinkSchema },
    },
    TagRelatedBookList: {
        method: "GET",
        path: "/tag/:tagId/book/list",
        query: PaginationQuerySchema,
        responses: { 200: z.array(BookSchema) },
    },
    TagRelatedThreadList: {
        method: "GET",
        path: "/tag/:tagId/thread/list",
        query: PaginationQuerySchema,
        responses: { 200: z.array(ThreadSchema) },
    },
    // Book
    bookRelatedTag: {
        method: "GET",
        path: "/book/:bookId/tag",
        responses: { 200: z.array(TagSchema) },
    },
    bookSpecificTagGroupTag: {
        method: "GET",
        path: "/book/:bookId/tag/taggroup/:tagGroupId",
        responses: { 200: z.array(TagSchema) },
    },
    bookSpecificTagGroupListTag: {
        method: "GET",
        path: "/book/:bookId/tag/taggroup/",
        query: bookSpecificTagGroupListTagQuery,
        responses: { 200: z.array(TagSchema) },
    },
    // Thread
    threadRelatedTags: {
        method: "GET",
        path: "/thread/:threadId/tag",
        responses: { 200: z.array(TagSchema) },
    },
});

export type TagRouter = typeof tagRouter;
