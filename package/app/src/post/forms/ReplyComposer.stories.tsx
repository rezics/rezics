import { realmKeys } from "@rezics/api/realm/realm";
import { tagKeys } from "@rezics/api/tag/tag";
import { LANGUAGES, type RealmDTO } from "@rezics/contract";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useEffect } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { ReplyComposer } from "./ReplyComposer";

const meta = {
  title: "App/Post/ReplyComposer",
  component: ReplyComposer,
  parameters: {
    docs: {
      description: {
        component:
          "Inline composer used by `PostTreeSection` and `ShelfDiscussionSection`. The submit step calls `useCreatePostMutation`; without an MSW handler the network call rejects, so the `HappyPath` play stops after the body is typed and the editor reports it.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const REALM_WITH_TAG_TREE_ID = "fixture-realm-with-tag-tree";
const REALM_EMPTY_TAG_TREE_ID = "fixture-realm-empty-tag-tree";

function makeRealm(unitId: string, extra: RealmDTO["extra"]): RealmDTO {
  return {
    unitId,
    slug: unitId,
    userId: "fixture-user",
    isPublic: true,
    isOfficial: false,
    memberCount: 18,
    extra,
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
  extra,
  children,
}: {
  realmId: string;
  extra: RealmDTO["extra"];
  children: ReactNode;
}) {
  const qc = useQueryClient();

  useEffect(() => {
    qc.setQueryData(realmKeys.detail(realmId), makeRealm(realmId, extra));
    qc.setQueryData(tagKeys.search("art"), {
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
  }, [extra, qc, realmId]);

  return <div className="p-4">{children}</div>;
}

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
        parentCommentUnitId="fixture-parent-3"
      />
    </div>
  ),
};

export const RealmPostWithTagTree: Story = {
  render: () => (
    <SeedRealmComposer
      realmId={REALM_WITH_TAG_TREE_ID}
      extra={{
        tagTree: [
          {
            disabled: true,
            label: "Reading mode",
            children: [
              { tagId: "tag-close-reading", label: "Close reading" },
              { tagId: "tag-reread", label: "Re-read" },
            ],
          },
          { tagId: "tag-question", label: "Question" },
        ],
      }}
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
    <SeedRealmComposer
      realmId={REALM_EMPTY_TAG_TREE_ID}
      extra={{ tagTree: [] }}
    >
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
    <SeedRealmComposer
      realmId={REALM_WITH_TAG_TREE_ID}
      extra={{
        tagTree: [
          {
            disabled: true,
            label: "Format",
            children: [
              { tagId: "tag-note", label: "Note" },
              { tagId: "tag-review", label: "Review" },
            ],
          },
        ],
      }}
    >
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
    await userEvent.click(trigger);
    await waitFor(() => {
      const editor = canvasElement.querySelector<HTMLElement>(
        "textarea, [contenteditable='true']",
      );
      expect(editor).not.toBeNull();
    });
    const editor = canvasElement.querySelector<HTMLElement>(
      "textarea, [contenteditable='true']",
    );
    if (editor) {
      editor.focus();
      await userEvent.keyboard("Looks good!");
    }
  },
};
