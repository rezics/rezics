import { gql } from "urql";

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

export const ChapterContentQuery = gql`
    query ChapterContentQuery($chapterId: ID!) {
        chapter(id: $chapterId) {
            id
            content
            createdAt
            author {
                name
                avatar
            }
        }
    }
`;
