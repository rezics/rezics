export { CHAPTER_CONTENT as ChapterContentQuery } from "schema";

export interface ChapterContent {
    id: string;
    content: string;
    createdAt: string;
    chapterName: string;
    author: {
        name: string;
        avatar: string;
    };
}
