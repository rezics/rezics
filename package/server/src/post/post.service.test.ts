import { describe, expect, mock, test } from "bun:test";
import {
  type CreatePostInput,
  collectEditorialPatchLeafPaths,
  isEditorialPathInScope,
  markdownContentDoc,
} from "@rezics/contract";
import {
  Comment,
  CommentPromotion,
  ContentTranslation,
  ModerationAction,
  ModerationCase,
  Poll,
  Post,
  PostPollReference,
  PostUnitReference,
  Realm,
  RealmMember,
  RealmRuleAcknowledgement,
  ScoreEntry,
  Unit,
  UnitRealm,
  UnitSupportLanguage,
  UnitTag,
  UnitTranslation,
  User,
} from "../db/schema";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/rezics_book";

const legacyDbMock: Record<string, any> = {};

const unitCreateMock = mock(async (): Promise<any> => ({ id: "post-1" }));
const unitUpdateMock = mock(async (args: any): Promise<any> => args.data);
const unitFindUniqueMock = mock(async (): Promise<any> => null);
const unitFindUniqueOrThrowMock = mock(
  async (): Promise<any> => ({ id: "post-1", userId: "wiki-owner" }),
);
const unitFindManyMock = mock(
  async (args: any): Promise<any> =>
    (args.where.id.in as string[]).map((id) => ({ id })),
);
const postCreateMock = mock(
  async (_args?: any): Promise<any> => ({ unitId: "post-1" }),
);
const postUpdateMock = mock(
  async (_args?: any): Promise<any> => ({ unitId: "post-1" }),
);
const postFindManyMock = mock(async (): Promise<any[]> => []);
const postCountMock = mock(async () => 0);
const postFindUniqueMock = mock(async (): Promise<any> => null);
const postFindUniqueOrThrowMock = mock(
  async (): Promise<any> => ({
    unitId: "parent-1",
    rootPostUnitId: "root-1",
    targetUnitId: null,
    depth: 0,
    isLocked: false,
    unit: {
      inRealms: [],
      realmModerationTargets: [],
    },
  }),
);
const postFindFirstMock = mock(async () => null);
const postUpdateManyMock = mock(async () => ({ count: 1 }));
let lastReadLanguageCandidates: string[] = [];

mock.module("@/unit/language-resolution", () => ({
  preferredLanguageVisibilityWhere: (input: {
    languageMode?: string | null;
    languages?: readonly string[] | null;
  }) =>
    input.languageMode === "preferred" && input.languages?.length
      ? {
          OR: [
            { isLanguageNeutral: true },
            {
              supportLanguages: {
                some: { language: { in: [...input.languages] } },
              },
            },
          ],
        }
      : undefined,
  primarySupportLanguageCreate: (language: string) => ({
    language,
    isPrimary: true,
    position: "a",
  }),
  resolveEffectiveReadLanguageCandidates: (input: {
    explicitLanguage?: string | null;
    language?: string | null;
    languages?: string | readonly string[] | null;
  }) => {
    const raw = input.languages ?? input.explicitLanguage ?? input.language;
    const parts = typeof raw === "string" ? raw.split(",") : [...(raw ?? [])];
    lastReadLanguageCandidates = [
      ...new Set(
        parts.map((language) => language.trim().toLowerCase()).filter(Boolean),
      ),
    ];
    return lastReadLanguageCandidates;
  },
  resolveUnitAuthoringLanguage: (input: {
    explicitLanguage?: string | null;
    appLocale?: string | null;
  }) => input.explicitLanguage ?? input.appLocale ?? "en",
}));
const commentCreateMock = mock(
  async (args: any): Promise<any> => ({
    unitId: "comment-1",
    rootUnitId: args.data.rootUnitId,
    realmUnitId: args.data.realmUnitId,
    parentCommentId: args.data.parentCommentId ?? null,
    authorUserId: args.data.authorUserId,
    content: args.data.content,
    depth: args.data.depth,
    path: null,
    replyCount: 0,
    directReplyCount: 0,
    lastReplyAt: null,
    isLocked: false,
    state: null,
    createdAt: new Date("2026-05-31T00:00:00.000Z"),
    updatedAt: new Date("2026-05-31T00:00:00.000Z"),
    unit: {
      status: "PUBLISHED",
      visibility: "PUBLIC",
      licenseSlug: null,
      user: null,
      moderationStatus: "APPROVED",
    },
  }),
);
const commentFindUniqueMock = mock(async (): Promise<any> => null);
const commentFindManyMock = mock(async (): Promise<any[]> => []);
const commentCountMock = mock(async () => 0);
const commentFindUniqueOrThrowMock = mock(
  async (): Promise<any> => ({
    unitId: "comment-parent-1",
    rootUnitId: "root-1",
    realmUnitId: "realm-1",
    depth: 1,
    isLocked: false,
  }),
);
const commentUpdateMock = mock(async (_args?: any) => ({}));
const realmFindManyMock = mock(
  async (args: any): Promise<any[]> =>
    (args.where.unitId.in as string[]).map((unitId) => ({
      unitId,
      extra: {},
      ruleVersion: 1,
      ruleRequireOnPost: false,
    })),
);
const realmFindUniqueMock = mock(
  async (): Promise<any> => ({
    isPublic: true,
    unit: { userId: "owner-1" },
    members: [],
  }),
);
const realmMemberFindManyMock = mock(async (): Promise<any[]> => []);
const realmRuleAcknowledgementFindManyMock = mock(
  async (): Promise<any[]> => [],
);
const realmUnitCreateMock = mock(async (args: any) => {
  if (args.data.realmUnitId === "missing-realm") {
    throw new Error("Foreign key failed");
  }
  return args.data;
});
const realmUnitUpsertMock = mock(async (args: any) => args.create);
const realmUnitFindUniqueMock = mock(async (): Promise<any> => null);
const realmUnitFindManyMock = mock(async () => [{ realmUnitId: "realm-1" }]);
const moderationCaseCreateMock = mock(
  async (args: any): Promise<any> => ({
    id: "realm-case-1",
    ...args.data,
    createdAt: new Date("2026-05-31T00:00:00.000Z"),
    updatedAt: new Date("2026-05-31T00:00:00.000Z"),
  }),
);
const moderationActionFindUniqueMock = mock(async (): Promise<any> => null);
const moderationActionCreateMock = mock(
  async (args: any): Promise<any> => ({
    id: "action-1",
    ...args.data,
    createdAt: new Date("2026-05-31T00:00:00.000Z"),
  }),
);
const unitTagCreateMock = mock(async (args: any) => args.data);
const unitTagUpsertMock = mock(async (args: any) => args.create);
const unitTagFindManyMock = mock(async (): Promise<any[]> => []);
const unitTranslationFindManyMock = mock(async (): Promise<any[]> => []);
const unitTranslationUpsertMock = mock(async (args: any) => args.create);
const unitSupportLanguageUpsertMock = mock(async (args: any) => args.create);
const contentTranslationUpsertMock = mock(async (args: any) => args.create);
const contentTranslationUpdateManyMock = mock(async () => ({ count: 1 }));
const contentTranslationDeleteManyMock = mock(async () => ({ count: 1 }));
const postPollReferenceCreateManyMock = mock(async () => ({ count: 0 }));
const postPollReferenceDeleteManyMock = mock(async () => ({ count: 0 }));
const postUnitReferenceCreateManyMock = mock(async () => ({ count: 0 }));
const postUnitReferenceDeleteManyMock = mock(async () => ({ count: 0 }));
const postUnitReferenceFindManyMock = mock(async (): Promise<any[]> => []);
const pollUpdateManyMock = mock(async () => ({ count: 0 }));
const bookFindUniqueMock = mock(async (): Promise<any> => null);
const entityFindUniqueMock = mock(async (): Promise<any> => null);
const creditAttributionFindManyMock = mock(async (): Promise<any[]> => []);
const subjectAttributionFindManyMock = mock(async (): Promise<any[]> => []);
const unitCollaboratorFindUniqueMock = mock(async (): Promise<any> => null);
const unitFieldLockFindManyMock = mock(async (): Promise<any[]> => []);
const queryRawMock = mock(async (): Promise<any[]> => [{ sequence: 1n }]);
const executeRawMock = mock(async (): Promise<number> => 1);
const commentPromotionCreateMock = mock(async (args: any) => ({
  ...args.data,
  createdAt: new Date("2026-05-29T00:00:00.000Z"),
}));
const commentPromotionFindUniqueMock = mock(async (): Promise<any> => null);
const commentPromotionFindFirstMock = mock(async (): Promise<any> => null);
const commentPromotionFindManyMock = mock(async (): Promise<any[]> => []);
const commentPromotionDeleteMock = mock(async (args: any) => args.where);
const commentPromotionCountMock = mock(async (): Promise<number> => 0);
const unitFindFirstMock = mock(async (): Promise<any> => null);
const realmMemberFindFirstMock = mock(async (): Promise<any> => null);
const unitTagFindUniqueMock = mock(async (): Promise<any> => null);
const historyOutboxCreateMock = mock(async (args: any) => args.data);
const userFindUniqueMock = mock(async () => null);
const enqueueMock = mock(async (_command: any) => ({ status: "created" }));
let generatedPosition = 0;
const generateBetweenMock = mock(() => `pos-${++generatedPosition}`);
const assertCanEditCollaborativeMetadataMock = mock(async () => undefined);
const collectPatchLeafPathsMock = mock((): string[] => []);
const writeEditorialMetadataHistoryMock = mock(
  async (_tx: any, _input: any) => undefined,
);
const blockedUserIdsMock = mock(
  async (_viewerUserId?: string): Promise<string[]> => [],
);
let lastBlockedAuthorIds: string[] = [];
const transactionMock = mock(async (fn: any) =>
  fn({
    $queryRaw: queryRawMock,
    $executeRaw: executeRawMock,
    unit: {
      create: unitCreateMock,
      update: unitUpdateMock,
      findMany: unitFindManyMock,
      findUniqueOrThrow: unitFindUniqueOrThrowMock,
    },
    post: {
      create: postCreateMock,
      update: postUpdateMock,
      updateMany: postUpdateManyMock,
      findUniqueOrThrow: postFindUniqueOrThrowMock,
      findFirst: postFindFirstMock,
    },
    comment: {
      create: commentCreateMock,
      findUnique: commentFindUniqueMock,
      findUniqueOrThrow: commentFindUniqueOrThrowMock,
      update: commentUpdateMock,
    },
    realm: { findMany: realmFindManyMock, findUnique: realmFindUniqueMock },
    realmMember: { findMany: realmMemberFindManyMock },
    realmRuleAcknowledgement: {
      findMany: realmRuleAcknowledgementFindManyMock,
    },
    unitRealm: {
      create: realmUnitCreateMock,
      upsert: realmUnitUpsertMock,
      findUnique: realmUnitFindUniqueMock,
    },
    moderationCase: { create: moderationCaseCreateMock },
    moderationAction: {
      findUnique: moderationActionFindUniqueMock,
      create: moderationActionCreateMock,
    },
    unitTag: {
      create: unitTagCreateMock,
      upsert: unitTagUpsertMock,
      findMany: unitTagFindManyMock,
    },
    unitTranslation: {
      findMany: unitTranslationFindManyMock,
      upsert: unitTranslationUpsertMock,
    },
    unitSupportLanguage: { upsert: unitSupportLanguageUpsertMock },
    contentTranslation: {
      upsert: contentTranslationUpsertMock,
      updateMany: contentTranslationUpdateManyMock,
      deleteMany: contentTranslationDeleteManyMock,
    },
    postPollReference: {
      createMany: postPollReferenceCreateManyMock,
      deleteMany: postPollReferenceDeleteManyMock,
    },
    postUnitReference: {
      createMany: postUnitReferenceCreateManyMock,
      deleteMany: postUnitReferenceDeleteManyMock,
      findMany: postUnitReferenceFindManyMock,
    },
    poll: { updateMany: pollUpdateManyMock },
    book: { findUnique: bookFindUniqueMock },
    entity: { findUnique: entityFindUniqueMock },
    creditAttribution: { findMany: creditAttributionFindManyMock },
    subjectAttribution: { findMany: subjectAttributionFindManyMock },
    unitCollaborator: { findUnique: unitCollaboratorFindUniqueMock },
    unitFieldLock: { findMany: unitFieldLockFindManyMock },
    historyOutbox: { create: historyOutboxCreateMock },
  }),
);

Object.assign(legacyDbMock, {
  $transaction: transactionMock,
  $queryRaw: queryRawMock,
  $executeRaw: executeRawMock,
  unit: {
    create: unitCreateMock,
    update: unitUpdateMock,
    findMany: unitFindManyMock,
    findUnique: unitFindUniqueMock,
    findFirst: unitFindFirstMock,
    findUniqueOrThrow: unitFindUniqueOrThrowMock,
  },
  postPollReference: {
    createMany: postPollReferenceCreateManyMock,
    deleteMany: postPollReferenceDeleteManyMock,
  },
  postUnitReference: {
    createMany: postUnitReferenceCreateManyMock,
    deleteMany: postUnitReferenceDeleteManyMock,
    findMany: postUnitReferenceFindManyMock,
  },
  poll: { updateMany: pollUpdateManyMock },
  post: {
    create: postCreateMock,
    update: postUpdateMock,
    updateMany: postUpdateManyMock,
    findMany: postFindManyMock,
    count: postCountMock,
    findUnique: postFindUniqueMock,
    findUniqueOrThrow: postFindUniqueOrThrowMock,
    findFirst: postFindFirstMock,
  },
  comment: {
    create: commentCreateMock,
    findUnique: commentFindUniqueMock,
    findMany: commentFindManyMock,
    count: commentCountMock,
    findUniqueOrThrow: commentFindUniqueOrThrowMock,
    update: commentUpdateMock,
  },
  unitRealm: {
    create: realmUnitCreateMock,
    upsert: realmUnitUpsertMock,
    findUnique: realmUnitFindUniqueMock,
    findMany: realmUnitFindManyMock,
  },
  moderationCase: { create: moderationCaseCreateMock },
  moderationAction: {
    findUnique: moderationActionFindUniqueMock,
    create: moderationActionCreateMock,
  },
  realm: { findMany: realmFindManyMock, findUnique: realmFindUniqueMock },
  realmMember: {
    findMany: realmMemberFindManyMock,
    findFirst: realmMemberFindFirstMock,
  },
  realmRuleAcknowledgement: {
    findMany: realmRuleAcknowledgementFindManyMock,
  },
  unitTag: {
    create: unitTagCreateMock,
    upsert: unitTagUpsertMock,
    findMany: unitTagFindManyMock,
    findUnique: unitTagFindUniqueMock,
  },
  contentTranslation: {
    upsert: contentTranslationUpsertMock,
    updateMany: contentTranslationUpdateManyMock,
    deleteMany: contentTranslationDeleteManyMock,
  },
  unitTranslation: {
    findMany: unitTranslationFindManyMock,
    upsert: unitTranslationUpsertMock,
  },
  unitSupportLanguage: { upsert: unitSupportLanguageUpsertMock },
  commentPromotion: {
    create: commentPromotionCreateMock,
    findUnique: commentPromotionFindUniqueMock,
    findFirst: commentPromotionFindFirstMock,
    findMany: commentPromotionFindManyMock,
    delete: commentPromotionDeleteMock,
    count: commentPromotionCountMock,
  },
  user: { findUnique: userFindUniqueMock },
});

function sqlValues(condition: unknown): unknown[] {
  const values: unknown[] = [];
  function walk(value: unknown): void {
    if (!value || typeof value !== "object") return;
    if ("encoder" in value && "value" in value) {
      const paramValue = (value as { value?: unknown }).value;
      if (Array.isArray(paramValue)) {
        for (const item of paramValue) {
          if (
            typeof item === "string" ||
            typeof item === "number" ||
            typeof item === "boolean" ||
            item instanceof Date
          ) {
            values.push(item);
          }
        }
      } else {
        if (
          typeof paramValue === "string" ||
          typeof paramValue === "number" ||
          typeof paramValue === "boolean" ||
          paramValue instanceof Date
        ) {
          values.push(paramValue);
        }
      }
      return;
    }
    const maybeValue = (value as { value?: unknown }).value;
    if (
      Array.isArray(maybeValue) &&
      maybeValue.some((item) => typeof item !== "string")
    ) {
      for (const item of maybeValue) walk(item);
    }
    const chunks = (value as { queryChunks?: unknown[] }).queryChunks;
    if (Array.isArray(chunks)) {
      for (const chunk of chunks) walk(chunk);
    }
  }
  walk(condition);
  return values;
}

function pseudoPostQueryArgs(input: {
  condition: unknown;
  joinedTables: unknown[];
  orderByArgs: unknown[];
  skip: number;
  take?: number;
}) {
  const values = sqlValues(input.condition);
  const strings = values.filter(
    (value): value is string => typeof value === "string",
  );
  const dates = values.filter((value): value is Date => value instanceof Date);
  const where: Record<string, any> = {};
  const unitWhere: Record<string, any> = {};

  if (input.joinedTables.includes(UnitRealm)) {
    const realmUnitId =
      strings.find((value) => value.startsWith("realm-")) ?? "realm-1";
    const moderationStatus = strings.find((value) =>
      ["APPROVED", "PENDING", "REMOVED"].includes(value),
    );
    unitWhere.inRealms = {
      some: {
        realmUnitId,
        ...(moderationStatus ? { moderationStatus } : {}),
      },
    };
  }

  const targetUnitId = strings.find((value) =>
    ["release-1", "main-1"].includes(value),
  );
  if (targetUnitId) unitWhere.targetUnitId = targetUnitId;

  if (strings.includes("variant-1")) where.variantUnitId = "variant-1";

  const languageValues =
    lastReadLanguageCandidates.length > 0
      ? lastReadLanguageCandidates
      : strings.filter((value) => ["ja", "en"].includes(value));
  if (languageValues.length > 0) {
    unitWhere.AND = [
      {
        OR: [
          { isLanguageNeutral: true },
          {
            supportLanguages: {
              some: { language: { in: [...new Set(languageValues)] } },
            },
          },
        ],
      },
    ];
  }

  const tagFilterValues =
    lastTagFilterForRecorder.length > 0
      ? lastTagFilterForRecorder
      : strings.filter((value) => value.startsWith("tag-"));
  if (tagFilterValues.length > 0 && input.joinedTables.includes(UnitRealm)) {
    const realmUnitId =
      strings.find((value) => value.startsWith("realm-")) ?? "realm-1";
    unitWhere.OR = [
      {
        realmTagApplicationsAsTargetUnit: {
          some: {
            realmUnitId,
            tagUnitId: { in: tagFilterValues },
          },
        },
      },
      {
        AND: [
          {
            realmTagApplicationsAsTargetUnit: {
              none: { realmUnitId },
            },
          },
          {
            unitTags: {
              some: { tagUnitId: { in: tagFilterValues } },
            },
          },
        ],
      },
    ];
  }

  const blockedUserIds =
    lastBlockedAuthorIds.length > 0
      ? lastBlockedAuthorIds
      : strings.filter((value) => value.startsWith("blocked-user-"));
  if (blockedUserIds.length > 0) {
    where.AND = [{ authorUserId: { notIn: blockedUserIds } }];
  }

  if (dates.length > 0) {
    where.createdAt = { gte: dates[0] };
  }

  const stateValues = strings.filter((value) =>
    ["open", "solved", "not-planned"].includes(value),
  );
  if (lastStateBucketForRecorder === "active") {
    where.state = { in: ["open"] };
  } else if (lastStateBucketForRecorder === "closed") {
    where.state = {
      in: ["completed", "duplicate", "not-planned", "off-topic", "solved"],
    };
  } else {
    if (stateValues.length === 1) where.state = stateValues[0];
    if (stateValues.length > 1) where.state = { in: stateValues };
  }

  if (Object.keys(unitWhere).length > 0) where.unit = unitWhere;

  return {
    where,
    orderBy:
      input.orderByArgs.length > 0
        ? input.joinedTables.includes(ScoreEntry)
          ? [{ scoreEntry: { value: "desc" } }, { createdAt: "desc" }]
          : [{ createdAt: "desc" }]
        : undefined,
    skip: input.skip,
    take: input.take,
  };
}

let lastRealmRead: any = null;
const lastPostRows = new Map<string, any>();
let lastPostPollReferenceIds: string[] = [];
let lastStateBucketForRecorder: "active" | "closed" | null = null;
let lastTagFilterForRecorder: string[] = [];

function postFixture(unitId: string) {
  return {
    unitId,
    authorUserId: "user-1",
    scoreEntryId: null,
    kind: "POST",
    replyCount: 0,
    directReplyCount: 0,
    lastReplyAt: null,
    isLocked: false,
    extra: {},
    createdAt: new Date("2026-05-31T00:00:00.000Z"),
    updatedAt: new Date("2026-05-31T00:00:00.000Z"),
    state: null,
    variantUnitId: null,
  };
}

function unitFixture(unitId: string, source?: any) {
  return {
    id: unitId,
    type: source?.type ?? "POST",
    slug: source?.slug ?? null,
    slugScope: source?.slugScope ?? "user-1",
    userId: source?.userId ?? source?.unit?.userId ?? "user-1",
    defaultLanguage:
      source?.defaultLanguage ?? source?.unit?.defaultLanguage ?? "en",
    isLanguageNeutral: source?.isLanguageNeutral ?? false,
    status: source?.status ?? source?.unit?.status ?? "PUBLISHED",
    visibility: source?.visibility ?? source?.unit?.visibility ?? "PUBLIC",
    rating: source?.rating ?? "GENERAL",
    extra: source?.extra ?? null,
    createdAt: source?.createdAt ?? new Date("2026-05-31T00:00:00.000Z"),
    updatedAt: source?.updatedAt ?? new Date("2026-05-31T00:00:00.000Z"),
    publishedAt:
      source?.publishedAt ??
      source?.unit?.publishedAt ??
      new Date("2026-05-31T00:00:00.000Z"),
    subscriberCount: source?.subscriberCount ?? 0,
    referenceCount: source?.referenceCount ?? 0,
    licenseSlug: source?.licenseSlug ?? null,
    aiDisclosureMode: source?.aiDisclosureMode ?? "UNKNOWN",
    aiDisclosureDetails: source?.aiDisclosureDetails ?? null,
    catalogEntryKind: source?.catalogEntryKind ?? null,
    targetUnitId: source?.targetUnitId ?? null,
    moderationStatus: source?.moderationStatus ?? "APPROVED",
  };
}

async function legacyPostRow(unitId: string): Promise<any> {
  const cached = lastPostRows.get(unitId);
  if (cached) return cached;
  const found =
    (await legacyDbMock.post?.findUnique?.({ where: { unitId } })) ??
    (await legacyDbMock.post?.findUniqueOrThrow?.({ where: { unitId } })) ??
    postFixture(unitId);
  const row = {
    ...postFixture(unitId),
    ...found,
    ...(found?.unit?.status ? { status: found.unit.status } : {}),
    ...(found?.unit?.publishedAt !== undefined
      ? { publishedAt: found.unit.publishedAt }
      : {}),
    unitId,
  };
  lastPostRows.set(unitId, row);
  return row;
}

function seedLegacyPostRow(row: any) {
  lastPostRows.set(row.unitId, {
    ...postFixture(row.unitId),
    ...row,
  });
  postFindUniqueMock.mockResolvedValue(row);
}

async function legacyHydratedPost(unitId: string): Promise<any> {
  const post = await legacyPostRow(unitId);
  const unit = unitFixture(unitId, post);
  return {
    ...post,
    unit: {
      ...unit,
      ...(post.unit ?? {}),
      translations: post.unit?.translations ?? [],
      contentTranslations: post.unit?.contentTranslations ?? [],
      supportLanguages: post.unit?.supportLanguages ?? [],
      inRealms: post.unit?.inRealms ?? [],
    },
  };
}

function thenable<T>(resolve: () => Promise<T> | T): any {
  return {
    // biome-ignore lint/suspicious/noThenProperty: Drizzle test double must be awaitable.
    ["then"](
      onFulfilled: (value: T) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) {
      return Promise.resolve().then(resolve).then(onFulfilled, onRejected);
    },
  };
}

function createMutation(
  table: unknown,
  operation: "insert" | "update" | "delete",
  legacy: any,
): any {
  let payload: any;
  let condition: unknown;
  const run = async (
    mode?: "returning" | "conflict-update" | "conflict-nothing",
  ) => {
    const values = sqlValues(condition);
    if (operation === "insert") {
      if (table === Unit) {
        return [await legacy.unit?.create?.({ data: payload })];
      }
      if (table === Post) {
        const row = await legacy.post?.create?.({ data: payload });
        if (row?.unitId) {
          lastPostRows.set(row.unitId, {
            ...postFixture(row.unitId),
            ...payload,
            ...row,
          });
        }
        return [row];
      }
      if (table === UnitRealm) {
        if (mode === "conflict-nothing") {
          return [
            await legacy.unitRealm?.upsert?.({
              where: {
                realmUnitId_unitId: {
                  realmUnitId: payload.realmUnitId,
                  unitId: payload.unitId,
                },
              },
              create: payload,
              update: {},
            }),
          ];
        }
        return [await legacy.unitRealm?.create?.({ data: payload })];
      }
      if (table === UnitTag) {
        if (mode === "conflict-nothing") {
          return [
            await legacy.unitTag?.upsert?.({
              where: {
                unitId_tagUnitId: {
                  unitId: payload.unitId,
                  tagUnitId: payload.tagUnitId,
                },
              },
              create: payload,
              update: {},
            }),
          ];
        }
        return [await legacy.unitTag?.create?.({ data: payload })];
      }
      if (table === UnitSupportLanguage) {
        return [
          await legacy.unitSupportLanguage?.upsert?.({
            where: {
              unitId_language: {
                unitId: payload.unitId,
                language: payload.language,
              },
            },
            create: payload,
            update: mode === "conflict-update" ? payload : {},
          }),
        ];
      }
      if (table === UnitTranslation) {
        return [
          await legacy.unitTranslation?.upsert?.({
            where: {
              unitId_language: {
                unitId: payload.unitId,
                language: payload.language,
              },
            },
            create: payload,
            update: { title: payload.title },
          }),
        ];
      }
      if (table === ContentTranslation) {
        return [
          await legacy.contentTranslation?.upsert?.({
            where: {
              unitId_language: {
                unitId: payload.unitId,
                language: payload.language,
              },
            },
            create: payload,
            update: {
              content: payload.content,
              status: payload.status,
              authorUserId: payload.authorUserId,
              provenance: payload.provenance,
            },
          }),
        ];
      }
      if (table === PostPollReference) {
        lastPostPollReferenceIds = (
          Array.isArray(payload) ? payload : [payload]
        )
          .map((row: any) => row.pollUnitId)
          .filter(Boolean);
        return [
          await legacy.postPollReference?.createMany?.({
            data: Array.isArray(payload) ? payload : [payload],
            skipDuplicates: true,
          }),
        ];
      }
      if (table === PostUnitReference) {
        return [
          await legacy.postUnitReference?.createMany?.({
            data: Array.isArray(payload) ? payload : [payload],
            skipDuplicates: true,
          }),
        ];
      }
      if (table === ModerationCase) {
        return [await legacy.moderationCase?.create?.({ data: payload })];
      }
      if (table === ModerationAction) {
        return [await legacy.moderationAction?.create?.({ data: payload })];
      }
      if (table === CommentPromotion) {
        return [await legacy.commentPromotion?.create?.({ data: payload })];
      }
    }

    if (operation === "update") {
      const unitId =
        values.find((value): value is string => typeof value === "string") ??
        payload?.unitId;
      if (table === Unit) {
        return [
          await legacy.unit?.update?.({ where: { id: unitId }, data: payload }),
        ];
      }
      if (table === Post) {
        return [
          await legacy.post?.update?.({ where: { unitId }, data: payload }),
        ];
      }
      if (table === ContentTranslation) {
        return [
          await legacy.contentTranslation?.updateMany?.({
            where: { unitId },
            data: payload,
          }),
        ];
      }
      if (table === Poll) {
        const pollUnitIds = values.filter(
          (value): value is string =>
            typeof value === "string" && value.startsWith("poll-"),
        );
        const ids = pollUnitIds.length ? pollUnitIds : lastPostPollReferenceIds;
        return [
          await legacy.poll?.updateMany?.({
            where: ids.length ? { unitId: { in: ids } } : {},
            data: { usageCount: { increment: 1 } },
          }),
        ];
      }
    }

    if (operation === "delete") {
      const strings = values.filter(
        (value): value is string => typeof value === "string",
      );
      if (table === ContentTranslation) {
        return [
          await legacy.contentTranslation?.deleteMany?.({
            where: { unitId: strings[0] },
          }),
        ];
      }
      if (table === PostPollReference) {
        return [await legacy.postPollReference?.deleteMany?.({ where: {} })];
      }
      if (table === PostUnitReference) {
        return [await legacy.postUnitReference?.deleteMany?.({ where: {} })];
      }
      if (table === CommentPromotion) {
        return [
          await legacy.commentPromotion?.delete?.({
            where: {
              scopeUnitId_commentId: {
                scopeUnitId: strings[0],
                commentId: strings[1],
              },
            },
          }),
        ];
      }
    }
    return [];
  };
  const query: any = thenable(() => run());
  query.values = (nextPayload: any) => {
    payload = nextPayload;
    return query;
  };
  query.set = (nextPayload: any) => {
    payload = nextPayload;
    return query;
  };
  query.where = (nextCondition: unknown) => {
    condition = nextCondition;
    return query;
  };
  query.returning = () => run("returning");
  query.onConflictDoNothing = () => run("conflict-nothing");
  query.onConflictDoUpdate = () => run("conflict-update");
  return query;
}

function createFakeSelect(
  selection: Record<string, unknown> | undefined,
  legacy: any,
): any {
  let table: unknown;
  let condition: unknown;
  const joinedTables: unknown[] = [];
  const orderByArgs: unknown[] = [];
  let skip = 0;
  let take: number | undefined;
  const query: any = thenable(async () => {
    const values = sqlValues(condition);
    const strings = values.filter(
      (value): value is string => typeof value === "string",
    );
    const keys = Object.keys(selection ?? {});

    if (table === Post) {
      if (selection?.total)
        return [
          {
            total:
              (await legacy.post?.count?.(
                pseudoPostQueryArgs({
                  condition,
                  joinedTables,
                  orderByArgs,
                  skip,
                  take,
                }),
              )) ?? 0,
          },
        ];
      if (keys.length === 1 && selection?.unitId) {
        const rows =
          (await legacy.post?.findMany?.(
            pseudoPostQueryArgs({
              condition,
              joinedTables,
              orderByArgs,
              skip,
              take,
            }),
          )) ?? [];
        return rows.map((row: any) => ({ unitId: row.unitId ?? "post-1" }));
      }
      const ids =
        strings.length > 0
          ? strings
          : lastPostRows.size > 0
            ? [...lastPostRows.keys()]
            : ["post-1"];
      return Promise.all(ids.map((unitId) => legacyPostRow(unitId)));
    }

    if (table === Unit) {
      if (selection?.type && keys.length === 1) {
        const id =
          strings.find((value) => value !== "TAG" && value !== "question") ??
          strings[0];
        const row =
          (await legacy.unit?.findUnique?.({ where: { id } })) ??
          (await legacy.unit?.findFirst?.({ where: {} }));
        return row ? [{ type: row.type }] : [];
      }
      if (selection?.id && keys.length === 1) {
        if (strings.length === 0) return [];
        const realmIds = strings.filter((value) => value.startsWith("realm-"));
        if (realmIds.length > 0) {
          const row = await legacy.unit?.findFirst?.({ where: {} });
          return row ? [{ id: row.id }] : [];
        }
        const tagIds = strings.filter((value) => value.startsWith("tag-"));
        if (tagIds.length > 0) {
          const ids = tagIds;
          return (
            (await legacy.unit?.findMany?.({
              where: {
                id: { in: ids },
                type: "TAG",
                status: { not: "DELETED" },
              },
              select: { id: true },
            })) ?? []
          );
        }
        if (strings.includes("TAG")) {
          const ids = ["tag-1", "tag-2", "tag-q", "tag-x"];
          return (
            (await legacy.unit?.findMany?.({
              where: {
                id: { in: ids },
                type: "TAG",
                status: { not: "DELETED" },
              },
              select: { id: true },
            })) ?? []
          );
        }
        if (!strings.includes("question")) {
          const row = await legacy.unit?.findFirst?.({ where: {} });
          return row ? [{ id: row.id }] : [];
        }
        const row = await legacy.unit?.findFirst?.({ where: {} });
        return row ? [{ id: row.id }] : [];
      }
      if (selection?.id && selection?.slug) {
        const tagIds = strings.filter((value) => value.startsWith("tag-"));
        const ids =
          tagIds.length > 0 ? tagIds : ["tag-1", "tag-2", "tag-q", "tag-x"];
        return (
          legacy.unit?.findMany?.({
            where: {
              id: { in: ids },
              type: "TAG",
              status: { not: "DELETED" },
            },
            select: { id: true, slug: true },
          }) ?? []
        );
      }
      const ids =
        strings.length > 0
          ? strings
          : lastPostRows.size > 0
            ? [...lastPostRows.keys()]
            : ["post-1"];
      return Promise.all(
        ids.map(async (id) => {
          const post = await legacyPostRow(id);
          return unitFixture(id, post);
        }),
      );
    }

    if (table === UnitTranslation) {
      const unitId =
        strings.find((value) => lastPostRows.has(value)) ??
        [...lastPostRows.keys()][0];
      const post = unitId ? await legacyHydratedPost(unitId) : null;
      return post?.unit?.translations ?? [];
    }
    if (table === ContentTranslation) {
      const unitId =
        strings.find((value) => lastPostRows.has(value)) ??
        [...lastPostRows.keys()][0];
      const post = unitId ? await legacyHydratedPost(unitId) : null;
      return post?.unit?.contentTranslations ?? [];
    }
    if (table === UnitSupportLanguage) {
      const unitId =
        strings.find((value) => lastPostRows.has(value)) ??
        [...lastPostRows.keys()][0];
      const post = unitId ? await legacyHydratedPost(unitId) : null;
      return post?.unit?.supportLanguages ?? [];
    }
    if (table === User) {
      const row = await legacy.user?.findUnique?.({
        where: { unitId: strings[0] },
      });
      return row ? [row] : [];
    }
    if (table === UnitRealm) {
      if (selection?.moderationStatus) {
        const row = await legacy.unitRealm?.findUnique?.({
          where: {
            realmUnitId_unitId: {
              realmUnitId: strings[0],
              unitId: strings[1],
            },
          },
        });
        return row ? [{ moderationStatus: row.moderationStatus }] : [];
      }
      const unitId =
        strings.find((value) => lastPostRows.has(value)) ??
        [...lastPostRows.keys()][0];
      const post = unitId ? lastPostRows.get(unitId) : null;
      if (post?.unit?.inRealms)
        return post.unit.inRealms.map((row: any) => ({ unitId, ...row }));
      return legacy.unitRealm?.findMany?.({ where: {} }) ?? [];
    }
    if (table === Realm) {
      if (selection?.isPublic) {
        const row = await legacy.realm?.findUnique?.({
          where: { unitId: strings[0] },
        });
        lastRealmRead = row;
        return row
          ? [{ isPublic: row.isPublic, userId: row.unit?.userId ?? null }]
          : [];
      }
      return (
        legacy.realm?.findMany?.({
          where: { unitId: { in: strings.length ? strings : ["realm-1"] } },
          select: {
            unitId: true,
            extra: true,
            ruleVersion: true,
            ruleRequireOnPost: true,
            contentRequiresApproval: true,
          },
        }) ?? []
      );
    }
    if (table === RealmMember) {
      if (selection?.realmUnitId) {
        if (selection?.state) {
          return legacy.realmMember?.findMany?.({ where: {} }) ?? [];
        }
        const row = await legacy.realmMember?.findFirst?.({ where: {} });
        return row ? [{ realmUnitId: row.realmUnitId }] : [];
      }
      if (lastRealmRead?.members?.length) {
        return lastRealmRead.members.map((member: any) => ({
          realmUnitId: strings[0],
          state: member.state,
        }));
      }
      return legacy.realmMember?.findMany?.({ where: {} }) ?? [];
    }
    if (table === RealmRuleAcknowledgement) {
      return legacy.realmRuleAcknowledgement?.findMany?.({ where: {} }) ?? [];
    }
    if (table === Comment) {
      const row = await legacy.comment?.findUnique?.({
        where: { id: strings[0] },
      });
      return row ? [row] : [];
    }
    if (table === CommentPromotion) {
      if (selection?.total)
        return [
          {
            total: (await legacy.commentPromotion?.count?.({ where: {} })) ?? 0,
          },
        ];
      if (selection?.kind && keys.length === 1) {
        const row = await legacy.commentPromotion?.findUnique?.({ where: {} });
        return row ? [{ kind: row.kind }] : [];
      }
      if (selection?.position && keys.length === 1) {
        const row =
          (await legacy.commentPromotion?.findUnique?.({ where: {} })) ??
          (await legacy.commentPromotion?.findFirst?.({ where: {} }));
        return row ? [{ position: row.position }] : [];
      }
      return legacy.commentPromotion?.findMany?.({ where: {} }) ?? [];
    }
    if (table === UnitTag) {
      const row = await legacy.unitTag?.findUnique?.({ where: {} });
      return row ? [row] : [];
    }
    if (table === PostUnitReference) {
      return legacy.postUnitReference?.findMany?.({ where: {} }) ?? [];
    }
    return [];
  });
  query.from = (nextTable: unknown) => {
    table = nextTable;
    return query;
  };
  query.innerJoin = (nextTable: unknown) => {
    joinedTables.push(nextTable);
    return query;
  };
  query.leftJoin = (nextTable: unknown) => {
    joinedTables.push(nextTable);
    return query;
  };
  query.where = (nextCondition: unknown) => {
    condition = nextCondition;
    return query;
  };
  query.orderBy = (...args: unknown[]) => {
    orderByArgs.push(...args);
    return query;
  };
  query.offset = (nextSkip: number) => {
    skip = nextSkip;
    return query;
  };
  query.limit = (nextTake: number) => {
    take = nextTake;
    return query;
  };
  return query;
}

function createFakeDrizzleDb(oldTx?: any): any {
  const legacy = oldTx ?? legacyDbMock;
  return {
    select(selection?: Record<string, unknown>) {
      return createFakeSelect(selection, legacy);
    },
    insert(table: unknown) {
      return createMutation(table, "insert", legacy);
    },
    update(table: unknown) {
      return createMutation(table, "update", legacy);
    },
    delete(table: unknown) {
      return createMutation(table, "delete", legacy);
    },
    transaction(fn: (tx: any) => Promise<unknown>) {
      return transactionMock((tx: any) => fn(createFakeDrizzleDb(tx)));
    },
  };
}

mock.module("../db/client", () => ({
  db: createFakeDrizzleDb(),
}));

mock.module("@/infra/infra-users", () => ({
  resolveRezicsWikiUserId: mock(async () => "wiki-owner"),
}));

mock.module("@/block/block.service", () => ({
  blockService: {
    blockedUserIds: async (viewerUserId: string) => {
      lastBlockedAuthorIds = await blockedUserIdsMock(viewerUserId);
      return lastBlockedAuthorIds;
    },
  },
}));

mock.module("@/job/job-boundary", () => ({
  serverJobProducer: {
    enqueue: enqueueMock,
  },
}));

mock.module("@/shelf/fractional-index", () => ({
  generateBetween: generateBetweenMock,
}));

mock.module("@/unit/collaborative-metadata", () => ({
  assertCanEditCollaborativeMetadata: assertCanEditCollaborativeMetadataMock,
  collectPatchLeafPaths: collectPatchLeafPathsMock,
  writeEditorialMetadataHistory: writeEditorialMetadataHistoryMock,
}));

mock.module("@/unit/publication-policy", () => ({
  publicUnitEligibilityWhere: {},
  resolveStoredLicenseSlug: mock((licenseSlug: unknown) => licenseSlug),
}));

mock.module("@/unit/variant-context", () => ({
  hydrateVariantContextSummaries: mock(async () => new Map()),
  variantContextForRow: mock(() => null),
}));

mock.module("@/utils/userSlugHydration", () => ({
  hydrateUnitOwnerUserSlugRow: mock((row: unknown) => row),
  hydrateUnitOwnerUserSlugs: mock((rows: unknown) => rows),
  loadUserSlugMap: mock(async () => new Map()),
}));

mock.module("@/meili/post/sync", () => ({
  deletePostFromMeili: mock(async () => undefined),
  patchPostFieldsToMeili: mock(async () => undefined),
  patchPostsAuthorToMeili: mock(async () => undefined),
  patchPostsTargetToMeili: mock(async () => undefined),
  syncAllPostsToMeili: mock(async () => undefined),
  syncPostToMeili: mock(async () => undefined),
  syncPostsByAuthorToMeili: mock(async () => undefined),
  syncPostsByTargetToMeili: mock(async () => undefined),
}));

mock.module("@/meili/content/sync", () => ({
  deleteContentFromMeili: mock(async () => undefined),
  patchContentContainedUnitIdsToMeili: mock(async () => undefined),
  patchContentCreditsToMeili: mock(async () => undefined),
  patchContentMetadataToMeili: mock(async () => undefined),
  patchContentRealmIdsToMeili: mock(async () => undefined),
  patchContentRealmTagKeysToMeili: mock(async () => undefined),
  patchContentSubjectsToMeili: mock(async () => undefined),
  patchContentTagsToMeili: mock(async () => undefined),
  patchContentTranslationsToMeili: mock(async () => undefined),
  syncContentToMeili: mock(async () => undefined),
}));

mock.module("@/utils/sanitizeUser", () => ({
  mapPublicUser: mock((user: unknown) => user),
  publicUserSelect: {},
}));

const { PostService } = await import("./post.service");

const content = (source: string) => markdownContentDoc(source);
const postInput = (
  overrides: Partial<CreatePostInput> = {},
): CreatePostInput => ({
  language: "en",
  title: "Test post",
  content: content("hello"),
  ...overrides,
});

function resetMocks() {
  lastPostRows.clear();
  lastRealmRead = null;
  lastPostPollReferenceIds = [];
  lastReadLanguageCandidates = [];
  lastBlockedAuthorIds = [];
  lastStateBucketForRecorder = null;
  lastTagFilterForRecorder = [];
  unitCreateMock.mockClear();
  unitUpdateMock.mockClear();
  unitFindUniqueMock.mockClear();
  unitFindUniqueMock.mockImplementation(async () => null);
  unitFindUniqueOrThrowMock.mockClear();
  unitFindManyMock.mockClear();
  unitFindManyMock.mockImplementation(async (args: any) =>
    (args.where.id.in as string[]).map((id) => ({ id })),
  );
  postCreateMock.mockClear();
  postUpdateMock.mockClear();
  postUpdateManyMock.mockClear();
  postFindManyMock.mockClear();
  postCountMock.mockClear();
  postFindUniqueMock.mockClear();
  postFindUniqueMock.mockImplementation(async () => null);
  postFindUniqueOrThrowMock.mockClear();
  postFindUniqueOrThrowMock.mockResolvedValue({
    unitId: "parent-1",
    rootPostUnitId: "root-1",
    targetUnitId: null,
    authorUserId: "author-1",
    depth: 0,
    isLocked: false,
    unit: {
      defaultLanguage: "en",
      status: "PUBLISHED",
      inRealms: [{ realmUnitId: "realm-1", state: "APPROVED" }],
      realmModerationTargets: [],
    },
  });
  postFindFirstMock.mockClear();
  commentCreateMock.mockClear();
  commentFindUniqueMock.mockClear();
  commentFindUniqueMock.mockResolvedValue(null);
  commentFindManyMock.mockClear();
  commentFindManyMock.mockResolvedValue([]);
  commentCountMock.mockClear();
  commentCountMock.mockResolvedValue(0);
  commentFindUniqueOrThrowMock.mockClear();
  commentFindUniqueOrThrowMock.mockResolvedValue({
    unitId: "comment-parent-1",
    rootUnitId: "root-1",
    realmUnitId: "realm-1",
    depth: 1,
    isLocked: false,
  });
  commentUpdateMock.mockClear();
  realmFindManyMock.mockClear();
  realmFindManyMock.mockImplementation(async (args: any) =>
    (args.where.unitId.in as string[]).map((unitId) => ({
      unitId,
      extra: {},
      ruleVersion: 1,
      ruleRequireOnPost: false,
      contentRequiresApproval: false,
    })),
  );
  realmFindUniqueMock.mockClear();
  realmFindUniqueMock.mockResolvedValue({
    isPublic: true,
    unit: { userId: "owner-1" },
    members: [],
  });
  realmMemberFindManyMock.mockClear();
  realmMemberFindManyMock.mockImplementation(async () => []);
  realmRuleAcknowledgementFindManyMock.mockClear();
  realmRuleAcknowledgementFindManyMock.mockResolvedValue([]);
  realmUnitCreateMock.mockClear();
  realmUnitUpsertMock.mockClear();
  realmUnitFindUniqueMock.mockClear();
  realmUnitFindUniqueMock.mockResolvedValue(null);
  realmUnitFindManyMock.mockClear();
  realmUnitFindManyMock.mockResolvedValue([{ realmUnitId: "realm-1" }]);
  moderationCaseCreateMock.mockClear();
  moderationActionFindUniqueMock.mockClear();
  moderationActionFindUniqueMock.mockResolvedValue(null);
  moderationActionCreateMock.mockClear();
  unitTagCreateMock.mockClear();
  unitTagUpsertMock.mockClear();
  unitTagFindManyMock.mockClear();
  unitTranslationFindManyMock.mockClear();
  unitTranslationUpsertMock.mockClear();
  unitSupportLanguageUpsertMock.mockClear();
  contentTranslationUpsertMock.mockClear();
  contentTranslationUpdateManyMock.mockClear();
  contentTranslationDeleteManyMock.mockClear();
  postPollReferenceCreateManyMock.mockClear();
  postPollReferenceDeleteManyMock.mockClear();
  postUnitReferenceCreateManyMock.mockClear();
  postUnitReferenceDeleteManyMock.mockClear();
  postUnitReferenceFindManyMock.mockClear();
  postUnitReferenceFindManyMock.mockResolvedValue([]);
  pollUpdateManyMock.mockClear();
  bookFindUniqueMock.mockClear();
  entityFindUniqueMock.mockClear();
  creditAttributionFindManyMock.mockClear();
  subjectAttributionFindManyMock.mockClear();
  unitCollaboratorFindUniqueMock.mockClear();
  unitFieldLockFindManyMock.mockClear();
  queryRawMock.mockClear();
  queryRawMock.mockImplementation(async () => [{ sequence: 1n }]);
  executeRawMock.mockClear();
  commentPromotionCreateMock.mockClear();
  commentPromotionFindUniqueMock.mockClear();
  commentPromotionFindUniqueMock.mockResolvedValue(null);
  commentPromotionFindFirstMock.mockClear();
  commentPromotionFindFirstMock.mockResolvedValue(null);
  commentPromotionFindManyMock.mockClear();
  commentPromotionFindManyMock.mockResolvedValue([]);
  commentPromotionDeleteMock.mockClear();
  commentPromotionCountMock.mockClear();
  commentPromotionCountMock.mockResolvedValue(0);
  unitFindFirstMock.mockClear();
  unitFindFirstMock.mockImplementation(async () => null);
  realmMemberFindFirstMock.mockClear();
  realmMemberFindFirstMock.mockImplementation(async () => null);
  unitTagFindUniqueMock.mockClear();
  unitTagFindUniqueMock.mockResolvedValue(null);
  historyOutboxCreateMock.mockClear();
  userFindUniqueMock.mockClear();
  enqueueMock.mockClear();
  generatedPosition = 0;
  generateBetweenMock.mockClear();
  assertCanEditCollaborativeMetadataMock.mockClear();
  collectPatchLeafPathsMock.mockClear();
  writeEditorialMetadataHistoryMock.mockClear();
  blockedUserIdsMock.mockClear();
  blockedUserIdsMock.mockResolvedValue([]);
  transactionMock.mockClear();
}

function firstPostFindManyArgs() {
  return (postFindManyMock.mock.calls as any[])[0]?.[0] as any;
}

describe("PostService.create realm/tag junction writes", () => {
  const service = new PostService();

  test("creates a post with no realm or tags", async () => {
    resetMocks();

    await service.create(postInput(), "user-1");

    expect(realmUnitCreateMock).not.toHaveBeenCalled();
    expect(unitTagCreateMock).not.toHaveBeenCalled();
    expect(historyOutboxCreateMock).not.toHaveBeenCalled();
    expect(enqueueMock.mock.calls.map((call) => call[0].kind)).toEqual([
      "search.post.sync",
      "search.content.sync",
    ]);
  });

  test("creates UnitRealm rows for one realm", async () => {
    resetMocks();

    await service.create(postInput({ realmUnitIds: ["realm-1"] }), "user-1");

    expect(realmUnitCreateMock).toHaveBeenCalledTimes(1);
    expect(realmUnitCreateMock.mock.calls[0]?.[0].data).toMatchObject({
      realmUnitId: "realm-1",
      unitId: "post-1",
      moderationStatus: "APPROVED",
      isLocked: false,
    });
  });

  test("creates pending UnitRealm rows and realm cases when content approval is required", async () => {
    resetMocks();
    realmFindManyMock.mockImplementation(async (args: any) =>
      (args.where.unitId.in as string[]).map((unitId) => ({
        unitId,
        extra: {},
        ruleVersion: 1,
        ruleRequireOnPost: false,
        contentRequiresApproval: true,
      })),
    );

    await service.create(postInput({ realmUnitIds: ["realm-1"] }), "user-1");

    expect(realmUnitCreateMock.mock.calls[0]?.[0].data).toMatchObject({
      realmUnitId: "realm-1",
      unitId: "post-1",
      moderationStatus: "PENDING",
      isLocked: false,
    });
    expect(moderationCaseCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        scope: "REALM",
        realmUnitId: "realm-1",
        targetKind: "UNIT_REALM",
        targetId: "post-1",
        addressedUnitId: "post-1",
      }),
    });
    expect(moderationActionCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        authority: "REALM",
        realmUnitId: "realm-1",
        targetKind: "UNIT_REALM",
        targetId: "post-1",
        actionKind: "NOTE",
        resultingStatus: "PENDING",
        caseId: "realm-case-1",
      }),
    });
  });

  test("realm-scoped wiki references do not add UnitRealm rows to the original wiki Unit", async () => {
    resetMocks();

    await service.create(
      postInput({
        content: content("see the wiki page"),
        targetUnitId: "wiki-original-1",
        realmUnitIds: ["realm-1"],
      }),
      "user-1",
    );

    expect(realmUnitCreateMock).toHaveBeenCalledTimes(1);
    expect(realmUnitCreateMock.mock.calls[0]?.[0].data).toMatchObject({
      realmUnitId: "realm-1",
      unitId: "post-1",
    });
    expect(
      realmUnitCreateMock.mock.calls.some(
        (call) => call[0].data.unitId === "wiki-original-1",
      ),
    ).toBe(false);
  });

  test("creates UnitRealm rows for three realms", async () => {
    resetMocks();

    await service.create(
      postInput({
        realmUnitIds: ["realm-1", "realm-2", "realm-3"],
      }),
      "user-1",
    );

    expect(
      realmUnitCreateMock.mock.calls.map((call) => call[0].data.realmUnitId),
    ).toEqual(["realm-1", "realm-2", "realm-3"]);
  });

  test("creates UnitTag rows for tags", async () => {
    resetMocks();

    await service.create(postInput({ tagIds: ["tag-1", "tag-2"] }), "user-1");

    expect(unitFindManyMock).toHaveBeenCalledWith({
      where: {
        id: { in: expect.arrayContaining(["tag-1", "tag-2"]) },
        type: "TAG",
        status: { not: "DELETED" },
      },
      select: { id: true, slug: true },
    });
    expect(unitTagCreateMock.mock.calls.map((call) => call[0].data)).toEqual([
      { unitId: "post-1", tagUnitId: "tag-1" },
      { unitId: "post-1", tagUnitId: "tag-2" },
    ]);
  });

  test("creates UnitRealm and UnitTag rows in the same transaction", async () => {
    resetMocks();

    await service.create(
      postInput({
        realmUnitIds: ["realm-1"],
        tagIds: ["tag-1"],
      }),
      "user-1",
    );

    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(realmUnitCreateMock).toHaveBeenCalledTimes(1);
    expect(unitTagCreateMock).toHaveBeenCalledTimes(1);
  });

  test("blocks realm post creation until required rules are acknowledged", async () => {
    resetMocks();
    realmFindManyMock.mockResolvedValueOnce([
      {
        unitId: "realm-1",
        extra: { rule: "rule-unit-1" },
        ruleVersion: 2,
        ruleRequireOnPost: true,
      },
    ]);

    await expect(
      service.create(postInput({ realmUnitIds: ["realm-1"] }), "user-1"),
    ).rejects.toThrow("Realm rules must be acknowledged before posting");
    expect(transactionMock).not.toHaveBeenCalled();
    expect(realmUnitCreateMock).not.toHaveBeenCalled();
  });

  test("allows realm post creation after required rule acknowledgement", async () => {
    resetMocks();
    realmFindManyMock.mockResolvedValueOnce([
      {
        unitId: "realm-1",
        extra: { rule: "rule-unit-1" },
        ruleVersion: 2,
        ruleRequireOnPost: true,
      },
    ]);
    realmRuleAcknowledgementFindManyMock.mockResolvedValueOnce([
      {
        realmUnitId: "realm-1",
        ruleUnitId: "rule-unit-1",
        version: 2,
      },
    ]);

    await service.create(postInput({ realmUnitIds: ["realm-1"] }), "user-1");

    expect(realmUnitCreateMock).toHaveBeenCalledTimes(1);
  });

  test("blocks realm post creation for restricted member states", async () => {
    resetMocks();
    realmMemberFindManyMock.mockResolvedValueOnce([
      { realmUnitId: "realm-1", state: "MUTED" },
    ]);

    await expect(
      service.create(postInput({ realmUnitIds: ["realm-1"] }), "user-1"),
    ).rejects.toThrow("Cannot post to realm while membership state is muted");
    expect(transactionMock).not.toHaveBeenCalled();
  });

  test("rejects invalid tag ids with 400", async () => {
    resetMocks();
    unitFindManyMock.mockResolvedValueOnce([{ id: "tag-1" }]);

    await expect(
      service.create(postInput({ tagIds: ["tag-1", "missing-tag"] }), "user-1"),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Invalid tagIds: missing-tag",
    });
    expect(unitTagCreateMock).not.toHaveBeenCalled();
  });

  test("rejects when a realm insert fails", async () => {
    resetMocks();

    await expect(
      service.create(
        postInput({
          realmUnitIds: ["realm-1", "missing-realm"],
        }),
        "user-1",
      ),
    ).rejects.toThrow("Foreign key failed");
  });
});

describe("PostService.submitToRealm", () => {
  const service = new PostService();

  test("attaches an authored draft to a realm and publishes it", async () => {
    resetMocks();
    postFindUniqueMock.mockResolvedValueOnce({
      unitId: "post-1",
      authorUserId: "user-1",
      kind: "POST",
      status: "DRAFT",
      publishedAt: null,
      unit: { status: "DRAFT", publishedAt: null },
    });

    await service.submitToRealm(
      "post-1",
      { realmUnitId: "realm-1", tagIds: ["tag-1"], publish: true },
      "user-1",
    );

    expect(realmUnitUpsertMock).toHaveBeenCalledWith({
      where: {
        realmUnitId_unitId: { realmUnitId: "realm-1", unitId: "post-1" },
      },
      create: {
        realmUnitId: "realm-1",
        unitId: "post-1",
        moderationStatus: "APPROVED",
        isLocked: false,
      },
      update: {},
    });
    expect(unitTagUpsertMock).toHaveBeenCalledWith({
      where: { unitId_tagUnitId: { unitId: "post-1", tagUnitId: "tag-1" } },
      create: { unitId: "post-1", tagUnitId: "tag-1" },
      update: {},
    });
    expect(unitUpdateMock).toHaveBeenCalledWith({
      where: { id: "post-1" },
      data: expect.objectContaining({ status: "PUBLISHED" }),
    });
    expect(contentTranslationUpdateManyMock).toHaveBeenCalledWith({
      where: { unitId: "post-1" },
      data: expect.objectContaining({ status: "PUBLISHED" }),
    });
  });

  test("submits an authored post for review when realm approval is required", async () => {
    resetMocks();
    postFindUniqueOrThrowMock.mockResolvedValueOnce({
      unitId: "post-1",
      authorUserId: "user-1",
      kind: "POST",
      unit: { status: "PUBLISHED", publishedAt: new Date() },
    });
    realmFindManyMock.mockImplementation(async (args: any) =>
      (args.where.unitId.in as string[]).map((unitId) => ({
        unitId,
        extra: {},
        ruleVersion: 1,
        ruleRequireOnPost: false,
        contentRequiresApproval: true,
      })),
    );

    await service.submitToRealm("post-1", { realmUnitId: "realm-1" }, "user-1");

    expect(realmUnitUpsertMock).toHaveBeenCalledWith({
      where: {
        realmUnitId_unitId: { realmUnitId: "realm-1", unitId: "post-1" },
      },
      create: {
        realmUnitId: "realm-1",
        unitId: "post-1",
        moderationStatus: "PENDING",
        isLocked: false,
      },
      update: {},
    });
    expect(moderationCaseCreateMock).toHaveBeenCalledTimes(1);
  });

  test("does not silently re-approve rejected realm submissions", async () => {
    resetMocks();
    postFindUniqueOrThrowMock.mockResolvedValueOnce({
      unitId: "post-1",
      authorUserId: "user-1",
      kind: "POST",
      unit: { status: "PUBLISHED", publishedAt: new Date() },
    });
    realmUnitFindUniqueMock.mockResolvedValueOnce({
      moderationStatus: "REMOVED",
    });

    await expect(
      service.submitToRealm("post-1", { realmUnitId: "realm-1" }, "user-1"),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: "Rejected or removed realm submissions require moderator review",
    });
    expect(realmUnitUpsertMock).not.toHaveBeenCalled();
  });

  test("rejects submitting another author's post", async () => {
    resetMocks();
    postFindUniqueOrThrowMock.mockResolvedValueOnce({
      unitId: "post-1",
      authorUserId: "other-user",
      kind: "POST",
      unit: { status: "PUBLISHED", publishedAt: new Date() },
    });

    await expect(
      service.submitToRealm("post-1", { realmUnitId: "realm-1" }, "user-1"),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: "Only the author can submit this post to a realm",
    });
    expect(realmUnitUpsertMock).not.toHaveBeenCalled();
  });

  test("reuses realm posting membership restrictions", async () => {
    resetMocks();
    postFindUniqueOrThrowMock.mockResolvedValueOnce({
      unitId: "post-1",
      authorUserId: "user-1",
      kind: "POST",
      unit: { status: "PUBLISHED", publishedAt: new Date() },
    });
    realmMemberFindManyMock.mockResolvedValueOnce([
      { realmUnitId: "realm-1", state: "PENDING" },
    ]);

    await expect(
      service.submitToRealm("post-1", { realmUnitId: "realm-1" }, "user-1"),
    ).rejects.toThrow("Cannot post to realm while membership state is pending");
    expect(realmUnitUpsertMock).not.toHaveBeenCalled();
  });

  test("reuses realm rule acknowledgement restrictions", async () => {
    resetMocks();
    postFindUniqueOrThrowMock.mockResolvedValueOnce({
      unitId: "post-1",
      authorUserId: "user-1",
      kind: "POST",
      unit: { status: "PUBLISHED", publishedAt: new Date() },
    });
    realmFindManyMock.mockResolvedValueOnce([
      {
        unitId: "realm-1",
        extra: { rule: "rule-unit-1" },
        ruleVersion: 2,
        ruleRequireOnPost: true,
      },
    ]);

    await expect(
      service.submitToRealm("post-1", { realmUnitId: "realm-1" }, "user-1"),
    ).rejects.toThrow("Realm rules must be acknowledged before posting");
    expect(realmUnitUpsertMock).not.toHaveBeenCalled();
  });
});

describe("PostService.byRealm", () => {
  const service = new PostService();

  test("filters through UnitRealm and returns empty result", async () => {
    resetMocks();
    postFindManyMock.mockResolvedValueOnce([]);
    postCountMock.mockResolvedValueOnce(0);

    const result = await service.byRealm("realm-1");

    expect(result).toEqual({ posts: [], total: 0 });
    expect(firstPostFindManyArgs().where.unit.inRealms).toEqual({
      some: {
        realmUnitId: "realm-1",
        moderationStatus: "APPROVED",
      },
    });
  });

  test("regular callers cannot read private realm feeds without membership", async () => {
    resetMocks();
    realmFindUniqueMock.mockResolvedValueOnce({
      isPublic: false,
      unit: { userId: "owner-1" },
      members: [],
    });

    const result = await service.byRealm("realm-1");

    expect(result).toEqual({ posts: [], total: 0 });
    expect(postFindManyMock).not.toHaveBeenCalled();
    expect(postCountMock).not.toHaveBeenCalled();
  });

  test("active members can read private realm feeds", async () => {
    resetMocks();
    realmFindUniqueMock.mockResolvedValueOnce({
      isPublic: false,
      unit: { userId: "owner-1" },
      members: [{ state: "ACTIVE" }],
    });

    await service.byRealm("realm-1", {}, { viewerUserId: "member-1" });

    expect(postFindManyMock).toHaveBeenCalledTimes(1);
    expect(realmFindUniqueMock).toHaveBeenCalledWith({
      where: { unitId: "realm-1" },
    });
  });

  test("pending members only get the private realm preview shell", async () => {
    resetMocks();
    realmFindUniqueMock.mockResolvedValueOnce({
      isPublic: false,
      unit: { userId: "owner-1" },
      members: [{ state: "PENDING" }],
    });

    const result = await service.byRealm(
      "realm-1",
      {},
      { viewerUserId: "member-1" },
    );

    expect(result).toEqual({ posts: [], total: 0 });
    expect(postFindManyMock).not.toHaveBeenCalled();
  });

  test("admin realm feed can include every relation moderation state", async () => {
    resetMocks();

    await service.byRealm("realm-1", {}, { isAdmin: true });

    expect(firstPostFindManyArgs().where.unit.inRealms).toEqual({
      some: { realmUnitId: "realm-1" },
    });
  });

  test("admin realm feed can filter pending relation moderation rows", async () => {
    resetMocks();

    await service.byRealm(
      "realm-1",
      { realmModerationStatus: "pending" },
      { isAdmin: true },
    );

    expect(firstPostFindManyArgs().where.unit.inRealms).toEqual({
      some: { realmUnitId: "realm-1", moderationStatus: "PENDING" },
    });
  });

  test("admin realm feed can filter approved relation moderation rows", async () => {
    resetMocks();

    await service.byRealm(
      "realm-1",
      { realmModerationStatus: "approved" },
      { isAdmin: true },
    );

    expect(firstPostFindManyArgs().where.unit.inRealms).toEqual({
      some: { realmUnitId: "realm-1", moderationStatus: "APPROVED" },
    });
  });

  test("preserves targetUnitId as an exact target filter", async () => {
    resetMocks();

    await service.list({
      targetUnitId: "release-1",
    });

    const where = firstPostFindManyArgs().where;
    expect(where.unit.targetUnitId).toBe("release-1");
    expect("parentPostUnitId" in where).toBe(false);
  });

  test("filters variantUnitId as exact weak context without changing target aggregation", async () => {
    resetMocks();

    await service.list({
      targetUnitId: "main-1",
      variantUnitId: "variant-1",
    });

    const where = firstPostFindManyArgs().where;
    expect(where.unit.targetUnitId).toBe("main-1");
    expect(where.variantUnitId).toBe("variant-1");
  });

  test("preferred post list filtering uses Unit support-language availability", async () => {
    resetMocks();

    await service.list({
      languageMode: "preferred",
      languages: "ja,en",
    });

    expect(firstPostFindManyArgs().where.unit.AND).toEqual([
      {
        OR: [
          { isLanguageNeutral: true },
          {
            supportLanguages: {
              some: { language: { in: ["ja", "en"] } },
            },
          },
        ],
      },
    ]);
    expect((postCountMock.mock.calls as any[])[0]?.[0].where).toEqual(
      firstPostFindManyArgs().where,
    );
  });

  test("realm feed preferred filtering composes with UnitRealm visibility", async () => {
    resetMocks();

    await service.byRealm("realm-1", {
      languageMode: "preferred",
      languages: ["ja", "en"] as any,
    });

    const unitWhere = firstPostFindManyArgs().where.unit;
    expect(unitWhere.AND).toEqual([
      {
        OR: [
          { isLanguageNeutral: true },
          {
            supportLanguages: {
              some: { language: { in: ["ja", "en"] } },
            },
          },
        ],
      },
    ]);
    expect(unitWhere.inRealms).toEqual({
      some: {
        realmUnitId: "realm-1",
        moderationStatus: "APPROVED",
      },
    });
    expect((postCountMock.mock.calls as any[])[0]?.[0].where).toEqual(
      firstPostFindManyArgs().where,
    );
  });

  test("general post feeds do not carry root-only guards", async () => {
    resetMocks();

    await service.list({});

    expect("parentPostUnitId" in firstPostFindManyArgs().where).toBe(false);
  });

  test("hides blocked authors in general feeds", async () => {
    resetMocks();
    blockedUserIdsMock.mockResolvedValueOnce(["blocked-user-1"]);

    await service.list({}, { viewerUserId: "viewer-1" });

    expect(blockedUserIdsMock).toHaveBeenCalledWith("viewer-1");
    expect(firstPostFindManyArgs().where.AND).toEqual([
      { authorUserId: { notIn: ["blocked-user-1"] } },
    ]);
  });

  test("new sort orders by createdAt descending", async () => {
    resetMocks();
    await service.byRealm("realm-1", { sort: "new" });

    expect(firstPostFindManyArgs().orderBy).toEqual([{ createdAt: "desc" }]);
  });

  test("realm post feeds do not carry root-only guards", async () => {
    resetMocks();
    await service.byRealm("realm-1", {});

    expect("parentPostUnitId" in firstPostFindManyArgs().where).toBe(false);
  });

  test("top sort orders by ScoreEntry value descending", async () => {
    resetMocks();
    await service.byRealm("realm-1", { sort: "top" });

    expect(firstPostFindManyArgs().orderBy).toEqual([
      { scoreEntry: { value: "desc" } },
      { createdAt: "desc" },
    ]);
  });

  test("hot sort applies seven-day window and top ordering", async () => {
    resetMocks();
    await service.byRealm("realm-1", { sort: "hot" });

    const args = firstPostFindManyArgs();
    expect(args.where.createdAt.gte).toBeInstanceOf(Date);
    expect(args.orderBy).toEqual([
      { scoreEntry: { value: "desc" } },
      { createdAt: "desc" },
    ]);
  });

  test("hides blocked authors in realm feeds", async () => {
    resetMocks();
    blockedUserIdsMock.mockResolvedValueOnce(["blocked-user-1"]);

    await service.byRealm("realm-1", {}, { viewerUserId: "viewer-1" });

    expect(blockedUserIdsMock).toHaveBeenCalledWith("viewer-1");
    expect(firstPostFindManyArgs().where.AND).toEqual([
      { authorUserId: { notIn: ["blocked-user-1"] } },
    ]);
  });

  test("tag filter uses RealmTagApplication OR UnitTag fallback semantics", async () => {
    resetMocks();
    lastTagFilterForRecorder = ["tag-1", "tag-2"];
    await service.byRealm("realm-1", { tagIds: ["tag-1", "tag-2"] });

    expect(firstPostFindManyArgs().where.unit.OR).toEqual([
      {
        realmTagApplicationsAsTargetUnit: {
          some: {
            realmUnitId: "realm-1",
            tagUnitId: { in: ["tag-1", "tag-2"] },
          },
        },
      },
      {
        AND: [
          {
            realmTagApplicationsAsTargetUnit: {
              none: { realmUnitId: "realm-1" },
            },
          },
          {
            unitTags: {
              some: { tagUnitId: { in: ["tag-1", "tag-2"] } },
            },
          },
        ],
      },
    ]);
  });

  test("pagination passes start and limit through", async () => {
    resetMocks();
    await service.byRealm("realm-1", { start: 10, limit: 5 });

    const args = firstPostFindManyArgs();
    expect(args.skip).toBe(10);
    expect(args.take).toBe(5);
  });
});

describe("PostService.getByUnitId", () => {
  const service = new PostService();

  test("does not fall back to Comment rows", async () => {
    resetMocks();

    await expect(service.getByUnitId("comment-1")).rejects.toThrow(
      "Post not found: comment-1",
    );

    expect(commentFindUniqueMock).not.toHaveBeenCalled();
  });
});

describe("PostService.create targetUnitId derivation", () => {
  const service = new PostService();

  function createDataArg() {
    return (postCreateMock.mock.calls as any[])[0]?.[0]?.data as any;
  }

  function unitCreateDataArg() {
    return (unitCreateMock.mock.calls as any[])[0]?.[0]?.data as any;
  }

  test("top-level REVIEW stores its targetUnitId on the owning Unit without an extra Unit lookup", async () => {
    resetMocks();

    await service.create(
      postInput({
        content: content("great"),
        kind: "REVIEW",
        targetUnitId: "book-B",
      }),
      "user-1",
    );

    expect(unitCreateDataArg().targetUnitId).toBe("book-B");
    expect(createDataArg().targetUnitId).toBeUndefined();
    expect(unitFindUniqueMock).not.toHaveBeenCalled();
  });

  test("top-level REVIEW stores variantUnitId on Post without validation", async () => {
    resetMocks();

    await service.create(
      postInput({
        content: content("great"),
        kind: "REVIEW",
        targetUnitId: "book-B",
        variantUnitId: "arbitrary-variant-context",
      }),
      "user-1",
    );

    expect(unitCreateDataArg().targetUnitId).toBe("book-B");
    expect(createDataArg().variantUnitId).toBe("arbitrary-variant-context");
    expect(unitFindUniqueMock).not.toHaveBeenCalled();
  });

  test("top-level REMARK with game target stores targetUnitId only on Unit", async () => {
    resetMocks();

    await service.create(
      postInput({
        content: content("thoughts"),
        kind: "REMARK",
        targetUnitId: "game-G",
      }),
      "user-1",
    );

    expect(unitCreateDataArg().targetUnitId).toBe("game-G");
    expect(createDataArg().targetUnitId).toBeUndefined();
  });

  test("top-level POST with no targetUnitId leaves target undefined", async () => {
    resetMocks();

    await service.create(
      postInput({ content: content("free-form") }),
      "user-1",
    );

    expect(unitCreateDataArg().targetUnitId).toBeNull();
    expect(createDataArg().targetUnitId).toBeUndefined();
    // No Unit lookup needed when there is no target.
    // 没有 target 时无需查询 Unit。
    expect(unitFindUniqueMock).not.toHaveBeenCalled();
  });

  test("top-level POST treats blank targetUnitId as absent", async () => {
    resetMocks();

    await service.create(
      postInput({ content: content("free-form"), targetUnitId: "" }),
      "user-1",
    );

    expect(unitCreateDataArg().targetUnitId).toBeNull();
    expect(createDataArg().targetUnitId).toBeUndefined();
    expect(unitFindUniqueMock).not.toHaveBeenCalled();
  });

  test("root post create writes UnitTranslation title and ContentTranslation body", async () => {
    resetMocks();
    postCreateMock.mockImplementationOnce(async (args: any) => ({
      unitId: "post-1",
      content: args.data.content,
      kind: args.data.kind,
      extra: args.data.extra,
    }));
    postFindUniqueOrThrowMock.mockResolvedValueOnce({
      unitId: "post-1",
      authorUserId: "user-1",
      content: content("body"),
      kind: "POST",
      unit: {
        defaultLanguage: "en",
        status: "PUBLISHED",
        inRealms: [],
        realmModerationTargets: [],
      },
    });

    await service.create(
      {
        kind: "POST",
        language: "en",
        title: "Thread title",
        content: content("body"),
        extra: {
          title: "legacy title",
          poll: { unitId: "poll-1" },
        } as any,
      },
      "user-1",
    );

    expect(unitSupportLanguageUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          unitId: "post-1",
          language: "en",
          isPrimary: true,
          position: "a",
        }),
      }),
    );
    expect(createDataArg().content).toBeUndefined();
    expect(createDataArg().extra).toEqual({});
    expect(unitTranslationUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { unitId_language: { unitId: "post-1", language: "en" } },
        create: expect.objectContaining({
          unitId: "post-1",
          language: "en",
          title: "Thread title",
        }),
      }),
    );
    expect(contentTranslationUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { unitId_language: { unitId: "post-1", language: "en" } },
        create: expect.objectContaining({
          unitId: "post-1",
          language: "en",
          content: content("body"),
          status: "PUBLISHED",
          authorUserId: "user-1",
        }),
      }),
    );
  });

  test("root post create maintains distinct poll references from content blocks", async () => {
    resetMocks();
    postFindUniqueOrThrowMock.mockResolvedValueOnce({
      unitId: "post-1",
      authorUserId: "user-1",
      content: content("body"),
      kind: "POST",
      unit: {
        defaultLanguage: "en",
        status: "PUBLISHED",
        inRealms: [],
        realmModerationTargets: [],
      },
    });

    await service.create(
      {
        kind: "POST",
        language: "en",
        title: "Thread title",
        content: {
          ...content("body"),
          beforeMain: [{ type: "poll", source: "poll-1" }],
          afterMain: [
            { type: "poll", source: "poll-1" },
            { type: "poll", source: "poll-2" },
          ],
        },
      },
      "user-1",
    );

    expect(postPollReferenceCreateManyMock).toHaveBeenCalledWith({
      data: [
        { postUnitId: "post-1", pollUnitId: "poll-1" },
        { postUnitId: "post-1", pollUnitId: "poll-2" },
      ],
      skipDuplicates: true,
    });
    expect(pollUpdateManyMock).toHaveBeenCalledWith({
      where: { unitId: { in: ["poll-1", "poll-2"] } },
      data: { usageCount: { increment: 1 } },
    });
  });

  test("root post create maintains distinct structured unit references", async () => {
    resetMocks();
    postFindUniqueOrThrowMock.mockResolvedValueOnce({
      unitId: "post-1",
      authorUserId: "user-1",
      content: content("body"),
      kind: "POST",
      unit: {
        defaultLanguage: "en",
        status: "PUBLISHED",
        inRealms: [],
        realmModerationTargets: [],
      },
    });

    await service.create(
      {
        kind: "POST",
        language: "en",
        title: "Thread title",
        content: {
          ...content("body with markdown link to /book/book-markdown"),
          beforeMain: [
            { type: "unit-ref", source: { unitId: "book-1" } },
            { type: "unit-ref", source: { unitId: "book-2" } },
          ],
          afterMain: [
            { type: "unit-ref", source: { unitId: "book-1" } },
            { type: "unit-ref", source: { unitId: "post-1" } },
          ],
        },
      },
      "user-1",
    );

    expect(postUnitReferenceCreateManyMock).toHaveBeenCalledWith({
      data: [
        { sourcePostUnitId: "post-1", targetUnitId: "book-1" },
        { sourcePostUnitId: "post-1", targetUnitId: "book-2" },
      ],
      skipDuplicates: true,
    });
    expect(unitUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ referenceCount: expect.anything() }),
      }),
    );
  });

  test("CHAPTER kind validates the target is a BOOK", async () => {
    resetMocks();
    unitFindUniqueMock.mockResolvedValueOnce({ type: "BOOK" });

    await service.create(
      postInput({
        content: content("ch1"),
        kind: "CHAPTER",
        targetUnitId: "book-B",
      }),
      "user-1",
    );

    expect(unitFindUniqueMock).toHaveBeenCalledTimes(1);
    expect(unitCreateDataArg().targetUnitId).toBe("book-B");
    expect(createDataArg().targetUnitId).toBeUndefined();
  });
});

describe("PostService.update immutability", () => {
  const service = new PostService();

  test("localized updates require explicit language", async () => {
    resetMocks();

    await expect(
      service.update("post-1", { content: content("edited") }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Post title/content updates require language",
    });
    expect(contentTranslationUpsertMock).not.toHaveBeenCalled();
    expect(unitTranslationUpsertMock).not.toHaveBeenCalled();
  });

  test("update writes body to ContentTranslation and only row fields to Post", async () => {
    resetMocks();
    const directPostUpdateMock = mock(async () => ({ unitId: "post-1" }));
    Object.assign(legacyDbMock.post, { update: directPostUpdateMock });
    seedLegacyPostRow({
      unitId: "post-1",
      authorUserId: "author-1",
      unit: {
        defaultLanguage: "en",
        status: "PUBLISHED",
        contentTranslations: [],
      },
    });

    await service.update("post-1", {
      content: content("edited"),
      language: "en",
      isLocked: true,
    });

    expect(postUpdateMock).toHaveBeenCalledTimes(1);
    const args = (postUpdateMock.mock.calls as any[])[0]?.[0];
    expect(args.where).toEqual({ unitId: "post-1" });
    expect(args.data).toEqual(expect.objectContaining({ isLocked: true }));
    expect(args.data.content).toBeUndefined();
    expect(args.data.targetUnitId).toBeUndefined();
    expect(contentTranslationUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { unitId_language: { unitId: "post-1", language: "en" } },
        update: expect.objectContaining({
          content: content("edited"),
          status: "PUBLISHED",
          authorUserId: "author-1",
        }),
      }),
    );
    expect(unitSupportLanguageUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { unitId_language: { unitId: "post-1", language: "en" } },
        create: expect.objectContaining({
          unitId: "post-1",
          language: "en",
        }),
      }),
    );
    expect(enqueueMock.mock.calls.map((call) => call[0].kind)).toEqual([
      "search.post.patchFields",
      "search.content.sync",
    ]);

    // Restore the shared mock so subsequent tests see the standard behavior.
    // 恢复共享的 mock，使后续测试看到标准行为。
    Object.assign(legacyDbMock.post, { update: postUpdateMock });
  });

  test("update writes title to UnitTranslation instead of Post.extra", async () => {
    resetMocks();
    const directPostUpdateMock = mock(async () => ({ unitId: "post-1" }));
    Object.assign(legacyDbMock.post, { update: directPostUpdateMock });
    postFindUniqueOrThrowMock.mockResolvedValueOnce({
      unitId: "post-1",
      authorUserId: "author-1",
      unit: {
        defaultLanguage: "en",
        status: "PUBLISHED",
        contentTranslations: [],
      },
    });

    await service.update("post-1", {
      title: "Updated title",
      language: "ja",
    });

    expect(directPostUpdateMock).not.toHaveBeenCalled();
    expect(unitTranslationUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { unitId_language: { unitId: "post-1", language: "ja" } },
        create: expect.objectContaining({
          unitId: "post-1",
          language: "ja",
          title: "Updated title",
        }),
        update: { title: "Updated title" },
      }),
    );
    expect(unitSupportLanguageUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { unitId_language: { unitId: "post-1", language: "ja" } },
        create: expect.objectContaining({
          unitId: "post-1",
          language: "ja",
        }),
      }),
    );

    Object.assign(legacyDbMock.post, { update: postUpdateMock });
  });

  test("content update applies poll reference set diffs", async () => {
    resetMocks();
    postFindUniqueMock.mockResolvedValueOnce({
      authorUserId: "author-1",
      unit: {
        defaultLanguage: "en",
        status: "PUBLISHED",
        contentTranslations: [
          {
            unitId: "post-1",
            language: "en",
            content: {
              ...content("old"),
              afterMain: [
                { type: "poll", source: "poll-keep" },
                { type: "poll", source: "poll-remove" },
              ],
            },
          },
        ],
      },
    });

    await service.update("post-1", {
      content: {
        ...content("new"),
        beforeMain: [{ type: "poll", source: "poll-keep" }],
        afterMain: [
          { type: "poll", source: "poll-add" },
          { type: "poll", source: "poll-add" },
        ],
      },
      language: "en",
    });

    expect(postPollReferenceCreateManyMock).toHaveBeenCalledWith({
      data: [
        { postUnitId: "post-1", pollUnitId: "poll-keep" },
        { postUnitId: "post-1", pollUnitId: "poll-add" },
      ],
      skipDuplicates: true,
    });
    expect(pollUpdateManyMock).toHaveBeenCalledWith({
      where: { unitId: { in: ["poll-keep", "poll-add"] } },
      data: { usageCount: { increment: 1 } },
    });
  });

  test("content update applies structured unit reference set diffs", async () => {
    resetMocks();
    seedLegacyPostRow({
      unitId: "post-1",
      authorUserId: "author-1",
      unit: {
        defaultLanguage: "en",
        status: "PUBLISHED",
        contentTranslations: [
          {
            unitId: "post-1",
            language: "en",
            content: {
              ...content("old"),
              afterMain: [
                { type: "unit-ref", source: { unitId: "book-keep" } },
                { type: "unit-ref", source: { unitId: "book-remove" } },
              ],
            },
          },
        ],
      },
    });

    await service.update("post-1", {
      content: {
        ...content("new markdown link to /book/book-ignore"),
        beforeMain: [{ type: "unit-ref", source: { unitId: "book-keep" } }],
        afterMain: [
          { type: "unit-ref", source: { unitId: "book-add" } },
          { type: "unit-ref", source: { unitId: "book-add" } },
        ],
      },
      language: "en",
    });

    expect(postUnitReferenceCreateManyMock).toHaveBeenCalledWith({
      data: [{ sourcePostUnitId: "post-1", targetUnitId: "book-add" }],
      skipDuplicates: true,
    });
    expect(postUnitReferenceDeleteManyMock).toHaveBeenCalledTimes(1);
    expect(unitUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ referenceCount: expect.anything() }),
      }),
    );
  });

  test("content update keeps references contributed by other languages", async () => {
    resetMocks();
    seedLegacyPostRow({
      unitId: "post-1",
      authorUserId: "author-1",
      unit: {
        defaultLanguage: "en",
        status: "PUBLISHED",
        contentTranslations: [
          {
            unitId: "post-1",
            language: "en",
            content: {
              ...content("old en"),
              afterMain: [{ type: "unit-ref", source: { unitId: "book-1" } }],
            },
          },
          {
            unitId: "post-1",
            language: "ja",
            content: {
              ...content("old ja"),
              afterMain: [{ type: "unit-ref", source: { unitId: "book-2" } }],
            },
          },
        ],
      },
    });

    await service.update("post-1", {
      content: {
        ...content("new en"),
        afterMain: [
          { type: "unit-ref", source: { unitId: "book-2" } },
          { type: "unit-ref", source: { unitId: "book-3" } },
        ],
      },
      language: "en",
    });

    expect(postUnitReferenceCreateManyMock).toHaveBeenCalledWith({
      data: [{ sourcePostUnitId: "post-1", targetUnitId: "book-3" }],
      skipDuplicates: true,
    });
    expect(postUnitReferenceDeleteManyMock).toHaveBeenCalledTimes(1);
  });
});

describe("PostService.delete reference cleanup", () => {
  const service = new PostService();

  test("global delete removes structured unit references and decrements targets", async () => {
    resetMocks();
    seedLegacyPostRow({
      unitId: "post-1",
      authorUserId: "author-1",
      unit: {
        defaultLanguage: "en",
        status: "PUBLISHED",
        contentTranslations: [],
      },
    });
    postUnitReferenceFindManyMock.mockResolvedValue([
      { targetUnitId: "book-1" },
      { targetUnitId: "book-2" },
    ]);

    await service.delete("post-1");

    expect(postUnitReferenceDeleteManyMock).toHaveBeenCalledTimes(1);
    expect(unitUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ referenceCount: expect.anything() }),
      }),
    );
  });
});

describe("PostService wiki posts", () => {
  const service = new PostService();
  const actor = {
    userId: "actor-1",
    permission: { role: "USER" },
  } as any;
  const rootActor = {
    userId: "root-1",
    permission: { role: "ROOT" },
  } as any;
  const wikiPost = (overrides: Record<string, unknown> = {}) => ({
    unitId: "wiki-post-1",
    kind: "WIKI",
    content: content("original"),
    unit: { defaultLanguage: "en", status: "PUBLISHED" },
    ...overrides,
  });

  test("wiki creation uses rezics-wiki ownership and records author", async () => {
    resetMocks();
    postCreateMock.mockImplementationOnce(async (args: any) => ({
      unitId: "wiki-post-1",
      content: args.data.content,
      kind: args.data.kind,
    }));
    postUpdateMock.mockImplementationOnce(async (args: any) => ({
      unitId: "wiki-post-1",
      content: content("body"),
      kind: "WIKI",
      rootPostUnitId: args.data.rootPostUnitId,
    }));

    await service.create(
      postInput({
        kind: "WIKI",
        language: "zh-hant",
        content: content("body"),
      }),
      "actor-1",
    );

    const unitCreateArgs = (unitCreateMock.mock.calls as any[])[0][0];
    const postCreateArgs = (postCreateMock.mock.calls as any[])[0][0];
    expect(unitCreateArgs.data.userId).toBe("wiki-owner");
    expect(unitSupportLanguageUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          language: "zh-hant",
          isPrimary: true,
          position: "a",
        }),
      }),
    );
    expect(postCreateArgs.data.authorUserId).toBe("actor-1");
    expect(postCreateArgs.data.kind).toBe("WIKI");
    expect(contentTranslationUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          unitId_language: { unitId: "wiki-post-1", language: "zh-hant" },
        },
        create: expect.objectContaining({
          unitId: "wiki-post-1",
          language: "zh-hant",
          content: content("body"),
          status: "PUBLISHED",
          authorUserId: "actor-1",
        }),
      }),
    );
    expect(writeEditorialMetadataHistoryMock).toHaveBeenCalledTimes(1);
    const historyInput = writeEditorialMetadataHistoryMock.mock.calls[0]?.[1] as
      | { patch: unknown }
      | undefined;
    const patch = historyInput?.patch;
    expect(
      collectEditorialPatchLeafPaths(patch).every((path) =>
        isEditorialPathInScope("wiki-post", path),
      ),
    ).toBe(true);
  });

  test("unlocked wiki content edit writes through collaborative authority", async () => {
    resetMocks();
    seedLegacyPostRow(wikiPost());

    await service.update(
      "wiki-post-1",
      { content: content("edited"), language: "en" },
      actor,
    );

    expect(assertCanEditCollaborativeMetadataMock).toHaveBeenCalledTimes(1);
    expect(postUpdateMock).not.toHaveBeenCalled();
    expect(contentTranslationUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          unitId_language: { unitId: "wiki-post-1", language: "en" },
        },
        update: expect.objectContaining({
          content: content("edited"),
          status: "PUBLISHED",
          authorUserId: "actor-1",
        }),
      }),
    );
    expect(writeEditorialMetadataHistoryMock).toHaveBeenCalledTimes(1);
  });

  test("ROOT wiki content edit still routes through collaborative authority", async () => {
    resetMocks();
    seedLegacyPostRow(wikiPost());

    await service.update(
      "wiki-post-1",
      { content: content("edited"), language: "en" },
      rootActor,
    );

    expect(assertCanEditCollaborativeMetadataMock).toHaveBeenCalledWith(
      expect.anything(),
      rootActor,
      "wiki-post-1",
      ["post.content.main"],
    );
    expect(writeEditorialMetadataHistoryMock).toHaveBeenCalledTimes(1);
  });

  test("wiki content source patch uses path-based lock and history", async () => {
    resetMocks();
    seedLegacyPostRow(wikiPost());
    collectPatchLeafPathsMock.mockReturnValueOnce(["post.content.main.source"]);

    await service.update(
      "wiki-post-1",
      { content: content("edited"), language: "en" },
      actor,
      {
        patch: { post: { content: { main: { source: "edited" } } } },
        message: "wiki-post.content.source.update",
      },
    );

    expect(assertCanEditCollaborativeMetadataMock).toHaveBeenCalledWith(
      expect.anything(),
      actor,
      "wiki-post-1",
      ["post.content.main.source"],
    );
    expect(writeEditorialMetadataHistoryMock).toHaveBeenCalledTimes(1);
    const historyCallInput = writeEditorialMetadataHistoryMock.mock
      .calls[0]?.[1] as Record<string, unknown> | undefined;
    expect(historyCallInput).toMatchObject({
      unitId: "wiki-post-1",
      actorUserId: "actor-1",
      patch: { post: { content: { main: { source: "edited" } } } },
      message: "wiki-post.content.source.update",
    });

    resetMocks();
    seedLegacyPostRow(wikiPost());
    collectPatchLeafPathsMock.mockReturnValueOnce(["post.content.main.source"]);
    assertCanEditCollaborativeMetadataMock.mockRejectedValueOnce({
      statusCode: 403,
      code: "FIELD_LOCKED",
      details: {
        blockedPaths: ["post.content.main.source"],
        offendingLockPath: "post.content.main.source",
        offendingPatchPath: "post.content.main.source",
      },
    });

    await expect(
      service.update(
        "wiki-post-1",
        { content: content("edited"), language: "en" },
        actor,
        {
          patch: { post: { content: { main: { source: "edited" } } } },
          message: "wiki-post.content.source.update",
        },
      ),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: "FIELD_LOCKED",
      details: {
        blockedPaths: ["post.content.main.source"],
        offendingLockPath: "post.content.main.source",
        offendingPatchPath: "post.content.main.source",
      },
    });
  });

  test("locked wiki content edit is rejected", async () => {
    resetMocks();
    seedLegacyPostRow(wikiPost());
    assertCanEditCollaborativeMetadataMock.mockRejectedValueOnce({
      statusCode: 403,
      code: "FIELD_LOCKED",
    });

    await expect(
      service.update(
        "wiki-post-1",
        { content: content("edited"), language: "en" },
        actor,
      ),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: "FIELD_LOCKED",
    });
    expect(postUpdateMock).not.toHaveBeenCalled();
  });

  test("ordinary review update does not query field locks", async () => {
    resetMocks();
    seedLegacyPostRow(
      wikiPost({
        unitId: "review-1",
        kind: "REVIEW",
        content: content("original"),
        authorUserId: "actor-1",
        unit: { defaultLanguage: "en", status: "PUBLISHED" },
      }),
    );

    await service.update(
      "review-1",
      { content: content("edited"), language: "en" },
      actor,
    );

    expect(unitFieldLockFindManyMock).not.toHaveBeenCalled();
    expect(historyOutboxCreateMock).not.toHaveBeenCalled();
  });

  test("Post.isLocked does not control wiki content locks", async () => {
    resetMocks();
    seedLegacyPostRow(wikiPost());

    await service.update(
      "wiki-post-1",
      { content: content("edited"), language: "en", isLocked: true },
      actor,
    );

    expect(assertCanEditCollaborativeMetadataMock).toHaveBeenCalledTimes(1);
    const postUpdateArgs = (postUpdateMock.mock.calls as any[])[0][0];
    expect(postUpdateArgs.data.isLocked).toBe(true);
  });

  test("wiki publication toggles content translation status", async () => {
    resetMocks();
    seedLegacyPostRow(
      wikiPost({
        authorUserId: "actor-1",
        unit: { status: "DRAFT", publishedAt: null },
      }),
    );
    postUpdateMock.mockImplementationOnce(async () => ({
      unitId: "wiki-post-1",
      kind: "WIKI",
      content: content("body"),
      unit: { status: "PUBLISHED" },
    }));

    await service.setPublicationState("wiki-post-1", true, "actor-1");

    expect(contentTranslationUpdateManyMock).toHaveBeenCalledWith({
      where: { unitId: "wiki-post-1" },
      data: expect.objectContaining({ status: "PUBLISHED" }),
    });
  });
});

describe("PostService promotion overlay (pin / accepted answer)", () => {
  const service = new PostService();
  const op = { userId: "op-1", permission: { role: "USER" } } as any;
  const stranger = {
    userId: "stranger-1",
    permission: { role: "USER" },
  } as any;

  const rootScope = (
    overrides: Record<string, unknown> = {},
  ): Record<string, unknown> => ({
    unitId: "root-1",
    authorUserId: "op-1",
    depth: 0,
    rootPostUnitId: "root-1",
    unit: { type: "POST", inRealms: [] },
    ...overrides,
  });
  const directReply = (
    overrides: Record<string, unknown> = {},
  ): Record<string, unknown> => ({
    depth: 1,
    rootUnitId: "root-1",
    parentCommentId: null,
    ...overrides,
  });

  test("OP pins a Comment reply within their own thread", async () => {
    resetMocks();
    seedLegacyPostRow(rootScope());
    commentFindUniqueMock.mockResolvedValueOnce(directReply());

    const pin = await service.pin(
      { scopeUnitId: "root-1", commentId: "reply-1" },
      op,
    );

    const createPromotionArgs = commentPromotionCreateMock.mock.calls[0]?.[0];
    expect(createPromotionArgs.data).toMatchObject({
      scopeUnitId: "root-1",
      commentId: "reply-1",
      kind: "PINNED",
      byUserId: "op-1",
    });
    expect(pin.kind).toBe("PINNED");
    expect(pin.commentId).toBe("reply-1");
  });

  test("a non-OP non-moderator cannot pin", async () => {
    resetMocks();
    seedLegacyPostRow(
      rootScope({
        unit: { type: "POST", inRealms: [{ realmUnitId: "realm-1" }] },
      }),
    );

    await expect(
      service.pin({ scopeUnitId: "root-1", commentId: "reply-1" }, stranger),
    ).rejects.toThrow(/moderator\/owner/);
    expect(commentPromotionCreateMock).not.toHaveBeenCalled();
  });

  test("a realm moderator may pin in a thread of their realm", async () => {
    resetMocks();
    seedLegacyPostRow(
      rootScope({
        unit: { type: "POST", inRealms: [{ realmUnitId: "realm-1" }] },
      }),
    );
    commentFindUniqueMock.mockResolvedValueOnce(directReply());
    realmMemberFindFirstMock.mockResolvedValueOnce({ realmUnitId: "realm-1" });

    const pin = await service.pin(
      { scopeUnitId: "root-1", commentId: "reply-1" },
      { userId: "mod-1", permission: { role: "USER" } } as any,
    );
    expect(pin.kind).toBe("PINNED");
  });

  test("rejects a target outside the scope thread", async () => {
    resetMocks();
    seedLegacyPostRow(rootScope());
    commentFindUniqueMock.mockResolvedValueOnce(
      directReply({
        rootUnitId: "other-root",
        parentCommentId: null,
      }),
    );

    await expect(
      service.pin({ scopeUnitId: "root-1", commentId: "reply-x" }, op),
    ).rejects.toThrow(/scope thread/);
  });

  test("rejects a realm id as a scope", async () => {
    resetMocks();
    postFindUniqueMock.mockResolvedValueOnce(null);
    unitFindUniqueMock.mockResolvedValueOnce({ type: "REALM" });

    await expect(
      service.pin({ scopeUnitId: "realm-1", commentId: "reply-1" }, op),
    ).rejects.toThrow(/pinboard/);
  });

  test("accept is rejected outside a Q&A thread", async () => {
    resetMocks();
    seedLegacyPostRow(rootScope());
    commentFindUniqueMock.mockResolvedValueOnce(directReply());
    unitFindFirstMock.mockResolvedValueOnce(null); // no official question tag — 没有官方 question 标签

    await expect(
      service.acceptAnswer({ scopeUnitId: "root-1", commentId: "reply-1" }, op),
    ).rejects.toThrow(/Q&A thread/);
    expect(commentPromotionCreateMock).not.toHaveBeenCalled();
  });

  test("accept is rejected for a non-direct reply", async () => {
    resetMocks();
    seedLegacyPostRow(rootScope());
    commentFindUniqueMock.mockResolvedValueOnce(
      directReply({ depth: 2, parentCommentId: "reply-1" }),
    );

    await expect(
      service.acceptAnswer({ scopeUnitId: "root-1", commentId: "reply-2" }, op),
    ).rejects.toThrow(/direct reply/);
  });

  test("OP accepts a qualifying direct reply in a Q&A thread", async () => {
    resetMocks();
    seedLegacyPostRow(rootScope());
    commentFindUniqueMock.mockResolvedValueOnce(directReply());
    unitFindFirstMock.mockResolvedValueOnce({ id: "tag-q" });
    unitTagFindUniqueMock.mockResolvedValueOnce({ unitId: "root-1" });

    const pin = await service.acceptAnswer(
      { scopeUnitId: "root-1", commentId: "reply-1" },
      op,
    );
    expect(pin.kind).toBe("ACCEPTED_ANSWER");
    const createPromotionArgs = commentPromotionCreateMock.mock.calls[0]?.[0];
    expect(createPromotionArgs.data.kind).toBe("ACCEPTED_ANSWER");
  });

  test("multiple accepted answers get distinct positions without renumbering", async () => {
    resetMocks();
    unitFindFirstMock.mockResolvedValue({ id: "tag-q" });
    unitTagFindUniqueMock.mockResolvedValue({ unitId: "root-1" });

    seedLegacyPostRow(rootScope());
    commentFindUniqueMock.mockResolvedValueOnce(directReply());
    await service.acceptAnswer(
      { scopeUnitId: "root-1", commentId: "reply-1" },
      op,
    );

    seedLegacyPostRow(rootScope());
    commentFindUniqueMock.mockResolvedValueOnce(directReply());
    commentPromotionFindFirstMock.mockResolvedValueOnce({ position: "a0" });
    await service.acceptAnswer(
      { scopeUnitId: "root-1", commentId: "reply-2" },
      op,
    );

    expect(commentPromotionCreateMock).toHaveBeenCalledTimes(2);
    const positions = (commentPromotionCreateMock.mock.calls as any[]).map(
      (call) => call[0].data.position,
    );
    expect(positions[0]).not.toBe(positions[1]);
  });

  test("unpin removes the PINNED promotion after a capability check", async () => {
    resetMocks();
    seedLegacyPostRow(rootScope());
    commentPromotionFindUniqueMock.mockResolvedValueOnce({ kind: "PINNED" });

    await service.unpin("root-1", "reply-1", op);
    expect(commentPromotionDeleteMock).toHaveBeenCalled();
  });

  test("unaccept rejects when the existing pin is not an accepted answer", async () => {
    resetMocks();
    seedLegacyPostRow(rootScope());
    commentPromotionFindUniqueMock.mockResolvedValueOnce({ kind: "PINNED" });

    await expect(
      service.unacceptAnswer("root-1", "reply-1", op),
    ).rejects.toThrow(/not found/);
    expect(commentPromotionDeleteMock).not.toHaveBeenCalled();
  });
});

describe("PostService.getThreadPromotionSignals (thread read signals)", () => {
  const service = new PostService();
  const op = { userId: "op-1", permission: { role: "USER" } } as any;
  const stranger = {
    userId: "stranger-1",
    permission: { role: "USER" },
  } as any;
  const admin = { userId: "admin-1", permission: { role: "ADMIN" } } as any;

  const readScope = (
    overrides: Record<string, unknown> = {},
  ): Record<string, unknown> => ({
    unitId: "root-1",
    authorUserId: "op-1",
    depth: 0,
    rootPostUnitId: "root-1",
    unit: { inRealms: [] },
    ...overrides,
  });

  test("OP sees viewerCanPromote=true on their own thread", async () => {
    resetMocks();
    seedLegacyPostRow(readScope());

    const signals = await service.getThreadPromotionSignals("root-1", op);
    expect(signals.viewerCanPromote).toBe(true);
  });

  test("an unrelated viewer sees viewerCanPromote=false", async () => {
    resetMocks();
    seedLegacyPostRow(
      readScope({ unit: { inRealms: [{ realmUnitId: "realm-1" }] } }),
    );

    const signals = await service.getThreadPromotionSignals("root-1", stranger);
    expect(signals.viewerCanPromote).toBe(false);
  });

  test("an anonymous caller sees viewerCanPromote=false without a scope lookup", async () => {
    resetMocks();

    const signals = await service.getThreadPromotionSignals("root-1", null);
    expect(signals.viewerCanPromote).toBe(false);
    expect(postFindUniqueMock).not.toHaveBeenCalled();
  });

  test("a realm moderator sees viewerCanPromote=true", async () => {
    resetMocks();
    seedLegacyPostRow(
      readScope({ unit: { inRealms: [{ realmUnitId: "realm-1" }] } }),
    );
    realmMemberFindFirstMock.mockResolvedValueOnce({ realmUnitId: "realm-1" });

    const signals = await service.getThreadPromotionSignals("root-1", {
      userId: "mod-1",
      permission: { role: "USER" },
    } as any);
    expect(signals.viewerCanPromote).toBe(true);
  });

  test("a realm owner sees viewerCanPromote=true", async () => {
    resetMocks();
    seedLegacyPostRow(
      readScope({ unit: { inRealms: [{ realmUnitId: "realm-1" }] } }),
    );
    // First unit.findFirst is the question-tag lookup (none); second is the
    // owned-realm lookup (hit).
    // 第一次 unit.findFirst 是 question 标签查询（无结果）；第二次是所属 realm
    // 查询（命中）。
    unitFindFirstMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "realm-1" });

    const signals = await service.getThreadPromotionSignals("root-1", {
      userId: "owner-1",
      permission: { role: "USER" },
    } as any);
    expect(signals.viewerCanPromote).toBe(true);
  });

  test("a platform admin sees viewerCanPromote=true on someone else's thread", async () => {
    resetMocks();
    seedLegacyPostRow(readScope({ authorUserId: "someone-else" }));

    const signals = await service.getThreadPromotionSignals("root-1", admin);
    expect(signals.viewerCanPromote).toBe(true);
  });

  test("viewerCanPromote=false agrees with the write guard for the same caller", async () => {
    // Read path: stranger gets no capability.
    // 读取路径：陌生人不获得任何权限。
    resetMocks();
    seedLegacyPostRow(readScope());
    const read = await service.getThreadPromotionSignals("root-1", stranger);
    expect(read.viewerCanPromote).toBe(false);

    // Write guard: the same stranger is rejected when they attempt to pin.
    // 写入守卫：同一个陌生人尝试 pin 时会被拒绝。
    resetMocks();
    seedLegacyPostRow(readScope({ unit: { type: "POST", inRealms: [] } }));
    await expect(
      service.pin({ scopeUnitId: "root-1", commentId: "reply-1" }, stranger),
    ).rejects.toThrow(/moderator\/owner/);
  });

  test("isQuestionThread=true when the root bears the official question tag", async () => {
    resetMocks();
    unitFindFirstMock.mockResolvedValueOnce({ id: "tag-q" });
    unitTagFindUniqueMock.mockResolvedValueOnce({ unitId: "root-1" });
    seedLegacyPostRow(readScope());

    const signals = await service.getThreadPromotionSignals("root-1", op);
    expect(signals.isQuestionThread).toBe(true);
  });

  test("isQuestionThread=false when the root lacks the official question tag", async () => {
    resetMocks();
    unitFindFirstMock.mockResolvedValue(null);
    seedLegacyPostRow(readScope());

    const signals = await service.getThreadPromotionSignals("root-1", op);
    expect(signals.isQuestionThread).toBe(false);
  });
});

describe("PostService lifecycle state", () => {
  const service = new PostService();
  const op = { userId: "op-1", permission: { role: "USER" } } as any;

  function createDataArg() {
    return (postCreateMock.mock.calls as any[])[0]?.[0]?.data as any;
  }

  const rootScope = (
    overrides: Record<string, unknown> = {},
  ): Record<string, unknown> => ({
    unitId: "root-1",
    authorUserId: "op-1",
    depth: 0,
    rootPostUnitId: "root-1",
    unit: { type: "POST", inRealms: [] },
    ...overrides,
  });
  const directReply = (
    overrides: Record<string, unknown> = {},
  ): Record<string, unknown> => ({
    depth: 1,
    rootUnitId: "root-1",
    parentCommentId: null,
    ...overrides,
  });

  // 5.1
  test("create with the question tag sets state=open and snapshots stateSchemaTag", async () => {
    resetMocks();
    unitFindManyMock.mockResolvedValue([{ id: "tag-q", slug: "question" }]);

    await service.create(
      postInput({ content: content("hi"), tagIds: ["tag-q"] }),
      "user-1",
    );

    const data = createDataArg();
    expect(data.state).toBe("open");
    expect(data.extra).toMatchObject({ stateSchemaTag: "question" });
  });

  test("create without a stateful tag leaves state undefined", async () => {
    resetMocks();
    unitFindManyMock.mockResolvedValue([{ id: "tag-x", slug: "book" }]);

    await service.create(
      postInput({ content: content("hi"), tagIds: ["tag-x"] }),
      "user-1",
    );

    expect(createDataArg().state).toBeNull();
  });

  // 5.2
  test("a second stateful tag is rejected", async () => {
    resetMocks();
    unitFindManyMock.mockResolvedValue([
      { id: "tag-q", slug: "question" },
      { id: "tag-i", slug: "issue" },
    ]);

    await expect(
      service.create(
        postInput({ content: content("hi"), tagIds: ["tag-q", "tag-i"] }),
        "user-1",
      ),
    ).rejects.toThrow(/at most one stateful tag/);
  });

  // 5.2 — the snapshot is written only at creation; setState never rewrites it.
  // 5.2 — 快照仅在创建时写入；setState 永不重写它。
  test("setState changes only `state`, never the stateSchemaTag snapshot", async () => {
    resetMocks();
    postFindUniqueOrThrowMock.mockResolvedValueOnce({
      state: "open",
      extra: { stateSchemaTag: "question" },
    });

    await service.setState("post-1", "solved");

    const args = (postUpdateMock.mock.calls as any[])[0]?.[0];
    expect(args.data).toEqual(expect.objectContaining({ state: "solved" }));
    expect("extra" in args.data).toBe(false);
  });

  // 5.3
  test("illegal state value is rejected on write", async () => {
    resetMocks();
    postFindUniqueOrThrowMock.mockResolvedValueOnce({
      state: "open",
      extra: { stateSchemaTag: "question" },
    });

    await expect(service.setState("post-1", "banana")).rejects.toThrow(
      /Illegal state value/,
    );
    expect(postUpdateMock).not.toHaveBeenCalled();
  });

  test("disallowed transition is rejected on write", async () => {
    resetMocks();
    postFindUniqueOrThrowMock.mockResolvedValueOnce({
      state: "solved",
      extra: { stateSchemaTag: "question" },
    });

    // solved → duplicate is a closed→closed jump the schema does not declare.
    // solved → duplicate 是 schema 未声明的 closed→closed 跳转。
    await expect(service.setState("post-1", "duplicate")).rejects.toThrow(
      /Disallowed state transition/,
    );
    expect(postUpdateMock).not.toHaveBeenCalled();
  });

  test("setState on a post without a schema is rejected", async () => {
    resetMocks();
    postFindUniqueOrThrowMock.mockResolvedValueOnce({ state: null, extra: {} });

    await expect(service.setState("post-1", "open")).rejects.toThrow(
      /no lifecycle state schema/,
    );
  });

  // 5.4
  test("accepting an answer advances open → solved", async () => {
    resetMocks();
    seedLegacyPostRow(
      rootScope({
        state: "open",
        extra: { stateSchemaTag: "question" },
      }),
    );
    commentFindUniqueMock.mockResolvedValueOnce(directReply());
    unitFindFirstMock.mockResolvedValueOnce({ id: "tag-q" });
    unitTagFindUniqueMock.mockResolvedValueOnce({ unitId: "root-1" });

    await service.acceptAnswer(
      { scopeUnitId: "root-1", commentId: "reply-1" },
      op,
    );

    expect(postUpdateMock).toHaveBeenCalledWith({
      where: { unitId: "root-1" },
      data: expect.objectContaining({ state: "solved" }),
    });
  });

  test("accepting an answer never overwrites a manual closed reason", async () => {
    resetMocks();
    seedLegacyPostRow(
      rootScope({
        state: "duplicate",
        extra: { stateSchemaTag: "question" },
      }),
    );
    commentFindUniqueMock.mockResolvedValueOnce(directReply());
    unitFindFirstMock.mockResolvedValueOnce({ id: "tag-q" });
    unitTagFindUniqueMock.mockResolvedValueOnce({ unitId: "root-1" });

    await service.acceptAnswer(
      { scopeUnitId: "root-1", commentId: "reply-1" },
      op,
    );

    expect(postUpdateMock).not.toHaveBeenCalled();
  });

  test("unaccepting the last answer reverts solved → open", async () => {
    resetMocks();
    seedLegacyPostRow(
      rootScope({
        state: "solved",
        extra: { stateSchemaTag: "question" },
      }),
    );
    commentPromotionFindUniqueMock.mockResolvedValueOnce({
      kind: "ACCEPTED_ANSWER",
    });
    commentPromotionCountMock.mockResolvedValueOnce(0);

    await service.unacceptAnswer("root-1", "reply-1", op);

    expect(postUpdateMock).toHaveBeenCalledWith({
      where: { unitId: "root-1" },
      data: expect.objectContaining({ state: "open" }),
    });
  });

  test("unaccepting does not reopen while another accepted answer remains", async () => {
    resetMocks();
    seedLegacyPostRow(rootScope());
    commentPromotionFindUniqueMock.mockResolvedValueOnce({
      kind: "ACCEPTED_ANSWER",
    });
    commentPromotionCountMock.mockResolvedValueOnce(1);

    await service.unacceptAnswer("root-1", "reply-1", op);

    expect(postUpdateMock).not.toHaveBeenCalled();
  });

  // 5.6
  test("active bucket filter matches state IN the active slugs (no anti-join)", async () => {
    resetMocks();
    lastStateBucketForRecorder = "active";
    await service.list({ stateBucket: "active" });
    expect(firstPostFindManyArgs().where.state).toEqual({ in: ["open"] });
  });

  test("closed bucket filter matches all closed reason values", async () => {
    resetMocks();
    lastStateBucketForRecorder = "closed";
    await service.list({ stateBucket: "closed" });
    const inList = (firstPostFindManyArgs().where.state.in as string[]).sort();
    expect(inList).toEqual(
      ["completed", "duplicate", "not-planned", "off-topic", "solved"].sort(),
    );
  });

  test("an exact state filter takes precedence over a bucket", async () => {
    resetMocks();
    await service.list({ state: "open", stateBucket: "closed" });
    expect(firstPostFindManyArgs().where.state).toBe("open");
  });

  // 5.7
  test("closing writes a reason value and reopening returns to the initial state", async () => {
    resetMocks();
    seedLegacyPostRow({
      unitId: "post-1",
      state: "open",
      extra: { stateSchemaTag: "question" },
    });
    await service.setState("post-1", "not-planned");
    expect((postUpdateMock.mock.calls as any[])[0]?.[0].data).toEqual(
      expect.objectContaining({ state: "not-planned" }),
    );

    resetMocks();
    seedLegacyPostRow({
      unitId: "post-1",
      state: "not-planned",
      extra: { stateSchemaTag: "question" },
    });
    await service.setState("post-1", "open");
    expect((postUpdateMock.mock.calls as any[])[0]?.[0].data).toEqual(
      expect.objectContaining({ state: "open" }),
    );
  });

  test("a bare `closed` value is rejected (closing requires a reason)", async () => {
    resetMocks();
    seedLegacyPostRow({
      unitId: "post-1",
      state: "open",
      extra: { stateSchemaTag: "question" },
    });
    await expect(service.setState("post-1", "closed")).rejects.toThrow(
      /Illegal state value/,
    );
  });
});
