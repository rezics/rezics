import { realmKeys } from "@rezics/api/realm/realm";
import { workRealmContextKeys } from "@rezics/api/work-realm-context/work-realm-context";
import { zoneKeys } from "@rezics/api/zone/zone";
import type {
  RealmDTO,
  ResolvedWorkRealmContext,
  WorkRealmContextDTO,
  ZoneDTO,
} from "@rezics/contract";
import { LANGUAGES } from "@rezics/contract";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useEffect } from "react";
import { withRouter } from "@/stories/decorators/withRouter";
import { bookFew } from "@/stories/fixtures/book";
import { BookWikiContextPanel } from "./BookWikiContextPanel";

const RELEASE_ID = bookFew.unitId;
const QUERY = {
  locale: LANGUAGES.ZH_HANT,
  includeCommunity: true,
  includeArchive: false,
};

const meta = {
  title: "Domain/Book/BookWikiContextPanel",
  component: BookWikiContextPanel,
  decorators: [withRouter],
  args: {
    bookInfo: bookFew,
  },
} satisfies Meta<typeof BookWikiContextPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

function makeContext(
  id: string,
  realmUnitId: string,
  role: WorkRealmContextDTO["role"],
  overrides: Partial<WorkRealmContextDTO> = {},
): WorkRealmContextDTO {
  return {
    id,
    workUnitId: "work-fixture",
    realmUnitId,
    role,
    priority: 0,
    releaseUnitId: role === "official" ? null : RELEASE_ID,
    ...overrides,
  };
}

function makeRealm(
  unitId: string,
  title: string,
  wikiZoneUnitId?: string,
): RealmDTO {
  return {
    unitId,
    isPublic: true,
    isOfficial: false,
    memberCount: 128,
    extra: wikiZoneUnitId ? { wikiZoneUnitId } : {},
    translations: [{ unitId, language: LANGUAGES.EN, title }],
  } as RealmDTO;
}

function makeZone(unitId: string, slug: string, name: string): ZoneDTO {
  return {
    unitId,
    slug,
    name,
    filters: {},
    template: "wiki-classic",
  };
}

function makeResolved(
  input: Partial<ResolvedWorkRealmContext>,
): ResolvedWorkRealmContext {
  return {
    releaseUnitId: RELEASE_ID,
    workUnitId: "work-fixture",
    official: null,
    community: [],
    language: [],
    archive: [],
    conflicts: [],
    ...input,
  };
}

function Seeded({
  resolved,
  realms = [],
  zones = [],
  children,
}: {
  resolved: ResolvedWorkRealmContext;
  realms?: RealmDTO[];
  zones?: ZoneDTO[];
  children: ReactNode;
}) {
  const qc = useQueryClient();

  useEffect(() => {
    qc.setQueryData(
      workRealmContextKeys.byRelease(RELEASE_ID, QUERY),
      resolved,
    );
    for (const realm of realms) {
      qc.setQueryData(realmKeys.detail(realm.unitId), realm);
    }
    for (const zone of zones) {
      qc.setQueryData(zoneKeys.byUnitId(zone.unitId), zone);
    }
  }, [qc, realms, resolved, zones]);

  return <div className="max-w-sm p-4">{children}</div>;
}

const officialContext = makeContext(
  "ctx-official",
  "realm-official",
  "official",
);
const languageContext = makeContext("ctx-language", "realm-ja", "language", {
  locale: LANGUAGES.JA,
});
const communityContext = makeContext(
  "ctx-community",
  "realm-community",
  "community",
);

export const OfficialRealm: Story = {
  render: (args) => (
    <Seeded
      resolved={makeResolved({ official: officialContext })}
      realms={[
        makeRealm("realm-official", "Official Codex Wiki", "zone-official"),
      ]}
      zones={[
        makeZone("zone-official", "official-codex-wiki", "Official Wiki"),
      ]}
    >
      <BookWikiContextPanel {...args} />
    </Seeded>
  ),
};

export const MultipleCommunityRealms: Story = {
  render: (args) => (
    <Seeded
      resolved={makeResolved({
        language: [languageContext],
        community: [communityContext],
      })}
      realms={[
        makeRealm("realm-ja", "Japanese Reader Wiki", "zone-ja"),
        makeRealm("realm-community", "Community Notes"),
      ]}
      zones={[makeZone("zone-ja", "japanese-reader-wiki", "Japanese Wiki")]}
    >
      <BookWikiContextPanel {...args} />
    </Seeded>
  ),
};

export const NoContext: Story = {
  render: (args) => (
    <Seeded resolved={makeResolved({})}>
      <BookWikiContextPanel {...args} />
    </Seeded>
  ),
};

export const OfficialConflict: Story = {
  render: (args) => (
    <Seeded
      resolved={makeResolved({
        conflicts: [
          {
            code: "WORK_REALM_CONTEXT_CONFLICT",
            workUnitId: "work-fixture",
            role: "official",
            contextIds: ["ctx-a", "ctx-b"],
          },
        ],
      })}
    >
      <BookWikiContextPanel {...args} />
    </Seeded>
  ),
};
