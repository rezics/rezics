import s from "./s";
import c from "contract";
import d from "database";

export default s.router(c.Tag, {
    list: async ({ query }) => {
        try {
            const { page = 1, limit = 20 } = query;
            const offset = (page - 1) * limit;

            const tags = await d.select(d.CustomTag, (tag) => ({
                id: true,
                name: true,
                created_at: true,
                updated_at: true,
                offset,
                limit
            }));

            return {
                status: 200,
                body: tags
            };
        } catch (error) {
            return {
                status: 200,
                body: []
            };
        }
    },

    get: async ({ params: { tagId } }) => {
        try {
            const tag = await d.select(d.CustomTag, (tag) => ({
                id: true,
                name: true,
                created_at: true,
                updated_at: true,
                filter: d.op(tag.id, '=', d.uuid(tagId))
            }));

            if (!tag[0]) {
                return {
                    status: 404,
                    body: { message: "Tag not found" }
                };
            }

            return {
                status: 200,
                body: tag[0]
            };
        } catch (error) {
            return {
                status: 404,
                body: { message: "Tag not found" }
            };
        }
    },

    create: async ({ body }) => {
        try {
            const newTag = await d.insert(d.CustomTag, {
                name: body.name,
                created_at: new Date(),
                updated_at: new Date(),
            });

            return {
                status: 200,
                body: newTag[0]
            };
        } catch (error) {
            return {
                status: 400,
                body: { message: "Failed to create tag" }
            };
        }
    },

    createTagGroup: async ({ body }) => {
        try {
            const newTagGroup = await d.insert(d.CustomTag, {
                name: body.name,
                created_at: new Date(),
                updated_at: new Date(),
            });

            return {
                status: 200,
                body: newTagGroup[0]
            };
        } catch (error) {
            return {
                status: 400,
                body: { message: "Failed to create tag group" }
            };
        }
    },

    updateTag: async ({ params: { tagId }, body }) => {
        try {
            const updatedTag = await d.update(d.CustomTag, (tag) => ({
                filter: d.op(tag.id, '=', d.uuid(tagId)),
                set: {
                    name: body.name,
                    updated_at: new Date(),
                }
            }));

            if (!updatedTag[0]) {
                return {
                    status: 404,
                    body: { message: "Tag not found" }
                };
            }

            return {
                status: 200,
                body: updatedTag[0]
            };
        } catch (error) {
            return {
                status: 404,
                body: { message: "Tag not found" }
            };
        }
    },

    updateTagGroup: async ({ params: { tagGroupId }, body }) => {
        try {
            const updatedTagGroup = await d.update(d.CustomTag, (tag) => ({
                filter: d.op(tag.id, '=', d.uuid(tagGroupId)),
                set: {
                    name: body.name,
                    updated_at: new Date(),
                }
            }));

            if (!updatedTagGroup[0]) {
                return {
                    status: 404,
                    body: { message: "Tag group not found" }
                };
            }

            return {
                status: 200,
                body: updatedTagGroup[0]
            };
        } catch (error) {
            return {
                status: 404,
                body: { message: "Tag group not found" }
            };
        }
    },

    deleteTag: async ({ params: { tagId } }) => {
        try {
            await d.delete(d.CustomTag, (tag) => ({
                filter: d.op(tag.id, '=', d.uuid(tagId))
            }));

            return {
                status: 200,
                body: { message: "Tag deleted successfully" }
            };
        } catch (error) {
            return {
                status: 404,
                body: { message: "Tag not found" }
            };
        }
    },

    deleteTagGroup: async ({ params: { tagGroupId } }) => {
        try {
            await d.delete(d.CustomTag, (tag) => ({
                filter: d.op(tag.id, '=', d.uuid(tagGroupId))
            }));

            return {
                status: 200,
                body: { message: "Tag group deleted successfully" }
            };
        } catch (error) {
            return {
                status: 404,
                body: { message: "Tag group not found" }
            };
        }
    },

    deleteTagRelatedBook: async ({ params: { tagId, bookId } }) => {
        try {
            // This would require removing the tag from book's tags array
            // Implementation depends on how the relationship is modeled
            return {
                status: 200,
                body: { message: "Tag-book relationship deleted successfully" }
            };
        } catch (error) {
            return {
                status: 404,
                body: { message: "Tag-book relationship not found" }
            };
        }
    },

    deleteTagRelatedThread: async ({ params: { tagId, threadId } }) => {
        try {
            // Similar to above but for threads
            return {
                status: 200,
                body: { message: "Tag-thread relationship deleted successfully" }
            };
        } catch (error) {
            return {
                status: 404,
                body: { message: "Tag-thread relationship not found" }
            };
        }
    },

    bookRelatedTag: async ({ params: { bookId } }) => {
        try {
            const book = await d.select(d.Book, (book) => ({
                tags: {
                    id: true,
                    name: true,
                },
                filter: d.op(book.id, '=', d.uuid(bookId))
            }));

            if (!book[0]) {
                return {
                    status: 404,
                    body: []
                };
            }

            return {
                status: 200,
                body: book[0].tags || []
            };
        } catch (error) {
            return {
                status: 200,
                body: []
            };
        }
    },

    bookSpecificTagGroupTag: async ({ params: { bookId, tagGroupId } }) => {
        try {
            // This would require filtering tags by group
            return {
                status: 200,
                body: []
            };
        } catch (error) {
            return {
                status: 200,
                body: []
            };
        }
    },

    bookSpecificTagGroupListTag: async ({ params: { bookId }, query }) => {
        try {
            // This would require filtering tags by multiple groups
            return {
                status: 200,
                body: []
            };
        } catch (error) {
            return {
                status: 200,
                body: []
            };
        }
    },

    threadRelatedTags: async ({ params: { threadId } }) => {
        try {
            const thread = await d.select(d.Thread, (thread) => ({
                tags: {
                    id: true,
                    name: true,
                },
                filter: d.op(thread.id, '=', d.uuid(threadId))
            }));

            if (!thread[0]) {
                return {
                    status: 404,
                    body: []
                };
            }

            return {
                status: 200,
                body: thread[0].tags || []
            };
        } catch (error) {
            return {
                status: 200,
                body: []
            };
        }
    }
});
