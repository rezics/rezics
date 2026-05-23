import { postKeys } from "@rezics/api/post/post";
import { realmKeys } from "@rezics/api/realm/realm";
import {
  LANGUAGES,
  markdownContentDoc,
  PostKind,
  type PostDTO,
  type RealmDTO,
} from "@rezics/contract";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { JoinButton } from "./JoinButton";

const meta = {
  title: "Domain/Realm/JoinButton",
  component: JoinButton,
  args: { realmId: "realm-default" },
  parameters: {
    docs: {
      description: {
        component:
          "Hooked to the live realm membership query. The story renders an idle button — a real backend / MSW handler is required to exercise the join/leave path.",
      },
    },
  },
} satisfies Meta<typeof JoinButton>;

export default meta;
type Story = StoryObj<typeof meta>;

const REALM_ID = "realm-default";
const RULE_POST_ID = "rule-post";

function makeRealm(extra: RealmDTO["extra"]): RealmDTO {
  return {
    unitId: REALM_ID,
    isPublic: true,
    isOfficial: false,
    memberCount: 12,
    extra,
    translations: [
      {
        unitId: REALM_ID,
        language: LANGUAGES.EN,
        title: "Fixture Realm",
        description: "A fixture realm.",
      },
    ],
  } as RealmDTO;
}

function makePost(contentSource: string): PostDTO {
  return {
    unitId: RULE_POST_ID,
    authorUserId: "fixture-user",
    kind: PostKind.POST,
    content: markdownContentDoc(contentSource),
  } as PostDTO;
}

function SeedJoinButton({
  realm,
  post,
  children,
}: {
  realm: RealmDTO;
  post?: PostDTO;
  children: ReactNode;
}) {
  const qc = useQueryClient();

  useEffect(() => {
    qc.setQueryData(realmKeys.mine(), { realms: [] });
    qc.setQueryData(realmKeys.detail(realm.unitId), realm);
    if (post) qc.setQueryData(postKeys.detail(post.unitId), post);
  }, [post, qc, realm]);

  return <div className="p-4">{children}</div>;
}

export const Default: Story = {
  render: () => (
    <SeedJoinButton realm={makeRealm({})}>
      <JoinButton realmId={REALM_ID} />
    </SeedJoinButton>
  ),
};

export const WithRule: Story = {
  render: () => (
    <SeedJoinButton
      realm={makeRealm({ rule: RULE_POST_ID })}
      post={makePost("Please keep posts specific, sourced, and civil.")}
    >
      <JoinButton realmId={REALM_ID} />
    </SeedJoinButton>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Join" }));
    await waitFor(() => {
      expect(canvas.queryByText("Realm rules")).not.toBeNull();
    });
  },
};

export const WithMultilingualRule: Story = {
  render: () => (
    <SeedJoinButton
      realm={makeRealm({ rule: RULE_POST_ID })}
      post={makePost(
        [
          "## English",
          "Read the pinned rule before posting.",
          "## 繁體中文",
          "發文前請先閱讀置頂規則。",
        ].join("\n\n"),
      )}
    >
      <JoinButton realmId={REALM_ID} />
    </SeedJoinButton>
  ),
};

export const DeletedRuleReference: Story = {
  render: () => (
    <SeedJoinButton realm={makeRealm({})}>
      <JoinButton realmId={REALM_ID} />
    </SeedJoinButton>
  ),
};
