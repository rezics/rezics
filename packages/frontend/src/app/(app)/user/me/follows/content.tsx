"use client";

import { SectionBoundary } from "@/components/SectionBoundary";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { parseAsStringLiteral, useQueryState } from "nuqs";

const TABS = ["following", "followers"] as const;

export function FollowsContent() {
  const [tab, setTab] = useQueryState(
    "tab",
    parseAsStringLiteral(TABS).withDefault("following"),
  );

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold">Follows</h1>
      <Tabs onValueChange={(d) => setTab(d.value as (typeof TABS)[number])} value={tab}>
        <TabsList>
          <TabsTrigger value="following">Following</TabsTrigger>
          <TabsTrigger value="followers">Followers</TabsTrigger>
        </TabsList>
        <TabsContent className="py-4" value={tab}>
          <SectionBoundary>
            <div className="text-muted-foreground py-12 text-center text-sm">
              Your {tab} will appear here.
            </div>
          </SectionBoundary>
        </TabsContent>
      </Tabs>
    </div>
  );
}
