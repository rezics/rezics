import { labelListQuery } from "@rezics/contract/api/label/label";
import { meiliTagSearchQueryOptions } from "@rezics/contract/api/meili/meili.queries";
import { realmTagTreeQuery } from "@rezics/contract/api/realm-tag-tree";
import { tagBatchTranslationsQuery } from "@rezics/contract/api/tag/tag";
import {
  emptyRealmTagTree,
  LANGUAGES,
  type BatchTagTranslationResult,
  type LabelDTO,
  type RealmTagTree,
  type RealmTagTreeNode,
} from "@rezics/contract";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { RealmPostTagPicker } from "./RealmPostTagPicker";

const REALM_ID = "realm-tag-picker-story";

const meta = {
  title: "App/Realm/RealmPostTagPicker",
  component: RealmPostTagPicker,
} satisfies Meta<typeof RealmPostTagPicker>;

export default meta;
type Story = StoryObj<typeof RealmPostTagPicker>;

type NamedTree = {
  tree: RealmTagTree;
  tags: BatchTagTranslationResult;
  labels: LabelDTO[];
};

function label(unitId: string, title: string): LabelDTO {
  return { unitId, translations: [{ language: LANGUAGES.EN, title }] };
}

function tag(name: string): BatchTagTranslationResult[string] {
  return {
    name,
    slug: name.toLowerCase().replaceAll(" ", "-"),
    description: "",
  };
}

function makeTree(
  nodes: RealmTagTreeNode[],
  tags: BatchTagTranslationResult,
  labels: LabelDTO[],
): NamedTree {
  return {
    tree: {
      ...emptyRealmTagTree(),
      view: { defaultMode: "tree", allowViewerSwitch: true },
      nodes,
    },
    tags,
    labels,
  };
}

function SeededPicker({
  fixture,
  initialSelected = [],
  children,
}: {
  fixture: NamedTree;
  initialSelected?: string[];
  children?: ReactNode;
}) {
  const queryClient = useQueryClient();
  const [selectedTagIds, setSelectedTagIds] = useState(initialSelected);
  const tagUnitIds = useMemo(() => Object.keys(fixture.tags), [fixture.tags]);
  const labelUnitIds = useMemo(
    () => fixture.labels.map((item) => item.unitId),
    [fixture.labels],
  );

  useEffect(() => {
    queryClient.setQueryData(realmTagTreeQuery(REALM_ID).queryKey, {
      realmUnitId: REALM_ID,
      tree: fixture.tree,
    });
    queryClient.setQueryData(
      tagBatchTranslationsQuery(tagUnitIds, LANGUAGES.EN).queryKey,
      fixture.tags,
    );
    queryClient.setQueryData(labelListQuery(labelUnitIds).queryKey, {
      labels: fixture.labels,
    });
    queryClient.setQueryData(
      meiliTagSearchQueryOptions({
        keyword: "art",
        limit: 20,
        languages: [LANGUAGES.EN],
        appLocale: LANGUAGES.EN,
      }).queryKey,
      {
        items: [
          {
            unitId: "tag-art-history",
            title: "Art history",
            slug: "art-history",
          },
          {
            unitId: "tag-visual-culture",
            title: "Visual culture",
            slug: "visual-culture",
          },
        ],
        total: 2,
      },
    );
  }, [fixture, labelUnitIds, queryClient, tagUnitIds]);

  return (
    <div className="max-w-2xl p-4">
      <RealmPostTagPicker
        realmUnitIds={[REALM_ID]}
        selectedTagIds={selectedTagIds}
        onSelectedTagIdsChange={setSelectedTagIds}
      />
      {children}
    </div>
  );
}

const emptyFixture = makeTree([], {}, []);

const shallowFixture = makeTree(
  [
    {
      kind: "label",
      labelUnitId: "label-format",
      children: [
        { kind: "tag", tagUnitId: "tag-novel" },
        { kind: "tag", tagUnitId: "tag-manga" },
      ],
    },
    { kind: "tag", tagUnitId: "tag-question" },
  ],
  {
    "tag-novel": tag("Novel"),
    "tag-manga": tag("Manga"),
    "tag-question": tag("Question"),
  },
  [label("label-format", "Format")],
);

const deepFixture = makeTree(
  [
    {
      kind: "label",
      labelUnitId: "label-works",
      children: [
        {
          kind: "tag",
          tagUnitId: "tag-wuthering-heights",
          children: [
            { kind: "tag", tagUnitId: "tag-heathcliff" },
            { kind: "tag", tagUnitId: "tag-moors" },
          ],
        },
        { kind: "tag", tagUnitId: "tag-the-road" },
        { kind: "tag", tagUnitId: "tag-wind-up-bird" },
      ],
    },
    {
      kind: "label",
      labelUnitId: "label-themes",
      children: [
        { kind: "tag", tagUnitId: "tag-memory" },
        { kind: "tag", tagUnitId: "tag-grief" },
      ],
    },
  ],
  {
    "tag-wuthering-heights": tag("Wuthering Heights"),
    "tag-heathcliff": tag("Heathcliff"),
    "tag-moors": tag("The moors"),
    "tag-the-road": tag("The Road"),
    "tag-wind-up-bird": tag("The Wind-Up Bird Chronicle"),
    "tag-memory": tag("Memory"),
    "tag-grief": tag("Grief"),
  },
  [label("label-works", "Works"), label("label-themes", "Themes")],
);

const manyTags = Array.from({ length: 60 }, (_, index) => ({
  kind: "tag" as const,
  tagUnitId: `tag-work-${index + 1}`,
}));
const manyFixture = makeTree(
  [{ kind: "label", labelUnitId: "label-works", children: manyTags }],
  Object.fromEntries(
    manyTags.map((node, index) => [node.tagUnitId, tag(`Work ${index + 1}`)]),
  ),
  [label("label-works", "Works")],
);

export const EmptyRealmTree: Story = {
  render: () => <SeededPicker fixture={emptyFixture} />,
};

export const ShallowTree: Story = {
  render: () => <SeededPicker fixture={shallowFixture} />,
};

export const DeepTreeWithSelectedTags: Story = {
  render: () => (
    <SeededPicker
      fixture={deepFixture}
      initialSelected={["tag-wuthering-heights"]}
    />
  ),
};

export const ManyTags: Story = {
  render: () => <SeededPicker fixture={manyFixture} />,
};

export const RealmAndGlobalSearch: Story = {
  render: () => <SeededPicker fixture={deepFixture} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /add tags/i }));
    await userEvent.type(
      canvas.getByPlaceholderText(/search realm tags/i),
      "moors",
    );
    await waitFor(() => {
      expect(canvas.queryByText("The moors")).not.toBeNull();
    });
    await userEvent.clear(canvas.getByPlaceholderText(/search realm tags/i));
    await userEvent.type(canvas.getByPlaceholderText(/^search tags$/i), "art");
    await waitFor(() => {
      expect(canvas.queryByText("Art history")).not.toBeNull();
    });
  },
};
