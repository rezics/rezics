import { userQueries } from "@rezics/api/user/user.queries";
import type { PostListQuery } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import {
  Checkbox,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { FeedLayout } from "@/feed";
import { PinnedFeedSection } from "@/pinboard";
import { RealmContentFeed } from "../components/RealmContentFeed";
import { useRealmManageMode } from "../models/realmManageMode";
import { AboutSection } from "./AboutSection";
import { FeaturedZoneSection } from "./FeaturedZoneSection";
import {
  type RealmFeedSort,
  RealmFeedSortSwitcher,
} from "./RealmFeedSortSwitcher";
import { RealmFeedTagFilter } from "./RealmFeedTagFilter";
import { RuleSection } from "./RuleSection";
import { useRealmDetail } from "../pages/realmDetailContext";

type RealmModerationFilter = NonNullable<
  PostListQuery["realmModerationStatus"]
>;

export interface RealmFeedTabProps {
  feedSort: RealmFeedSort;
  feedTagIds: string[];
  onFeedSortChange: (sort: RealmFeedSort) => void;
  onFeedTagIdsChange: (tagIds: string[]) => void;
  onOpenTagsTab: () => void;
}

const realmModerationFilters = [
  "all",
  "pending",
  "approved",
  "removed",
] satisfies RealmModerationFilter[];

/**
 * Feed tab of the realm detail. Sort and tag filters are route-search driven
 * (owned by the feed route); manage mode and the moderation filter are local
 * tab state, scoped to managers.
 * realm 详情的信息流标签。排序与标签筛选由路由 search 驱动（归属信息流路由）；
 * 管理模式与审核筛选为本标签的本地状态，仅对管理者可见。
 */
export function RealmFeedTab({
  feedSort,
  feedTagIds,
  onFeedSortChange,
  onFeedTagIdsChange,
  onOpenTagsTab,
}: RealmFeedTabProps) {
  const { t } = useTranslation("community");
  const { realmId, realm, showManage, tagTree } = useRealmDetail();
  const { data: settings } = useQuery({
    ...userQueries.settings(),
    enabled: showManage,
  });
  const [manageMode, setManageMode] = useRealmManageMode({ realmId, settings });
  const [realmModerationStatus, setRealmModerationStatus] =
    useState<RealmModerationFilter>("all");

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="flex min-w-0 flex-col gap-4">
        <RuleSection
          realmUnitId={realmId}
          postUnitId={realm.extra?.rule ?? null}
        />
        <div className="flex flex-col gap-3">
          <RealmFeedTagFilter
            tagTree={tagTree}
            selectedTagIds={feedTagIds}
            onChange={(tagIds) => onFeedTagIdsChange(tagIds)}
            onOpenTagsTab={onOpenTagsTab}
          />
          <RealmFeedSortSwitcher
            value={feedSort}
            onChange={(sort) => onFeedSortChange(sort)}
          />
          {showManage ? (
            <div className="flex flex-wrap items-center gap-2">
              <label
                htmlFor="realm-manage-mode-toggle"
                className="flex w-fit cursor-pointer items-center gap-2 rounded-md bg-surface-subtle px-3 py-2 text-sm leading-ui text-text-primary"
              >
                <Checkbox
                  id="realm-manage-mode-toggle"
                  checked={manageMode}
                  onCheckedChange={(checked) => setManageMode(checked === true)}
                />
                {t("manage_mode")}
              </label>
              {manageMode ? (
                <Select
                  value={realmModerationStatus}
                  onValueChange={(value) =>
                    setRealmModerationStatus(value as RealmModerationFilter)
                  }
                >
                  <SelectTrigger className="h-9 w-[12rem]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {realmModerationFilters.map((value) => (
                      <SelectItem key={value} value={value}>
                        {realmModerationFilterLabel(value, t)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
            </div>
          ) : null}
        </div>
        <FeedLayout className="space-y-4">
          <PinnedFeedSection realmUnitId={realmId} />
          <RealmContentFeed
            realmId={realmId}
            sort={feedSort}
            tagIds={feedTagIds}
            manageMode={showManage && manageMode}
            realmModerationStatus={
              showManage && manageMode ? realmModerationStatus : undefined
            }
          />
        </FeedLayout>
      </div>
      <aside className="flex min-w-0 flex-col gap-4">
        <FeaturedZoneSection zoneUnitId={realm.extra?.featuredZoneUnitId} />
        <AboutSection postUnitId={realm.extra?.about ?? null} />
        <RuleSection
          realmUnitId={realmId}
          postUnitId={realm.extra?.rule ?? null}
        />
      </aside>
    </div>
  );
}

/**
 * Resolve a human-readable label for a realm moderation filter value.
 * 将 realm 审核筛选值解析为可读标签。
 */
function realmModerationFilterLabel(
  value: RealmModerationFilter,
  t: (key: string) => string,
) {
  switch (value) {
    case "all":
      return t("moderation_filter_all");
    case "pending":
      return t("moderation_status_pending");
    case "approved":
      return t("moderation_status_approved");
    case "removed":
      return t("moderation_status_removed");
  }
}
