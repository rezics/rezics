import { draftListQuery } from "@rezics/api/draft";
import { postListQuery } from "@rezics/api/post/post";
import {
  myRealmMembershipQuery,
  myRealmsQuery,
  realmDetailQuery,
  realmRuleResolvedQuery,
} from "@rezics/api/realm/realm";
import {
  type DraftMetadata,
  LANGUAGES,
  markdownContentDoc,
  type PostDTO,
  PostKind,
  type RealmDTO,
  type RealmMembershipMeDTO,
} from "@rezics/contract";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useEffect, useState } from "react";
import { withRouter } from "@/stories/decorators/withRouter";
import { useAuthSessionStore } from "@/user/states";
import type { RealmCreateMode } from "../models/realmCreateMode";
import { RealmCreatePage } from "./RealmCreatePage";

const REALM_ID = "realm-create-story";
const RULE_POST_ID = "realm-create-rule";
const STORY_USER_ID = "story-user";

function makeRealm(): RealmDTO {
  return {
    unitId: REALM_ID,
    slug: "create-story",
    userId: "story-owner",
    isPublic: true,
    isOfficial: false,
    memberCount: 48,
    extra: {
      rule: RULE_POST_ID,
      tagTree: [
        {
          label: "Format",
          children: [
            { tagId: "tag-discussion", label: "Discussion" },
            { tagId: "tag-guide", label: "Guide" },
          ],
        },
      ],
    },
    translations: [
      {
        unitId: REALM_ID,
        language: LANGUAGES.EN,
        title: "Create Story Realm",
        description: markdownContentDoc(
          "A fixture realm for the page-level authoring surface.",
        ),
      },
    ],
  } as RealmDTO;
}

function makeMembership(): RealmMembershipMeDTO {
  return {
    realmUnitId: REALM_ID,
    userId: STORY_USER_ID,
    roleKey: "member",
    state: "active",
    member: {
      realmUnitId: REALM_ID,
      userId: STORY_USER_ID,
      roleKey: "member",
      state: "active",
      capabilities: [],
    },
    muted: false,
    banned: false,
    capabilities: [],
    ruleAcknowledgement: {
      currentRuleUnitId: RULE_POST_ID,
      requiredVersion: 1,
      acceptedRuleUnitId: RULE_POST_ID,
      acceptedVersion: 1,
      acceptedAt: "2026-06-02T08:00:00.000Z",
      acceptedLanguage: LANGUAGES.EN,
      acknowledgementRequired: false,
    },
  } as RealmMembershipMeDTO;
}

function makePost(
  unitId: string,
  title: string,
  kind = PostKind.POST,
): PostDTO {
  return {
    unitId,
    authorUserId: STORY_USER_ID,
    kind,
    title,
    content: markdownContentDoc(`${title} body preview.`),
    createdAt: "2026-06-02T08:00:00.000Z",
    updatedAt: "2026-06-02T08:00:00.000Z",
  } as PostDTO;
}

const drafts: DraftMetadata[] = [
  {
    id: "draft-post-1",
    kind: "post",
    title: "Draft field notes",
    excerpt: "A post draft ready to publish into the realm.",
    updatedAt: "2026-06-02T08:00:00.000Z",
    resumeRoute: "/post/draft-post-1",
  },
  {
    id: "draft-wiki-1",
    kind: "wiki",
    title: "Draft wiki page",
    excerpt: "A wiki draft that can be published into the realm.",
    updatedAt: "2026-06-02T08:20:00.000Z",
    resumeRoute: "/post/draft-wiki-1",
  },
];

function setAuthState(hasMemberSession: boolean) {
  useAuthSessionStore.setState({
    ...useAuthSessionStore.getState(),
    status: "ready",
    auth: {
      session: null,
      user: null,
      role: null,
      hasIdentity: hasMemberSession,
    },
    rezics: {
      userId: hasMemberSession ? STORY_USER_ID : null,
      permission: { role: hasMemberSession ? "MEMBER" : "ANONYMOUS" },
      governanceCapabilities: [],
      hasMemberSession,
      hasProfileSetupSession: false,
      mainUserExists: hasMemberSession,
    },
    registration: {
      stage: hasMemberSession ? "complete" : "anonymous",
      emailVerified: hasMemberSession,
      complete: hasMemberSession,
      needsVerification: false,
      needsMainSetup: false,
    },
    capabilityLevel: hasMemberSession ? "member" : "anonymous",
    error: null,
  });
}

function SeedRealmCreatePage({
  member,
  mode,
  children,
}: {
  member: boolean;
  mode: RealmCreateMode;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    queryClient.clear();
    setAuthState(member);

    const realm = makeRealm();
    const rulePost = makePost(RULE_POST_ID, "Realm posting rules");
    queryClient.setQueryData(realmDetailQuery(REALM_ID).queryKey, realm);
    queryClient.setQueryData(
      myRealmMembershipQuery(REALM_ID).queryKey,
      member ? makeMembership() : null,
    );
    queryClient.setQueryData(myRealmsQuery().queryKey, {
      realms: member ? [realm] : [],
    });
    queryClient.setQueryData(realmRuleResolvedQuery(REALM_ID).queryKey, {
      realmUnitId: REALM_ID,
      ruleUnitId: RULE_POST_ID,
      version: 1,
      requireOnJoin: true,
      requireOnPost: true,
      requireOnUpdate: true,
      requestedLanguage: null,
      resolvedLanguage: LANGUAGES.EN,
      translation: null,
      sourceRulePostUnitId: RULE_POST_ID,
      sourceRulePost: rulePost,
    });
    queryClient.setQueryData(draftListQuery({ limit: 25 }).queryKey, {
      drafts,
    });
    queryClient.setQueryData(
      postListQuery({ authorUserId: STORY_USER_ID, limit: 25 }).queryKey,
      {
        posts: [
          makePost("published-post-1", "Published discussion"),
          makePost("published-wiki-1", "Published wiki note", PostKind.WIKI),
        ],
        total: 2,
      },
    );

    setReady(true);
    return () => {
      queryClient.clear();
      useAuthSessionStore.getState().reset();
    };
  }, [member, queryClient]);

  if (!ready) return null;
  return <div className="min-h-screen bg-surface-canvas">{children}</div>;
}

function RealmCreateStory({
  member,
  mode = "post",
}: {
  member: boolean;
  mode?: RealmCreateMode;
}) {
  const [activeMode, setActiveMode] = useState<RealmCreateMode>(mode);
  return (
    <SeedRealmCreatePage member={member} mode={activeMode}>
      <RealmCreatePage
        realmId={REALM_ID}
        mode={activeMode}
        onModeChange={setActiveMode}
      />
    </SeedRealmCreatePage>
  );
}

const meta = {
  title: "Domain/Realm/RealmCreatePage",
  component: RealmCreatePage,
  decorators: [withRouter],
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof RealmCreatePage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MemberPost: Story = {
  render: () => <RealmCreateStory member mode="post" />,
};

export const ExistingPosts: Story = {
  render: () => <RealmCreateStory member mode="existing" />,
};

export const NonMember: Story = {
  render: () => <RealmCreateStory member={false} mode="post" />,
};
