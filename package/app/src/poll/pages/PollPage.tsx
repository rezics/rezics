import { pollDetailQuery } from "@rezics/api/poll/poll.queries";
import { useTranslation } from "@rezics/i18n/react";
import { AccentBar } from "@rezics/ui/primitive/decorative/AccentBar.tsx";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { ReplyComposer, useFocusReplyFromQuery } from "@/comment";
import { QueryErrorDisplay } from "@/core";
import { PostListSection } from "@/post";
import { PollView } from "../components/PollView";

/**
 * Standalone poll page: the `PollView` voting/results surface above the poll's
 * discussion thread, where the thread is the existing post tree rooted on the
 * poll unit. Mirrors `ReviewDetailSection` / `RemarkDetailSection`; replies
 * target the poll unit like replies to any other content unit.
 * 独立投票页面：投票/结果表面显示在投票的讨论线程上方，线程是以投票 unit 为根的现有帖子树。
 * 镜像 `ReviewDetailSection` / `RemarkDetailSection`；回复针对投票 unit，与任何其他内容 unit 的回复相同。
 *
 * Mobile <640px:
 * +---[PollView]---+
 * |  Options       |
 * |  Results       |
 * |  +----------+  |
 * |  |Discussion|  |
 * |  +----------+  |
 * |  Composer      |
 * |  PostList      |
 * +----------------+
 *
 * Tablet 640-1023px:
 * +-----[PollView]-----+
 * |  Options Results  |
 * |  +------+-------+ |
 * |  |      |       | |
 * |  +------+-------+ |
 * |  +----Discussion--+ |
 * |  |                | |
 * |  | Composer       | |
 * |  | PostList       | |
 * |  +----------------+ |
 * +--------------------+
 *
 * Desktop 1024-1535px:
 * +--------[PollView max-w-4xl]--------+
 * |  Options       Results            |
 * |  +--------+------------------+  |
 * |  |        |                  |  |
 * |  +--------+------------------+  |
 * |  +--------Discussion-----------+  |
 * |  |  +-AccentBar              |  |
 * |  |  Composer PostList        |  |
 * |  |                           |  |
 * |  +---------------------------+  |
 * +-----+----------------------+-----+
 *
 * Ultra-wide >=1536px:
 * +--------[PollView max-w-4xl]--------+
 * |  Options       Results            |
 * |  +--------+------------------+  |
 * |  |        |                  |  |
 * |  +--------+------------------+  |
 * |  +--------Discussion-----------+  |
 * |  |  +-AccentBar              |  |
 * |  |  Composer PostList        |  |
 * |  |                           |  |
 * |  +---------------------------+  |
 * +-----+----------------------+-----+
 */
export const PollPage: React.FC<{ unitId: string }> = ({ unitId }) => {
  const { t } = useTranslation(["common", "community"]);
  const composerRef = useFocusReplyFromQuery();
  const { data: results, isLoading, error } = useQuery(pollDetailQuery(unitId));

  if (isLoading) return <div>{t("common:loading")}</div>;
  if (error) return <QueryErrorDisplay error={error} />;
  if (!results) return <div>{t("common:no_data")}</div>;

  return (
    <div className="mx-auto mt-16 w-full px-4 max-w-4xl">
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
          />

          <PostListSection targetUnitId={unitId} />
        </div>
      </div>
    </div>
  );
};
