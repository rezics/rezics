import { restClient } from "../plugin/providers/rest";

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

// API functions
export const getChapterContent = async (chapterId: string): Promise<ChapterContent> => {
    return restClient.get<ChapterContent>(`/chapters/${chapterId}/content`);
};
