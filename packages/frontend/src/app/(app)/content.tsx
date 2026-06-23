"use client";

import { ClientOnly } from "@/components/ClientOnly";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useT } from "@/lib/i18n/locale";
import { createListCollection } from "@ark-ui/react/select";
import { parseAsStringLiteral, useQueryStates } from "nuqs";

const FEEDS = ["home", "all"] as const;
const SORTS = ["hot", "new", "top"] as const;

type FeedKind = (typeof FEEDS)[number];
type SortKind = (typeof SORTS)[number];

// Runtime membership guards for Ark UI string callbacks
// Ark UI 字符串回调的运行时成员守卫
const isFeedKind = (v: string): v is FeedKind =>
  (FEEDS as readonly string[]).includes(v);
const isSortKind = (v: string): v is SortKind =>
  (SORTS as readonly string[]).includes(v);

export function HomeContent() {
  const [t] = useT();
  const [{ feed, sort }, setParams] = useQueryStates({
    feed: parseAsStringLiteral(FEEDS).withDefault("home"),
    sort: parseAsStringLiteral(SORTS).withDefault("hot"),
  });

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Tabs onValueChange={(details) => { if (isFeedKind(details.value)) setParams({ feed: details.value }); }} value={feed}>
          <TabsList>
            <TabsTrigger value="home">{t.nav.home}</TabsTrigger>
            <TabsTrigger value="all">{t.feed.all}</TabsTrigger>
          </TabsList>
        </Tabs>

        <Select
          collection={createListCollection({
            items: [
              { value: "hot", label: t.feed.hot },
              { value: "new", label: t.feed.new },
              { value: "top", label: t.feed.top },
            ],
          })}
          onValueChange={(details) => { const v = details.value[0]; if (v !== undefined && isSortKind(v)) setParams({ sort: v }); }}
          value={[sort]}
        >
          <SelectTrigger className="h-9 w-32 shrink-0 sm:h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[
              { value: "hot", label: t.feed.hot },
              { value: "new", label: t.feed.new },
              { value: "top", label: t.feed.top },
            ].map((item) => (
              <SelectItem item={item} key={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ClientOnly>
        <HomeFeed feed={feed} key={`${feed}:${sort}`} sort={sort} />
      </ClientOnly>
    </div>
  );
}

function HomeFeed({ feed, sort }: { readonly feed: FeedKind; readonly sort: SortKind }) {
  const [t] = useT();
  return (
    <div className="text-muted-foreground space-y-4 py-8 text-center text-sm">
      <p>Feed: {feed} / Sort: {sort}</p>
      <p>{t.feed.connecting}</p>
    </div>
  );
}
