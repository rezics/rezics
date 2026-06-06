import type {
  ContentSearchDocument,
  FederatedSearchResult,
  PostSearchDocument,
  RealmSearchDocument,
  ShelfItemShelfGroup,
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
  contentText: null,
  descriptionText: null,
  summaries: ["A tale of magic and adventure."],
  descriptions: [],
  creditNames: ["Author A"],
  subjectNames: [],
  subjectEntityIds: [],
  subjectKinds: [],
  subjectRoles: [],
  tagLabels: ["fantasy"],
  aliasValues: [],
  tagIds: [],
  tagScores: {},
  catalogEntryKind: null,
  targetUnitId: null,
  seriesUnitIds: [],
  seriesKindKeys: [],
  seriesTitles: [],
  realmIds: [],
  realmTagKeys: [],
  languages: ["en"],
  isLanguageNeutral: false,
  supportLanguages: [{ language: "en", isPrimary: true, sortOrder: 0 }],
  rating: "GENERAL",
  aiDisclosureMode: "NONE",
  visibility: "PUBLIC",
  isLicensed: false,
  postKind: null,
  textLength: 120000,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
  publishedAt: "2024-01-01T00:00:00Z",
  hotScore: 0,
  topScore: 0,
  trendingScore: 0,
  qualityScore: 0,
  rankUpdatedAt: null,
  resolvedLanguage: "en",
  title: "Great Saga",
  subtitle: null,
  summary: "A tale of magic and adventure.",
  description: null,
  defaultLanguage: "en",
  coverUrl: null,
  userId: null,
  translations: [
    {
      language: "en",
      title: "Great Saga",
      subtitle: null,
      summary: "A tale of magic and adventure.",
      description: null,
    },
  ],
};

const sampleReview: PostSearchDocument = {
  id: "u-post-1",
  titleText: "Excellent magic",
  contentText: "This book is excellent and full of magic.",
  kind: "REVIEW",
  isLocked: false,
  replyCount: 2,
  directReplyCount: 2,
  lastReplyAt: null,
  createdAt: "2024-01-02T00:00:00Z",
  updatedAt: "2024-01-02T00:00:00Z",
  hotScore: 0,
  topScore: 0,
  trendingScore: 0,
  qualityScore: 0,
  rankUpdatedAt: null,
  targetUnitId: "u-book-1",
  realmIds: [],
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
  languages: ["en"],
  isLanguageNeutral: false,
  supportLanguages: [{ language: "en", isPrimary: true, sortOrder: 0 }],
  resolvedLanguage: "en",
  title: "Excellent magic",
  content: null,
  translations: [
    {
      language: "en",
      title: "Excellent magic",
      content: null,
    },
  ],
};

const sampleRealm: RealmSearchDocument = {
  id: "u-realm-1",
  isPublic: true,
  isOfficial: false,
  memberCount: 124,
  createdAt: "2024-01-03T00:00:00Z",
  updatedAt: "2024-01-03T00:00:00Z",
  userId: null,
  languages: ["en"],
  isLanguageNeutral: false,
  supportLanguages: [{ language: "en", isPrimary: true, sortOrder: 0 }],
  resolvedLanguage: "en",
  title: "Fantasy Readers",
  description: "A community for fantasy book lovers",
  titles: ["Fantasy Readers"],
  descriptions: ["A community for fantasy book lovers"],
  aliasValues: [],
  translations: [],
};

const sampleUser: UserSearchDocument = {
  id: "user-1",
  unitId: "user-1",
  name: "Alice Reviewer",
  bio: "Reads everything magical.",
  avatar: null,
  followersCount: 12,
  followingsCount: 8,
};

const sampleShelfMatch: ShelfItemShelfGroup = {
  shelfId: "shelf-magic",
  shelfTitle: "Magic reading list",
  shelfOwnerUserId: "user-1",
  shelfVisibility: "PUBLIC",
  total: 2,
  matches: [
    {
      item: {
        id: "shelf-magic:unit:u-book-1",
        shelfId: "shelf-magic",
        shelfOwnerUserId: "user-1",
        shelfVisibility: "PUBLIC",
        shelfStatus: "PUBLISHED",
        shelfTitle: "Magic reading list",
        itemType: "unit",
        itemId: "u-book-1",
        kind: "book",
        rootItemType: "unit",
        rootItemId: "u-book-1",
        parentItemType: null,
        parentItemId: null,
        parentRole: null,
        position: "a0",
        itemTitle: "Great Saga",
        itemSummary: "A tale of magic and adventure.",
        itemText: null,
        searchText: null,
        rootUnitId: "u-book-1",
        realmUnitId: null,
        parentCommentId: null,
        authorUserId: null,
        authorName: null,
        moderationStatus: null,
        isLocked: null,
        deletedAt: null,
        createdAt: 1,
        updatedAt: 2,
      },
    },
  ],
};

const sampleShelf: ContentSearchDocument & {
  matchedShelfItemGroup: ShelfItemShelfGroup;
} = {
  ...sampleBook,
  id: "shelf-magic",
  type: "SHELF",
  titles: ["Magic reading list"],
  title: "Magic reading list",
  summaries: ["Books found because a saved shelf item matched."],
  summary: "Books found because a saved shelf item matched.",
  containedUnitIds: ["u-book-1"],
  matchedShelfItemGroup: sampleShelfMatch,
};

const groupedResult: FederatedSearchResult = {
  kind: "grouped",
  scope: { kind: "global" },
  sections: {
    books: { totalHits: 42, items: [sampleBook], processingTimeMs: 4 },
    reviews: { totalHits: 18, items: [sampleReview], processingTimeMs: 3 },
    shelves: { totalHits: 1, items: [sampleShelf], processingTimeMs: 2 },
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
