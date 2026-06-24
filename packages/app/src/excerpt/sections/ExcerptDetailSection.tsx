import { excerptQueries } from "@rezics/api/excerpt/excerpt.queries";
import { useEditorEntry } from "@rezics/api/hooks";
import { useTranslation } from "@rezics/i18n/react";
import { AccentBar } from "@rezics/ui/primitive/decorative/AccentBar.tsx";
import { Button } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import type React from "react";
import { ReplyComposer, useFocusReplyFromQuery } from "@/comment";
import {
  isApiNotFoundError,
  QueryErrorDisplay,
  ResourceNotFoundState,
} from "@/core";
import { PostListSection } from "@/post";
import { Link } from "@/shared/ui/link";
import { ExcerptDetail } from "../components/detail/ExcerptDetail";

interface ExcerptDetailSectionProps {
  unitId: string;
}

/**
 * 摘录详情部分。显示摘录内容、编辑按钮和评论列表，支持添加新回复。
 * Excerpt detail section. Displays excerpt content, edit button, and comment list, supports adding new replies.
 *
 * Mobile:            Tablet:             Desktop:            Ultra-wide:
 * ┌──────────────────┐ ┌────────────────────────┐ ┌────────────────────────┐ ┌──────────────────────────┐
 * │ Title [✏]        │ │ Title              [✏] │ │ Title              [✏] │ │ Title              [✏]   │
 * │                  │ │                        │ │                        │ │                          │
 * │ Content Content  │ │ Full Excerpt Content   │ │ Full Excerpt Content   │ │ Full Excerpt Content     │
 * │ ...              │ │ ...                    │ │ ...                    │ │ ...                      │
 * │                  │ │                        │ │                        │ │                          │
 * │ ▬ Comments       │ │ ▬ Comments             │ │ ▬ Comments             │ │ ▬ Comments               │
 * │ Composer         │ │ Composer input         │ │ Composer input         │ │ Composer input           │
 * │ Comment 1        │ │ Comment 1              │ │ Comment 1              │ │ Comment 1                │
 * └──────────────────┘ └────────────────────────┘ └────────────────────────┘ └──────────────────────────┘
 */
export const ExcerptDetailSection: React.FC<ExcerptDetailSectionProps> = ({
  unitId,
}) => {
  const { t } = useTranslation(["common", "community"]);
  const composerRef = useFocusReplyFromQuery();
  const {
    data: excerpt,
    isLoading,
    error,
  } = useQuery(excerptQueries.detail(unitId));
  const editorEntry = useEditorEntry({
    surface: "excerpt",
    ownerUnit: { user: excerpt?.user },
  });

  if (isLoading) return <div>{t("common:loading")}</div>;
  if (error) {
    return isApiNotFoundError(error) ? (
      <ResourceNotFoundState variant="section" />
    ) : (
      <QueryErrorDisplay error={error} />
    );
  }
  if (!excerpt?.id) {
    return <ResourceNotFoundState variant="section" />;
  }

  const title = excerpt.translations?.[0]?.title;

  const handleReplyInvoke = () => {
    composerRef.current?.focus();
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center">
        {title && <h1 className="text-2xl font-bold">{title}</h1>}
        {editorEntry.canEnter && (
          <div className="ml-auto">
            <Link to="/excerpt/$unitId/edit" params={{ unitId }}>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={t("common:edit")}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        )}
      </div>

      <ExcerptDetail excerpt={excerpt} onReplyInvoke={handleReplyInvoke} />

      <div className="mt-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <AccentBar />
          <h2 className="text-xl font-bold">
            {t("community:review_comments")}
          </h2>
        </div>
        <ReplyComposer
          ref={composerRef}
          mode="progressive"
          targetUnitId={unitId}
        />
        <PostListSection targetUnitId={unitId} />
      </div>
    </div>
  );
};
