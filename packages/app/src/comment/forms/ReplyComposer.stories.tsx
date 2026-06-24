import { labelListQuery } from "@rezics/contract/api/label/label";
import { meiliTagSearchQueryOptions } from "@rezics/contract/api/meili/meili.queries";
import { realmKeys } from "@rezics/contract/api/realm/realm";
import { realmTagTreeQuery } from "@rezics/contract/api/realm-tag-tree";
import { tagBatchTranslationsQuery } from "@rezics/contract/api/tag/tag";
import {
  emptyRealmTagTree,
  LANGUAGES,
  type BatchTagTranslationResult,
  type LabelDTO,
  type RealmDTO,
  type RealmTagTree,
  type RealmTagTreeNode,
} from "@rezics/contract";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useEffect, useMemo } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { ReplyComposer } from "./ReplyComposer";

const meta = {
  title: "App/Comment/ReplyComposer",
  component: ReplyComposer,
  parameters: {
    docs: {
      description: {
        component:
          "Inline composer used by post feeds and comment threads. The submit step calls the matching create mutation; without an MSW handler the network call rejects, so the `HappyPath` play stops after the body is typed and the editor reports it.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const REALM_WITH_TAG_TREE_ID = "fixture-realm-with-tag-tree";
const REALM_EMPTY_TAG_TREE_ID = "fixture-realm-empty-tag-tree";

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

function makeRealm(unitId: string): RealmDTO {
  return {
    unitId,
    slug: unitId,
    userId: "fixture-user",
    isPublic: true,
    isOfficial: false,
    memberCount: 18,
    extra: {},
    translations: [
      {
        unitId,
        language: LANGUAGES.EN,
        title: "Fixture Realm",
        description: "Realm composer fixture.",
      },
    ],
  } as RealmDTO;
}

function SeedRealmComposer({
  realmId,
  fixture,
  children,
}: {
  realmId: string;
  fixture: NamedTree;
  children: ReactNode;
}) {
  const qc = useQueryClient();
  const tagUnitIds = useMemo(() => Object.keys(fixture.tags), [fixture.tags]);
  const labelUnitIds = useMemo(
    () => fixture.labels.map((item) => item.unitId),
    [fixture.labels],
  );

  useEffect(() => {
    qc.setQueryData(realmKeys.detail(realmId), makeRealm(realmId));
    qc.setQueryData(realmTagTreeQuery(realmId).queryKey, {
      realmUnitId: realmId,
      tree: fixture.tree,
    });
    qc.setQueryData(
      tagBatchTranslationsQuery(tagUnitIds, LANGUAGES.EN).queryKey,
      fixture.tags,
    );
    qc.setQueryData(labelListQuery(labelUnitIds).queryKey, {
      labels: fixture.labels,
    });
    qc.setQueryData(
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
  }, [fixture, labelUnitIds, qc, realmId, tagUnitIds]);

  return <div className="p-4">{children}</div>;
}

const emptyFixture = makeTree([], {}, []);
const readingFixture = makeTree(
  [
    {
      kind: "label",
      labelUnitId: "label-reading-mode",
      children: [
        { kind: "tag", tagUnitId: "tag-close-reading" },
        { kind: "tag", tagUnitId: "tag-reread" },
      ],
    },
    { kind: "tag", tagUnitId: "tag-question" },
  ],
  {
    "tag-close-reading": tag("Close reading"),
    "tag-reread": tag("Re-read"),
    "tag-question": tag("Question"),
  },
  [label("label-reading-mode", "Reading mode")],
);
const formatFixture = makeTree(
  [
    {
      kind: "label",
      labelUnitId: "label-format",
      children: [
        { kind: "tag", tagUnitId: "tag-note" },
        { kind: "tag", tagUnitId: "tag-review" },
      ],
    },
  ],
  {
    "tag-note": tag("Note"),
    "tag-review": tag("Review"),
  },
  [label("label-format", "Format")],
);

export const Default: Story = {
  render: () => (
    <div className="p-4">
      <ReplyComposer
        mode="progressive"
        targetUnitId="fixture-target-1"
        placeholder="Start a discussion"
      />
    </div>
  ),
};

export const Compact: Story = {
  render: () => (
    <div className="p-4">
      <ReplyComposer
        mode="progressive"
        autoFocus
        targetUnitId="fixture-target-2"
      />
    </div>
  ),
};

export const Empty: Story = {
  render: () => (
    <div className="p-4">
      <ReplyComposer
        mode="expanded"
        targetUnitId="fixture-target-3"
        rootUnitId="fixture-root-3"
        realmUnitId="fixture-realm-3"
        parentCommentId="fixture-parent-3"
      />
    </div>
  ),
};

export const RealmPostWithTagTree: Story = {
  render: () => (
    <SeedRealmComposer
      realmId={REALM_WITH_TAG_TREE_ID}
      fixture={readingFixture}
    >
      <ReplyComposer
        mode="expanded"
        realmUnitIds={[REALM_WITH_TAG_TREE_ID]}
        tagIds={["tag-question"]}
      />
    </SeedRealmComposer>
  ),
};

export const RealmPostSearchOnly: Story = {
  render: () => (
    <SeedRealmComposer realmId={REALM_EMPTY_TAG_TREE_ID} fixture={emptyFixture}>
      <ReplyComposer mode="expanded" realmUnitIds={[REALM_EMPTY_TAG_TREE_ID]} />
    </SeedRealmComposer>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByPlaceholderText(/search tags/i), "art");
    await waitFor(() => {
      expect(canvas.queryByText("Art history")).not.toBeNull();
    });
  },
};

export const RealmPostDisabledHeader: Story = {
  render: () => (
    <SeedRealmComposer realmId={REALM_WITH_TAG_TREE_ID} fixture={formatFixture}>
      <ReplyComposer mode="expanded" realmUnitIds={[REALM_WITH_TAG_TREE_ID]} />
    </SeedRealmComposer>
  ),
};

export const HappyPath: Story = {
  render: () => (
    <div className="p-4">
      <ReplyComposer
        mode="progressive"
        targetUnitId="fixture-target-happy"
        placeholder="Start a discussion"
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByPlaceholderText(/start a discussion/i);
    await userEvent.type(trigger, "This reply adds a concrete observation.");
    await waitFor(() => {
      expect(
        canvas.queryByText("This reply adds a concrete observation."),
      ).not.toBeNull();
    });
  },
};
