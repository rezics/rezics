"use client";

import { SectionBoundary } from "@/components/SectionBoundary";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useT } from "@/lib/i18n/locale";
import { parseAsStringLiteral, useQueryState } from "nuqs";

const TABS = ["following", "followers"] as const;
type TabKind = (typeof TABS)[number];

// Runtime membership guard for Ark UI string callback
// Ark UI 字符串回调的运行时成员守卫
const tabSet: ReadonlySet<string> = new Set(TABS);
const isTabKind = (v: string): v is TabKind => tabSet.has(v);

export function FollowsContent() {
  const [t] = useT();
  const [tab, setTab] = useQueryState(
    "tab",
    parseAsStringLiteral(TABS).withDefault("following"),
  );

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold">{t.follows.title}</h1>
      <Tabs onValueChange={(d) => { if (isTabKind(d.value)) setTab(d.value); }} value={tab}>
        <TabsList>
          <TabsTrigger value="following">{t.follows.following}</TabsTrigger>
          <TabsTrigger value="followers">{t.follows.followers}</TabsTrigger>
        </TabsList>
        <TabsContent className="py-4" value={tab}>
          <SectionBoundary>
            <div className="text-muted-foreground py-12 text-center text-sm">
              {t.follows.emptyPlaceholder(tab)}
            </div>
          </SectionBoundary>
        </TabsContent>
      </Tabs>
    </div>
  );
}
