import { useParams } from "wouter";

import MarkdownIt from "markdown-it";
import { preserveFormattingPlugin } from "@/component/Form/preserveFormatPlugin";
import tsr from "@/api/tsr";

export const BookReadChapterPage: React.FC = () => {
    const { chapterId } = useParams();
    const { data, isLoading, error } = tsr.books.chapters.content.useQuery({
        queryKey: ["bookChapter", chapterId],
        queryData: {
            params: {
                bookId: "1",
                chapterId: chapterId || "",
            },
        },
    });

    const md = new MarkdownIt({
        html: false,
        // html: true,
        linkify: true,
        breaks: true, // key: convert \n to <br>
        typographer: true,
    });

    md.use(preserveFormattingPlugin);

    const chapterHtml = md.render(data?.body.content || "");

    if (isLoading) return <div>Loading...</div>;
    if (error) return <div>Oh no... {String(error)}</div>;
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
