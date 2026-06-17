import { postKeys } from "@rezics/api/post/post";
import {
  myRealmMembershipQuery,
  realmKeys,
  realmRuleResolvedQuery,
} from "@rezics/api/realm/realm";
import {
  LANGUAGES,
  markdownContentDoc,
  type PostDTO,
  PostKind,
  type RealmDTO,
  type RealmMembershipMeDTO,
  type RealmRuleResolvedDTO,
} from "@rezics/contract";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useEffect } from "react";
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
const RULE_POLICY_ID = "rule-policy";
const RULE_REVISION_ID = "rule-revision";
const RULE_ITEM_ID = "rule-item";
const RULE_POST_ID = "rule-post";

function makeRealm(): RealmDTO {
  return {
    unitId: REALM_ID,
    isPublic: true,
    isOfficial: false,
    memberCount: 12,
    resolvedLanguage: LANGUAGES.EN,
    title: "Fixture Realm",
    description: "A fixture realm.",
    extra: {},
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

function makeMembership(
  acknowledgementRequired: boolean,
): RealmMembershipMeDTO {
  return {
    realmUnitId: REALM_ID,
    userId: "fixture-user",
    member: null,
    roleKey: null,
    state: null,
    muted: false,
    banned: false,
    capabilities: [],
    ruleAcknowledgement: acknowledgementRequired
      ? {
          currentPolicyId: RULE_POLICY_ID,
          currentRevisionId: RULE_REVISION_ID,
          requiredVersion: 1,
          acceptedPolicyId: null,
          acceptedRevisionId: null,
          acceptedVersion: null,
          acceptedAt: null,
          acceptedLanguage: null,
          acknowledgementRequired: true,
        }
      : {
          currentPolicyId: null,
          currentRevisionId: null,
          requiredVersion: null,
          acceptedPolicyId: null,
          acceptedRevisionId: null,
          acceptedVersion: null,
          acceptedAt: null,
          acceptedLanguage: null,
          acknowledgementRequired: false,
        },
  };
}

function makePost(contentSource: string): PostDTO {
  return {
    unitId: RULE_POST_ID,
    authorUserId: "fixture-user",
    kind: PostKind.POST,
    resolvedLanguage: LANGUAGES.EN,
    content: markdownContentDoc(contentSource),
  } as PostDTO;
}

function makeResolvedRule(post: PostDTO): RealmRuleResolvedDTO {
  return {
    policy: {
      realmUnitId: REALM_ID,
      policyId: RULE_POLICY_ID,
      currentRevisionId: RULE_REVISION_ID,
      currentVersion: 1,
      requirements: {
        requireOnJoin: true,
        requireOnPost: true,
        requireOnUpdate: true,
      },
    },
    revision: {
      id: RULE_REVISION_ID,
      policyId: RULE_POLICY_ID,
      version: 1,
      items: [
        {
          id: RULE_ITEM_ID,
          policyId: RULE_POLICY_ID,
          revisionId: RULE_REVISION_ID,
          rulePostUnitId: post.unitId,
          position: "a0",
        },
      ],
      createdByUserId: "fixture-user",
    },
    items: [
      {
        id: RULE_ITEM_ID,
        rulePostUnitId: post.unitId,
        position: "a0",
        requestedLanguage: null,
        resolvedLanguage: LANGUAGES.EN,
        sourceRulePost: post,
      },
    ],
  };
}

function SeedJoinButton({
  post,
  children,
}: {
  post?: PostDTO;
  children: ReactNode;
}) {
  const qc = useQueryClient();

  useEffect(() => {
    const realm = makeRealm();
    qc.setQueryData(realmKeys.mine(), { realms: [] });
    qc.setQueryData(realmKeys.detail(realm.unitId), realm);
    qc.setQueryData(
      myRealmMembershipQuery(realm.unitId).queryKey,
      makeMembership(Boolean(post)),
    );
    if (post) {
      qc.setQueryData(postKeys.detail(post.unitId), post);
      qc.setQueryData(
        realmRuleResolvedQuery(realm.unitId, undefined, {
          languages: [LANGUAGES.EN],
          appLocale: LANGUAGES.EN,
        }).queryKey,
        makeResolvedRule(post),
      );
    }
  }, [post, qc]);

  return <div className="p-4">{children}</div>;
}

export const Default: Story = {
  render: () => (
    <SeedJoinButton>
      <JoinButton realmId={REALM_ID} />
    </SeedJoinButton>
  ),
};

export const WithRule: Story = {
  render: () => (
    <SeedJoinButton
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
    <SeedJoinButton>
      <JoinButton realmId={REALM_ID} />
    </SeedJoinButton>
  ),
};
