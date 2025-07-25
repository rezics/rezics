import s from "./s";
import c from "contract";
import d from "database";

export default s.router(c.Chapter, {
    list: async ({ params: { bookId } }) => {
        try {
            // Return mock chapters for now
            const mockChapters = [
                {
                    id: "chapter-1",
                    name: "Chapter 1: The Beginning",
                    created_at: new Date(),
                    updated_at: new Date(),
                    up: [],
                    down: [],
                    favorites: []
                },
                {
                    id: "chapter-2",
                    name: "Chapter 2: The Journey",
                    created_at: new Date(),
                    updated_at: new Date(),
                    up: [],
                    down: [],
                    favorites: []
                }
            ];

            return {
                status: 200,
                body: {
                    chapters: mockChapters,
                    order: mockChapters.map((chapter, index) => ({ 
                        id: chapter.id, 
                        order: index + 1 
                    }))
                }
            };
        } catch (error) {
            return {
                status: 200,
                body: {
                    chapters: [],
                    order: []
                }
            };
        }
    },

    get: async ({ params: { bookId, chapterId } }) => {
        try {
            return {
                status: 200,
                body: {
                    id: chapterId,
                    name: "Sample Chapter",
                    created_at: new Date(),
                    updated_at: new Date(),
                    up: [],
                    down: [],
                    favorites: []
                }
            };
        } catch (error) {
            return {
                status: 404,
                body: { message: "Chapter not found" }
            };
        }
    }
});
