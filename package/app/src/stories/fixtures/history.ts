// MOCK: Storybook history fixtures for content-history v2 UI states.
import type {
  HistoryActorResolution,
  HistoryUnitReferenceResolution,
  StructureEventDTO,
  UnitRevisionDTO,
} from "@rezics/contract";

export const historyBookId = "11111111-1111-4111-8111-111111111111";
export const historyPrivateChapterId = "22222222-2222-4222-8222-222222222222";
export const historyDeletedUnitId = "33333333-3333-4333-8333-333333333333";
export const historyGoneUnitId = "44444444-4444-4444-8444-444444444444";

export const historyActors: Record<string, HistoryActorResolution> = {
  "user-editor": {
    actorUserId: "user-editor",
    status: "OK",
    displayName: "Mina Park",
    handle: "mina",
    avatarUrl: null,
  },
  "user-maintainer": {
    actorUserId: "user-maintainer",
    status: "OK",
    displayName: "Library Maintainer",
    handle: "maintainer",
    avatarUrl: null,
  },
  "user-deleted": {
    actorUserId: "user-deleted",
    status: "DELETED",
  },
};

export const historyReferences: Record<string, HistoryUnitReferenceResolution> =
  {
    [historyBookId]: {
      unitId: historyBookId,
      status: "OK",
      title: "The Quiet Library",
      unitType: "BOOK",
      slug: "quiet-library",
    },
    [historyPrivateChapterId]: {
      unitId: historyPrivateChapterId,
      status: "RESTRICTED",
    },
    [historyDeletedUnitId]: {
      unitId: historyDeletedUnitId,
      status: "DELETED",
    },
    [historyGoneUnitId]: {
      unitId: historyGoneUnitId,
      status: "GONE",
    },
  };

export const historyRevisionPayloadBase = {
  unit: {
    visibility: "PUBLIC",
    defaultLanguage: "en",
  },
  translations: [
    {
      language: "en",
      title: "The Quiet Library",
      summary: "A short note on rooms that hold a reading life.",
      description:
        "Across twelve essays, the narrator visits public libraries and traces how each city changes the books people carry home.",
    },
  ],
  extension: {
    isbn13: "9780000000001",
    pageCount: 320,
    textLength: 86_400,
    formatKey: "paperback",
    isLicensed: true,
  },
  credits: [{ entityId: historyBookId, name: "Mei Tanaka", role: "AUTHOR" }],
  tags: [{ tagUnitId: historyDeletedUnitId, name: "archive" }],
};

export const historyRevisionPayloadTarget = {
  ...historyRevisionPayloadBase,
  translations: [
    {
      language: "en",
      title: "The Quiet Library",
      summary: "A sharper note on rooms that hold a reading life.",
      description:
        "Across thirteen essays, the narrator visits public libraries, private archives, and station reading rooms.\n\nEach city changes the books people carry home.",
    },
    {
      language: "zh-Hant",
      title: "靜謐圖書館",
      summary: "關於閱讀之屋如何保存日常記憶的短札。",
      description:
        "敘事者走過公共圖書館、私人檔案室與車站閱覽室，記錄每座城市如何改變人們帶回家的書。",
    },
  ],
  extension: {
    isbn13: "9780000000001",
    pageCount: 344,
    textLength: 91_200,
    formatKey: "paperback",
    isLicensed: true,
  },
  credits: [
    { entityId: historyBookId, name: "Mei Tanaka", role: "AUTHOR" },
    {
      entityId: historyPrivateChapterId,
      name: "Hidden Editor",
      role: "EDITOR",
    },
  ],
  subjects: [{ subjectUnitId: historyGoneUnitId, name: "Libraries" }],
};

export const historyRevisions: UnitRevisionDTO[] = [
  {
    id: "rev-5",
    unitId: historyBookId,
    sequence: 5,
    contentHash: "hash-rev-5",
    actorUserId: "user-maintainer",
    changedFieldKeys: [
      "identity.description",
      "bibliographic.pageCount",
      "credits.authors",
    ],
    message: "Expanded translation notes and updated edition metadata.",
    createdAt: "2026-05-19T09:24:00.000Z",
    ingestedAt: "2026-05-19T09:24:02.000Z",
    content: {
      hash: "hash-rev-5",
      payload: historyRevisionPayloadTarget,
      createdAt: "2026-05-19T09:24:00.000Z",
    },
  },
  {
    id: "rev-4",
    unitId: historyBookId,
    sequence: 4,
    contentHash: "hash-rev-4",
    actorUserId: "user-editor",
    changedFieldKeys: ["identity.summary", "tags"],
    message: "Tightened the summary and removed a stale tag.",
    createdAt: "2026-05-18T16:12:00.000Z",
    ingestedAt: "2026-05-18T16:12:03.000Z",
    content: {
      hash: "hash-rev-4",
      payload: historyRevisionPayloadBase,
      createdAt: "2026-05-18T16:12:00.000Z",
    },
  },
  {
    id: "rev-3",
    unitId: historyBookId,
    sequence: 3,
    contentHash: "hash-rev-3",
    actorUserId: "user-deleted",
    changedFieldKeys: ["identity.title"],
    message: null,
    createdAt: "2026-05-18T15:40:00.000Z",
    ingestedAt: "2026-05-18T15:40:04.000Z",
  },
];

export const historyEmptyRevisions: UnitRevisionDTO[] = [];

export const historyLaggingRevisions: UnitRevisionDTO[] = [
  {
    id: "rev-lag",
    unitId: historyBookId,
    sequence: 6,
    contentHash: "hash-lag",
    actorUserId: "user-editor",
    changedFieldKeys: ["identity.summary"],
    message: "Recently saved revision waiting for ingestion.",
    createdAt: "2026-05-20T10:10:00.000Z",
  },
];

export const historyStructureEvents: StructureEventDTO[] = [
  {
    id: "structure-3",
    unitId: historyBookId,
    sequence: 3,
    eventType: "book.contentStructure.batch",
    actorUserId: "user-maintainer",
    changedFieldKeys: ["book.contentStructure"],
    message: "Reordered opening chapters.",
    createdAt: "2026-05-19T11:30:00.000Z",
    ingestedAt: "2026-05-19T11:30:02.000Z",
    payload: {
      operations: [
        {
          op: "move",
          nodeId: "chapter-intro",
          beforeParentId: null,
          afterParentId: "part-1",
          beforeIndex: 0,
          afterIndex: 1,
        },
        {
          op: "link",
          nodeId: "chapter-archive",
          unitId: historyPrivateChapterId,
          title: "Restricted appendix",
        },
        {
          op: "delete",
          nodeId: "chapter-old",
          unitId: historyDeletedUnitId,
          descendantCount: 2,
        },
      ],
    },
  },
];

export const historyAuthorityEvents = {
  publicViewer: {
    canOpenDetail: true,
    canOpenCompare: true,
    canInspectRawPayload: false,
    canRestore: false,
  },
  maintainer: {
    canOpenDetail: true,
    canOpenCompare: true,
    canInspectRawPayload: true,
    canRestore: true,
  },
};

export const historyCompareFixtures = {
  english: {
    before: {
      translations: [
        {
          language: "en",
          title: "The Quiet Library",
          description: "A room keeps the books we forget.\n",
        },
      ],
    },
    after: {
      translations: [
        {
          language: "en",
          title: "The Quiet Library",
          description: "A room keeps the books we forget and return to.\n",
        },
      ],
    },
  },
  chinese: {
    before: {
      translations: [
        {
          language: "zh-Hant",
          title: "靜謐圖書館",
          description: "城市把書留在光裡。",
        },
      ],
    },
    after: {
      translations: [
        {
          language: "zh-Hant",
          title: "靜謐圖書館",
          description: "城市把書留在午後的光裡。",
        },
      ],
    },
  },
  japanese: {
    before: {
      translations: [
        {
          language: "ja",
          title: "静かな図書館",
          description: "読書室は記憶を保存する。",
        },
      ],
    },
    after: {
      translations: [
        {
          language: "ja",
          title: "静かな図書館",
          description: "読書室は記憶と余白を保存する。",
        },
      ],
    },
  },
  longProse: {
    before: historyRevisionPayloadBase,
    after: historyRevisionPayloadTarget,
  },
  largeCollapsedHunk: {
    before: {
      translations: [
        {
          language: "en",
          title: "The Quiet Library",
          description: Array.from(
            { length: 28 },
            (_, index) => `Line ${index + 1}: unchanged archive note.`,
          ).join("\n"),
        },
      ],
    },
    after: {
      translations: [
        {
          language: "en",
          title: "The Quiet Library",
          description: Array.from({ length: 28 }, (_, index) =>
            index === 14
              ? "Line 15: a newly restored reading-room note."
              : `Line ${index + 1}: unchanged archive note.`,
          ).join("\n"),
        },
      ],
    },
  },
  rawAuthorized: {
    before: {
      migrationOnlySlot: { privateUnitIds: [historyPrivateChapterId] },
    },
    after: {
      migrationOnlySlot: {
        privateUnitIds: [historyPrivateChapterId],
        migrationMarker: "v2",
      },
    },
  },
};
