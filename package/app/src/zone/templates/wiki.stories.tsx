import { bestLanguageWikiPostsQuery } from "@rezics/api/translation-group";
import { unitDetailQuery } from "@rezics/api/unit";
import {
  LANGUAGES,
  type UnitDTO,
  UnitType,
  type WikiZoneHomepageData,
  type ZoneDTO,
} from "@rezics/contract";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useEffect } from "react";
import { withRouter } from "@/stories/decorators/withRouter";
import {
  WikiClassicZoneTemplate,
  WikiDatabaseZoneTemplate,
  WikiMediaZoneTemplate,
  WikiMinimalZoneTemplate,
} from "./wiki";

const TRANSLATION_GROUP_ID = "translation-group-overview";
const UNIT_IDS = {
  overviewLabel: "label-overview",
  charactersLabel: "label-characters",
  character: "entity-character",
  tag: "tag-lore",
  unit: "unit-guide",
};

function makeUnit(
  id: string,
  title: string,
  type: UnitDTO["type"] = UnitType.LABEL,
): UnitDTO {
  return {
    id,
    type,
    status: "PUBLISHED",
    visibility: "PUBLIC",
    defaultLanguage: LANGUAGES.EN,
    translations: [
      { unitId: id, language: LANGUAGES.EN, title },
      { unitId: id, language: LANGUAGES.ZH_HANT, title: `${title} 繁中` },
    ],
  } as UnitDTO;
}

const navigationUnits = [
  makeUnit(UNIT_IDS.overviewLabel, "Overview"),
  makeUnit(UNIT_IDS.charactersLabel, "Characters"),
  makeUnit(UNIT_IDS.character, "Archivist Rin", UnitType.ENTITY),
  makeUnit(UNIT_IDS.tag, "Lore", UnitType.TAG),
  makeUnit(UNIT_IDS.unit, "Reading guide", UnitType.POST),
];

const baseZone: ZoneDTO = {
  unitId: "zone-wiki-template-fixture",
  slug: "fixture-wiki-template",
  name: "Archive of the Glass City",
  description:
    "A seeded wiki portal covering characters, places, factions, and translated entry groups.",
  template: "wiki-classic",
  filters: {},
  wiki: {
    filters: { realmUnitId: "realm-wiki-fixture", postKind: "WIKI" },
    navigation: {
      sections: [
        {
          id: "main",
          labelUnitId: UNIT_IDS.overviewLabel,
          items: [
            { kind: "labelHeading", labelUnitId: UNIT_IDS.charactersLabel },
            { kind: "entity", entityId: UNIT_IDS.character },
            { kind: "tag", tagUnitId: UNIT_IDS.tag },
            {
              kind: "translationGroup",
              translationGroupId: TRANSLATION_GROUP_ID,
            },
            { kind: "unit", unitId: UNIT_IDS.unit },
            {
              kind: "external",
              href: "https://example.com/wiki-source",
              label: {
                translations: { en: "External archive" },
                fallbackLanguage: LANGUAGES.EN,
              },
            },
            {
              kind: "manualLink",
              href: "/realm/search",
              label: {
                translations: { en: "Realm search" },
                fallbackLanguage: LANGUAGES.EN,
              },
            },
          ],
        },
      ],
    },
    homepage: { template: "wiki-classic-home", sections: [] },
    theme: {
      template: "wiki-classic",
      homepageTemplate: "wiki-classic-home",
      palette: {},
      chrome: { density: "comfortable", navPosition: "side" },
      layout: { contentWidth: "wide", infoboxPosition: "right" },
    },
  },
} as ZoneDTO;

const homepageData: WikiZoneHomepageData = {
  template: "wiki-classic-home",
  sections: [
    {
      section: {
        id: "characters",
        kind: "entityCollection",
        title: {
          translations: { en: "Characters and factions" },
          fallbackLanguage: LANGUAGES.EN,
        },
      },
      items: [
        {
          kind: "entity",
          entityUnitId: UNIT_IDS.character,
          title: "Archivist Rin",
          summary: "Maintains the city index and links disputed sources.",
        },
      ],
    },
    {
      section: {
        id: "featured",
        kind: "translationGroupCollection",
        title: {
          translations: { en: "Featured entries" },
          fallbackLanguage: LANGUAGES.EN,
        },
      },
      items: [
        {
          kind: "wikiPost",
          unitId: "wiki-overview-en",
          translationGroupId: TRANSLATION_GROUP_ID,
          title: "Overview",
          summary:
            "Best-language wiki entry selected from a translation group.",
        },
      ],
    },
    {
      section: {
        id: "manual",
        kind: "manualLinks",
        title: {
          translations: { en: "Manual links" },
          fallbackLanguage: LANGUAGES.EN,
        },
      },
      items: [
        {
          kind: "navigationItem",
          item: {
            kind: "manualLink",
            href: "/realm/search",
            label: {
              translations: { en: "Open realm search" },
              fallbackLanguage: LANGUAGES.EN,
            },
          },
        },
      ],
    },
    {
      section: {
        id: "empty",
        kind: "stubWiki",
        emptyState: "show-empty",
      },
      items: [],
    },
  ],
};

function zoneWith(
  template: NonNullable<ZoneDTO["wiki"]>["theme"]["template"],
  homepageTemplate: WikiZoneHomepageData["template"],
  navPosition: "side" | "top" = "side",
): ZoneDTO {
  return {
    ...baseZone,
    template,
    wiki: {
      ...baseZone.wiki!,
      homepage: {
        ...baseZone.wiki!.homepage,
        template: homepageTemplate,
      },
      theme: {
        ...baseZone.wiki!.theme,
        template,
        homepageTemplate,
        chrome: {
          density: template === "wiki-minimal" ? "compact" : "comfortable",
          navPosition,
        },
      },
    },
  } as ZoneDTO;
}

function homepageWith(
  template: WikiZoneHomepageData["template"],
): WikiZoneHomepageData {
  return { ...homepageData, template };
}

function Seeded({ children }: { children: ReactNode }) {
  const qc = useQueryClient();

  useEffect(() => {
    for (const unit of navigationUnits) {
      qc.setQueryData(unitDetailQuery(unit.id).queryKey, unit);
    }
    qc.setQueryData(
      bestLanguageWikiPostsQuery([TRANSLATION_GROUP_ID], [LANGUAGES.ZH_HANT])
        .queryKey,
      {
        posts: [
          {
            translationGroupId: TRANSLATION_GROUP_ID,
            unitId: "wiki-overview-en",
            language: LANGUAGES.EN,
            title: "Overview",
          },
        ],
      },
    );
  }, [qc]);

  return <div className="p-6">{children}</div>;
}

const meta = {
  title: "Domain/Zone/WikiTemplates",
  decorators: [withRouter],
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Classic: Story = {
  render: () => (
    <Seeded>
      <WikiClassicZoneTemplate
        zone={zoneWith("wiki-classic", "wiki-classic-home")}
        homepageData={homepageWith("wiki-classic-home")}
      />
    </Seeded>
  ),
};

export const Media: Story = {
  render: () => (
    <Seeded>
      <WikiMediaZoneTemplate
        zone={zoneWith("wiki-media", "wiki-media-home")}
        homepageData={homepageWith("wiki-media-home")}
      />
    </Seeded>
  ),
};

export const Database: Story = {
  render: () => (
    <Seeded>
      <WikiDatabaseZoneTemplate
        zone={zoneWith("wiki-database", "wiki-database-home")}
        homepageData={homepageWith("wiki-database-home")}
      />
    </Seeded>
  ),
};

export const MinimalTopNavigation: Story = {
  render: () => (
    <Seeded>
      <WikiMinimalZoneTemplate
        zone={zoneWith("wiki-minimal", "wiki-minimal-home", "top")}
        homepageData={homepageWith("wiki-minimal-home")}
      />
    </Seeded>
  ),
};
