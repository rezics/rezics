import { useParams } from "wouter";
import { useQuery } from "urql";
import { ChapterContentQuery, ChapterContent } from "@/api/bookContent";
import { Typography } from "@mui/material";

import MarkdownIt from "markdown-it";
import { preserveFormattingPlugin } from "@/component/Form/preserveFormatPlugin";

export const BookReadChapterPage: React.FC = () => {
    const { chapterId } = useParams();
    const [{ data, fetching, error }] = useQuery<ChapterContent>({
        query: ChapterContentQuery,
        variables: { chapterId: chapterId },
    });

    const md = new MarkdownIt({
        html: false,
        // html: true,
        linkify: true,
        breaks: true, // key: convert \n to <br>
        typographer: true,
    });

    md.use(preserveFormattingPlugin);

    const chapterHtml = md.render(data?.content || "");

    if (fetching) return <div>Loading...</div>;
    if (error) return <div>Oh no... {error.message}</div>;
    return (
        <div>
            <div className="w-11/12 mx-auto">
                <div id="markdown-chapter-content" className="markdown-body p-4">
                    <div dangerouslySetInnerHTML={{ __html: chapterHtml }} />
                </div>
            </div>
        </div>
    );
};
