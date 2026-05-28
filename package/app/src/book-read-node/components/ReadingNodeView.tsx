import { useUpdateUnitProgress, useToggleNodeCompletion } from "@rezics/api";
import { chapterDetailQuery } from "@rezics/api/chapter/chapter";
import { contentDocMarkdownFallback } from "@rezics/contract";
import { createRezicsRenderer } from "@rezics/editor/markdown";
import { handleExternalLinkClick } from "@rezics/ui/link/handleExternalLinkClick.ts";
import { Button } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useEffect, useState } from "react";

type ReadingNodeViewProps = {
  bookUnitId: string;
  nodeId: string;
  title: string;
  contentUnitId: string;
  initialIsCompleted?: boolean;
};

export const ReadingNodeView: React.FC<ReadingNodeViewProps> = ({
  bookUnitId,
  nodeId,
  title,
  contentUnitId,
  initialIsCompleted = false,
}) => {
  const { data, isPending, error, isError } = useQuery(
    chapterDetailQuery(contentUnitId),
  );
  const updateProgress = useUpdateUnitProgress(bookUnitId);
  const toggleCompletion = useToggleNodeCompletion(bookUnitId);
  const [isCompleted, setIsCompleted] = useState(initialIsCompleted);

  useEffect(() => {
    updateProgress.mutate({ status: "ACTIVE", lastReadNodeId: nodeId });
    // intentional: only on nodeId change
    // biome-ignore lint/correctness/useExhaustiveDependencies: deliberate
  }, [nodeId]);

  const handleToggle = () => {
    const next = !isCompleted;
    setIsCompleted(next);
    toggleCompletion.mutate(
      { nodeId, isCompleted: next },
      { onError: () => setIsCompleted(!next) },
    );
  };

  if (isPending) return <div>Loading…</div>;
  if (isError) return <div>Error loading chapter: {String(error)}</div>;

  const md = createRezicsRenderer();
  const html = md.render(contentDocMarkdownFallback(data?.content));

  return (
    <div className="w-11/12 mx-auto p-4">
      <div className="flex items-center justify-between gap-4 mb-2">
        <h1 className="text-2xl font-bold">{data?.title ?? title}</h1>
        <Button
          type="button"
          variant={isCompleted ? "default" : "outline"}
          onClick={handleToggle}
          disabled={toggleCompletion.isPending}
        >
          {isCompleted ? "Marked as read" : "Mark as read"}
        </Button>
      </div>
      <div id="markdown-chapter-content" className="markdown-body">
        {/* biome-ignore lint/a11y/noStaticElementInteractions: delegated click handler only intercepts links in rendered markdown. */}
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: markdown links remain keyboard-accessible as native anchors. */}
        <div
          onClick={handleExternalLinkClick}
          // biome-ignore lint/security/noDangerouslySetInnerHtml: intentional HTML rendering
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
};
