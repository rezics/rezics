import { governanceRealmCaseListQuery } from "@rezics/api/governance/governance";
import { labelListQuery } from "@rezics/api/label/label";
import { postQueries } from "@rezics/api/post/post";
import {
  myRealmMembershipQuery,
  myRealmsQuery,
  realmDetailQuery,
  realmRuleResolvedQuery,
} from "@rezics/api/realm/realm";
import { realmTagTreeQuery } from "@rezics/api/realm-tag-tree";
import { subscriptionCheckQuery } from "@rezics/api/subscription/subscription";
import { tagBatchTranslationsQuery } from "@rezics/api/tag/tag";
import {
  emptyRealmTagTree,
  LANGUAGES,
  markdownContentDoc,
  type BatchTagTranslationResult,
  type LabelDTO,
  type PostDTO,
  PostKind,
  type RealmDTO,
  type RealmMemberState,
  type RealmMembershipMeDTO,
  type RealmRuleResolvedDTO,
  type RealmTagTree,
} from "@rezics/contract";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useEffect, useState } from "react";
import { RealmDock } from "@/realm-dock";
import { withRouter } from "@/stories/decorators/withRouter";
import { useAuthSessionStore } from "@/user";
import { RealmStreamTab } from "../sections/RealmStreamTab";
import { RealmDetailLayout } from "./RealmDetailLayout";
import { useRealmDetail } from "./realmDetailContext";

const REALM_ID = "realm-story-community";
const RULE_POLICY_ID = "realm-rule-policy";
const RULE_REVISION_ID = "realm-rule-revision";
const RULE_ITEM_ID = "realm-rule-item";
const RULE_POST_ID = "realm-rule-post";
const TAG_REVIEW_ID = "tag-review";
const LABEL_FORMAT_ID = "label-format";

type RealmStoryState =
  | "owner"
  | "moderator"
  | "global-staff"
  | "member"
  | "pending"
  | "muted"
  | "banned";

type RealmDetailStoryTab = "stream" | "dock";

function makePost(unitId: string, contentSource: string): PostDTO {
  return {
    unitId,
    authorUserId: "story-owner",
    kind: PostKind.POST,
    resolvedLanguage: LANGUAGES.EN,
    content: markdownContentDoc(contentSource),
    createdAt: "2026-05-27T08:30:00.000Z",
    updatedAt: "2026-05-27T08:30:00.000Z",
  } as PostDTO;
}

function makeRealm(): RealmDTO {
  return {
    unitId: REALM_ID,
    slug: "story-community",
    userId: "story-owner",
    isPublic: true,
    isOfficial: false,
    memberCount: 128,
    resolvedLanguage: LANGUAGES.EN,
    title: "Story Realm",
    description: "A fixture realm for community governance states.",
    extra: {},
    translations: [
      {
        unitId: REALM_ID,
        language: LANGUAGES.EN,
        title: "Story Realm",
        description: "A fixture realm for community governance states.",
      },
    ],
    dock: {
      schema: "rezics/dock",
      version: 1,
      placements: {
        main: [
          { kind: "unitDescription", nodeId: "description", maxLines: 4 },
          { kind: "unitSubscriptionStat", nodeId: "subscription-stat" },
          { kind: "realmInfo", nodeId: "realm-info" },
          { kind: "links", nodeId: "links", items: [] },
          { kind: "realmRules", nodeId: "rules", mode: "summary" },
          { kind: "realmModerators", nodeId: "moderators", limit: 5 },
        ],
      },
    },
  } as RealmDTO;
}

function tag(name: string): BatchTagTranslationResult[string] {
  return {
    name,
    slug: name.toLowerCase().replaceAll(" ", "-"),
    description: "",
  };
}

const tagTree: RealmTagTree = {
  ...emptyRealmTagTree(),
  view: { defaultMode: "grouped", allowViewerSwitch: true },
  nodes: [
    {
      kind: "label",
      labelUnitId: LABEL_FORMAT_ID,
      children: [{ kind: "tag", tagUnitId: TAG_REVIEW_ID }],
    },
  ],
};
const tagTranslations: BatchTagTranslationResult = {
  [TAG_REVIEW_ID]: tag("Review"),
};
const labels: LabelDTO[] = [
  {
    unitId: LABEL_FORMAT_ID,
    translations: [{ language: LANGUAGES.EN, title: "Format" }],
  },
];

function makeResolvedRule(rulePost: PostDTO): RealmRuleResolvedDTO {
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
          rulePostUnitId: RULE_POST_ID,
          position: "a0",
        },
      ],
      createdByUserId: "story-owner",
      createdAt: "2026-05-27T08:30:00.000Z",
    },
    items: [
      {
        id: RULE_ITEM_ID,
        rulePostUnitId: RULE_POST_ID,
        position: "a0",
        requestedLanguage: null,
        resolvedLanguage: LANGUAGES.EN,
        sourceRulePost: rulePost,
      },
    ],
  };
}

function stateMembership(
  state: Exclude<RealmStoryState, "global-staff">,
): RealmMembershipMeDTO {
  const roleKey =
    state === "owner"
      ? "owner"
      : state === "moderator"
        ? "moderator"
        : "member";
  const memberState: RealmMemberState =
    state === "pending" || state === "muted" || state === "banned"
      ? state
      : "active";

  return {
    realmUnitId: REALM_ID,
    userId: "story-user",
    member: {
      realmUnitId: REALM_ID,
      userId: "story-user",
      roleKey,
      state: memberState,
      capabilities: [],
    },
    roleKey,
    state: memberState,
    muted: memberState === "muted",
    banned: memberState === "banned",
    capabilities:
      roleKey === "moderator" || roleKey === "owner"
        ? [
            {
              capability: "queue.realm.decide",
              scope: { kind: "realm", realmUnitId: REALM_ID },
            },
          ]
        : [],
    ruleAcknowledgement: {
      currentPolicyId: RULE_POLICY_ID,
      currentRevisionId: RULE_REVISION_ID,
      requiredVersion: 1,
      acceptedPolicyId: RULE_POLICY_ID,
      acceptedRevisionId: RULE_REVISION_ID,
      acceptedVersion: 1,
      acceptedAt: "2026-05-27T08:30:00.000Z",
      acceptedLanguage: LANGUAGES.EN,
      acknowledgementRequired: false,
    },
  };
}

function setAuthState(state: RealmStoryState) {
  const isGlobalStaff = state === "global-staff";
  useAuthSessionStore.setState({
    ...useAuthSessionStore.getState(),
    status: "ready",
    auth: {
      session: null,
      user: null,
      role: null,
      hasIdentity: true,
    },
    rezics: {
      userId: "story-user",
      permission: { role: isGlobalStaff ? "ADMIN" : "MEMBER" },
      governanceCapabilities: isGlobalStaff
        ? [
            {
              capability: "queue.realm.decide",
              scope: { kind: "global" },
            },
          ]
        : [],
      hasMemberSession: true,
      hasProfileSetupSession: false,
      mainUserExists: true,
    },
    registration: {
      stage: "complete",
      emailVerified: true,
      complete: true,
      needsVerification: false,
      needsMainSetup: false,
    },
    capabilityLevel: "member",
    error: null,
  });
}

function SeededRealmDetail({
  state,
  children,
}: {
  state: RealmStoryState;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    queryClient.clear();
    setAuthState(state);

    const realm = makeRealm();
    const membership = state === "global-staff" ? null : stateMembership(state);
    const rulePost = makePost(
      RULE_POST_ID,
      "Keep discussion specific, cite sources for claims, and respect moderator decisions.",
    );
    queryClient.setQueryData(realmDetailQuery(REALM_ID).queryKey, realm);
    queryClient.setQueryData(
      myRealmMembershipQuery(REALM_ID).queryKey,
      membership,
    );
    queryClient.setQueryData(myRealmsQuery().queryKey, {
      realms: membership?.member ? [realm] : [],
    });
    queryClient.setQueryData(subscriptionCheckQuery(REALM_ID).queryKey, {
      subscribed: true,
    });
    queryClient.setQueryData(realmTagTreeQuery(REALM_ID).queryKey, {
      realmUnitId: REALM_ID,
      tree: tagTree,
    });
    queryClient.setQueryData(
      tagBatchTranslationsQuery([TAG_REVIEW_ID], LANGUAGES.EN).queryKey,
      tagTranslations,
    );
    queryClient.setQueryData(labelListQuery([LABEL_FORMAT_ID]).queryKey, {
      labels,
    });
    queryClient.setQueryData(
      postQueries.detail(RULE_POST_ID).queryKey,
      rulePost,
    );
    queryClient.setQueryData(
      realmRuleResolvedQuery(REALM_ID, undefined, {
        languages: [LANGUAGES.EN],
        appLocale: LANGUAGES.EN,
      }).queryKey,
      makeResolvedRule(rulePost),
    );
    queryClient.setQueryData(
      governanceRealmCaseListQuery(REALM_ID, { limit: 25 }).queryKey,
      [
        {
          id: "case-story-1",
          scope: "realm",
          state: "new",
          severity: "medium",
          reporterUserId: "reporter-1",
          subjectUserId: "subject-1",
          target: {
            kind: "unit",
            id: "post-needs-review",
            realmUnitId: REALM_ID,
          },
          sourceFeedbackId: null,
          assignedToUserId: null,
          parentCaseId: null,
          duplicateOfCaseId: null,
          reason: "A realm moderator should review this report.",
          safeSummary: "Fixture report for moderator cases.",
          createdAt: "2026-05-27T08:30:00.000Z",
          updatedAt: "2026-05-27T08:30:00.000Z",
        },
      ],
    );

    setReady(true);
    return () => {
      queryClient.clear();
      useAuthSessionStore.getState().reset();
    };
  }, [queryClient, state]);

  if (!ready) return null;
  return <div className="min-h-screen bg-surface-canvas">{children}</div>;
}

function DetailTab({ tab }: { tab: RealmDetailStoryTab }) {
  const detail = useRealmDetail();
  if (tab === "dock") {
    return <RealmDock realm={detail.realm} placement="main" variant="page" />;
  }
  return (
    <RealmStreamTab
      streamSort="best"
      streamTagIds={[]}
      onStreamSortChange={() => {}}
      onStreamTagIdsChange={() => {}}
      onOpenTagsTab={() => {}}
    />
  );
}

function RealmStateStory({
  state,
  tab = "dock",
}: {
  state: RealmStoryState;
  tab?: RealmDetailStoryTab;
}) {
  return (
    <SeededRealmDetail state={state}>
      <RealmDetailLayout realmId={REALM_ID}>
        <DetailTab tab={tab} />
      </RealmDetailLayout>
    </SeededRealmDetail>
  );
}

const meta = {
  title: "Domain/Realm/RealmDetail",
  component: RealmDetailLayout,
  decorators: [withRouter],
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof RealmDetailLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Owner: Story = {
  render: () => <RealmStateStory state="owner" tab="stream" />,
};

export const Moderator: Story = {
  render: () => <RealmStateStory state="moderator" tab="stream" />,
};

export const GlobalStaffOverride: Story = {
  render: () => <RealmStateStory state="global-staff" tab="stream" />,
};

export const Member: Story = {
  render: () => <RealmStateStory state="member" />,
};

export const Pending: Story = {
  render: () => <RealmStateStory state="pending" />,
};

export const Muted: Story = {
  render: () => <RealmStateStory state="muted" />,
};

export const Banned: Story = {
  render: () => <RealmStateStory state="banned" />,
};
