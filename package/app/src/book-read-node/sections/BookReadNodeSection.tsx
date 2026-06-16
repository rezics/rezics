import { bookQueries } from "@rezics/api/book/book";
import { chapterDetailQuery } from "@rezics/api/chapter/chapter";
import { useCanEdit } from "@rezics/api/hooks";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";
import { DeletedNodeView } from "../components/DeletedNodeView";
import { EmptyNodeView } from "../components/EmptyNodeView";
import { ReadingNodeView } from "../components/ReadingNodeView";
import { resolveNodeView } from "../models/resolveNodeView";

type BookReadNodeSectionProps = {
  bookId: string;
  nodeId: string;
};

export const BookReadNodeSection: React.FC<BookReadNodeSectionProps> = ({
  bookId,
  nodeId,
}) => {
  const navigate = useNavigate();
  const readContext = useReadLanguageContext();
  const { data: bookInfo } = useQuery({
    ...bookQueries.detail(bookId, {
      languages: readContext.languages,
      appLocale: readContext.appLocale,
    }),
    enabled: Boolean(bookId) && readContext.ready,
  });
  const { data: contentStructure, isLoading } = useQuery({
    ...bookQueries.contentStructure(bookId),
    enabled: Boolean(bookId),
  });
  const canEdit = useCanEdit({ resource: "chapter", ownerUnit: bookInfo });

  const state = resolveNodeView({
    nodes: contentStructure?.nodes,
    isLoading,
    nodeId,
  });

  // Chapter Unit deletion check piggybacks on chapter detail fetch
  // 章节 Unit 删除检查搭载在章节详情请求上。
  const contentUnitId =
    state.kind === "reading" ? state.contentUnitId : undefined;
  const { data: chapterData } = useQuery({
    ...chapterDetailQuery(contentUnitId ?? ""),
    enabled: Boolean(contentUnitId),
  });
  const chapterDeleted =
    chapterData && (chapterData as { status?: string }).status === "DELETED";

  if (state.kind === "loading") return <div className="p-4">Loading…</div>;
  if (state.kind === "not-found")
    return <div className="p-4">Node not found</div>;

  if (state.kind === "deleted" || chapterDeleted) {
    const node = state.kind === "deleted" ? state.node : null;
    if (!node && chapterDeleted) {
      return (
        <DeletedNodeView
          bookUnitId={bookId}
          nodeId={nodeId}
          canEdit={canEdit}
        />
      );
    }
    return (
      <DeletedNodeView bookUnitId={bookId} nodeId={nodeId} canEdit={canEdit} />
    );
  }

  if (state.kind === "empty") {
    return (
      <EmptyNodeView
        bookUnitId={bookId}
        nodeId={nodeId}
        title={state.node.title}
        canEdit={canEdit}
        onMaterialized={() =>
          navigate({
            to: "/book/$bookId/node/$nodeId",
            params: { bookId, nodeId },
          })
        }
      />
    );
  }

  return (
    <ReadingNodeView
      bookUnitId={bookId}
      nodeId={nodeId}
      title={state.node.title}
      contentUnitId={state.contentUnitId}
      canEdit={canEdit}
    />
  );
};
