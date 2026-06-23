"use client";

import { ClientOnly } from "@/components/ClientOnly";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useT } from "@/lib/i18n/locale";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { use } from "react";

const TABS = ["posts", "reviews", "shelves", "realms"] as const;
type TabKind = (typeof TABS)[number];

export function UserProfileContent({
  paramsPromise,
}: {
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
        <Avatar size="2xl">
          <AvatarFallback>U</AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="truncate text-xl font-bold sm:text-2xl">User</h1>
          <p className="text-muted-foreground truncate text-sm">@{id}</p>
          <p className="text-muted-foreground text-sm">
            Profile details will load once API is connected.
          </p>
          <div className="flex items-center gap-2 pt-2">
            <Button size="sm">Follow</Button>
            <Button size="sm" variant="outline">
              {t.nav.messages}
            </Button>
          </div>
        </div>
      </div>

      <Tabs
        onValueChange={(details) => setTab(details.value as TabKind)}
        value={tab}
      >
        <TabsList className="overflow-x-auto">
          <TabsTrigger value="posts">Posts</TabsTrigger>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
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
  return (
    <div className="text-muted-foreground py-8 text-center text-sm">
      {tab} for user {userId} — connecting to API...
    </div>
  );
}
