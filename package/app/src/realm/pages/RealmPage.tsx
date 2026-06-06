import { useServerPermission } from "@rezics/api/hooks";
import {
  myRealmMembershipQuery,
  realmDetailQuery,
} from "@rezics/api/realm/realm";
import { userQueries } from "@rezics/api/user/user.queries";
import {
  contentDocMarkdownFallback,
  type PostListQuery,
  type TagTreeNode,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import {
  Button,
  Checkbox,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Plus, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { FeedLayout } from "@/feed";
import { PinnedFeedSection } from "@/pinboard";
import { useReadLanguageCandidates } from "@/shared/hooks/useReadLanguageCandidates";
import { JoinButton } from "../components/JoinButton";
import { RealmContentFeed } from "../components/RealmContentFeed";
import { RealmMemberList } from "../components/RealmMemberList";
import { RealmMuteButton } from "../components/RealmMuteButton";
import { RealmTagBrowser } from "../components/RealmTagBrowser";
import { RealmWikiTab } from "../components/RealmWikiTab";
import { canManageRealm } from "../models/canManageRealm";
import { useRealmManageMode } from "../models/realmManageMode";
import { AboutSection } from "../sections/AboutSection";
import { BannerSection } from "../sections/BannerSection";
import { RealmAboutTab } from "../sections/RealmAboutTab";
import {
  type RealmFeedSort,
  RealmFeedSortSwitcher,
} from "../sections/RealmFeedSortSwitcher";
import { RealmFeedTagFilter } from "../sections/RealmFeedTagFilter";
import { RuleSection } from "../sections/RuleSection";

export type RealmPageTab = "feed" | "wiki" | "tags" | "about" | "members";
export type { RealmFeedSort };

type RealmModerationFilter = NonNullable<
  PostListQuery["realmModerationStatus"]
>;

const realmModerationFilters = [
  "all",
  "pending",
  "approved",
  "removed",
] satisfies RealmModerationFilter[];

function realmModerationFilterLabel(value: RealmModerationFilter) {
  switch (value) {
    case "all":
      return "All moderation states";
    case "pending":
      return "Pending review";
    case "approved":
      return "Approved";
    case "removed":
      return "Removed";
  }
}

interface RealmPageProps {
  realmId: string;
  tab?: RealmPageTab;
  feedSort?: RealmFeedSort;
  feedTagIds?: string[];
  onTabChange?: (tab: RealmPageTab) => void;
  onFeedSortChange?: (sort: RealmFeedSort) => void;
  onFeedTagIdsChange?: (tagIds: string[]) => void;
}

export function RealmPage({
  realmId,
  tab,
  feedSort = "best",
  feedTagIds = [],
  onTabChange,
  onFeedSortChange,
  onFeedTagIdsChange,
}: RealmPageProps) {
  const { t } = useTranslation(["common", "entity"]);
  const languages = useReadLanguageCandidates();
  const { data: realm, isLoading } = useQuery(
    realmDetailQuery(realmId, { languages }),
  );
  const { data: membership } = useQuery(myRealmMembershipQuery(realmId));
  const { data: settings } = useQuery({
    ...userQueries.settings(),
    enabled: Boolean(membership),
  });
  const permission = useServerPermission();
  const [localTab, setLocalTab] = useState<RealmPageTab>(tab ?? "feed");
  const [realmModerationStatus, setRealmModerationStatus] =
    useState<RealmModerationFilter>("all");

  useEffect(() => {
    if (tab) setLocalTab(tab);
  }, [tab]);

  const showManage = canManageRealm({
    permission,
    memberRoleKey: membership?.roleKey,
  });
  const isMember = Boolean(membership);
  const [manageMode, setManageMode] = useRealmManageMode({
    realmId,
    settings,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (!realm) {
    return (
      <p className="py-8 text-text-secondary">{t("entity:realm_not_found")}</p>
    );
  }

  const title = realm.title ?? t("entity:realm_untitled");
  const description = contentDocMarkdownFallback(realm.description);
  const tagTree = realm.extra?.tagTree as TagTreeNode[] | undefined;
  const wikiZoneUnitId = realm.extra?.wikiZoneUnitId ?? null;
  const showWikiTab = Boolean(wikiZoneUnitId) || showManage;
  // Public realm tabs are consumption-only; configuration and queues live in /manage.
  const activeTab = localTab === "wiki" && !showWikiTab ? "feed" : localTab;
  const handleTabChange = (value: string) => {
    const next = value as RealmPageTab;
    if (onTabChange) onTabChange(next);
    else setLocalTab(next);
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <BannerSection banner={realm.extra?.banner ?? null} />
      <div className="mb-6 flex flex-col gap-4">
        <div className="flex flex-row items-center justify-between">
          <div className="flex flex-row items-center gap-2">
            <h1 className="text-2xl font-semibold">{title}</h1>
            {showManage && (
              <Link to="/realm/$realmId/manage" params={{ realmId }}>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("entity:realm_manage")}
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </Link>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isMember ? (
              <Link to="/realm/$realmId/create" params={{ realmId }}>
                <Button size="sm" className="gap-1 rounded-full px-2 md:px-4">
                  <Plus className="h-4 w-4" />
                  {t("common:create")}
                </Button>
              </Link>
            ) : (
              <Button size="sm" variant="outline" disabled>
                {t("entity:realm_join_to_post")}
              </Button>
            )}
            <JoinButton realmId={realmId} />
            <RealmMuteButton realmUnitId={realmId} />
          </div>
        </div>
        {description && (
          <p className="text-base text-text-secondary">{description}</p>
        )}
        <div className="flex flex-row gap-4">
          <span className="text-xs text-text-secondary">
            {t("entity:realm_member_count", { count: realm.memberCount ?? 0 })}
          </span>
          {realm.isPublic && (
            <span className="text-xs text-text-brand">
              {t("entity:realm_public")}
            </span>
          )}
          {realm.isOfficial && (
            <span className="text-xs text-text-secondary">
              {t("entity:realm_official")}
            </span>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="mb-4">
        <TabsList>
          <TabsTrigger value="feed">{t("entity:realm_tab_feed")}</TabsTrigger>
          {showWikiTab && <TabsTrigger value="wiki">Wiki</TabsTrigger>}
          <TabsTrigger value="tags">{t("entity:realm_tab_tags")}</TabsTrigger>
          <TabsTrigger value="about">About</TabsTrigger>
          <TabsTrigger value="members">
            {t("entity:realm_tab_members")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="feed">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="flex min-w-0 flex-col gap-4">
              <RuleSection
                realmUnitId={realmId}
                postUnitId={realm.extra?.rule ?? null}
              />
              <div className="flex flex-col gap-3">
                <RealmFeedSortSwitcher
                  value={feedSort}
                  onChange={(sort) => onFeedSortChange?.(sort)}
                />
                <RealmFeedTagFilter
                  tagTree={tagTree}
                  selectedTagIds={feedTagIds}
                  onChange={(tagIds) => onFeedTagIdsChange?.(tagIds)}
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
                        onCheckedChange={(checked) =>
                          setManageMode(checked === true)
                        }
                      />
                      Manage mode
                    </label>
                    {manageMode ? (
                      <Select
                        value={realmModerationStatus}
                        onValueChange={(value) =>
                          setRealmModerationStatus(
                            value as RealmModerationFilter,
                          )
                        }
                      >
                        <SelectTrigger className="h-9 w-[12rem]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {realmModerationFilters.map((value) => (
                            <SelectItem key={value} value={value}>
                              {realmModerationFilterLabel(value)}
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
            <aside className="min-w-0">
              <AboutSection postUnitId={realm.extra?.about ?? null} />
              <div className="mt-4">
                <RuleSection
                  realmUnitId={realmId}
                  postUnitId={realm.extra?.rule ?? null}
                />
              </div>
            </aside>
          </div>
        </TabsContent>
        {showWikiTab && (
          <TabsContent value="wiki">
            <RealmWikiTab
              realmId={realmId}
              wikiZoneUnitId={wikiZoneUnitId}
              canManage={showManage}
            />
          </TabsContent>
        )}
        <TabsContent value="tags">
          <RealmTagBrowser
            realmId={realmId}
            tagTree={tagTree}
            tagView={realm.extra?.tagView ?? null}
          />
        </TabsContent>
        <TabsContent value="members">
          <RealmMemberList realmId={realmId} />
        </TabsContent>
        <TabsContent value="about">
          <RealmAboutTab
            realm={realm}
            description={description}
            membership={membership}
            canManage={showManage}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default RealmPage;
