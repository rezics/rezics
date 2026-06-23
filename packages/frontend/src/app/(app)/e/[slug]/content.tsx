"use client";

import { ClientOnly } from "@/components/ClientOnly";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { use } from "react";

const TABS = ["works", "credits", "about"] as const;
type TabKind = (typeof TABS)[number];

export function EntityDetailContent({
  paramsPromise,
}: {
  readonly paramsPromise: Promise<{ slug: string }>;
}) {
  const { slug } = use(paramsPromise);
  const [tab, setTab] = useQueryState(
    "tab",
    parseAsStringLiteral(TABS).withDefault("works"),
  );

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="flex items-start gap-4 sm:gap-6">
        <Avatar size="2xl">
          <AvatarFallback>{slug.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="truncate text-xl font-bold sm:text-2xl">{slug}</h1>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground truncate text-sm">@{slug}</span>
            <Badge variant="outline">Person</Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            Entity details will load once API is connected.
          </p>
        </div>
      </div>

      <Tabs
        onValueChange={(details) => setTab(details.value as TabKind)}
        value={tab}
      >
        <TabsList className="overflow-x-auto">
          <TabsTrigger value="works">Works</TabsTrigger>
          <TabsTrigger value="credits">Credits</TabsTrigger>
          <TabsTrigger value="about">About</TabsTrigger>
        </TabsList>

        <TabsContent className="py-4" value="works">
          <ClientOnly>
            <EntityTabPlaceholder slug={slug} tab="works" />
          </ClientOnly>
        </TabsContent>
        <TabsContent className="py-4" value="credits">
          <ClientOnly>
            <EntityTabPlaceholder slug={slug} tab="credits" />
          </ClientOnly>
        </TabsContent>
        <TabsContent className="py-4" value="about">
          <ClientOnly>
            <EntityTabPlaceholder slug={slug} tab="about" />
          </ClientOnly>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EntityTabPlaceholder({
  tab,
  slug,
}: {
  readonly tab: string;
  readonly slug: string;
}) {
  return (
    <div className="text-muted-foreground py-8 text-center text-sm">
      {tab} for entity &ldquo;{slug}&rdquo; — connecting to API...
    </div>
  );
}
