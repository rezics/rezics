import { useServerPermission } from "@rezics/api/hooks";
import {
  myRealmMembershipQuery,
  realmDetailQuery,
} from "@rezics/api/realm/realm";
import { contentDocMarkdownFallback, type TagTreeNode } from "@rezics/contract";
import {
  realm_join_to_post,
  realm_manage,
  realm_member_count,
  realm_not_found,
  realm_official,
  realm_post_in_realm,
  realm_public,
  realm_tab_feed,
  realm_tab_members,
  realm_tab_tags,
  realm_untitled,
} from "@rezics/i18n/messages";
import { useMessage } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { PinnedFeedSection } from "@/pinboard";
import { ReplyComposer } from "@/post";
import { getTranslation } from "@/shared/utils/translation-helpers";
import { JoinButton } from "../components/JoinButton";
import { RealmContentFeed } from "../components/RealmContentFeed";
import { RealmMemberList } from "../components/RealmMemberList";
import { RealmMuteButton } from "../components/RealmMuteButton";
import { RealmTagManager } from "../components/RealmTagManager";
import { RealmWikiTab } from "../components/RealmWikiTab";
import { canManageRealm } from "../models/canManageRealm";
import { AboutSection } from "../sections/AboutSection";
import { BannerSection } from "../sections/BannerSection";
import {
  type RealmFeedSort,
  RealmFeedSortSwitcher,
} from "../sections/RealmFeedSortSwitcher";
import { RealmFeedTagFilter } from "../sections/RealmFeedTagFilter";
import { RealmAboutTab } from "../sections/RealmAboutTab";
import { RealmModerationQueueSection } from "../sections/RealmModerationQueueSection";
import { RuleSection } from "../sections/RuleSection";

const i18nMessages = {
  realm_join_to_post,
  realm_manage,
  realm_member_count,
  realm_not_found,
  realm_official,
  realm_post_in_realm,
  realm_public,
  realm_tab_feed,
  realm_tab_members,
  realm_tab_tags,
  realm_untitled,
};

export type RealmPageTab =
  | "feed"
  | "wiki"
  | "tags"
  | "about"
  | "members"
  | "moderation";

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
  feedSort = "new",
  feedTagIds = [],
  onTabChange,
  onFeedSortChange,
  onFeedTagIdsChange,
}: RealmPageProps) {
  const m = useMessage(i18nMessages);
  const { data: realm, isLoading } = useQuery(realmDetailQuery(realmId));
  const { data: membership } = useQuery(myRealmMembershipQuery(realmId));
  const permission = useServerPermission();
  const [localTab, setLocalTab] = useState<RealmPageTab>(tab ?? "feed");
  const [composerOpen, setComposerOpen] = useState(false);

  useEffect(() => {
    if (tab) setLocalTab(tab);
  }, [tab]);

  const showManage = canManageRealm({
    permission,
    memberRoleKey: membership?.roleKey,
  });
  const isMember = Boolean(membership);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (!realm) {
    return <p className="py-8 text-text-secondary">{m.realm_not_found()}</p>;
  }

  const translation = getTranslation(realm.translations);
  const title = translation?.title ?? m.realm_untitled();
  const description = contentDocMarkdownFallback(translation?.description);
  const tagTree = realm.extra?.tagTree as TagTreeNode[] | undefined;
  const wikiZoneUnitId = realm.extra?.wikiZoneUnitId ?? null;
  const showWikiTab = Boolean(wikiZoneUnitId) || showManage;
  const showModerationTab = showManage;
  const activeTab =
    (localTab === "wiki" && !showWikiTab) ||
    (localTab === "moderation" && !showModerationTab)
      ? "feed"
      : localTab;
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
                  aria-label={m.realm_manage()}
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </Link>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isMember ? (
              <Button size="sm" onClick={() => setComposerOpen(true)}>
                {m.realm_post_in_realm()}
              </Button>
            ) : (
              <Button size="sm" variant="outline" disabled>
                {m.realm_join_to_post()}
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
            {m.realm_member_count({ count: realm.memberCount ?? 0 })}
          </span>
          {realm.isPublic && (
            <span className="text-xs text-text-brand">{m.realm_public()}</span>
          )}
          {realm.isOfficial && (
            <span className="text-xs text-text-secondary">
              {m.realm_official()}
            </span>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="mb-4">
        <TabsList>
          <TabsTrigger value="feed">{m.realm_tab_feed()}</TabsTrigger>
          {showWikiTab && <TabsTrigger value="wiki">Wiki</TabsTrigger>}
          <TabsTrigger value="tags">{m.realm_tab_tags()}</TabsTrigger>
          <TabsTrigger value="about">About</TabsTrigger>
          <TabsTrigger value="members">{m.realm_tab_members()}</TabsTrigger>
          {showModerationTab ? (
            <TabsTrigger value="moderation">Moderation</TabsTrigger>
          ) : null}
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
              </div>
              <PinnedFeedSection realmUnitId={realmId} />
              <RealmContentFeed
                realmId={realmId}
                sort={feedSort}
                tagIds={feedTagIds}
              />
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
          <RealmTagManager
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
        {showModerationTab ? (
          <TabsContent value="moderation">
            <RealmModerationQueueSection realmUnitId={realmId} />
          </TabsContent>
        ) : null}
      </Tabs>

      <Dialog open={composerOpen} onOpenChange={setComposerOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{m.realm_post_in_realm()}</DialogTitle>
          </DialogHeader>
          <RuleSection
            realmUnitId={realmId}
            postUnitId={realm.extra?.rule ?? null}
          />
          <ReplyComposer
            mode="expanded"
            realmUnitIds={[realmId]}
            onSubmitted={() => setComposerOpen(false)}
            onCancelled={() => setComposerOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default RealmPage;
