import { chapterDetailQuery } from "@rezics/api/chapter/chapter";
import { createRezicsRenderer } from "@rezics/editor/markdown";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { QueryErrorDisplay } from "@/core/component/QueryErrorDisplay";
import { bookReadLayoutRoute } from "@/router";

export const BookReadChapterPage: React.FC = () => {
  const { chapterId } = bookReadLayoutRoute.useParams();
  const { data, isPending, error, isError } = useQuery(
    chapterDetailQuery(chapterId),
  );

  const md = createRezicsRenderer();
  const chapterHtml = md.render(data?.content || "");

  if (isPending) return <div>Loading...</div>;
  if (isError) return <QueryErrorDisplay error={error} />;

  return (
    <div className="w-11/12 mx-auto p-4">
      <h1 className="text-2xl font-bold">{data?.title}</h1>
      <div id="markdown-chapter-content" className="markdown-body">
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: intentional HTML rendering */}
        <div dangerouslySetInnerHTML={{ __html: chapterHtml }} />
      </div>
    </div>
  );
};
