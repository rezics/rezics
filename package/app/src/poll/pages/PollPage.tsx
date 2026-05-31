import { pollDetailQuery } from "@rezics/api/poll/poll.queries";
import { useTranslation } from "@rezics/i18n/react";
import { AccentBar } from "@rezics/ui/primitive/decorative/AccentBar.tsx";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { QueryErrorDisplay } from "@/core/components/QueryErrorDisplay";
import { PostTreeSection } from "@/post";
import { ReplyComposer } from "@/post/forms/ReplyComposer";
import { useFocusReplyFromQuery } from "@/post/hooks/useFocusReplyFromQuery";
import { PollView } from "../components/PollView";

/**
 * Standalone poll page: the `PollView` voting/results surface above the poll's
 * discussion thread, where the thread is the existing post tree rooted on the
 * poll unit. Mirrors `ReviewDetailSection` / `RemarkDetailSection`; replies
 * target the poll unit like replies to any other content unit.
 */
export const PollPage: React.FC<{ unitId: string }> = ({ unitId }) => {
  const { t } = useTranslation(["common", "community"]);
  const composerRef = useFocusReplyFromQuery();
  const { data: results, isLoading, error } = useQuery(pollDetailQuery(unitId));

  if (isLoading) return <div>{t("common:loading")}</div>;
  if (error) return <QueryErrorDisplay error={error} />;
  if (!results) return <div>{t("common:no_data")}</div>;

  return (
    <div className="mx-auto mt-16 w-11/12 max-w-4xl">
      <div className="flex flex-col gap-8">
        <PollView results={results} />

        <div className="mt-4 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <AccentBar />
            <h2 className="text-lg font-bold">
              {t("community:poll_discussion")}
            </h2>
          </div>

          <ReplyComposer
            ref={composerRef}
            mode="progressive"
            targetUnitId={unitId}
            rootUnitId={unitId}
            parentCommentUnitId={unitId}
          />

          <PostTreeSection rootUnitId={unitId} />
        </div>
      </div>
    </div>
  );
};
