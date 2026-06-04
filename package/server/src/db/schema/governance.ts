import {
  boolean,
  foreignKey,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { Unit } from "./catalog";
import { Feedback } from "./engagement";
import {
  AccountEnforcementKind,
  AccountEnforcementState,
  GovernanceGrantState,
  ModerationActionKind,
  ModerationActorKind,
  ModerationAuthority,
  ModerationCaseState,
  ModerationScope,
  ModerationStatus,
  ModerationTargetKind,
} from "./enums";
import { User } from "./identity";

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
