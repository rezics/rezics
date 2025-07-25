import s from "./s";
import c from "contract";

// Mock tags data
const mockTags = new Map<string, {
    id: string;
    name: string;
    color: string;
    owner: string[];
    type: "book" | "thread";
    tags: string[];
    created_at: string;
    updated_at: string;
}>();

// Initialize with some mock data
const sampleTag = {
    id: "tag_1",
    name: "Fiction",
    color: "blue",
    owner: ["user_1"],
    type: "book" as const,
    tags: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
};

mockTags.set(sampleTag.id, sampleTag);

export default s.router(c.Tag, {
    // Tag listing
    list: async ({ query }: { query: any }) => {
        try {
            const { page = 1, limit = 20 } = query;
            const offset = (page - 1) * limit;

            const tags = Array.from(mockTags.values()).slice(offset, offset + limit);

            return {
                status: 200,
                body: tags
            };
        } catch (error) {
            console.error("List tags error:", error);
            return {
                status: 200,
                body: []
            };
        }
    },

    // Get single tag
    get: async ({ params }: { params: any }) => {
        try {
            const { tagId } = params;

            const tag = mockTags.get(tagId);

            if (!tag) {
                return {
                    status: 404,
                    body: { message: "Tag not found" }
                };
            }

            return {
                status: 200,
                body: tag
            };
        } catch (error) {
            console.error("Get tag error:", error);
            return {
                status: 404,
                body: { message: "Tag not found" }
            };
        }
    },

    // Create tag
    create: async ({ body }: { body: any }) => {
        try {
            const { name, color = "blue", owner, type = "book" } = body;

            const tagId = `tag_${Date.now()}`;
            const newTag = {
                id: tagId,
                name,
                color,
                owner: Array.isArray(owner) ? owner : [owner],
                type,
                tags: [],
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            mockTags.set(tagId, newTag);

            return {
                status: 200,
                body: newTag
            };
        } catch (error) {
            console.error("Create tag error:", error);
            return {
                status: 400,
                body: { message: "Failed to create tag" }
            };
        }
    },

    // Create tag group (similar to create tag)
    createTagGroup: async ({ body }: { body: any }) => {
        try {
            const { name, color = "blue", owner, type = "book" } = body;

            const tagId = `taggroup_${Date.now()}`;
            const newTag = {
                id: tagId,
                name,
                color,
                owner: Array.isArray(owner) ? owner : [owner],
                type,
                tags: [],
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            mockTags.set(tagId, newTag);

            return {
                status: 200,
                body: newTag
            };
        } catch (error) {
            console.error("Create tag group error:", error);
            return {
                status: 400,
                body: { message: "Failed to create tag group" }
            };
        }
    },

    // Update tag
    updateTag: async ({ params, body }: { params: any; body: any }) => {
        try {
            const { tagId } = params;
            const { name, color, type } = body;

            const tag = mockTags.get(tagId);
            if (!tag) {
                return {
                    status: 404,
                    body: { message: "Tag not found" }
                };
            }

            if (name !== undefined) tag.name = name;
            if (color !== undefined) tag.color = color;
            if (type !== undefined) tag.type = type;
            tag.updated_at = new Date().toISOString();

            mockTags.set(tagId, tag);

            return {
                status: 200,
                body: tag
            };
        } catch (error) {
            console.error("Update tag error:", error);
            return {
                status: 404,
                body: { message: "Tag not found" }
            };
        }
    },

    // Update tag group
    updateTagGroup: async ({ params, body }: { params: any; body: any }) => {
        try {
            const { tagGroupId } = params;
            const { name, color, type } = body;

            const tag = mockTags.get(tagGroupId);
            if (!tag) {
                return {
                    status: 404,
                    body: { message: "Tag group not found" }
                };
            }

            if (name !== undefined) tag.name = name;
            if (color !== undefined) tag.color = color;
            if (type !== undefined) tag.type = type;
            tag.updated_at = new Date().toISOString();

            mockTags.set(tagGroupId, tag);

            return {
                status: 200,
                body: tag
            };
        } catch (error) {
            console.error("Update tag group error:", error);
            return {
                status: 404,
                body: { message: "Tag group not found" }
            };
        }
    },

    // Delete tag
    deleteTag: async ({ params }: { params: any }) => {
        try {
            const { tagId } = params;

            if (mockTags.delete(tagId)) {
                return {
                    status: 200,
                    body: { message: "Tag deleted successfully" }
                };
            } else {
                return {
                    status: 404,
                    body: { message: "Tag not found" }
                };
            }
        } catch (error) {
            console.error("Delete tag error:", error);
            return {
                status: 404,
                body: { message: "Tag not found" }
            };
        }
    },

    // Delete tag group
    deleteTagGroup: async ({ params }: { params: any }) => {
        try {
            const { tagGroupId } = params;

            if (mockTags.delete(tagGroupId)) {
                return {
                    status: 200,
                    body: { message: "Tag group deleted successfully" }
                };
            } else {
                return {
                    status: 404,
                    body: { message: "Tag group not found" }
                };
            }
        } catch (error) {
            console.error("Delete tag group error:", error);
            return {
                status: 404,
                body: { message: "Tag group not found" }
            };
        }
    },

    // Book-tag relationships
    bookRelatedTag: async ({ params }: { params: any }) => {
        try {
            const { bookId } = params;

            // Return some mock tags for the book
            const bookTags = Array.from(mockTags.values()).slice(0, 3);

            return {
                status: 200,
                body: bookTags
            };
        } catch (error) {
            console.error("Get book tags error:", error);
            return {
                status: 200,
                body: []
            };
        }
    },

    // Book specific tag group tag
    bookSpecificTagGroupTag: async ({ params }: { params: any }) => {
        try {
            return {
                status: 200,
                body: []
            };
        } catch (error) {
            console.error("Get book specific tag group tags error:", error);
            return {
                status: 200,
                body: []
            };
        }
    },

    // Book specific tag group list tag
    bookSpecificTagGroupListTag: async ({ params, query }: { params: any; query: any }) => {
        try {
            return {
                status: 200,
                body: []
            };
        } catch (error) {
            console.error("Get book specific tag group list tags error:", error);
            return {
                status: 200,
                body: []
            };
        }
    },

    // Thread related tags
    threadRelatedTags: async ({ params }: { params: any }) => {
        try {
            const { threadId } = params;

            // Return some mock tags for the thread
            const threadTags = Array.from(mockTags.values()).filter(tag => tag.type === "thread");

            return {
                status: 200,
                body: threadTags
            };
        } catch (error) {
            console.error("Get thread tags error:", error);
            return {
                status: 200,
                body: []
            };
        }
    },

    // Delete tag-book relationship
    deleteTagRelatedBook: async ({ params }: { params: any }) => {
        try {
            const { tagId, bookId } = params;

            return {
                status: 200,
                body: { message: "Tag removed from book successfully" }
            };
        } catch (error) {
            console.error("Delete tag-book relationship error:", error);
            return {
                status: 404,
                body: { message: "Relationship not found" }
            };
        }
    },

    // Delete tag-thread relationship
    deleteTagRelatedThread: async ({ params }: { params: any }) => {
        try {
            const { tagId, threadId } = params;

            return {
                status: 200,
                body: { message: "Tag removed from thread successfully" }
            };
        } catch (error) {
            console.error("Delete tag-thread relationship error:", error);
            return {
                status: 404,
                body: { message: "Relationship not found" }
            };
        }
    },
});