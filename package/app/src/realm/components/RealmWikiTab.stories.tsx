import { postQueries } from "@rezics/api/post/post";
import { zoneKeys } from "@rezics/api/zone/zone";
import type { PostDTO, ZonePortalResponse } from "@rezics/contract";
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

const wikiZonePortal: ZonePortalResponse = {
  zone: {
    unitId: WIKI_ZONE_ID,
    ownerRealmUnitId: REALM_ID,
    slug: "fixture-wiki-zone",
    name: "Fixture Wiki Zone",
    translations: [{ language: "en", title: "Fixture Wiki Zone" }],
    boundary: {
      schema: "rezics/zone-boundary",
      version: 1,
      context: { kind: "realm", realmUnitId: REALM_ID },
      filters: { realm: "context" },
    },
    nav: {
      schema: "rezics/zone-nav",
      version: 1,
      menus: [
        {
          id: "main",
          nodes: [
            {
              id: "home",
              target: { kind: "zonePage", pageId: "home" },
            },
          ],
        },
      ],
      header: { menuId: "main" },
    },
    theme: { schema: "rezics/zone-theme", version: 1 },
    homePageId: "wiki-home-page",
    pages: [{ id: "wiki-home-page", slug: "home", position: 0 }],
  },
  page: {
    id: "wiki-home-page",
    slug: "home",
    position: 0,
    config: {
      schema: "rezics/zone-page",
      version: 1,
      sections: [],
    },
  },
  refUnits: {},
};

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
  portal = wikiZonePortal,
  children,
}: {
  posts: PostDTO[];
  portal?: ZonePortalResponse | null;
  children: ReactNode;
}) {
  const qc = useQueryClient();

  useEffect(() => {
    qc.setQueryData(postQueries.wikiByRealm(REALM_ID, WIKI_FILTERS).queryKey, {
      posts,
      total: posts.length,
    });
    for (const post of posts) {
      qc.setQueryData(postQueries.detail(post.unitId).queryKey, post);
    }
    if (portal) {
      qc.setQueryData(
        zoneKeys.portal(portal.zone.unitId, portal.page.slug),
        portal,
      );
    }
  }, [posts, qc, portal]);

  return <div className="max-w-5xl p-6">{children}</div>;
}

const meta = {
  title: "Domain/Realm/RealmWikiTab",
  component: RealmWikiTab,
  decorators: [withRouter],
  args: {
    realmId: REALM_ID,
    routeLocation: { kind: "unitId", realmId: REALM_ID },
    wikiSidebar: null,
  },
} satisfies Meta<typeof RealmWikiTab>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AutoPageList: Story = {
  render: (args) => (
    <Seeded posts={wikiPosts}>
      <RealmWikiTab {...args} />
    </Seeded>
  ),
};

export const SidebarPost: Story = {
  args: {
    wikiSidebar: { kind: "post", postUnitId: "wiki-post-1" },
  },
  render: (args) => (
    <Seeded posts={wikiPosts}>
      <RealmWikiTab {...args} />
    </Seeded>
  ),
};

export const ZoneNavigation: Story = {
  args: {
    wikiSidebar: { kind: "zoneNav", zoneUnitId: WIKI_ZONE_ID },
  },
  render: (args) => (
    <Seeded posts={wikiPosts}>
      <RealmWikiTab {...args} />
    </Seeded>
  ),
};

export const EmptyAutoList: Story = {
  render: (args) => (
    <Seeded posts={[]} portal={null}>
      <RealmWikiTab {...args} />
    </Seeded>
  ),
};
