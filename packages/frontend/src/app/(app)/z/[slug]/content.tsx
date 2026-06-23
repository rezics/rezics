"use client";

import { ClientOnly } from "@/components/ClientOnly";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { use } from "react";

const TABS = ["pages", "posts", "wiki", "search"] as const;
type TabKind = (typeof TABS)[number];

export function ZoneDetailContent({
  paramsPromise,
}: {
  readonly paramsPromise: Promise<{ slug: string }>;
}) {
  const { slug } = use(paramsPromise);
  const [tab, setTab] = useQueryState(
    "tab",
    parseAsStringLiteral(TABS).withDefault("pages"),
  );

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">{slug}</h1>
        <p className="text-muted-foreground text-sm">
          Zone details will load once API is connected.
        </p>
      </div>

      <Tabs
        onValueChange={(details) => setTab(details.value as TabKind)}
        value={tab}
      >
        <TabsList className="overflow-x-auto">
          <TabsTrigger value="pages">Pages</TabsTrigger>
          <TabsTrigger value="posts">Posts</TabsTrigger>
          <TabsTrigger value="wiki">Wiki</TabsTrigger>
          <TabsTrigger value="search">Search</TabsTrigger>
        </TabsList>

        <TabsContent className="py-4" value={tab}>
          <ClientOnly>
            <ZoneTabPlaceholder slug={slug} tab={tab} />
          </ClientOnly>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ZoneTabPlaceholder({
  tab,
  slug,
}: {
  readonly tab: string;
  readonly slug: string;
}) {
  return (
    <div className="text-muted-foreground py-8 text-center text-sm">
      {tab} for zone &ldquo;{slug}&rdquo; — connecting to API...
    </div>
  );
}
