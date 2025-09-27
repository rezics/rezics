import { useParams } from "wouter";

import useRpcQuery from "@/api/swr-query/tsrTypeBuild";
import { preserveFormattingPlugin } from "@/component/Form/preserveFormatPlugin.ts";
import MarkdownIt from "markdown-it";

export const BookReadChapterPage: React.FC = () => {
  const { chapterId } = useParams();
  const createBookChapterContentInput = {
    operation: "chapter.read",
    parameter: {
      bookId: "1",
      chapterId: chapterId || "",
    },
  };
  const { data, isLoading, error } = useRpcQuery<any>(createBookChapterContentInput);

  const md = new MarkdownIt({
    html: false,
    // html: true,
    linkify: true,
    breaks: true, // key: convert \n to <br>
    typographer: true,
  });

  md.use(preserveFormattingPlugin);

  const chapterHtml = md.render(data?.content || "");

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Oh no... {error.message}</div>;
  return (
    <div>
      <div className="w-11/12 mx-auto">
        <div
          id="markdown-chapter-content"
          className="markdown-body p-4"
        >
          <div dangerouslySetInnerHTML={{ __html: chapterHtml }} />
        </div>
      </div>
    </div>
  );
};
