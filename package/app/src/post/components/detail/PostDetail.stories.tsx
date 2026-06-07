import { markdownContentDoc, type PostDTO, PostKind } from "@rezics/contract";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { PostDetail } from "./PostDetail";

const post = {
  unitId: "post-detail-1",
  authorUserId: "user-1",
  author: {
    unitId: "user-1",
    name: "Milk Devourer",
    avatarUrl: null,
  },
  targetUnitId: null,
  variantUnitId: null,
  variantContext: null,
  realmUnitId: "realm-1",
  referenceCount: 0,
  shareCount: 0,
  resolvedLanguage: "en",
  title: "Wholesome Dragon Girl and Man ending",
  content: markdownContentDoc(
    [
      "Plot: Since this is a collection of one-shot stories, Chapter 17 has its own self-contained plot.",
      "",
      "The story follows a lonely dragon-like monster girl carrying emotional scars from her past. She meets a human man who treats her with kindness and acceptance despite her appearance.",
      "",
      "As their relationship develops, the chapter explores themes of loneliness, self-worth, and finding companionship after loss. The story begins with a melancholic tone but ends on a hopeful and heartwarming note as the two find happiness together.",
    ].join("\n"),
  ),
  kind: PostKind.POST,
  status: "PUBLISHED",
  visibility: "PUBLIC",
  licenseSlug: null,
  moderationStatus: "visible",
  isTombstone: false,
  scoreEntryId: null,
  replyCount: 50,
  directReplyCount: 50,
  lastReplyAt: null,
  isLocked: false,
  state: null,
  pinKind: null,
  pinPosition: null,
  extra: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
} as PostDTO;

const meta = {
  title: "Domain/Post/PostDetail",
  component: PostDetail,
  args: {
    post,
    summaryScopeKey: "realm:realm-1",
    reactionScopeKey: "realm:realm-1",
  },
} satisfies Meta<typeof PostDetail>;

export default meta;

type Story = StoryObj<typeof meta>;

export const RealmContext: Story = {};
