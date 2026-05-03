import { useServerPermission } from "@rezics/api/hooks";
import {
  myRealmMembershipQuery,
  realmDetailQuery,
} from "@rezics/api/realm/realm";
import { Spinner } from "@rezics/ui";
import {
  Button,
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
import { getTranslation } from "@/shared/utils/translation-helpers";
import { JoinButton } from "../components/JoinButton";
import { RealmContentFeed } from "../components/RealmContentFeed";
import { RealmMemberList } from "../components/RealmMemberList";
import { RealmTagManager } from "../components/RealmTagManager";
import { canManageRealm } from "../models/canManageRealm";

interface RealmPageProps {
  realmId: string;
}

export function RealmPage({ realmId }: RealmPageProps) {
  const { data: realm, isLoading } = useQuery(realmDetailQuery(realmId));
  const { data: membership } = useQuery(myRealmMembershipQuery(realmId));
  const permission = useServerPermission();
  const [tab, setTab] = useState<"feed" | "tags" | "members">("feed");

  const showManage = canManageRealm({
    permission,
    memberRoleKey: membership?.roleKey,
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
      <p className="py-8 text-rezics-color-fg-muted">Realm not found</p>
    );
  }

  const translation = getTranslation(realm.translations);
  const title = translation?.title ?? "Untitled Realm";
  const description = translation?.description ?? "";

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
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
          <JoinButton realmId={realmId} />
        </div>
        {description && (
          <p className="text-base text-rezics-color-fg-muted">{description}</p>
        )}
        <div className="flex flex-row gap-4">
          <span className="text-xs text-rezics-color-fg-muted">
            {realm.memberCount ?? 0} members
          </span>
          {realm.isPublic && (
            <span className="text-xs text-rezics-color-primary">Public</span>
          )}
          {realm.isOfficial && (
            <span className="text-xs" style={{ color: "var(--rezics-color-secondary, var(--rezics-color-fg-muted))" }}>
              Official
            </span>
          )}
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="mb-4">
        <TabsList>
          <TabsTrigger value="feed">Feed</TabsTrigger>
          <TabsTrigger value="tags">Tags</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
        </TabsList>

        <TabsContent value="feed">
          <div className="flex flex-col gap-4">
            <PinnedFeedSection realmUnitId={realmId} />
            <RealmContentFeed realmId={realmId} />
          </div>
        </TabsContent>
        <TabsContent value="tags">
          <RealmTagManager realmId={realmId} />
        </TabsContent>
        <TabsContent value="members">
          <RealmMemberList realmId={realmId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default RealmPage;
