import { realmKeys } from "@rezics/api/realm/realm";
import { tagKeys } from "@rezics/api/tag/tag";
import { LANGUAGES, type RealmDTO, type TagTreeNode } from "@rezics/contract";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useEffect, useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { RealmPostTagPicker } from "./RealmPostTagPicker";

const REALM_ID = "realm-tag-picker-story";

const meta = {
  title: "App/Realm/RealmPostTagPicker",
  component: RealmPostTagPicker,
} satisfies Meta<typeof RealmPostTagPicker>;

export default meta;
type Story = StoryObj<typeof RealmPostTagPicker>;

function described(node: TagTreeNode, description: string): TagTreeNode {
  return { ...node, description } as TagTreeNode;
}

function makeRealm(tagTree: TagTreeNode[]): RealmDTO {
  return {
    unitId: REALM_ID,
    slug: "tag-picker-story",
    userId: "story-user",
    isPublic: true,
    isOfficial: false,
    memberCount: 24,
    resolvedLanguage: LANGUAGES.EN,
    title: "Tag Picker Story",
    extra: { tagTree },
    translations: [
      {
        unitId: REALM_ID,
        language: LANGUAGES.EN,
        title: "Tag Picker Story",
      },
    ],
  } as RealmDTO;
}

function SeededPicker({
  tagTree,
  initialSelected = [],
  children,
}: {
  tagTree: TagTreeNode[];
  initialSelected?: string[];
  children?: ReactNode;
}) {
  const queryClient = useQueryClient();
  const [selectedTagIds, setSelectedTagIds] = useState(initialSelected);

  useEffect(() => {
    queryClient.setQueryData(realmKeys.detail(REALM_ID), makeRealm(tagTree));
    queryClient.setQueryData(tagKeys.search("art"), {
      total: 2,
      tags: [
        {
          unitId: "tag-art-history",
          label: "Art history",
          slug: "art-history",
        },
        {
          unitId: "tag-visual-culture",
          label: "Visual culture",
          slug: "visual-culture",
        },
      ],
    });
  }, [queryClient, tagTree]);

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

const shallowTree: TagTreeNode[] = [
  described(
    {
      label: "Format",
      children: [
        { tagId: "tag-novel", label: "Novel" },
        { tagId: "tag-manga", label: "Manga" },
      ],
    },
    "How this post frames the work.",
  ),
  { tagId: "tag-question", label: "Question" },
];

const deepTree: TagTreeNode[] = [
  {
    label: "Works",
    children: [
      described(
        {
          tagId: "tag-wuthering-heights",
          label: "Wuthering Heights",
          children: [
            { tagId: "tag-heathcliff", label: "Heathcliff" },
            { tagId: "tag-moors", label: "The moors" },
          ],
        },
        "Posts anchored to the novel and its local discussion paths.",
      ),
      { tagId: "tag-the-road", label: "The Road" },
      { tagId: "tag-wind-up-bird", label: "The Wind-Up Bird Chronicle" },
    ],
  },
  {
    label: "Themes",
    children: [
      { tagId: "tag-memory", label: "Memory" },
      { tagId: "tag-grief", label: "Grief" },
    ],
  },
];

const manyTags: TagTreeNode[] = [
  {
    label: "Works",
    children: Array.from({ length: 60 }, (_, index) => ({
      tagId: `tag-work-${index + 1}`,
      label: `Work ${index + 1}`,
    })),
  },
];

export const EmptyRealmTree: Story = {
  render: () => <SeededPicker tagTree={[]} />,
};

export const ShallowTree: Story = {
  render: () => <SeededPicker tagTree={shallowTree} />,
};

export const DeepTreeWithSelectedTags: Story = {
  render: () => (
    <SeededPicker
      tagTree={deepTree}
      initialSelected={["tag-wuthering-heights"]}
    />
  ),
};

export const ManyTags: Story = {
  render: () => <SeededPicker tagTree={manyTags} />,
};

export const RealmAndGlobalSearch: Story = {
  render: () => <SeededPicker tagTree={deepTree} />,
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
