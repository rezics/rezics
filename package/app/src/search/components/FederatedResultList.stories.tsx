import type {
  ContentSearchDocument,
  FederatedSearchResult,
  PostSearchDocument,
  RealmSearchDocument,
  UserSearchDocument,
} from "@rezics/contract";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { FederatedResultList } from "./FederatedResultList";

const meta = {
  title: "Domain/Search/FederatedResultList",
  component: FederatedResultList,
} satisfies Meta<typeof FederatedResultList>;

export default meta;
type Story = StoryObj<typeof meta>;

const sampleBook: ContentSearchDocument = {
  id: "u-book-1",
  type: "BOOK",
  titles: ["Great Saga"],
  subtitles: [],
  summaries: ["A tale of magic and adventure."],
  descriptions: [],
  creditNames: ["Author A"],
  tagLabels: ["fantasy"],
  tagIds: [],
  tagScores: {},
  realmIds: [],
  realmTagKeys: [],
  languages: ["en"],
  rating: "GENERAL",
  visibility: "PUBLIC",
  isLicensed: false,
  postKind: null,
  textLength: 120000,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
  publishedAt: "2024-01-01T00:00:00Z",
  defaultLanguage: "en",
  coverUrl: null,
  userId: null,
};

const sampleReview: PostSearchDocument = {
  id: "u-post-1",
  body: "This book is excellent and full of magic.",
  kind: "REVIEW",
  depth: 0,
  sortPath: "0001",
  isLocked: false,
  replyCount: 2,
  directReplyCount: 2,
  lastReplyAt: null,
  createdAt: "2024-01-02T00:00:00Z",
  updatedAt: "2024-01-02T00:00:00Z",
  targetUnitId: "u-book-1",
  rootTargetUnitId: "u-book-1",
  rootTargetUnitType: "BOOK",
  realmIds: [],
  rootPostUnitId: null,
  parentPostUnitId: null,
  authorUserId: "user-1",
  scoreEntryId: null,
  authorName: "Reviewer One",
  authorSlug: null,
  authorAvatar: null,
  targetTitles: ["Great Saga"],
  targetType: "BOOK",
  targetCoverUrl: null,
  scoreValue: 8.5,
  scoreFields: null,
};

const sampleRealm: RealmSearchDocument = {
  id: "u-realm-1",
  isPublic: true,
  isOfficial: false,
  memberCount: 124,
  createdAt: "2024-01-03T00:00:00Z",
  updatedAt: "2024-01-03T00:00:00Z",
  userId: null,
  titles: ["Fantasy Readers"],
  descriptions: ["A community for fantasy book lovers"],
  translations: [],
};

const sampleUser: UserSearchDocument = {
  id: "user-1",
  userId: "user-1",
  name: "Alice Reviewer",
  bio: "Reads everything magical.",
  avatar: null,
  followersCount: 12,
  followingsCount: 8,
};

const groupedResult: FederatedSearchResult = {
  kind: "grouped",
  scope: { kind: "global" },
  sections: {
    books: { totalHits: 42, items: [sampleBook], processingTimeMs: 4 },
    reviews: { totalHits: 18, items: [sampleReview], processingTimeMs: 3 },
    realms: { totalHits: 3, items: [sampleRealm], processingTimeMs: 2 },
    users: { totalHits: 0, items: [], processingTimeMs: 1 },
  },
};

const rankedResult: FederatedSearchResult = {
  kind: "ranked",
  scope: { kind: "global" },
  hits: [
    { ...sampleBook, _origin: { indexUid: "content", category: "books" } },
    { ...sampleReview, _origin: { indexUid: "post", category: "reviews" } },
    { ...sampleRealm, _origin: { indexUid: "realm", category: "realms" } },
    { ...sampleUser, _origin: { indexUid: "user", category: "users" } },
  ],
  totalHits: 4,
  processingTimeMs: 9,
  page: 1,
  hitsPerPage: 20,
};

const singleResult: FederatedSearchResult = {
  kind: "single",
  scope: { kind: "global" },
  category: "books",
  items: [sampleBook, sampleBook, sampleBook],
  totalHits: 42,
  processingTimeMs: 4,
  page: 1,
  hitsPerPage: 20,
};

export const Grouped: Story = {
  args: {
    result: groupedResult,
    isLoading: false,
    scope: { kind: "global" },
    onCategoryChange: () => {},
  },
};

export const Ranked: Story = {
  args: {
    result: rankedResult,
    isLoading: false,
    scope: { kind: "global" },
    onCategoryChange: () => {},
  },
};

export const Single: Story = {
  args: {
    result: singleResult,
    isLoading: false,
    scope: { kind: "global" },
    onCategoryChange: () => {},
  },
};

export const Loading: Story = {
  args: {
    isLoading: true,
    scope: { kind: "global" },
    onCategoryChange: () => {},
  },
};
