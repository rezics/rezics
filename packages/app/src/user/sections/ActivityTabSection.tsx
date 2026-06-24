import { useActivityInfinite } from "@rezics/contract/api/activity";
import type { ActivityKind } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import { Button } from "@rezics/ui/shadcn";
import type { FC } from "react";
import { Link } from "@/shared/ui/link";
import { useProfileContext } from "@/user/components/ProfileLayout";

/**
 * Profile activity tab: a time-ordered feed of the user's public posts,
 * reviews, remarks, reactions, and shelf updates. Privacy and lifecycle
 * filtering happen server-side, so the client just renders what it receives.
 * 个人资料活动标签页：用户公开的帖子、评论、评注、反应和书架更新的按时间排序
 * 信息流。隐私和生命周期过滤在服务端进行，因此客户端只渲染收到的内容。
 */
export const ActivityTabSection: FC = () => {
  const { userId } = useProfileContext();
  const { t } = useTranslation(["settings", "common"]);
  const query = useActivityInfinite(userId);
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];

  if (query.isLoading) {
    return (
      <div className="flex items-center gap-2 py-6 text-text-secondary">
        <Spinner size="sm" /> {t("common:loading")}
      </div>
    );
  }
  if (query.isError) {
    return <p className="py-6 text-sm text-error-text">{t("common:error")}</p>;
  }
  if (items.length === 0) {
    return (
      <p className="py-6 text-sm text-text-secondary">
        {t("settings:profile_activity_empty")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2 py-4">
      <ul className="flex flex-col">
        {items.map((item) => (
          <li key={`${item.kind}:${item.id}`}>
            <Link
              to={item.href}
              className="flex items-baseline gap-3 rounded-md px-2 py-2 hover:bg-surface-sunken"
            >
              <span className="flex-none text-xs text-text-tertiary">
                {activityKindLabel(t, item.kind)}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-text-primary">
                {item.title || activityKindLabel(t, item.kind)}
              </span>
              <time className="flex-none text-xs text-text-tertiary">
                {formatAt(item.at)}
              </time>
            </Link>
          </li>
        ))}
      </ul>
      {query.hasNextPage ? (
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => query.fetchNextPage()}
          disabled={query.isFetchingNextPage}
        >
          {query.isFetchingNextPage
            ? t("common:loading")
            : t("common:load_more")}
        </Button>
      ) : null}
    </div>
  );
};

/**
 * Localized per-kind label. Literal `t` calls keep the R12 token check happy.
 * 按 kind 本地化的标签。字面量 `t` 调用可让 R12 token 检查通过。
 */
function activityKindLabel(
  t: (key: string) => string,
  kind: ActivityKind,
): string {
  switch (kind) {
    case "review":
      return t("settings:activity_kind_review");
    case "remark":
      return t("settings:activity_kind_remark");
    case "reaction":
      return t("settings:activity_kind_reaction");
    case "shelf":
      return t("settings:activity_kind_shelf");
    default:
      return t("settings:activity_kind_post");
  }
}

function formatAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    date,
  );
}
