import { COLLECTION_INDEX_NAME } from "./collection";
import { PROGRESS_INDEX_NAME } from "./progress";

export type ExpectedMeiliIndexUid =
  | "content"
  | "feedbacks"
  | "users"
  | "posts"
  | "comments"
  | "polls"
  | typeof COLLECTION_INDEX_NAME
  | "realms"
  | "entities"
  | typeof PROGRESS_INDEX_NAME;

export interface ExpectedMeiliIndexSchema {
  uid: ExpectedMeiliIndexUid;
  primaryKey: string;
  searchableAttributes: readonly string[];
  filterableAttributes: readonly string[];
  sortableAttributes: readonly string[];
  facetableSummaryFields?: readonly string[];
  supportsFullSync?: boolean;
  domain: string;
  description: string;
}

export type ExpectedMeiliIndexSettings = Pick<
  ExpectedMeiliIndexSchema,
  "searchableAttributes" | "filterableAttributes" | "sortableAttributes"
>;

export const EXPECTED_MEILI_INDEX_SCHEMAS = [
  {
    uid: "content",
    primaryKey: "id",
    searchableAttributes: [
      "titles",
      "subtitles",
      "contentText",
      "descriptionText",
      "descriptions",
      "summaries",
      "aliasValues",
      "creditNames",
      "subjectNames",
      "tagLabels",
    ],
    filterableAttributes: [
      "type",
      "postKind",
      "tagIds",
      "catalogEntryKind",
      "targetUnitId",
      "seriesUnitIds",
      "seriesKindKeys",
      "realmIds",
      "realmTagKeys",
      "languages",
      "isLanguageNeutral",
      "rating",
      "aiDisclosureMode",
      "visibility",
      "isLicensed",
      "textLength",
      "userId",
      "containedUnitIds",
      "subjectEntityIds",
      "subjectKinds",
      "subjectRoles",
      "platformEntityIds",
      "ratingTagUnitIds",
      "mediaKindKey",
      "mediaContentStructureAvailable",
    ],
    sortableAttributes: [
      "createdAt",
      "updatedAt",
      "publishedAt",
      "gameReleaseDate",
      "mediaReleaseDate",
      "mediaRuntimeMinutes",
      "hotScore",
      "topScore",
      "trendingScore",
      "qualityScore",
    ],
    facetableSummaryFields: ["type", "postKind", "visibility"],
    supportsFullSync: true,
    domain: "Content",
    description: "Books, units, and searchable content records.",
  },
  {
    uid: "feedbacks",
    primaryKey: "id",
    searchableAttributes: ["id", "content", "url"],
    filterableAttributes: [
      "userId",
      "unitId",
      "type",
      "resolved",
      "createdAt",
      "updatedAt",
    ],
    sortableAttributes: ["createdAt", "updatedAt"],
    facetableSummaryFields: ["type", "resolved"],
    supportsFullSync: true,
    domain: "Feedback",
    description: "User feedback and issue reports.",
  },
  {
    uid: "users",
    primaryKey: "id",
    searchableAttributes: ["name", "slug", "email", "bio", "descriptionText"],
    filterableAttributes: ["slug", "email", "joinDate"],
    sortableAttributes: ["joinDate", "followersCount", "followingsCount"],
    supportsFullSync: true,
    domain: "Users",
    description: "User profile search records.",
  },
  {
    uid: "posts",
    primaryKey: "id",
    searchableAttributes: [
      "titleText",
      "contentText",
      "targetTitles",
      "authorName",
    ],
    filterableAttributes: [
      "kind",
      "targetUnitId",
      "variantUnitId",
      "realmIds",
      "authorUserId",
      "languages",
      "isLanguageNeutral",
      "isLocked",
    ],
    sortableAttributes: [
      "createdAt",
      "updatedAt",
      "replyCount",
      "hotScore",
      "topScore",
      "trendingScore",
      "qualityScore",
    ],
    facetableSummaryFields: ["kind", "isLocked"],
    supportsFullSync: true,
    domain: "Posts",
    description: "Discussion posts and replies.",
  },
  {
    uid: "comments",
    primaryKey: "id",
    searchableAttributes: ["contentText", "authorName"],
    filterableAttributes: [
      "rootUnitId",
      "realmUnitId",
      "parentCommentId",
      "authorUserId",
      "depth",
      "isLocked",
      "state",
      "visibilityState",
    ],
    sortableAttributes: [
      "createdAt",
      "updatedAt",
      "replyCount",
      "hotScore",
      "topScore",
      "qualityScore",
    ],
    facetableSummaryFields: ["isLocked", "state", "visibilityState"],
    supportsFullSync: true,
    domain: "Comments",
    description: "Reply tree comments partitioned by root unit and realm.",
  },
  {
    uid: "polls",
    primaryKey: "id",
    searchableAttributes: ["titles", "descriptions", "optionLabels"],
    filterableAttributes: [
      "ownerUserId",
      "used",
      "closed",
      "voteMode",
      "resultVisibility",
      "languages",
      "isLanguageNeutral",
      "createdAt",
      "updatedAt",
    ],
    sortableAttributes: ["createdAt", "updatedAt", "usageCount"],
    facetableSummaryFields: ["used", "closed", "voteMode"],
    supportsFullSync: true,
    domain: "Polls",
    description: "Reusable poll library records.",
  },
  {
    uid: COLLECTION_INDEX_NAME,
    primaryKey: "id",
    searchableAttributes: ["searchText"],
    filterableAttributes: ["ownerUserId", "unitId", "createdAt", "updatedAt"],
    sortableAttributes: ["createdAt", "updatedAt"],
    facetableSummaryFields: [],
    supportsFullSync: true,
    domain: "User unit collections",
    description: "Private per-user collection search text only.",
  },
  {
    uid: "realms",
    primaryKey: "id",
    searchableAttributes: ["titles", "descriptions", "aliasValues"],
    filterableAttributes: [
      "isPublic",
      "isOfficial",
      "languages",
      "isLanguageNeutral",
    ],
    sortableAttributes: ["memberCount", "createdAt", "updatedAt"],
    facetableSummaryFields: ["isPublic", "isOfficial"],
    supportsFullSync: true,
    domain: "Realms",
    description: "Realm directory records.",
  },
  {
    uid: "entities",
    primaryKey: "id",
    searchableAttributes: ["titles", "summaries", "aliasValues", "slug"],
    filterableAttributes: [
      "kind",
      "verified",
      "ownerUnitId",
      "eligibleCreditRoles",
      "eligibleSubjectRoles",
    ],
    sortableAttributes: ["createdAt", "updatedAt"],
    facetableSummaryFields: ["kind", "verified"],
    supportsFullSync: true,
    domain: "Entities",
    description: "People, organizations, and other credited entities.",
  },
  {
    uid: PROGRESS_INDEX_NAME,
    primaryKey: "id",
    searchableAttributes: [],
    filterableAttributes: ["unitId", "userId", "status", "progressBucket"],
    sortableAttributes: ["lastSeenAt"],
    facetableSummaryFields: ["status", "progressBucket"],
    supportsFullSync: true,
    domain: "User progress",
    description: "Per-user unit progress records.",
  },
] as const satisfies readonly ExpectedMeiliIndexSchema[];

export const EXPECTED_MEILI_INDEX_SCHEMA_BY_UID = Object.fromEntries(
  EXPECTED_MEILI_INDEX_SCHEMAS.map((schema) => [schema.uid, schema]),
) as Readonly<
  Record<ExpectedMeiliIndexUid, (typeof EXPECTED_MEILI_INDEX_SCHEMAS)[number]>
>;

export function getExpectedMeiliIndexSchema(
  uid: ExpectedMeiliIndexUid,
): ExpectedMeiliIndexSchema {
  return EXPECTED_MEILI_INDEX_SCHEMA_BY_UID[uid];
}

export function getExpectedMeiliIndexSettings(
  schema: ExpectedMeiliIndexSchema,
): {
  searchableAttributes: string[];
  filterableAttributes: string[];
  sortableAttributes: string[];
} {
  return {
    searchableAttributes: [...schema.searchableAttributes],
    filterableAttributes: [...schema.filterableAttributes],
    sortableAttributes: [...schema.sortableAttributes],
  };
}

export function getExpectedMeiliIndexUids(): ExpectedMeiliIndexUid[] {
  return EXPECTED_MEILI_INDEX_SCHEMAS.map((schema) => schema.uid);
}
