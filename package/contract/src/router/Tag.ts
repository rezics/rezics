import c from "./c";
import { z } from "zod";
import { PaginationQuerySchema, ThreadSchema, id as idSchema } from "./common";
import { Tag } from "../schema/Tag";
import { Book } from "../schema/Book";

const bookSpecificTagGroupListTagQuery = z.object({
    tagGroupId: z.array(idSchema),
});

export default c.router({
    // single tag and tag group
    list: {
        method: "GET",
        path: "/tag",
        query: PaginationQuerySchema,
        responses: { 200: z.array(Tag.View) },
    },
    get: {
        method: "GET",
        path: "/tag/:tagId",
        responses: { 200: Tag.View },
    },
    create: {
        method: "POST",
        path: "/tag",
        body: Tag.Create.omit({ id: true, created_at: true, updated_at: true }),
        responses: { 200: Tag.View },
    },
    createTagGroup: {
        method: "POST",
        path: "/taggroup",
        body: Tag.Create.omit({
            id: true,
            created_at: true,
            updated_at: true,
        }),
        responses: { 200: Tag.View },
    },
    updateTag: {
        method: "PUT",
        path: "/tag/:tagId",
        body: Tag.Create.omit({ id: true, created_at: true, updated_at: true }),
        responses: { 200: Tag.View },
    },
    updateTagGroup: {
        method: "PUT",
        path: "/taggroup/:tagGroupId",
        body: Tag.Create.omit({
            id: true,
            created_at: true,
            updated_at: true,
        }),
        responses: { 200: Tag.View },
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
    // createTagRelatedBook: {
    //     method: "POST",
    //     path: "/tag/:tagId/book/:bookId",
    //     body: TagBookLinkSchema.omit({
    //         id: true,
    //         created_at: true,
    //         updated_at: true,
    //     }),
    //     responses: { 200: TagBookLinkSchema },
    // },
    // createTagRelatedThread: {
    //     method: "POST",
    //     path: "/tag/:tagId/thread/:threadId",
    //     body: TagThreadLinkSchema.omit({
    //         id: true,
    //         created_at: true,
    //         updated_at: true,
    //     }),
    //     responses: { 200: TagThreadLinkSchema },
    // },
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
    // updateTagRelatedBook: {
    //     method: "PUT",
    //     path: "/tag/:tagId/book/:bookId",
    //     body: TagBookLinkSchema.omit({
    //         id: true,
    //         created_at: true,
    //         updated_at: true,
    //     }),
    //     responses: { 200: TagBookLinkSchema },
    // },
    // updateTagRelatedThread: {
    //     method: "PUT",
    //     path: "/tag/:tagId/thread/:threadId",
    //     body: TagThreadLinkSchema.omit({
    //         id: true,
    //         created_at: true,
    //         updated_at: true,
    //     }),
    //     responses: { 200: TagThreadLinkSchema },
    // },
    // TagRelatedBookList: {
    //     method: "GET",
    //     path: "/tag/:tagId/book/list",
    //     query: PaginationQuerySchema,
    //     responses: { 200: z.array(z.lazy(() => BookSchema)) },
    // },
    // TagRelatedThreadList: {
    //     method: "GET",
    //     path: "/tag/:tagId/thread/list",
    //     query: PaginationQuerySchema,
    //     responses: { 200: z.array(ThreadSchema) },
    // },
    // Book
    bookRelatedTag: {
        method: "GET",
        path: "/book/:bookId/tag",
        responses: { 200: z.array(Tag.View) },
    },
    bookSpecificTagGroupTag: {
        method: "GET",
        path: "/book/:bookId/tag/taggroup/:tagGroupId",
        responses: { 200: z.array(Tag.View) },
    },
    bookSpecificTagGroupListTag: {
        method: "GET",
        path: "/book/:bookId/tag/taggroup/",
        query: bookSpecificTagGroupListTagQuery,
        responses: { 200: z.array(Tag.View) },
    },
    // Thread
    threadRelatedTags: {
        method: "GET",
        path: "/thread/:threadId/tag",
        responses: { 200: z.array(Tag.View) },
    },
});
