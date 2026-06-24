import { mockRealm } from "@/__cosmos__/mock-data";
import { Button } from "@/components/ui/button";
import type { Realm } from "@rezics/backend/api";
import type { ReactNode } from "react";
import { RealmDetailShell } from "./content";

function toRealm(mock: ReturnType<typeof mockRealm>): Realm {
  return mock;
}

function Frame({ children }: { readonly children: ReactNode }) {
  return <div className="mx-auto w-full max-w-3xl p-4 sm:p-6">{children}</div>;
}

function Placeholder({ label }: { readonly label: string }) {
  return <div className="text-muted-foreground py-8 text-center text-sm">{label}</div>;
}

export default {
  JoinedPostsContext: (
    <Frame>
      <RealmDetailShell
        action={<Button variant="outline">Leave</Button>}
        pathname="/r/effect-ts"
        realm={toRealm(mockRealm())}
      >
        <Placeholder label="Post cards here hide the current realm name." />
      </RealmDetailShell>
    </Frame>
  ),
  LockedRulesContext: (
    <Frame>
      <RealmDetailShell
        action={<Button disabled>Locked</Button>}
        pathname="/r/effect-ts/rules"
        realm={toRealm(mockRealm())}
      >
        <Placeholder label="Rules tab selected for a locked realm." />
      </RealmDetailShell>
    </Frame>
  ),
  LongNameWithMemberAction: (
    <Frame>
      <RealmDetailShell
        action={<Button>Join</Button>}
        pathname="/r/very-long-realm-name-for-testing/wiki"
        realm={toRealm(
          mockRealm({
            id: "realm-long",
            slug: "very-long-realm-name-for-testing",
            name: "A very very very long realm name for header wrapping and action wrapping",
          }),
        )}
      >
        <Placeholder label="Wiki content placeholder." />
      </RealmDetailShell>
    </Frame>
  ),
  NarrowUnbrokenName: (
    <div className="max-w-80">
      <Frame>
        <RealmDetailShell
          action={<Button>Join</Button>}
          pathname="/r/unbroken/tags"
          realm={toRealm(
            mockRealm({
              id: "realm-unbroken",
              slug: "unbroken-realm",
              name: "RealmNameWithoutBreaksRealmNameWithoutBreaksRealmNameWithoutBreaks",
            }),
          )}
        >
          <Placeholder label="Tags tab selected." />
        </RealmDetailShell>
      </Frame>
    </div>
  ),
};
