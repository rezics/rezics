import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import * as publicSchema from ".";
import * as schema from "./schema";

const expectedSchemaExports = [
  "AccountEnforcement",
  "AccountEnforcementKind",
  "AccountEnforcementState",
  "AiDisclosureMode",
  "ApiToken",
  "Book",
  "CatalogEntryKind",
  "Comment",
  "CommentPromotion",
  "ContentRating",
  "ContentStructure",
  "ContentStructureAnchor",
  "ContentStructureNode",
  "ContentTranslation",
  "ContentTranslationStatus",
  "CreditAttribution",
  "CreditAttributionEvidence",
  "EchoKV",
  "EmailVerificationContract",
  "EmailVerificationContractStatus",
  "Entity",
  "Feedback",
  "FeedbackType",
  "Game",
  "GameSystemRequirement",
  "GovernanceGrantState",
  "HistoryOutbox",
  "Jwks",
  "JwtService",
  "Link",
  "Media",
  "ModerationAction",
  "ModerationActionKind",
  "ModerationActorKind",
  "ModerationAuthority",
  "ModerationCase",
  "ModerationCaseState",
  "ModerationScope",
  "ModerationStatus",
  "ModerationTargetKind",
  "PinKind",
  "Poll",
  "PollOption",
  "PollResultVisibility",
  "PollVote",
  "PollVoteMode",
  "Post",
  "PostKind",
  "PostPollReference",
  "Realm",
  "RealmCapabilityGrant",
  "RealmMember",
  "RealmMemberState",
  "RealmRuleAcknowledgement",
  "RealmTagApplication",
  "RealmTagApplicationVote",
  "RealmTagContext",
  "ScoreAggregate",
  "ScoreEntry",
  "ScoreRealmField",
  "Series",
  "SeriesContentIndex",
  "Shelf",
  "ShelfUnit",
  "ShelfUnitRelation",
  "SlugScope",
  "SourceSite",
  "StaffAuditLog",
  "StaffGrant",
  "SubjectAttribution",
  "Subscription",
  "TagVote",
  "Unit",
  "UnitAlias",
  "UnitAliasKind",
  "UnitAliasStatus",
  "UnitAliasVote",
  "UnitCollaborator",
  "UnitExternalRef",
  "UnitFieldLock",
  "UnitHistoryClock",
  "UnitRealm",
  "UnitStatus",
  "UnitSupportLanguage",
  "UnitTag",
  "UnitTranslation",
  "UnitType",
  "UnitVisibility",
  "User",
  "UserBlock",
  "UserContentNodeProgress",
  "UserTagApplication",
  "UserUnitCollection",
  "UserUnitProgress",
  "UserUnitProgressStatus",
  "Zone",
  "createdAt",
  "jsonData",
  "ltree",
  "nullableTimestamp",
  "pgEnumName",
  "post_path_label_seq",
  "textArray",
  "timestampMs",
  "timestamps",
  "updatedAt",
  "uuidv7",
  "uuidv7PrimaryKey",
] as const;

const schemaDir = import.meta.dir;
const compositeForeignKeys = [
  {
    file: "shelf.ts",
    constraintName: "ShelfUnitRelation_shelfId_childUnitId_fkey",
  },
  {
    file: "shelf.ts",
    constraintName: "ShelfUnitRelation_shelfId_parentUnitId_fkey",
  },
  {
    file: "realm.ts",
    constraintName: "RealmCapabilityGrant_realmUnitId_userId_fkey",
  },
  {
    file: "attribution.ts",
    constraintName: "CreditAttributionEvidence_unitId_entityId_role_fkey",
  },
  {
    file: "poll.ts",
    constraintName: "PollVote_pollUnitId_optionId_fkey",
  },
  {
    file: "tagging.ts",
    constraintName: "RealmTagApplicationVote_realmUnitId_tagUnitId_unitId_fkey",
  },
] as const;

describe("server Drizzle schema exports", () => {
  test("thin schema aggregator exports every table, enum, sequence, and custom type", () => {
    for (const exportName of expectedSchemaExports) {
      expect(schema).toHaveProperty(exportName);
    }
  });

  test("public schema index keeps runtime aliases outside the Drizzle Kit entry", () => {
    expect(publicSchema.historyOutbox).toBe(schema.HistoryOutbox);
    expect("historyOutbox" in schema).toBe(false);
  });

  test("JSON columns stay opaque in Drizzle schema", () => {
    const schemaSources = readdirSync(schemaDir)
      .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"))
      .map((file) => readFileSync(join(schemaDir, file), "utf8"));

    expect(schemaSources.join("\n")).not.toContain(".$type<");
  });

  test("known composite foreign keys use table callback builders", () => {
    for (const { file, constraintName } of compositeForeignKeys) {
      const source = readFileSync(join(schemaDir, file), "utf8");
      const constraintIndex = source.indexOf(`name: "${constraintName}"`);
      const builderIndex = source.lastIndexOf("foreignKey({", constraintIndex);

      expect(constraintIndex).toBeGreaterThan(-1);
      expect(builderIndex).toBeGreaterThan(-1);
    }
  });
});
