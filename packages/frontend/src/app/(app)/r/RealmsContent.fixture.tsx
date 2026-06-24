import { mockRealm, mockRealms } from "@/__cosmos__/mock-data";
import { Button } from "@/components/ui/button";
import type { Realm } from "@rezics/backend/api";
import type { ReactNode } from "react";
import { RealmListView } from "./content";

function toRealm(mock: ReturnType<typeof mockRealm>): Realm {
  return mock;
}

const manyRealms = Array.from({ length: 25 }, (_, index) =>
  toRealm(
    mockRealm({
      id: `realm-${String(index + 1).padStart(3, "0")}`,
      slug: `realm-${index + 1}`,
      name: index === 12 ? "A realm name long enough to wrap naturally inside the card layout" : `Realm ${index + 1}`,
    }),
  ),
);

function Frame({ children }: { readonly children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-3xl p-4 sm:p-6">
      <h1 className="mb-4 text-xl font-semibold">Realms</h1>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

export default {
  Empty: (
    <Frame>
      <RealmListView realms={[]} />
    </Frame>
  ),
  MixedList: (
    <Frame>
      <RealmListView realms={mockRealms().map(toRealm)} />
    </Frame>
  ),
  FullPageShowsLoadMore: (
    <Frame>
      <RealmListView realms={manyRealms} showLoadMore />
    </Frame>
  ),
  NarrowLongName: (
    <div className="max-w-80">
      <Frame>
        <RealmListView
          realms={[
            toRealm(
              mockRealm({
                id: "realm-long",
                slug: "layout-pressure",
                name: "RealmWithOneUnbrokenNameRealmWithOneUnbrokenNameRealmWithOneUnbrokenName",
              }),
            ),
          ]}
        />
      </Frame>
    </div>
  ),
  LoadMoreOnlyControlHeight: (
    <Frame>
      <Button className="self-center" variant="outline">
        Load more
      </Button>
    </Frame>
  ),
};
