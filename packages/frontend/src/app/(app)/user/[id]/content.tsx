"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";
import { use } from "react";
import { ClientOnly } from "@/components/ClientOnly";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useT } from "@/lib/i18n/locale";

const TABS = ["posts", "reviews", "shelves", "realms"] as const;
type TabKind = (typeof TABS)[number];

export interface UserProfileFixtureProfile {
  readonly displayName?: string;
  readonly handle?: string;
  readonly avatarFallback?: string;
  readonly bio?: string;
  readonly canFollow?: boolean;
  readonly canMessage?: boolean;
  readonly isAnonymousViewer?: boolean;
}

// Runtime membership guard for Ark UI string callback
// Ark UI 字符串回调的运行时成员守卫
const tabSet: ReadonlySet<string> = new Set(TABS);
const isTabKind = (v: string): v is TabKind => tabSet.has(v);

export function UserProfileContent({
  profile,
  paramsPromise,
}: {
  readonly profile?: UserProfileFixtureProfile;
  readonly paramsPromise: Promise<{ id: string }>;
}) {
  const { id } = use(paramsPromise);
  const [t] = useT();
  const [tab, setTab] = useQueryState(
    "tab",
    parseAsStringLiteral(TABS).withDefault("posts"),
  );

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="flex items-start gap-4 sm:gap-6">
        <Avatar size="lg">
          <AvatarFallback>{profile?.avatarFallback ?? "U"}</AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="truncate text-xl font-bold sm:text-2xl">
            {profile?.displayName ?? "User"}
          </h1>
          <p className="text-muted-foreground truncate text-sm">
            @{profile?.handle ?? id}
          </p>
          <p className="text-muted-foreground text-sm">
            {profile?.bio ?? t.user.profilePlaceholder}
          </p>
          <div className="flex items-center gap-2 pt-2">
            {profile?.canFollow !== false && (
              <Button size="sm">
                {profile?.isAnonymousViewer ? t.nav.signIn : t.user.follow}
              </Button>
            )}
            {profile?.canMessage !== false && (
              <Button size="sm" variant="outline">
                {t.nav.messages}
              </Button>
            )}
          </div>
        </div>
      </div>

      <Tabs
        onValueChange={(details) => {
          if (isTabKind(details.value)) setTab(details.value);
        }}
        value={tab}
      >
        <TabsList className="overflow-x-auto">
          <TabsTrigger value="posts">{t.user.posts}</TabsTrigger>
          <TabsTrigger value="reviews">{t.user.reviews}</TabsTrigger>
          <TabsTrigger value="shelves">{t.nav.shelves}</TabsTrigger>
          <TabsTrigger value="realms">{t.nav.realms}</TabsTrigger>
        </TabsList>

        <TabsContent className="py-4" value="posts">
          <ClientOnly>
            <UserTabPlaceholder tab="posts" userId={id} />
          </ClientOnly>
        </TabsContent>
        <TabsContent className="py-4" value="reviews">
          <ClientOnly>
            <UserTabPlaceholder tab="reviews" userId={id} />
          </ClientOnly>
        </TabsContent>
        <TabsContent className="py-4" value="shelves">
          <ClientOnly>
            <UserTabPlaceholder tab="shelves" userId={id} />
          </ClientOnly>
        </TabsContent>
        <TabsContent className="py-4" value="realms">
          <ClientOnly>
            <UserTabPlaceholder tab="realms" userId={id} />
          </ClientOnly>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function UserTabPlaceholder({
  tab,
  userId,
}: {
  readonly tab: string;
  readonly userId: string;
}) {
  const [t] = useT();
  return (
    <div className="text-muted-foreground py-8 text-center text-sm">
      {t.user.tabPlaceholder(tab, userId)}
    </div>
  );
}
