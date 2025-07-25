import s from "./s";
import c from "contract";

// Mock chapters data
const mockChapters = new Map<string, Array<{
    id: string;
    name: string;
    up: Array<{ id: string; name: string }>;
    down: Array<{ id: string; name: string }>;
    favorites: Array<{ id: string; name: string }>;
    tags: Array<{ id: string; name: string }>;
}>>();

// Initialize with some mock data
const book1Chapters = [
    {
        id: "chapter_1",
        name: "Chapter 1: Introduction",
        up: [],
        down: [],
        favorites: [],
        tags: []
    },
    {
        id: "chapter_2", 
        name: "Chapter 2: Getting Started",
        up: [],
        down: [],
        favorites: [],
        tags: []
    }
];

mockChapters.set("book_1", book1Chapters);

export default s.router(c.Chapter, {
    list: async ({ params }: { params: any }) => {
        try {
            const { bookId } = params;

            const chapters = mockChapters.get(bookId) || [];

            // Create chapter order map (unit id -> array of child unit ids)
            const chapterOrder = new Map();
            chapters.forEach((chapter) => {
                // For now, each chapter has no sub-chapters
                chapterOrder.set(chapter.id, []);
            });

            return {
                status: 200,
                body: {
                    chapters,
                    order: chapterOrder
                }
            };
        } catch (error) {
            console.error("List chapters error:", error);
            return {
                status: 200,
                body: {
                    chapters: [],
                    order: new Map()
                }
            };
        }
    },

    get: async ({ params }: { params: any }) => {
        try {
            const { bookId, chapterId } = params;

            const chapters = mockChapters.get(bookId) || [];
            const chapter = chapters.find(ch => ch.id === chapterId);

            if (!chapter) {
                return {
                    status: 404,
                    body: { message: "Chapter not found" }
                };
            }

            return {
                status: 200,
                body: chapter
            };
        } catch (error) {
            console.error("Get chapter error:", error);
            return {
                status: 404,
                body: { message: "Chapter not found" }
            };
        }
    },
});