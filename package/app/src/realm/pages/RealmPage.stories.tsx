import { governanceRealmQueueListQuery } from "@rezics/api/governance/governance";
import {
  myRealmMembershipQuery,
  myRealmsQuery,
  realmDetailQuery,
} from "@rezics/api/realm/realm";
import { subscriptionCheckQuery } from "@rezics/api/subscription/subscription";
import {
  LANGUAGES,
  markdownContentDoc,
  type PostDTO,
  PostKind,
  type RealmDTO,
  type RealmMembershipMeDTO,
  type RealmMemberState,
} from "@rezics/contract";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useEffect, useState } from "react";
import { postQueries } from "@rezics/api/post/post";
import { withRouter } from "@/stories/decorators/withRouter";
import { useAuthSessionStore } from "@/user/states";
import { RealmPage, type RealmPageTab } from "./RealmPage";

const REALM_ID = "realm-story-community";
const ABOUT_POST_ID = "realm-about-post";
const RULE_POST_ID = "realm-rule-post";

type RealmStoryState =
  | "owner"
  | "moderator"
  | "global-staff"
  | "member"
  | "pending"
  | "muted"
  | "banned";

function makePost(unitId: string, contentSource: string): PostDTO {
  return {
    unitId,
    authorUserId: "story-owner",
    kind: PostKind.POST,
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
    extra: {
      about: ABOUT_POST_ID,
      rule: RULE_POST_ID,
      tagTree: [
        {
          label: "Format",
          children: [{ tagId: "tag-review", label: "Review" }],
        },
      ],
      tagView: { defaultStyle: "grouped", allowViewerSwitch: true },
    },
    translations: [
      {
        unitId: REALM_ID,
        language: LANGUAGES.EN,
        title: "Story Realm",
        description: "A fixture realm for community governance states.",
      },
    ],
  } as RealmDTO;
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
      currentRuleUnitId: RULE_POST_ID,
      requiredVersion: 1,
      acceptedRuleUnitId: RULE_POST_ID,
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

function SeededRealmPage({
  state,
  tab,
  children,
}: {
  state: RealmStoryState;
  tab: RealmPageTab;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    queryClient.clear();
    setAuthState(state);

    const realm = makeRealm();
    const membership = state === "global-staff" ? null : stateMembership(state);
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
    queryClient.setQueryData(
      postQueries.detail(ABOUT_POST_ID).queryKey,
      makePost(
        ABOUT_POST_ID,
        "This realm coordinates book lists, reviews, and sourced recommendations.",
      ),
    );
    queryClient.setQueryData(
      postQueries.detail(RULE_POST_ID).queryKey,
      makePost(
        RULE_POST_ID,
        "Keep discussion specific, cite sources for claims, and respect moderator decisions.",
      ),
    );
    queryClient.setQueryData(
      governanceRealmQueueListQuery(REALM_ID, { limit: 25 }).queryKey,
      [
        {
          id: "queue-story-1",
          realmUnitId: REALM_ID,
          state: "new",
          reporterUserId: "reporter-1",
          subjectUserId: "subject-1",
          target: {
            kind: "post",
            id: "post-needs-review",
            realmUnitId: REALM_ID,
          },
          sourceFeedbackId: null,
          linkedCaseId: null,
          assignedToUserId: null,
          reason: "A realm moderator should review this report.",
          safeSummary: "Fixture report for moderator queue.",
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

function RealmStateStory({
  state,
  tab = "about",
}: {
  state: RealmStoryState;
  tab?: RealmPageTab;
}) {
  return (
    <SeededRealmPage state={state} tab={tab}>
      <RealmPage realmId={REALM_ID} tab={tab} />
    </SeededRealmPage>
  );
}

const meta = {
  title: "Domain/Realm/RealmPage",
  component: RealmPage,
  decorators: [withRouter],
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof RealmPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Owner: Story = {
  render: () => <RealmStateStory state="owner" tab="moderation" />,
};

export const Moderator: Story = {
  render: () => <RealmStateStory state="moderator" tab="moderation" />,
};

export const GlobalStaffOverride: Story = {
  render: () => <RealmStateStory state="global-staff" tab="moderation" />,
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
