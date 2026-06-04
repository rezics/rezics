import {
  pgEnum,
  pgTable,
  uuid,
  text,
  varchar,
  timestamp,
  boolean,
  jsonb,
  bigint,
  doublePrecision,
  integer,
  customType,
  index,
  uniqueIndex,
  foreignKey,
  primaryKey,
  check,
  pgSequence,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const UnitType = pgEnum("UnitType", [
  "BOOK",
  "GAME",
  "MEDIA",
  "POST",
  "TAG",
  "REALM",
  "SHELF",
  "IMAGE",
  "VIDEO",
  "QUOTE",
  "LINK",
  "ENTITY",
  "ZONE",
  "USER",
  "SCOPE",
  "SERIES",
  "LABEL",
  "POLL",
  "COMMENT",
]);
export const UnitStatus = pgEnum("UnitStatus", [
  "DRAFT",
  "PUBLISHED",
  "ARCHIVED",
  "DELETED",
]);
export const UnitVisibility = pgEnum("UnitVisibility", [
  "PUBLIC",
  "UNLISTED",
  "PRIVATE",
]);
export const ContentRating = pgEnum("ContentRating", [
  "GENERAL",
  "R_15",
  "R_18",
  "R_18G",
]);
export const UserUnitProgressStatus = pgEnum("UserUnitProgressStatus", [
  "BACKLOG",
  "ACTIVE",
  "PAUSED",
  "COMPLETED",
  "DROPPED",
]);
export const PostKind = pgEnum("PostKind", [
  "REVIEW",
  "EXCERPT",
  "REMARK",
  "POST",
  "CHAPTER",
  "WIKI",
]);
export const EmailVerificationContractStatus = pgEnum(
  "EmailVerificationContractStatus",
  ["PENDING", "VERIFIED", "EXPIRED"],
);
export const FeedbackType = pgEnum("FeedbackType", [
  "REPORT",
  "BUG",
  "FEATURE",
  "OTHER",
]);
export const UnitAliasKind = pgEnum("UnitAliasKind", [
  "COMMON",
  "ABBREVIATION",
  "TRANSLITERATION",
  "ALTERNATE_TITLE",
  "LEGACY_TITLE",
  "MISSPELLING",
  "OTHER",
]);
export const UnitAliasStatus = pgEnum("UnitAliasStatus", ["ACTIVE", "HIDDEN"]);
export const AiDisclosureMode = pgEnum("AiDisclosureMode", [
  "UNKNOWN",
  "NONE",
  "AI_ASSISTED",
  "AI_ORIGINATED",
  "MACHINE_GENERATED",
]);
export const GovernanceGrantState = pgEnum("GovernanceGrantState", [
  "ACTIVE",
  "EXPIRED",
  "REVOKED",
]);
export const AccountEnforcementKind = pgEnum("AccountEnforcementKind", [
  "WARNING",
  "SILENCE",
  "SUSPENSION",
  "BAN",
  "RATE_LIMIT",
  "TRUST_RESTRICTION",
]);
export const AccountEnforcementState = pgEnum("AccountEnforcementState", [
  "ACTIVE",
  "EXPIRED",
  "REVOKED",
]);
export const ModerationCaseState = pgEnum("ModerationCaseState", [
  "NEW",
  "TRIAGED",
  "ASSIGNED",
  "ACTIONED",
  "RESOLVED",
  "DUPLICATE",
  "REJECTED",
  "ESCALATED",
  "REVIEWING",
]);
export const RealmMemberState = pgEnum("RealmMemberState", [
  "ACTIVE",
  "PENDING",
  "MUTED",
  "REMOVED",
  "BANNED",
]);
export const PinKind = pgEnum("PinKind", [
  "ACCEPTED_ANSWER",
  "PINNED",
  "HIGHLIGHT",
]);
export const PollVoteMode = pgEnum("PollVoteMode", ["SINGLE", "MULTI"]);
export const PollResultVisibility = pgEnum("PollResultVisibility", [
  "LIVE",
  "AFTER_CLOSE",
]);
export const CatalogEntryKind = pgEnum("CatalogEntryKind", [
  "MAIN",
  "VARIANT",
  "NONE",
]);
export const ContentTranslationStatus = pgEnum("ContentTranslationStatus", [
  "DRAFT",
  "PUBLISHED",
  "ARCHIVED",
]);
export const ModerationStatus = pgEnum("ModerationStatus", [
  "APPROVED",
  "PENDING",
  "REMOVED",
]);
export const ModerationScope = pgEnum("ModerationScope", ["PLATFORM", "REALM"]);
export const ModerationTargetKind = pgEnum("ModerationTargetKind", [
  "UNIT",
  "UNIT_REALM",
  "COMMENT",
  "UNIT_FIELD",
  "ACCOUNT",
  "REALM_MEMBER",
  "FEEDBACK",
]);
export const ModerationAuthority = pgEnum("ModerationAuthority", [
  "PLATFORM",
  "REALM",
  "OWNER",
]);
export const ModerationActorKind = pgEnum("ModerationActorKind", [
  "USER",
  "SYSTEM",
  "AUTOMATION",
  "IMPORT",
]);
export const ModerationActionKind = pgEnum("ModerationActionKind", [
  "APPROVE",
  "REMOVE",
  "RESTORE",
  "LOCK",
  "UNLOCK",
  "FIELD_LOCK",
  "FIELD_UNLOCK",
  "WARNING",
  "SILENCE",
  "SUSPENSION",
  "BAN",
  "RATE_LIMIT",
  "TRUST_RESTRICTION",
  "REVOKE_ENFORCEMENT",
  "MUTE_MEMBER",
  "REMOVE_MEMBER",
  "BAN_MEMBER",
  "RESTORE_MEMBER",
  "ESCALATE",
  "REVERSE",
  "NOTE",
]);

export const post_path_label_seq = pgSequence("post_path_label_seq", {
  startWith: "1",
  increment: "1",
  minValue: "1",
  maxValue: "9223372036854775807",
  cache: "1",
  cycle: false,
});

export const AccountEnforcement = pgTable(
  "AccountEnforcement",
  {
    id: uuid().default(sql`uuidv7()`).primaryKey(),
    targetUserId: uuid()
      .notNull()
      .references(() => User.unitId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    kind: AccountEnforcementKind().notNull(),
    state: AccountEnforcementState().default("ACTIVE").notNull(),
    reason: text().notNull(),
    safeMessage: text(),
    decidedById: uuid()
      .notNull()
      .references(() => User.unitId, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    decisionCode: varchar({ length: 64 }).notNull(),
    startsAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    expiresAt: timestamp({ precision: 3 }),
    revokedAt: timestamp({ precision: 3 }),
    revokedById: uuid().references(() => User.unitId, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    metadata: jsonb(),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3 }).notNull(),
    decisionActionId: uuid().references(() => ModerationAction.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    revocationActionId: uuid().references(() => ModerationAction.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
  },
  (table) => [
    index("AccountEnforcement_decidedById_createdAt_idx").using(
      "btree",
      table.decidedById.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
    index("AccountEnforcement_decisionActionId_idx").using(
      "btree",
      table.decisionActionId.asc().nullsLast(),
    ),
    index("AccountEnforcement_kind_state_createdAt_idx").using(
      "btree",
      table.kind.asc().nullsLast(),
      table.state.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
    index("AccountEnforcement_revocationActionId_idx").using(
      "btree",
      table.revocationActionId.asc().nullsLast(),
    ),
    index("AccountEnforcement_revokedById_idx").using(
      "btree",
      table.revokedById.asc().nullsLast(),
    ),
    index("AccountEnforcement_targetUserId_state_kind_expiresAt_idx").using(
      "btree",
      table.targetUserId.asc().nullsLast(),
      table.state.asc().nullsLast(),
      table.kind.asc().nullsLast(),
      table.expiresAt.asc().nullsLast(),
    ),
  ],
);

export const ApiToken = pgTable(
  "ApiToken",
  {
    id: uuid().default(sql`uuidv7()`).primaryKey(),
    userId: uuid()
      .notNull()
      .references(() => User.unitId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    name: text().notNull(),
    tokenHash: text().notNull(),
    scopes: jsonb().default({}).notNull(),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    expiresAt: timestamp({ precision: 3 }),
    lastUsedAt: timestamp({ precision: 3 }),
    lastIP: text(),
    userAgent: text(),
    revoked: boolean().default(false).notNull(),
    revokedAt: timestamp({ precision: 3 }),
  },
  (table) => [
    index("ApiToken_expiresAt_idx").using(
      "btree",
      table.expiresAt.asc().nullsLast(),
    ),
    index("ApiToken_tokenHash_idx").using(
      "btree",
      table.tokenHash.asc().nullsLast(),
    ),
    uniqueIndex("ApiToken_tokenHash_key").using(
      "btree",
      table.tokenHash.asc().nullsLast(),
    ),
    index("ApiToken_userId_idx").using("btree", table.userId.asc().nullsLast()),
  ],
);

export const Book = pgTable(
  "Book",
  {
    unitId: uuid()
      .primaryKey()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    isbn13: varchar({ length: 32 }),
    publicationDate: timestamp({ precision: 3 }),
    pageCount: integer(),
    textLength: integer().default(0).notNull(),
    formatKey: varchar({ length: 32 }),
    isLicensed: boolean().default(false).notNull(),
    extra: jsonb(),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3 }).notNull(),
    chapterCount: integer().default(0).notNull(),
  },
  (table) => [
    index("Book_isbn13_idx").using("btree", table.isbn13.asc().nullsLast()),
    index("Book_publicationDate_idx").using(
      "btree",
      table.publicationDate.asc().nullsLast(),
    ),
  ],
);

export const Comment = pgTable(
  "Comment",
  {
    id: uuid().default(sql`uuidv7()`).primaryKey(),
    rootUnitId: uuid()
      .notNull()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    realmUnitId: uuid().references(() => Unit.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    parentCommentId: uuid(),
    authorUserId: uuid()
      .notNull()
      .references(() => User.unitId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    content: jsonb(),
    depth: integer().default(1).notNull(),
    path: customType({ dataType: () => "ltree" })(),
    replyCount: integer().default(0).notNull(),
    directReplyCount: integer().default(0).notNull(),
    lastReplyAt: timestamp({ precision: 3 }),
    isLocked: boolean().default(false).notNull(),
    state: text(),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3 }).notNull(),
    deletedAt: timestamp({ precision: 3 }),
    moderationStatus: ModerationStatus().default("APPROVED").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.parentCommentId],
      foreignColumns: [table.id],
      name: "Comment_parentCommentId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("set null"),
    index("Comment_authorUserId_createdAt_idx").using(
      "btree",
      table.authorUserId.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
    index("Comment_deletedAt_idx").using(
      "btree",
      table.deletedAt.asc().nullsLast(),
    ),
    index("Comment_moderationStatus_idx").using(
      "btree",
      table.moderationStatus.asc().nullsLast(),
    ),
    index("Comment_parentCommentId_createdAt_idx").using(
      "btree",
      table.parentCommentId.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
    index("Comment_path_gist_idx").using("gist", table.path.asc().nullsLast()),
    index("Comment_rootUnitId_realmUnitId_createdAt_idx").using(
      "btree",
      table.rootUnitId.asc().nullsLast(),
      table.realmUnitId.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
    index("Comment_rootUnitId_realmUnitId_parentCommentId_createdAt_idx").using(
      "btree",
      table.rootUnitId.asc().nullsLast(),
      table.realmUnitId.asc().nullsLast(),
      table.parentCommentId.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
    index("Comment_state_idx").using("btree", table.state.asc().nullsLast()),
  ],
);

export const CommentPromotion = pgTable(
  "CommentPromotion",
  {
    scopeUnitId: uuid()
      .notNull()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    commentId: uuid()
      .notNull()
      .references(() => Comment.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    kind: PinKind().notNull(),
    position: varchar({ length: 64 }).notNull(),
    byUserId: uuid().notNull(),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.scopeUnitId, table.commentId],
      name: "CommentPromotion_pkey",
    }),
    index("CommentPromotion_commentId_idx").using(
      "btree",
      table.commentId.asc().nullsLast(),
    ),
    index("CommentPromotion_scopeUnitId_kind_position_idx").using(
      "btree",
      table.scopeUnitId.asc().nullsLast(),
      table.kind.asc().nullsLast(),
      table.position.asc().nullsLast(),
    ),
  ],
);

export const ContentStructure = pgTable(
  "ContentStructure",
  {
    ownerUnitId: uuid()
      .primaryKey()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3 }).notNull(),
  },
  (table) => [
    index("ContentStructure_updatedAt_idx").using(
      "btree",
      table.updatedAt.desc().nullsFirst(),
    ),
  ],
);

export const ContentStructureAnchor = pgTable(
  "ContentStructureAnchor",
  {
    nodeId: uuid()
      .primaryKey()
      .references(() => ContentStructureNode.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    ownerUnitId: uuid()
      .notNull()
      .references(() => ContentStructure.ownerUnitId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    contentUnitId: uuid()
      .notNull()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    parentNodeId: uuid(),
    ancestorNodeIds: jsonb().notNull(),
    path: jsonb().notNull(),
    depth: integer().notNull(),
    position: text().notNull(),
    positionPath: text().notNull(),
    titlePath: jsonb().notNull(),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3 }).notNull(),
  },
  (table) => [
    index("ContentStructureAnchor_contentUnitId_ownerUnitId_idx").using(
      "btree",
      table.contentUnitId.asc().nullsLast(),
      table.ownerUnitId.asc().nullsLast(),
    ),
    index("ContentStructureAnchor_ownerUnitId_depth_idx").using(
      "btree",
      table.ownerUnitId.asc().nullsLast(),
      table.depth.asc().nullsLast(),
    ),
    index("ContentStructureAnchor_ownerUnitId_parentNodeId_position_idx").using(
      "btree",
      table.ownerUnitId.asc().nullsLast(),
      table.parentNodeId.asc().nullsLast(),
      table.position.asc().nullsLast(),
    ),
    index("ContentStructureAnchor_ownerUnitId_positionPath_idx").using(
      "btree",
      table.ownerUnitId.asc().nullsLast(),
      table.positionPath.asc().nullsLast(),
    ),
  ],
);

export const ContentStructureNode = pgTable(
  "ContentStructureNode",
  {
    id: uuid().default(sql`uuidv7()`).primaryKey(),
    ownerUnitId: uuid()
      .notNull()
      .references(() => ContentStructure.ownerUnitId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    parentId: uuid(),
    position: text().notNull(),
    contentUnitId: uuid().references(() => Unit.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    title: text().notNull(),
    noContent: boolean().default(false).notNull(),
    rating: ContentRating(),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3 }).notNull(),
    isDeleted: boolean().default(false).notNull(),
    deletedAt: timestamp({ precision: 3 }),
  },
  (table) => [
    foreignKey({
      columns: [table.parentId],
      foreignColumns: [table.id],
      name: "ContentStructureNode_parentId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    index("ContentStructureNode_contentUnitId_idx").using(
      "btree",
      table.contentUnitId.asc().nullsLast(),
    ),
    index("ContentStructureNode_ownerUnitId_isDeleted_updatedAt_idx").using(
      "btree",
      table.ownerUnitId.asc().nullsLast(),
      table.isDeleted.asc().nullsLast(),
      table.updatedAt.desc().nullsFirst(),
    ),
    index(
      "ContentStructureNode_ownerUnitId_parentId_position_isDelete_idx",
    ).using(
      "btree",
      table.ownerUnitId.asc().nullsLast(),
      table.parentId.asc().nullsLast(),
      table.position.asc().nullsLast(),
      table.isDeleted.asc().nullsLast(),
    ),
    index("ContentStructureNode_ownerUnitId_updatedAt_idx").using(
      "btree",
      table.ownerUnitId.asc().nullsLast(),
      table.updatedAt.desc().nullsFirst(),
    ),
  ],
);

export const ContentTranslation = pgTable(
  "ContentTranslation",
  {
    unitId: uuid()
      .notNull()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    language: varchar({ length: 16 }).notNull(),
    content: jsonb().notNull(),
    status: ContentTranslationStatus().default("PUBLISHED").notNull(),
    sourceUnitId: uuid(),
    authorUserId: uuid(),
    provenance: jsonb(),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3 }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.unitId, table.language],
      name: "ContentTranslation_pkey",
    }),
    index("ContentTranslation_authorUserId_idx").using(
      "btree",
      table.authorUserId.asc().nullsLast(),
    ),
    index("ContentTranslation_language_status_idx").using(
      "btree",
      table.language.asc().nullsLast(),
      table.status.asc().nullsLast(),
    ),
    index("ContentTranslation_sourceUnitId_idx").using(
      "btree",
      table.sourceUnitId.asc().nullsLast(),
    ),
    index("ContentTranslation_status_updatedAt_idx").using(
      "btree",
      table.status.asc().nullsLast(),
      table.updatedAt.asc().nullsLast(),
    ),
  ],
);

export const CreditAttribution = pgTable(
  "CreditAttribution",
  {
    unitId: uuid()
      .notNull()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    entityId: uuid()
      .notNull()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    role: varchar({ length: 64 }).notNull(),
    sortOrder: integer().default(0).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.unitId, table.entityId, table.role],
      name: "CreditAttribution_pkey",
    }),
    index("CreditAttribution_entityId_role_idx").using(
      "btree",
      table.entityId.asc().nullsLast(),
      table.role.asc().nullsLast(),
    ),
    index("CreditAttribution_unitId_role_sortOrder_idx").using(
      "btree",
      table.unitId.asc().nullsLast(),
      table.role.asc().nullsLast(),
      table.sortOrder.asc().nullsLast(),
    ),
  ],
);

export const CreditAttributionEvidence = pgTable(
  "CreditAttributionEvidence",
  {
    id: uuid().default(sql`uuidv7()`).primaryKey(),
    unitId: uuid().notNull(),
    entityId: uuid().notNull(),
    role: varchar({ length: 64 }).notNull(),
    sourceRefId: uuid()
      .notNull()
      .references(() => UnitExternalRef.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    claimPath: text(),
    observedUrl: text(),
    observedAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    confidence: doublePrecision(),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3 }).notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.unitId, table.entityId, table.role],
      foreignColumns: [
        CreditAttribution.unitId,
        CreditAttribution.entityId,
        CreditAttribution.role,
      ],
      name: "CreditAttributionEvidence_unitId_entityId_role_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    index("CreditAttributionEvidence_sourceRefId_idx").using(
      "btree",
      table.sourceRefId.asc().nullsLast(),
    ),
    index("CreditAttributionEvidence_unitId_entityId_role_idx").using(
      "btree",
      table.unitId.asc().nullsLast(),
      table.entityId.asc().nullsLast(),
      table.role.asc().nullsLast(),
    ),
  ],
);

export const EchoKV = pgTable("EchoKV", {
  key: text().primaryKey(),
  value: jsonb().notNull(),
  createdAt: timestamp({ precision: 3 })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp({ precision: 3 }).notNull(),
});

export const EmailVerificationContract = pgTable(
  "EmailVerificationContract",
  {
    id: uuid().default(sql`uuidv7()`).primaryKey(),
    contractName: varchar({ length: 96 }).notNull(),
    ownerId: uuid().notNull(),
    email: varchar({ length: 320 }).notNull(),
    status: EmailVerificationContractStatus().default("PENDING").notNull(),
    codeHash: text(),
    deliveryStatus: varchar({ length: 64 }),
    source: varchar({ length: 64 }),
    verifiedAt: timestamp({ precision: 3 }),
    expiresAt: timestamp({ precision: 3 }),
    lastSentAt: timestamp({ precision: 3 }),
    attempts: integer().default(0).notNull(),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3 }).notNull(),
  },
  (table) => [
    uniqueIndex(
      "EmailVerificationContract_contractName_ownerId_email_key",
    ).using(
      "btree",
      table.contractName.asc().nullsLast(),
      table.ownerId.asc().nullsLast(),
      table.email.asc().nullsLast(),
    ),
    index("EmailVerificationContract_contractName_ownerId_status_idx").using(
      "btree",
      table.contractName.asc().nullsLast(),
      table.ownerId.asc().nullsLast(),
      table.status.asc().nullsLast(),
    ),
    index("EmailVerificationContract_email_idx").using(
      "btree",
      table.email.asc().nullsLast(),
    ),
  ],
);

export const Entity = pgTable("Entity", {
  unitId: uuid()
    .primaryKey()
    .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
  kind: varchar({ length: 32 }),
  verified: boolean().default(false).notNull(),
  avatar: text(),
  eligibleCreditRoles: text().array().default(sql`ARRAY[]`).notNull(),
  eligibleSubjectRoles: text().array().default(sql`ARRAY[]`).notNull(),
});

export const Feedback = pgTable(
  "Feedback",
  {
    id: uuid().default(sql`uuidv7()`).primaryKey(),
    userId: uuid().notNull(),
    url: text(),
    content: text().notNull(),
    type: FeedbackType().default("REPORT").notNull(),
    resolved: boolean().default(false).notNull(),
    resolvedAt: timestamp({ precision: 3 }),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3 }).notNull(),
    addressedUnitId: uuid(),
    targetId: varchar({ length: 128 }),
    targetKind: ModerationTargetKind(),
  },
  (table) => [
    index("Feedback_addressedUnitId_idx").using(
      "btree",
      table.addressedUnitId.asc().nullsLast(),
    ),
    index("Feedback_resolved_idx").using(
      "btree",
      table.resolved.asc().nullsLast(),
    ),
    index("Feedback_targetKind_targetId_idx").using(
      "btree",
      table.targetKind.asc().nullsLast(),
      table.targetId.asc().nullsLast(),
    ),
    index("Feedback_type_idx").using("btree", table.type.asc().nullsLast()),
    index("Feedback_userId_idx").using("btree", table.userId.asc().nullsLast()),
  ],
);

export const Game = pgTable("Game", {
  unitId: uuid()
    .primaryKey()
    .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
  releaseDate: timestamp({ precision: 3 }),
  versionLabel: text(),
  isLicensed: boolean().default(false).notNull(),
  extra: jsonb(),
  createdAt: timestamp({ precision: 3 })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp({ precision: 3 }).notNull(),
});

export const GameSystemRequirement = pgTable(
  "GameSystemRequirement",
  {
    id: uuid().default(sql`uuidv7()`).primaryKey(),
    gameUnitId: uuid()
      .notNull()
      .references(() => Game.unitId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    platformEntityId: uuid().references(() => Unit.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    tier: varchar({ length: 32 }).notNull(),
    language: varchar({ length: 16 }),
    sourceRefId: uuid().references(() => UnitExternalRef.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    hardware: jsonb().notNull(),
    rawText: text(),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3 }).notNull(),
  },
  (table) => [
    index("GameSystemRequirement_gameUnitId_idx").using(
      "btree",
      table.gameUnitId.asc().nullsLast(),
    ),
    index(
      "GameSystemRequirement_gameUnitId_platformEntityId_tier_sour_idx",
    ).using(
      "btree",
      table.gameUnitId.asc().nullsLast(),
      table.platformEntityId.asc().nullsLast(),
      table.tier.asc().nullsLast(),
      table.sourceRefId.asc().nullsLast(),
    ),
    index("GameSystemRequirement_platformEntityId_idx").using(
      "btree",
      table.platformEntityId.asc().nullsLast(),
    ),
    index("GameSystemRequirement_sourceRefId_idx").using(
      "btree",
      table.sourceRefId.asc().nullsLast(),
    ),
    index("GameSystemRequirement_tier_idx").using(
      "btree",
      table.tier.asc().nullsLast(),
    ),
  ],
);

export const HistoryOutbox = pgTable(
  "HistoryOutbox",
  {
    id: uuid().default(sql`uuidv7()`).primaryKey(),
    unitId: uuid()
      .notNull()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    sequence: bigint({ mode: "number" }).notNull(),
    actorUserId: uuid()
      .notNull()
      .references(() => User.unitId, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    category: varchar({ length: 64 }).notNull(),
    payload: jsonb().notNull(),
    payloadHash: varchar({ length: 64 }),
    status: varchar({ length: 32 }).default("pending").notNull(),
    attempts: integer().default(0).notNull(),
    nextAttemptAt: timestamp({ precision: 3 }),
    processedAt: timestamp({ precision: 3 }),
    processedById: uuid().references(() => User.unitId, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    lastError: text(),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3 }).notNull(),
  },
  (table) => [
    index("HistoryOutbox_actorUserId_createdAt_idx").using(
      "btree",
      table.actorUserId.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
    index("HistoryOutbox_processedById_idx").using(
      "btree",
      table.processedById.asc().nullsLast(),
    ),
    index("HistoryOutbox_status_nextAttemptAt_createdAt_idx").using(
      "btree",
      table.status.asc().nullsLast(),
      table.nextAttemptAt.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
    index("HistoryOutbox_unitId_createdAt_idx").using(
      "btree",
      table.unitId.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
    uniqueIndex("HistoryOutbox_unitId_sequence_key").using(
      "btree",
      table.unitId.asc().nullsLast(),
      table.sequence.asc().nullsLast(),
    ),
  ],
);

export const Jwks = pgTable(
  "Jwks",
  {
    id: text().primaryKey(),
    jwtServiceId: uuid()
      .notNull()
      .references(() => JwtService.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    publicJwk: jsonb().notNull(),
    privateJwk: jsonb().notNull(),
    alg: text(),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    expiresAt: timestamp({ precision: 3 }),
  },
  (table) => [
    index("Jwks_jwtServiceId_idx").using(
      "btree",
      table.jwtServiceId.asc().nullsLast(),
    ),
  ],
);

export const JwtService = pgTable(
  "JwtService",
  {
    id: uuid().default(sql`uuidv7()`).primaryKey(),
    serviceKey: text().notNull(),
    issuer: text().notNull(),
    audience: text().notNull(),
    jwksUrl: text().notNull(),
    jwksPath: text().notNull(),
    isLocalIssuer: boolean().default(false).notNull(),
    isActive: boolean().default(true).notNull(),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3 }).notNull(),
  },
  (table) => [
    index("JwtService_isLocalIssuer_isActive_idx").using(
      "btree",
      table.isLocalIssuer.asc().nullsLast(),
      table.isActive.asc().nullsLast(),
    ),
    uniqueIndex("JwtService_issuer_audience_key").using(
      "btree",
      table.issuer.asc().nullsLast(),
      table.audience.asc().nullsLast(),
    ),
    uniqueIndex("JwtService_serviceKey_key").using(
      "btree",
      table.serviceKey.asc().nullsLast(),
    ),
  ],
);

export const Link = pgTable("Link", {
  unitId: uuid()
    .primaryKey()
    .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
  url: text().notNull(),
  siteName: varchar({ length: 128 }),
  faviconUrl: text(),
  extra: jsonb(),
  createdAt: timestamp({ precision: 3 })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp({ precision: 3 }).notNull(),
});

export const Media = pgTable(
  "Media",
  {
    unitId: uuid()
      .primaryKey()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    kindKey: varchar({ length: 32 }).notNull(),
    releaseDate: timestamp({ precision: 3 }),
    runtimeMinutes: integer(),
    episodeCount: integer(),
    seasonCount: integer(),
    isLicensed: boolean().default(false).notNull(),
    extra: jsonb(),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3 }).notNull(),
  },
  (table) => [
    index("Media_kindKey_releaseDate_idx").using(
      "btree",
      table.kindKey.asc().nullsLast(),
      table.releaseDate.asc().nullsLast(),
    ),
  ],
);

export const ModerationAction = pgTable(
  "ModerationAction",
  {
    id: uuid().default(sql`uuidv7()`).primaryKey(),
    authority: ModerationAuthority().notNull(),
    realmUnitId: uuid().references(() => Unit.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    targetKind: ModerationTargetKind().notNull(),
    targetId: varchar({ length: 128 }).notNull(),
    targetPath: text(),
    actorKind: ModerationActorKind().default("USER").notNull(),
    actorUserId: uuid().references(() => User.unitId, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    actionKind: ModerationActionKind().notNull(),
    resultingStatus: ModerationStatus(),
    resultingLocked: boolean(),
    reasonCode: varchar({ length: 64 }).notNull(),
    reasonText: text(),
    publicMessage: text(),
    caseId: uuid().references(() => ModerationCase.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    reversesActionId: uuid(),
    requestId: varchar({ length: 128 }),
    idempotencyKey: varchar({ length: 256 }),
    importedFrom: varchar({ length: 128 }),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.reversesActionId],
      foreignColumns: [table.id],
      name: "ModerationAction_reversesActionId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("set null"),
    index("ModerationAction_actionKind_createdAt_id_idx").using(
      "btree",
      table.actionKind.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
      table.id.asc().nullsLast(),
    ),
    index("ModerationAction_actorUserId_createdAt_id_idx").using(
      "btree",
      table.actorUserId.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
      table.id.asc().nullsLast(),
    ),
    index("ModerationAction_caseId_createdAt_id_idx").using(
      "btree",
      table.caseId.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
      table.id.asc().nullsLast(),
    ),
    uniqueIndex("ModerationAction_idempotencyKey_key").using(
      "btree",
      table.idempotencyKey.asc().nullsLast(),
    ),
    index("ModerationAction_realmUnitId_createdAt_id_idx").using(
      "btree",
      table.realmUnitId.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
      table.id.asc().nullsLast(),
    ),
    index("ModerationAction_requestId_idx").using(
      "btree",
      table.requestId.asc().nullsLast(),
    ),
    index(
      "ModerationAction_targetKind_targetId_actionKind_createdAt_i_idx",
    ).using(
      "btree",
      table.targetKind.asc().nullsLast(),
      table.targetId.asc().nullsLast(),
      table.actionKind.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
      table.id.asc().nullsLast(),
    ),
    index("ModerationAction_targetKind_targetId_createdAt_id_idx").using(
      "btree",
      table.targetKind.asc().nullsLast(),
      table.targetId.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
      table.id.asc().nullsLast(),
    ),
  ],
);

export const ModerationCase = pgTable(
  "ModerationCase",
  {
    id: uuid().default(sql`uuidv7()`).primaryKey(),
    state: ModerationCaseState().default("NEW").notNull(),
    severity: varchar({ length: 32 }),
    reporterUserId: uuid().references(() => User.unitId, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    subjectUserId: uuid().references(() => User.unitId, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    targetId: varchar({ length: 128 }).notNull(),
    addressedUnitId: uuid().references(() => Unit.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    realmUnitId: uuid().references(() => Unit.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    sourceFeedbackId: uuid().references(() => Feedback.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    assignedToUserId: uuid().references(() => User.unitId, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    duplicateOfCaseId: uuid(),
    reason: text(),
    safeSummary: text(),
    metadata: jsonb(),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3 }).notNull(),
    parentCaseId: uuid(),
    scope: ModerationScope().default("PLATFORM").notNull(),
    targetKind: ModerationTargetKind().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.duplicateOfCaseId],
      foreignColumns: [table.id],
      name: "ModerationCase_duplicateOfCaseId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("set null"),
    foreignKey({
      columns: [table.parentCaseId],
      foreignColumns: [table.id],
      name: "ModerationCase_parentCaseId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("set null"),
    index("ModerationCase_addressedUnitId_state_idx").using(
      "btree",
      table.addressedUnitId.asc().nullsLast(),
      table.state.asc().nullsLast(),
    ),
    index("ModerationCase_assignedToUserId_state_createdAt_idx").using(
      "btree",
      table.assignedToUserId.asc().nullsLast(),
      table.state.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
    index("ModerationCase_duplicateOfCaseId_idx").using(
      "btree",
      table.duplicateOfCaseId.asc().nullsLast(),
    ),
    index("ModerationCase_parentCaseId_idx").using(
      "btree",
      table.parentCaseId.asc().nullsLast(),
    ),
    index("ModerationCase_realmUnitId_state_createdAt_idx").using(
      "btree",
      table.realmUnitId.asc().nullsLast(),
      table.state.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
    index("ModerationCase_reporterUserId_createdAt_idx").using(
      "btree",
      table.reporterUserId.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
    index("ModerationCase_scope_state_createdAt_idx").using(
      "btree",
      table.scope.asc().nullsLast(),
      table.state.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
    index("ModerationCase_sourceFeedbackId_idx").using(
      "btree",
      table.sourceFeedbackId.asc().nullsLast(),
    ),
    index("ModerationCase_state_severity_createdAt_idx").using(
      "btree",
      table.state.asc().nullsLast(),
      table.severity.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
    index("ModerationCase_subjectUserId_state_createdAt_idx").using(
      "btree",
      table.subjectUserId.asc().nullsLast(),
      table.state.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
    index("ModerationCase_targetKind_targetId_idx").using(
      "btree",
      table.targetKind.asc().nullsLast(),
      table.targetId.asc().nullsLast(),
    ),
  ],
);

export const Poll = pgTable("Poll", {
  unitId: uuid()
    .primaryKey()
    .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
  voteMode: PollVoteMode().default("SINGLE").notNull(),
  resultVisibility: PollResultVisibility().default("LIVE").notNull(),
  anonymous: boolean().default(false).notNull(),
  closesAt: timestamp({ precision: 3 }),
  createdAt: timestamp({ precision: 3 })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp({ precision: 3 }).notNull(),
  usageCount: integer().default(0).notNull(),
});

export const PollOption = pgTable(
  "PollOption",
  {
    pollUnitId: uuid()
      .notNull()
      .references(() => Poll.unitId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    optionId: uuid().default(sql`uuidv7()`).notNull(),
    position: varchar({ length: 64 }).notNull(),
    voteCount: integer().default(0).notNull(),
    label: text(),
    unitId: uuid().references(() => Unit.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3 }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.pollUnitId, table.optionId],
      name: "PollOption_pkey",
    }),
    index("PollOption_pollUnitId_position_idx").using(
      "btree",
      table.pollUnitId.asc().nullsLast(),
      table.position.asc().nullsLast(),
    ),
    index("PollOption_unitId_idx").using(
      "btree",
      table.unitId.asc().nullsLast(),
    ),
  ],
);

export const PollVote = pgTable(
  "PollVote",
  {
    pollUnitId: uuid()
      .notNull()
      .references(() => Poll.unitId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    userId: uuid().notNull(),
    optionId: uuid().notNull(),
    voteMode: PollVoteMode().notNull(),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    id: uuid().default(sql`uuidv7()`).primaryKey(),
    realmUnitId: uuid(),
  },
  (table) => [
    foreignKey({
      columns: [table.pollUnitId, table.optionId],
      foreignColumns: [PollOption.pollUnitId, PollOption.optionId],
      name: "PollVote_pollUnitId_optionId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    index("PollVote_pollUnitId_optionId_idx").using(
      "btree",
      table.pollUnitId.asc().nullsLast(),
      table.optionId.asc().nullsLast(),
    ),
    index("PollVote_pollUnitId_realmUnitId_optionId_idx").using(
      "btree",
      table.pollUnitId.asc().nullsLast(),
      table.realmUnitId.asc().nullsLast(),
      table.optionId.asc().nullsLast(),
    ),
    index("PollVote_pollUnitId_userId_idx").using(
      "btree",
      table.pollUnitId.asc().nullsLast(),
      table.userId.asc().nullsLast(),
    ),
    uniqueIndex("PollVote_pollUnitId_userId_optionId_key").using(
      "btree",
      table.pollUnitId.asc().nullsLast(),
      table.userId.asc().nullsLast(),
      table.optionId.asc().nullsLast(),
    ),
    uniqueIndex("PollVote_single_choice_uniq")
      .using(
        "btree",
        table.pollUnitId.asc().nullsLast(),
        table.userId.asc().nullsLast(),
      )
      .where(sql`("voteMode" = 'SINGLE'::"PollVoteMode")`),
    index("PollVote_userId_idx").using("btree", table.userId.asc().nullsLast()),
  ],
);

export const Post = pgTable(
  "Post",
  {
    unitId: uuid()
      .primaryKey()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    authorUserId: uuid().notNull(),
    scoreEntryId: uuid().references(() => ScoreEntry.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    kind: PostKind(),
    replyCount: integer().default(0).notNull(),
    directReplyCount: integer().default(0).notNull(),
    lastReplyAt: timestamp({ precision: 3 }),
    isLocked: boolean().default(false).notNull(),
    extra: jsonb(),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3 }).notNull(),
    state: text(),
    variantUnitId: uuid(),
  },
  (table) => [
    index("Post_authorUserId_createdAt_idx").using(
      "btree",
      table.authorUserId.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
    index("Post_kind_createdAt_idx").using(
      "btree",
      table.kind.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
    index("Post_scoreEntryId_idx").using(
      "btree",
      table.scoreEntryId.asc().nullsLast(),
    ),
    index("Post_variantUnitId_idx").using(
      "btree",
      table.variantUnitId.asc().nullsLast(),
    ),
  ],
);

export const PostPollReference = pgTable(
  "PostPollReference",
  {
    postUnitId: uuid().notNull(),
    pollUnitId: uuid().notNull(),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3 }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.postUnitId, table.pollUnitId],
      name: "PostPollReference_pkey",
    }),
    index("PostPollReference_pollUnitId_idx").using(
      "btree",
      table.pollUnitId.asc().nullsLast(),
    ),
    index("PostPollReference_postUnitId_idx").using(
      "btree",
      table.postUnitId.asc().nullsLast(),
    ),
  ],
);

export const Realm = pgTable("Realm", {
  unitId: uuid()
    .primaryKey()
    .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
  isPublic: boolean().default(true).notNull(),
  isOfficial: boolean().default(false).notNull(),
  memberCount: integer().default(0).notNull(),
  extra: jsonb(),
  createdAt: timestamp({ precision: 3 })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp({ precision: 3 }).notNull(),
  ruleVersion: integer().default(1).notNull(),
  ruleRequireOnJoin: boolean().default(false).notNull(),
  ruleRequireOnPost: boolean().default(false).notNull(),
  ruleRequireOnUpdate: boolean().default(true).notNull(),
  rulePolicyUpdatedAt: timestamp({ precision: 3 }),
  joinRequiresApproval: boolean().default(false).notNull(),
  contentRequiresApproval: boolean().default(false).notNull(),
});

export const RealmCapabilityGrant = pgTable(
  "RealmCapabilityGrant",
  {
    id: uuid().default(sql`uuidv7()`).primaryKey(),
    realmUnitId: uuid()
      .notNull()
      .references(() => Realm.unitId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    userId: uuid().notNull(),
    capability: varchar({ length: 96 }).notNull(),
    state: GovernanceGrantState().default("ACTIVE").notNull(),
    grantedById: uuid()
      .notNull()
      .references(() => User.unitId, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    revokedById: uuid().references(() => User.unitId, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    expiresAt: timestamp({ precision: 3 }),
    revokedAt: timestamp({ precision: 3 }),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3 }).notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.realmUnitId, table.userId],
      foreignColumns: [RealmMember.realmUnitId, RealmMember.userId],
      name: "RealmCapabilityGrant_realmUnitId_userId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    index("RealmCapabilityGrant_grantedById_createdAt_idx").using(
      "btree",
      table.grantedById.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
    index("RealmCapabilityGrant_realmUnitId_capability_state_idx").using(
      "btree",
      table.realmUnitId.asc().nullsLast(),
      table.capability.asc().nullsLast(),
      table.state.asc().nullsLast(),
    ),
    index("RealmCapabilityGrant_realmUnitId_userId_state_idx").using(
      "btree",
      table.realmUnitId.asc().nullsLast(),
      table.userId.asc().nullsLast(),
      table.state.asc().nullsLast(),
    ),
    index("RealmCapabilityGrant_revokedById_idx").using(
      "btree",
      table.revokedById.asc().nullsLast(),
    ),
    index("RealmCapabilityGrant_userId_capability_state_idx").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.capability.asc().nullsLast(),
      table.state.asc().nullsLast(),
    ),
  ],
);

export const RealmMember = pgTable(
  "RealmMember",
  {
    realmUnitId: uuid()
      .notNull()
      .references(() => Realm.unitId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    userId: uuid().notNull(),
    roleKey: varchar({ length: 32 }).notNull(),
    joinedAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3 }).notNull(),
    state: RealmMemberState().default("ACTIVE").notNull(),
    onboardingCompletedAt: timestamp({ precision: 3 }),
  },
  (table) => [
    primaryKey({
      columns: [table.realmUnitId, table.userId],
      name: "RealmMember_pkey",
    }),
    index("RealmMember_realmUnitId_roleKey_idx").using(
      "btree",
      table.realmUnitId.asc().nullsLast(),
      table.roleKey.asc().nullsLast(),
    ),
    index("RealmMember_realmUnitId_state_idx").using(
      "btree",
      table.realmUnitId.asc().nullsLast(),
      table.state.asc().nullsLast(),
    ),
    index("RealmMember_userId_idx").using(
      "btree",
      table.userId.asc().nullsLast(),
    ),
  ],
);

export const RealmRuleAcknowledgement = pgTable(
  "RealmRuleAcknowledgement",
  {
    realmUnitId: uuid()
      .notNull()
      .references(() => Realm.unitId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    ruleUnitId: uuid()
      .notNull()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    version: integer().notNull(),
    userId: uuid()
      .notNull()
      .references(() => User.unitId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    acceptedLanguage: varchar({ length: 16 }),
    acceptedAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [
        table.realmUnitId,
        table.ruleUnitId,
        table.version,
        table.userId,
      ],
      name: "RealmRuleAcknowledgement_pkey",
    }),
    index("RealmRuleAcknowledgement_realmUnitId_userId_acceptedAt_idx").using(
      "btree",
      table.realmUnitId.asc().nullsLast(),
      table.userId.asc().nullsLast(),
      table.acceptedAt.asc().nullsLast(),
    ),
    index("RealmRuleAcknowledgement_userId_acceptedAt_idx").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.acceptedAt.asc().nullsLast(),
    ),
  ],
);

export const RealmTagApplication = pgTable(
  "RealmTagApplication",
  {
    realmUnitId: uuid()
      .notNull()
      .references(() => Realm.unitId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    tagUnitId: uuid()
      .notNull()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    unitId: uuid()
      .notNull()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    score: integer().default(0).notNull(),
    voteCount: integer().default(0).notNull(),
    pinned: boolean().default(false).notNull(),
    position: text(),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3 }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.realmUnitId, table.tagUnitId, table.unitId],
      name: "RealmTagApplication_pkey",
    }),
    index("RealmTagApplication_realmUnitId_unitId_idx").using(
      "btree",
      table.realmUnitId.asc().nullsLast(),
      table.unitId.asc().nullsLast(),
    ),
    index("RealmTagApplication_realmUnitId_unitId_pinned_position_idx").using(
      "btree",
      table.realmUnitId.asc().nullsLast(),
      table.unitId.asc().nullsLast(),
      table.pinned.asc().nullsLast(),
      table.position.asc().nullsLast(),
    ),
    index("RealmTagApplication_score_idx").using(
      "btree",
      table.score.asc().nullsLast(),
    ),
    index("RealmTagApplication_tagUnitId_realmUnitId_idx").using(
      "btree",
      table.tagUnitId.asc().nullsLast(),
      table.realmUnitId.asc().nullsLast(),
    ),
    index("RealmTagApplication_unitId_realmUnitId_idx").using(
      "btree",
      table.unitId.asc().nullsLast(),
      table.realmUnitId.asc().nullsLast(),
    ),
  ],
);

export const RealmTagApplicationVote = pgTable(
  "RealmTagApplicationVote",
  {
    realmUnitId: uuid().notNull(),
    tagUnitId: uuid().notNull(),
    unitId: uuid().notNull(),
    userId: uuid().notNull(),
    value: integer().notNull(),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.realmUnitId, table.tagUnitId, table.unitId, table.userId],
      name: "RealmTagApplicationVote_pkey",
    }),
    foreignKey({
      columns: [table.realmUnitId, table.tagUnitId, table.unitId],
      foreignColumns: [
        RealmTagApplication.realmUnitId,
        RealmTagApplication.tagUnitId,
        RealmTagApplication.unitId,
      ],
      name: "RealmTagApplicationVote_realmUnitId_tagUnitId_unitId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    index("RealmTagApplicationVote_userId_idx").using(
      "btree",
      table.userId.asc().nullsLast(),
    ),
  ],
);

export const RealmTagContext = pgTable(
  "RealmTagContext",
  {
    realmUnitId: uuid()
      .notNull()
      .references(() => Realm.unitId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    tagUnitId: uuid()
      .notNull()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    contextUnitId: uuid().references(() => Unit.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3 }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.realmUnitId, table.tagUnitId],
      name: "RealmTagContext_pkey",
    }),
    uniqueIndex("RealmTagContext_contextUnitId_key").using(
      "btree",
      table.contextUnitId.asc().nullsLast(),
    ),
    index("RealmTagContext_tagUnitId_idx").using(
      "btree",
      table.tagUnitId.asc().nullsLast(),
    ),
  ],
);

export const ScoreAggregate = pgTable(
  "ScoreAggregate",
  {
    unitId: uuid().notNull(),
    realm: uuid().notNull(),
    totalScore: integer().default(0).notNull(),
    totalCount: integer().default(0).notNull(),
    distribution: jsonb().notNull(),
    fields: jsonb(),
    updatedAt: timestamp({ precision: 3 }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.unitId, table.realm],
      name: "ScoreAggregate_pkey",
    }),
  ],
);

export const ScoreEntry = pgTable(
  "ScoreEntry",
  {
    id: uuid().default(sql`uuidv7()`).primaryKey(),
    userId: uuid().notNull(),
    unitId: uuid().notNull(),
    realm: uuid().notNull(),
    value: integer().notNull(),
    fields: jsonb(),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3 }).notNull(),
  },
  (table) => [
    index("ScoreEntry_unitId_realm_idx").using(
      "btree",
      table.unitId.asc().nullsLast(),
      table.realm.asc().nullsLast(),
    ),
    index("ScoreEntry_userId_unitId_idx").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.unitId.asc().nullsLast(),
    ),
    uniqueIndex("ScoreEntry_userId_unitId_realm_key").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.unitId.asc().nullsLast(),
      table.realm.asc().nullsLast(),
    ),
  ],
);

export const ScoreRealmField = pgTable(
  "ScoreRealmField",
  {
    realm: uuid().notNull(),
    key: varchar({ length: 64 }).notNull(),
    label: text(),
    sortOrder: integer().default(0).notNull(),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3 }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.realm, table.key],
      name: "ScoreRealmField_pkey",
    }),
    index("ScoreRealmField_realm_sortOrder_idx").using(
      "btree",
      table.realm.asc().nullsLast(),
      table.sortOrder.asc().nullsLast(),
    ),
  ],
);

export const Series = pgTable(
  "Series",
  {
    unitId: uuid()
      .primaryKey()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    kindKey: varchar({ length: 64 }).notNull(),
    extra: jsonb(),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3 }).notNull(),
  },
  (table) => [
    index("Series_kindKey_idx").using("btree", table.kindKey.asc().nullsLast()),
    index("Series_updatedAt_idx").using(
      "btree",
      table.updatedAt.desc().nullsFirst(),
    ),
  ],
);

export const SeriesContentIndex = pgTable(
  "SeriesContentIndex",
  {
    seriesUnitId: uuid()
      .notNull()
      .references(() => Series.unitId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    releaseUnitId: uuid()
      .notNull()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    contentNodeId: uuid()
      .notNull()
      .references(() => ContentStructureNode.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3 }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.seriesUnitId, table.releaseUnitId, table.contentNodeId],
      name: "SeriesContentIndex_pkey",
    }),
    uniqueIndex("SeriesContentIndex_contentNodeId_key").using(
      "btree",
      table.contentNodeId.asc().nullsLast(),
    ),
    index("SeriesContentIndex_releaseUnitId_seriesUnitId_idx").using(
      "btree",
      table.releaseUnitId.asc().nullsLast(),
      table.seriesUnitId.asc().nullsLast(),
    ),
    index("SeriesContentIndex_seriesUnitId_releaseUnitId_idx").using(
      "btree",
      table.seriesUnitId.asc().nullsLast(),
      table.releaseUnitId.asc().nullsLast(),
    ),
  ],
);

export const Shelf = pgTable("Shelf", {
  unitId: uuid()
    .primaryKey()
    .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
  kindKey: varchar({ length: 64 }),
  extra: jsonb(),
  itemCount: integer().default(0).notNull(),
  createdAt: timestamp({ precision: 3 })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp({ precision: 3 }).notNull(),
});

export const ShelfUnit = pgTable(
  "ShelfUnit",
  {
    shelfId: uuid()
      .notNull()
      .references(() => Shelf.unitId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    unitId: uuid().notNull(),
    kind: varchar({ length: 32 }).notNull(),
    position: varchar({ length: 64 }).notNull(),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3 }).notNull(),
    variantUnitId: uuid(),
  },
  (table) => [
    primaryKey({
      columns: [table.shelfId, table.unitId],
      name: "ShelfUnit_pkey",
    }),
    index("ShelfUnit_shelfId_position_idx").using(
      "btree",
      table.shelfId.asc().nullsLast(),
      table.position.asc().nullsLast(),
    ),
    index("ShelfUnit_variantUnitId_idx").using(
      "btree",
      table.variantUnitId.asc().nullsLast(),
    ),
  ],
);

export const ShelfUnitRelation = pgTable(
  "ShelfUnitRelation",
  {
    shelfId: uuid()
      .notNull()
      .references(() => Shelf.unitId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    parentUnitId: uuid().notNull(),
    childUnitId: uuid().notNull(),
    role: varchar({ length: 32 }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [
        table.shelfId,
        table.parentUnitId,
        table.childUnitId,
        table.role,
      ],
      name: "ShelfUnitRelation_pkey",
    }),
    foreignKey({
      columns: [table.shelfId, table.childUnitId],
      foreignColumns: [ShelfUnit.shelfId, ShelfUnit.unitId],
      name: "ShelfUnitRelation_shelfId_childUnitId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.shelfId, table.parentUnitId],
      foreignColumns: [ShelfUnit.shelfId, ShelfUnit.unitId],
      name: "ShelfUnitRelation_shelfId_parentUnitId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    index("ShelfUnitRelation_childUnitId_role_idx").using(
      "btree",
      table.childUnitId.asc().nullsLast(),
      table.role.asc().nullsLast(),
    ),
    index("ShelfUnitRelation_parentUnitId_role_idx").using(
      "btree",
      table.parentUnitId.asc().nullsLast(),
      table.role.asc().nullsLast(),
    ),
    index("ShelfUnitRelation_shelfId_childUnitId_idx").using(
      "btree",
      table.shelfId.asc().nullsLast(),
      table.childUnitId.asc().nullsLast(),
    ),
    index("ShelfUnitRelation_shelfId_parentUnitId_role_idx").using(
      "btree",
      table.shelfId.asc().nullsLast(),
      table.parentUnitId.asc().nullsLast(),
      table.role.asc().nullsLast(),
    ),
  ],
);

export const SlugScope = pgTable(
  "SlugScope",
  {
    slug: text().primaryKey(),
    unitId: uuid().notNull(),
  },
  (table) => [
    uniqueIndex("SlugScope_unitId_key").using(
      "btree",
      table.unitId.asc().nullsLast(),
    ),
  ],
);

export const SourceSite = pgTable(
  "SourceSite",
  {
    entityUnitId: uuid()
      .primaryKey()
      .references(() => Entity.unitId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    key: varchar({ length: 64 }).notNull(),
    crawlSupport: varchar({ length: 32 }).notNull(),
    crawlEnabled: boolean().default(false).notNull(),
    crawlerAdapterKey: varchar({ length: 64 }),
    refRules: jsonb().notNull(),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3 }).notNull(),
  },
  (table) => [
    index("SourceSite_crawlSupport_crawlEnabled_idx").using(
      "btree",
      table.crawlSupport.asc().nullsLast(),
      table.crawlEnabled.asc().nullsLast(),
    ),
    uniqueIndex("SourceSite_key_key").using(
      "btree",
      table.key.asc().nullsLast(),
    ),
  ],
);

export const StaffAuditLog = pgTable(
  "StaffAuditLog",
  {
    id: uuid().default(sql`uuidv7()`).primaryKey(),
    actorUserId: uuid()
      .notNull()
      .references(() => User.unitId, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    action: varchar({ length: 128 }).notNull(),
    targetKind: varchar({ length: 64 }).notNull(),
    targetId: varchar({ length: 128 }).notNull(),
    decisionCode: varchar({ length: 64 }).notNull(),
    requestId: varchar({ length: 128 }),
    reason: text().notNull(),
    metadata: jsonb(),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("StaffAuditLog_action_createdAt_idx").using(
      "btree",
      table.action.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
    index("StaffAuditLog_actorUserId_createdAt_idx").using(
      "btree",
      table.actorUserId.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
    index("StaffAuditLog_decisionCode_createdAt_idx").using(
      "btree",
      table.decisionCode.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
    index("StaffAuditLog_requestId_idx").using(
      "btree",
      table.requestId.asc().nullsLast(),
    ),
    index("StaffAuditLog_targetKind_targetId_createdAt_idx").using(
      "btree",
      table.targetKind.asc().nullsLast(),
      table.targetId.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
  ],
);

export const StaffGrant = pgTable(
  "StaffGrant",
  {
    id: uuid().default(sql`uuidv7()`).primaryKey(),
    userId: uuid()
      .notNull()
      .references(() => User.unitId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    capability: varchar({ length: 96 }).notNull(),
    scopeKind: varchar({ length: 32 }).default("global").notNull(),
    realmUnitId: uuid().references(() => Unit.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    state: GovernanceGrantState().default("ACTIVE").notNull(),
    grantedById: uuid()
      .notNull()
      .references(() => User.unitId, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    revokedById: uuid().references(() => User.unitId, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    expiresAt: timestamp({ precision: 3 }),
    revokedAt: timestamp({ precision: 3 }),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3 }).notNull(),
  },
  (table) => [
    index("StaffGrant_capability_scopeKind_realmUnitId_idx").using(
      "btree",
      table.capability.asc().nullsLast(),
      table.scopeKind.asc().nullsLast(),
      table.realmUnitId.asc().nullsLast(),
    ),
    index("StaffGrant_grantedById_createdAt_idx").using(
      "btree",
      table.grantedById.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
    index("StaffGrant_revokedById_idx").using(
      "btree",
      table.revokedById.asc().nullsLast(),
    ),
    index("StaffGrant_userId_state_expiresAt_idx").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.state.asc().nullsLast(),
      table.expiresAt.asc().nullsLast(),
    ),
  ],
);

export const SubjectAttribution = pgTable(
  "SubjectAttribution",
  {
    unitId: uuid()
      .notNull()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    entityId: uuid()
      .notNull()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    role: varchar({ length: 64 }).notNull(),
    sortOrder: integer().default(0).notNull(),
    weight: doublePrecision(),
  },
  (table) => [
    primaryKey({
      columns: [table.unitId, table.entityId, table.role],
      name: "SubjectAttribution_pkey",
    }),
    index("SubjectAttribution_entityId_role_sortOrder_idx").using(
      "btree",
      table.entityId.asc().nullsLast(),
      table.role.asc().nullsLast(),
      table.sortOrder.asc().nullsLast(),
    ),
    index("SubjectAttribution_entityId_sortOrder_idx").using(
      "btree",
      table.entityId.asc().nullsLast(),
      table.sortOrder.asc().nullsLast(),
    ),
    index("SubjectAttribution_unitId_role_sortOrder_idx").using(
      "btree",
      table.unitId.asc().nullsLast(),
      table.role.asc().nullsLast(),
      table.sortOrder.asc().nullsLast(),
    ),
  ],
);

export const Subscription = pgTable(
  "Subscription",
  {
    id: uuid().default(sql`uuidv7()`).primaryKey(),
    subscriberUnitId: uuid()
      .notNull()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    subscribedUnitId: uuid()
      .notNull()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    channels: text().array(),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3 }).notNull(),
  },
  (table) => [
    index("subscription_channels_gin").using(
      "gin",
      table.channels.asc().nullsLast(),
    ),
    index("Subscription_subscribedUnitId_idx").using(
      "btree",
      table.subscribedUnitId.asc().nullsLast(),
    ),
    index("Subscription_subscriberUnitId_idx").using(
      "btree",
      table.subscriberUnitId.asc().nullsLast(),
    ),
    uniqueIndex("Subscription_subscriberUnitId_subscribedUnitId_key").using(
      "btree",
      table.subscriberUnitId.asc().nullsLast(),
      table.subscribedUnitId.asc().nullsLast(),
    ),
  ],
);

export const TagVote = pgTable(
  "TagVote",
  {
    userId: uuid().notNull(),
    unitId: uuid()
      .notNull()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    tagUnitId: uuid()
      .notNull()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    value: integer().notNull(),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.userId, table.unitId, table.tagUnitId],
      name: "TagVote_pkey",
    }),
    index("TagVote_unitId_tagUnitId_idx").using(
      "btree",
      table.unitId.asc().nullsLast(),
      table.tagUnitId.asc().nullsLast(),
    ),
  ],
);

export const Unit = pgTable(
  "Unit",
  {
    id: uuid().default(sql`uuidv7()`).primaryKey(),
    type: UnitType().notNull(),
    slug: text(),
    slugScope: uuid().notNull(),
    userId: uuid().references(() => User.unitId, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    defaultLanguage: varchar({ length: 16 }),
    isLanguageNeutral: boolean().default(false).notNull(),
    status: UnitStatus().default("DRAFT").notNull(),
    visibility: UnitVisibility().default("PUBLIC").notNull(),
    rating: ContentRating().default("GENERAL").notNull(),
    extra: jsonb(),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3 }).notNull(),
    publishedAt: timestamp({ precision: 3 }),
    subscriberCount: integer().default(0).notNull(),
    licenseSlug: text(),
    aiDisclosureMode: AiDisclosureMode().default("UNKNOWN").notNull(),
    aiDisclosureDetails: jsonb(),
    catalogEntryKind: CatalogEntryKind(),
    targetUnitId: uuid(),
    moderationStatus: ModerationStatus().default("APPROVED").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.targetUnitId],
      foreignColumns: [table.id],
      name: "Unit_targetUnitId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("set null"),
    index("Unit_catalogEntryKind_targetUnitId_idx").using(
      "btree",
      table.catalogEntryKind.asc().nullsLast(),
      table.targetUnitId.asc().nullsLast(),
    ),
    index("Unit_defaultLanguage_idx").using(
      "btree",
      table.defaultLanguage.asc().nullsLast(),
    ),
    index("Unit_moderationStatus_idx").using(
      "btree",
      table.moderationStatus.asc().nullsLast(),
    ),
    uniqueIndex("Unit_slugScope_slug_key").using(
      "btree",
      table.slugScope.asc().nullsLast(),
      table.slug.asc().nullsLast(),
    ),
    index("Unit_slugScope_type_idx").using(
      "btree",
      table.slugScope.asc().nullsLast(),
      table.type.asc().nullsLast(),
    ),
    index("Unit_status_visibility_idx").using(
      "btree",
      table.status.asc().nullsLast(),
      table.visibility.asc().nullsLast(),
    ),
    index("Unit_targetUnitId_idx").using(
      "btree",
      table.targetUnitId.asc().nullsLast(),
    ),
    index("Unit_type_status_createdAt_idx").using(
      "btree",
      table.type.asc().nullsLast(),
      table.status.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
    index("Unit_userId_createdAt_idx").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
    check(
      "Unit_series_catalogEntryKind_check",
      sql`((type <> 'SERIES'::"UnitType") OR ("catalogEntryKind" IS NULL))`,
    ),
    check(
      "Unit_variant_targetUnitId_check",
      sql`(("catalogEntryKind" <> 'VARIANT'::"CatalogEntryKind") OR ("targetUnitId" IS NOT NULL))`,
    ),
  ],
);

export const UnitAlias = pgTable(
  "UnitAlias",
  {
    id: uuid().default(sql`uuidv7()`).primaryKey(),
    unitId: uuid()
      .notNull()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    value: text().notNull(),
    normalizedValue: text().notNull(),
    language: varchar({ length: 16 }),
    kind: UnitAliasKind().default("COMMON").notNull(),
    status: UnitAliasStatus().default("ACTIVE").notNull(),
    score: integer().default(0).notNull(),
    voteCount: integer().default(0).notNull(),
    pinned: boolean().default(false).notNull(),
    position: text(),
    createdById: uuid().references(() => User.unitId, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    updatedById: uuid().references(() => User.unitId, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3 }).notNull(),
  },
  (table) => [
    index("UnitAlias_createdById_createdAt_idx").using(
      "btree",
      table.createdById.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
    index("UnitAlias_normalizedValue_idx").using(
      "btree",
      table.normalizedValue.asc().nullsLast(),
    ),
    index("UnitAlias_status_score_idx").using(
      "btree",
      table.status.asc().nullsLast(),
      table.score.asc().nullsLast(),
    ),
    uniqueIndex("UnitAlias_unitId_normalizedValue_key").using(
      "btree",
      table.unitId.asc().nullsLast(),
      table.normalizedValue.asc().nullsLast(),
    ),
    index("UnitAlias_unitId_pinned_position_idx").using(
      "btree",
      table.unitId.asc().nullsLast(),
      table.pinned.asc().nullsLast(),
      table.position.asc().nullsLast(),
    ),
    index("UnitAlias_unitId_status_score_idx").using(
      "btree",
      table.unitId.asc().nullsLast(),
      table.status.asc().nullsLast(),
      table.score.asc().nullsLast(),
    ),
  ],
);

export const UnitAliasVote = pgTable(
  "UnitAliasVote",
  {
    aliasId: uuid()
      .notNull()
      .references(() => UnitAlias.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    userId: uuid()
      .notNull()
      .references(() => User.unitId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    value: integer().notNull(),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3 }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.aliasId, table.userId],
      name: "UnitAliasVote_pkey",
    }),
    index("UnitAliasVote_userId_idx").using(
      "btree",
      table.userId.asc().nullsLast(),
    ),
  ],
);

export const UnitCollaborator = pgTable(
  "UnitCollaborator",
  {
    unitId: uuid()
      .notNull()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    userId: uuid()
      .notNull()
      .references(() => User.unitId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    roleKey: varchar({ length: 32 }).notNull(),
    addedById: uuid()
      .notNull()
      .references(() => User.unitId, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.unitId, table.userId],
      name: "UnitCollaborator_pkey",
    }),
    index("UnitCollaborator_unitId_roleKey_idx").using(
      "btree",
      table.unitId.asc().nullsLast(),
      table.roleKey.asc().nullsLast(),
    ),
    index("UnitCollaborator_userId_roleKey_idx").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.roleKey.asc().nullsLast(),
    ),
  ],
);

export const UnitExternalRef = pgTable(
  "UnitExternalRef",
  {
    id: uuid().default(sql`uuidv7()`).primaryKey(),
    unitId: uuid()
      .notNull()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    sourceSiteEntityUnitId: uuid()
      .notNull()
      .references(() => SourceSite.entityUnitId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    externalKind: varchar({ length: 64 }).notNull(),
    externalId: text().notNull(),
    canonicalUrl: text().notNull(),
    originalUrl: text(),
    firstSeenAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    lastSeenAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3 }).notNull(),
  },
  (table) => [
    uniqueIndex(
      "UnitExternalRef_sourceSiteEntityUnitId_externalKind_externa_key",
    ).using(
      "btree",
      table.sourceSiteEntityUnitId.asc().nullsLast(),
      table.externalKind.asc().nullsLast(),
      table.externalId.asc().nullsLast(),
    ),
    index("UnitExternalRef_sourceSiteEntityUnitId_externalKind_idx").using(
      "btree",
      table.sourceSiteEntityUnitId.asc().nullsLast(),
      table.externalKind.asc().nullsLast(),
    ),
    index(
      "UnitExternalRef_unitId_sourceSiteEntityUnitId_externalKind_idx",
    ).using(
      "btree",
      table.unitId.asc().nullsLast(),
      table.sourceSiteEntityUnitId.asc().nullsLast(),
      table.externalKind.asc().nullsLast(),
    ),
  ],
);

export const UnitFieldLock = pgTable(
  "UnitFieldLock",
  {
    unitId: uuid()
      .notNull()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    path: varchar({ length: 256 }).notNull(),
    lockedById: uuid()
      .notNull()
      .references(() => User.unitId, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    reason: text(),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.unitId, table.path],
      name: "UnitFieldLock_pkey",
    }),
    index("UnitFieldLock_lockedById_createdAt_idx").using(
      "btree",
      table.lockedById.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
  ],
);

export const UnitHistoryClock = pgTable("UnitHistoryClock", {
  unitId: uuid()
    .primaryKey()
    .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
  nextSequence: bigint({ mode: "number" }).default(1).notNull(),
  updatedAt: timestamp({ precision: 3 }).notNull(),
});

export const UnitRealm = pgTable(
  "UnitRealm",
  {
    realmUnitId: uuid()
      .notNull()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    unitId: uuid()
      .notNull()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    isLocked: boolean().default(false).notNull(),
    moderationStatus: ModerationStatus().default("APPROVED").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.realmUnitId, table.unitId],
      name: "UnitRealm_pkey",
    }),
    index("UnitRealm_realmUnitId_createdAt_idx").using(
      "btree",
      table.realmUnitId.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
    index("UnitRealm_realmUnitId_moderationStatus_createdAt_idx").using(
      "btree",
      table.realmUnitId.asc().nullsLast(),
      table.moderationStatus.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
    index(
      "UnitRealm_realmUnitId_moderationStatus_isLocked_createdAt_idx",
    ).using(
      "btree",
      table.realmUnitId.asc().nullsLast(),
      table.moderationStatus.asc().nullsLast(),
      table.isLocked.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
    index("UnitRealm_unitId_idx").using(
      "btree",
      table.unitId.asc().nullsLast(),
    ),
  ],
);

export const UnitSupportLanguage = pgTable(
  "UnitSupportLanguage",
  {
    unitId: uuid()
      .notNull()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    language: varchar({ length: 16 }).notNull(),
    isPrimary: boolean().default(false).notNull(),
    sortOrder: integer().default(0).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.unitId, table.language],
      name: "UnitSupportLanguage_pkey",
    }),
    index("UnitSupportLanguage_language_unitId_idx").using(
      "btree",
      table.language.asc().nullsLast(),
      table.unitId.asc().nullsLast(),
    ),
  ],
);

export const UnitTag = pgTable(
  "UnitTag",
  {
    unitId: uuid()
      .notNull()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    tagUnitId: uuid()
      .notNull()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    score: integer().default(0).notNull(),
    voteCount: integer().default(0).notNull(),
    pinned: boolean().default(false).notNull(),
    position: text(),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3 }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.unitId, table.tagUnitId],
      name: "UnitTag_pkey",
    }),
    index("UnitTag_tagUnitId_score_idx").using(
      "btree",
      table.tagUnitId.asc().nullsLast(),
      table.score.asc().nullsLast(),
    ),
    index("UnitTag_unitId_pinned_position_idx").using(
      "btree",
      table.unitId.asc().nullsLast(),
      table.pinned.asc().nullsLast(),
      table.position.asc().nullsLast(),
    ),
    index("UnitTag_unitId_score_idx").using(
      "btree",
      table.unitId.asc().nullsLast(),
      table.score.asc().nullsLast(),
    ),
  ],
);

export const UnitTranslation = pgTable(
  "UnitTranslation",
  {
    unitId: uuid()
      .notNull()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    language: varchar({ length: 16 }).notNull(),
    title: text(),
    subtitle: text(),
    summary: text(),
    description: jsonb(),
    extra: jsonb(),
    sourceUnitId: uuid(),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3 }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.unitId, table.language],
      name: "UnitTranslation_pkey",
    }),
    index("UnitTranslation_language_title_idx").using(
      "btree",
      table.language.asc().nullsLast(),
      table.title.asc().nullsLast(),
    ),
  ],
);

export const User = pgTable(
  "User",
  {
    unitId: uuid().primaryKey(),
    authUserId: uuid(),
    email: varchar({ length: 320 }),
    name: text(),
    avatar: text(),
    bio: text(),
    description: jsonb(),
    joinDate: timestamp({ precision: 3 }),
    permission: jsonb(),
    followersCount: integer().default(0).notNull(),
    followingsCount: integer().default(0).notNull(),
    settings: jsonb(),
    extra: jsonb(),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3 }).notNull(),
  },
  (table) => [
    uniqueIndex("User_authUserId_key").using(
      "btree",
      table.authUserId.asc().nullsLast(),
    ),
    index("User_email_idx").using("btree", table.email.asc().nullsLast()),
  ],
);

export const UserBlock = pgTable(
  "UserBlock",
  {
    id: uuid().default(sql`uuidv7()`).primaryKey(),
    blockerId: uuid().notNull(),
    blockedId: uuid().notNull(),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("UserBlock_blockedId_idx").using(
      "btree",
      table.blockedId.asc().nullsLast(),
    ),
    uniqueIndex("UserBlock_blockerId_blockedId_key").using(
      "btree",
      table.blockerId.asc().nullsLast(),
      table.blockedId.asc().nullsLast(),
    ),
    index("UserBlock_blockerId_idx").using(
      "btree",
      table.blockerId.asc().nullsLast(),
    ),
  ],
);

export const UserContentNodeProgress = pgTable(
  "UserContentNodeProgress",
  {
    userId: uuid()
      .notNull()
      .references(() => User.unitId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    nodeId: uuid()
      .notNull()
      .references(() => ContentStructureNode.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    completedAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.userId, table.nodeId],
      name: "UserContentNodeProgress_pkey",
    }),
    index("UserContentNodeProgress_nodeId_idx").using(
      "btree",
      table.nodeId.asc().nullsLast(),
    ),
  ],
);

export const UserTagApplication = pgTable(
  "UserTagApplication",
  {
    userId: uuid()
      .notNull()
      .references(() => User.unitId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    unitId: uuid()
      .notNull()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    tagUnitId: uuid()
      .notNull()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    position: text(),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3 }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.userId, table.unitId, table.tagUnitId],
      name: "UserTagApplication_pkey",
    }),
    index("UserTagApplication_userId_tagUnitId_unitId_idx").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.tagUnitId.asc().nullsLast(),
      table.unitId.asc().nullsLast(),
    ),
    index("UserTagApplication_userId_unitId_idx").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.unitId.asc().nullsLast(),
    ),
    index("UserTagApplication_userId_unitId_position_idx").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.unitId.asc().nullsLast(),
      table.position.asc().nullsLast(),
    ),
  ],
);

export const UserUnitCollection = pgTable(
  "UserUnitCollection",
  {
    userId: uuid()
      .notNull()
      .references(() => User.unitId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    unitId: uuid()
      .notNull()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    searchText: text(),
    createdAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3 }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.userId, table.unitId],
      name: "UserUnitCollection_pkey",
    }),
    index("UserUnitCollection_unitId_idx").using(
      "btree",
      table.unitId.asc().nullsLast(),
    ),
    index("UserUnitCollection_userId_updatedAt_idx").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.updatedAt.asc().nullsLast(),
    ),
  ],
);

export const UserUnitProgress = pgTable(
  "UserUnitProgress",
  {
    userId: uuid()
      .notNull()
      .references(() => User.unitId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    unitId: uuid()
      .notNull()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    progress: doublePrecision().default(0).notNull(),
    status: UserUnitProgressStatus().default("BACKLOG").notNull(),
    isDeleted: boolean().default(false).notNull(),
    completedCount: integer().default(0).notNull(),
    totalTimeMs: bigint({ mode: "number" }).default(0).notNull(),
    extra: jsonb(),
    firstSeenAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    lastSeenAt: timestamp({ precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    lastReadNodeId: uuid().references(() => ContentStructureNode.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    lastReadAnchor: jsonb(),
  },
  (table) => [
    primaryKey({
      columns: [table.userId, table.unitId],
      name: "UserUnitProgress_pkey",
    }),
    index("UserUnitProgress_lastReadNodeId_idx").using(
      "btree",
      table.lastReadNodeId.asc().nullsLast(),
    ),
    index("UserUnitProgress_unitId_status_idx").using(
      "btree",
      table.unitId.asc().nullsLast(),
      table.status.asc().nullsLast(),
    ),
    index("UserUnitProgress_userId_isDeleted_lastSeenAt_idx").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.isDeleted.asc().nullsLast(),
      table.lastSeenAt.desc().nullsFirst(),
    ),
    index("UserUnitProgress_userId_lastSeenAt_idx").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.lastSeenAt.desc().nullsFirst(),
    ),
  ],
);

export const Zone = pgTable("Zone", {
  unitId: uuid()
    .primaryKey()
    .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
  filters: jsonb().notNull(),
  template: varchar({ length: 64 }).notNull(),
  styling: jsonb(),
  startsAt: timestamp({ precision: 3 }),
  endsAt: timestamp({ precision: 3 }),
  createdAt: timestamp({ precision: 3 })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp({ precision: 3 }).notNull(),
  wiki: jsonb(),
});
