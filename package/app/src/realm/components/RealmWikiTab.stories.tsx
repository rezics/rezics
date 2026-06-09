import { postQueries } from "@rezics/api/post/post";
import { zoneKeys } from "@rezics/api/zone/zone";
import type { PostDTO, ZoneDTO } from "@rezics/contract";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useEffect } from "react";
import { withRouter } from "@/stories/decorators/withRouter";
import { postFlat } from "@/stories/fixtures/post";
import { RealmWikiTab } from "./RealmWikiTab";

const REALM_ID = "realm-wiki-fixture";
const WIKI_ZONE_ID = "zone-wiki-fixture";
const WIKI_FILTERS = {
  sort: { field: "updatedAt", order: "desc" },
  limit: 24,
} as const;

const wikiZone: ZoneDTO = {
  unitId: WIKI_ZONE_ID,
  ownerRealmUnitId: REALM_ID,
  slug: "fixture-wiki-zone",
  name: "Fixture Wiki Zone",
  template: "wiki-classic",
  filters: {},
  configVersion: 1,
  pages: null,
  sections: null,
  theme: null,
  primaryRealmUnitId: REALM_ID,
} as ZoneDTO;

const wikiPosts = postFlat.map(
  (post, index) =>
    ({
      ...post,
      unitId: `wiki-post-${index + 1}`,
      kind: "WIKI",
      title: `Wiki entry ${index + 1}`,
      targetUnitId: REALM_ID,
    }) as PostDTO,
);

function Seeded({
  posts,
  zone = wikiZone,
  children,
}: {
  posts: PostDTO[];
  zone?: ZoneDTO | null;
  children: ReactNode;
}) {
  const qc = useQueryClient();

  useEffect(() => {
    qc.setQueryData(postQueries.wikiByRealm(REALM_ID, WIKI_FILTERS).queryKey, {
      posts,
      total: posts.length,
    });
    if (zone) {
      qc.setQueryData(zoneKeys.byUnitId(zone.unitId), zone);
    }
  }, [posts, qc, zone]);

  return <div className="max-w-5xl p-6">{children}</div>;
}

const meta = {
  title: "Domain/Realm/RealmWikiTab",
  component: RealmWikiTab,
  decorators: [withRouter],
  args: {
    realmId: REALM_ID,
    wikiZoneUnitId: WIKI_ZONE_ID,
    canManage: true,
  },
} satisfies Meta<typeof RealmWikiTab>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithConfiguredZone: Story = {
  render: (args) => (
    <Seeded posts={wikiPosts}>
      <RealmWikiTab {...args} />
    </Seeded>
  ),
};

export const EmptyWithSetup: Story = {
  args: { wikiZoneUnitId: null },
  render: (args) => (
    <Seeded posts={[]} zone={null}>
      <RealmWikiTab {...args} />
    </Seeded>
  ),
};
