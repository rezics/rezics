import { useServerPermission } from "@rezics/api/hooks";
import {
  myRealmMembershipQuery,
  realmDetailQuery,
} from "@rezics/api/realm/realm";
import type { TagTreeNode } from "@rezics/contract";
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
import { useState } from "react";
import { PinnedFeedSection } from "@/pinboard";
import { ReplyComposer } from "@/post";
import { getTranslation } from "@/shared/utils/translation-helpers";
import { JoinButton } from "../components/JoinButton";
import { RealmContentFeed } from "../components/RealmContentFeed";
import { RealmMemberList } from "../components/RealmMemberList";
import { RealmMuteButton } from "../components/RealmMuteButton";
import { RealmTagManager } from "../components/RealmTagManager";
import { canManageRealm } from "../models/canManageRealm";
import { AboutSection } from "../sections/AboutSection";
import { BannerSection } from "../sections/BannerSection";
import {
  RealmFeedSortSwitcher,
  type RealmFeedSort,
} from "../sections/RealmFeedSortSwitcher";
import { RealmFeedTagFilter } from "../sections/RealmFeedTagFilter";
import { RuleSection } from "../sections/RuleSection";

interface RealmPageProps {
  realmId: string;
  feedSort?: RealmFeedSort;
  feedTagIds?: string[];
  onFeedSortChange?: (sort: RealmFeedSort) => void;
  onFeedTagIdsChange?: (tagIds: string[]) => void;
}

export function RealmPage({
  realmId,
  feedSort = "new",
  feedTagIds = [],
  onFeedSortChange,
  onFeedTagIdsChange,
}: RealmPageProps) {
  const { data: realm, isLoading } = useQuery(realmDetailQuery(realmId));
  const { data: membership } = useQuery(myRealmMembershipQuery(realmId));
  const permission = useServerPermission();
  const [tab, setTab] = useState<"feed" | "tags" | "members">("feed");
  const [composerOpen, setComposerOpen] = useState(false);

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
    return <p className="py-8 text-text-secondary">Realm not found</p>;
  }

  const translation = getTranslation(realm.translations);
  const title = translation?.title ?? "Untitled Realm";
  const description = translation?.description ?? "";
  const tagTree = realm.extra?.tagTree as TagTreeNode[] | undefined;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <BannerSection banner={realm.extra?.banner ?? null} />
      <div className="mb-6 flex flex-col gap-4">
        <div className="flex flex-row items-center justify-between">
          <div className="flex flex-row items-center gap-2">
            <h1 className="text-2xl font-semibold">{title}</h1>
            {showManage && (
              <Link to="/realm/$realmId/manage" params={{ realmId }}>
                <Button variant="ghost" size="icon" aria-label="Manage realm">
                  <Settings className="h-4 w-4" />
                </Button>
              </Link>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isMember ? (
              <Button size="sm" onClick={() => setComposerOpen(true)}>
                Post in this realm
              </Button>
            ) : (
              <Button size="sm" variant="outline" disabled>
                Join to post
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
            {realm.memberCount ?? 0} members
          </span>
          {realm.isPublic && (
            <span className="text-xs text-text-brand">Public</span>
          )}
          {realm.isOfficial && (
            <span className="text-xs text-text-secondary">Official</span>
          )}
        </div>
        <RuleSection postUnitId={realm.extra?.rule ?? null} />
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as typeof tab)}
        className="mb-4"
      >
        <TabsList>
          <TabsTrigger value="feed">Feed</TabsTrigger>
          <TabsTrigger value="tags">Tags</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
        </TabsList>

        <TabsContent value="feed">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="flex min-w-0 flex-col gap-4">
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
            </aside>
          </div>
        </TabsContent>
        <TabsContent value="tags">
          <RealmTagManager realmId={realmId} />
        </TabsContent>
        <TabsContent value="members">
          <RealmMemberList realmId={realmId} />
        </TabsContent>
      </Tabs>

      <Dialog open={composerOpen} onOpenChange={setComposerOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Post in this realm</DialogTitle>
          </DialogHeader>
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
