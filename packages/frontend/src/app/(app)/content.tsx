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

export function HomeContent() {
  const [t] = useT();
  const [{ feed, sort }, setParams] = useQueryStates({
    feed: parseAsStringLiteral(FEEDS).withDefault("home"),
    sort: parseAsStringLiteral(SORTS).withDefault("hot"),
  });

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Tabs onValueChange={(details) => setParams({ feed: details.value as FeedKind })} value={feed}>
          <TabsList>
            <TabsTrigger value="home">{t.nav.home}</TabsTrigger>
            <TabsTrigger value="all">{"All"}</TabsTrigger>
          </TabsList>
        </Tabs>

        <Select
          collection={createListCollection({
            items: [
              { value: "hot", label: "Hot" },
              { value: "new", label: "New" },
              { value: "top", label: "Top" },
            ],
          })}
          onValueChange={(details) => setParams({ sort: details.value[0] as SortKind })}
          value={[sort]}
        >
          <SelectTrigger className="h-9 w-32 shrink-0 sm:h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[
              { value: "hot", label: "Hot" },
              { value: "new", label: "New" },
              { value: "top", label: "Top" },
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
  return (
    <div className="text-muted-foreground space-y-4 py-8 text-center text-sm">
      <p>Feed: {feed} / Sort: {sort}</p>
      <p>Posts will appear here once the API is connected.</p>
    </div>
  );
}
