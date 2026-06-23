"use client";

import { ClientOnly } from "@/components/ClientOnly";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GamepadIcon } from "lucide-react";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { use } from "react";

const TABS = ["info", "reviews", "discussion"] as const;
type TabKind = (typeof TABS)[number];

export function GameDetailContent({
  paramsPromise,
}: {
  readonly paramsPromise: Promise<{ id: string }>;
}) {
  const { id } = use(paramsPromise);
  const [tab, setTab] = useQueryState(
    "tab",
    parseAsStringLiteral(TABS).withDefault("info"),
  );

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="flex items-start gap-4 sm:gap-6">
        <div className="bg-muted flex size-20 shrink-0 items-center justify-center rounded-md sm:h-32 sm:w-24">
          <GamepadIcon className="text-muted-foreground size-8" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="truncate text-xl font-bold sm:text-2xl">Game</h1>
          <p className="text-muted-foreground text-sm">Developer · Publisher</p>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline">PC</Badge>
            <Badge variant="outline">Console</Badge>
          </div>
        </div>
      </div>

      <Tabs
        onValueChange={(details) => setTab(details.value as TabKind)}
        value={tab}
      >
        <TabsList>
          <TabsTrigger value="info">Info</TabsTrigger>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
          <TabsTrigger value="discussion">Discussion</TabsTrigger>
        </TabsList>

        <TabsContent className="py-4" value={tab}>
          <ClientOnly>
            <div className="text-muted-foreground py-8 text-center text-sm">
              {tab} for game {id} — connecting to API...
            </div>
          </ClientOnly>
        </TabsContent>
      </Tabs>
    </div>
  );
}
