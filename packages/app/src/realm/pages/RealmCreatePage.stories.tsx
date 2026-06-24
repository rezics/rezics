import { draftListQuery } from "@rezics/contract/api/draft";
import { labelListQuery } from "@rezics/contract/api/label/label";
import { postListQuery } from "@rezics/contract/api/post/post";
import {
  myRealmMembershipQuery,
  myRealmsQuery,
  realmDetailQuery,
  realmRuleResolvedQuery,
} from "@rezics/contract/api/realm/realm";
import { realmTagTreeQuery } from "@rezics/contract/api/realm-tag-tree";
import { tagBatchTranslationsQuery } from "@rezics/contract/api/tag/tag";
import {
  type DraftMetadata,
  emptyRealmTagTree,
  LANGUAGES,
  markdownContentDoc,
  type BatchTagTranslationResult,
  type LabelDTO,
  type PostDTO,
  PostKind,
  type RealmDTO,
  type RealmMembershipMeDTO,
  type RealmRuleResolvedDTO,
  type RealmTagTree,
} from "@rezics/contract";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useEffect, useState } from "react";
import { withRouter } from "@/stories/decorators/withRouter";
import { useAuthSessionStore } from "@/user";
import type { RealmCreateMode } from "../models/realmCreateMode";
import { RealmCreatePage } from "./RealmCreatePage";

const REALM_ID = "realm-create-story";
const RULE_POLICY_ID = "realm-create-rule-policy";
const RULE_REVISION_ID = "realm-create-rule-revision";
const RULE_ITEM_ID = "realm-create-rule-item";
const RULE_POST_ID = "realm-create-rule";
const STORY_USER_ID = "story-user";
const TAG_DISCUSSION_ID = "tag-discussion";
const TAG_GUIDE_ID = "tag-guide";
const LABEL_FORMAT_ID = "label-format";

function makeRealm(): RealmDTO {
  return {
    unitId: REALM_ID,
    slug: "create-story",
    userId: "story-owner",
    isPublic: true,
    isOfficial: false,
    memberCount: 48,
    resolvedLanguage: LANGUAGES.EN,
    title: "Create Story Realm",
    description: markdownContentDoc(
      "A fixture realm for the page-level authoring surface.",
    ),
    extra: {},
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
      currentPolicyId: RULE_POLICY_ID,
      currentRevisionId: RULE_REVISION_ID,
      requiredVersion: 1,
      acceptedPolicyId: RULE_POLICY_ID,
      acceptedRevisionId: RULE_REVISION_ID,
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
    resolvedLanguage: LANGUAGES.EN,
    title,
    content: markdownContentDoc(`${title} body preview.`),
    createdAt: "2026-06-02T08:00:00.000Z",
    updatedAt: "2026-06-02T08:00:00.000Z",
  } as PostDTO;
}

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
          rulePostUnitId: rulePost.unitId,
          position: "a0",
        },
      ],
      createdByUserId: STORY_USER_ID,
      createdAt: "2026-06-02T08:00:00.000Z",
    },
    items: [
      {
        id: RULE_ITEM_ID,
        rulePostUnitId: rulePost.unitId,
        position: "a0",
        requestedLanguage: null,
        resolvedLanguage: LANGUAGES.EN,
        sourceRulePost: rulePost,
      },
    ],
  };
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
  view: { defaultMode: "tree", allowViewerSwitch: true },
  nodes: [
    {
      kind: "label",
      labelUnitId: LABEL_FORMAT_ID,
      children: [
        { kind: "tag", tagUnitId: TAG_DISCUSSION_ID },
        { kind: "tag", tagUnitId: TAG_GUIDE_ID },
      ],
    },
  ],
};
const tagTranslations: BatchTagTranslationResult = {
  [TAG_DISCUSSION_ID]: tag("Discussion"),
  [TAG_GUIDE_ID]: tag("Guide"),
};
const labels: LabelDTO[] = [
  {
    unitId: LABEL_FORMAT_ID,
    translations: [{ language: LANGUAGES.EN, title: "Format" }],
  },
];

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
  mode: _mode,
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
    queryClient.setQueryData(realmTagTreeQuery(REALM_ID).queryKey, {
      realmUnitId: REALM_ID,
      tree: tagTree,
    });
    queryClient.setQueryData(
      tagBatchTranslationsQuery([TAG_DISCUSSION_ID, TAG_GUIDE_ID], LANGUAGES.EN)
        .queryKey,
      tagTranslations,
    );
    queryClient.setQueryData(labelListQuery([LABEL_FORMAT_ID]).queryKey, {
      labels,
    });
    queryClient.setQueryData(realmRuleResolvedQuery(REALM_ID).queryKey, {
      ...makeResolvedRule(rulePost),
    });
    queryClient.setQueryData(
      realmRuleResolvedQuery(REALM_ID, undefined, {
        languages: [LANGUAGES.EN],
        appLocale: LANGUAGES.EN,
      }).queryKey,
      makeResolvedRule(rulePost),
    );
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
