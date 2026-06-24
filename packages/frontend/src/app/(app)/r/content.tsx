"use client";

import { PAGE_SIZE, realmListQuery } from "@/atoms/realms";
import { RealmCard } from "@/components/realm/RealmCard";
import { SectionBoundary } from "@/components/SectionBoundary";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/locale";
import { useAtomSuspense } from "@effect/atom-react";
import type { Realm } from "@rezics/backend/api";
import { UsersIcon } from "lucide-react";
import { useState } from "react";

export function RealmListView({
  realms,
  showLoadMore = false,
  onLoadMore,
}: {
  readonly realms: readonly Realm[];
  readonly showLoadMore?: boolean;
  readonly onLoadMore?: () => void;
}) {
  const [t] = useT();

  if (realms.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12">
        <UsersIcon className="text-muted-foreground size-8" />
        <p className="text-muted-foreground text-sm">{t.realms.empty}</p>
      </div>
    );
  }

  return (
    <>
      {realms.map((realm) => (
        <RealmCard key={realm.id} realm={realm} />
      ))}
      {showLoadMore && (
        <Button className="self-center" onClick={onLoadMore} variant="outline">
          {t.common.loadMore}
        </Button>
      )}
    </>
  );
}

function RealmListPage({
  offset,
  isLast,
  onLoadMore,
}: {
  readonly offset: number;
  readonly isLast: boolean;
  readonly onLoadMore: () => void;
}) {
  const result = useAtomSuspense(realmListQuery(offset));
  const realms = result.value;

  return <RealmListView realms={realms} showLoadMore={isLast && realms.length === PAGE_SIZE} onLoadMore={onLoadMore} />;
}

export function RealmsContent() {
  const [t] = useT();
  const [pageCount, setPageCount] = useState(1);
  const offsets = Array.from({ length: pageCount }, (_, i) => i * PAGE_SIZE);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="mb-4 text-xl font-semibold">{t.realms.title}</h1>
      <div className="flex flex-col gap-3">
        {offsets.map((offset) => (
          <SectionBoundary key={offset}>
            <RealmListPage
              isLast={offset === (pageCount - 1) * PAGE_SIZE}
              offset={offset}
              onLoadMore={() => setPageCount((c) => c + 1)}
            />
          </SectionBoundary>
        ))}
      </div>
    </div>
  );
}
