import { useCanEdit } from "@rezics/api/hooks";
import { unitQueries } from "@rezics/api/unit/unit.queries";
import { AccentBar } from "@rezics/ui/primitive/decorative/AccentBar.tsx";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { PostListSection } from "@/post";
import { ReplyComposer } from "@/post/forms/ReplyComposer";
import { useFocusReplyFromQuery } from "@/post/hooks/useFocusReplyFromQuery";
import { TextLink } from "@/shared/ui/link";
import { ExcerptDetail } from "../components/detail/ExcerptDetail";
import { useMessage } from "@rezics/i18n/react";
import {
  common_edit,
  common_loading,
  excerpt_not_found,
  review_comments,
} from "@rezics/i18n/messages";
const i18nMessages = {
  common_edit,
  common_loading,
  excerpt_not_found,
  review_comments,
};

interface ExcerptDetailSectionProps {
  unitId: string;
}

export const ExcerptDetailSection: React.FC<ExcerptDetailSectionProps> = ({
  unitId,
}) => {
  const m = useMessage(i18nMessages);
  const composerRef = useFocusReplyFromQuery();
  const { data: excerpt, isLoading } = useQuery(unitQueries.detail(unitId));
  const canEdit = useCanEdit({
    resource: "unit",
    ownerUnit: { user: excerpt?.user },
  });

  if (isLoading) return <div>{m.common_loading()}</div>;
  if (!excerpt?.id) {
    return (
      <div className="text-center py-16 text-error-text">
        {m.excerpt_not_found()}
      </div>
    );
  }

  const title = excerpt.translations?.[0]?.title;

  const handleReplyInvoke = () => {
    composerRef.current?.focus();
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center">
        {title && <h1 className="text-2xl font-bold">{title}</h1>}
        {canEdit && (
          <div className="ml-auto">
            <TextLink to="/excerpt/$unitId/edit" params={{ unitId }}>
              {m.common_edit()}
            </TextLink>
          </div>
        )}
      </div>

      <ExcerptDetail excerpt={excerpt} onReplyInvoke={handleReplyInvoke} />

      <div className="mt-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <AccentBar />
          <h2 className="text-xl font-bold">{m.review_comments()}</h2>
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
