import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  aiDisclosureModeValues,
  catalogEntryKindValues,
  contentRatingValues,
  contentTranslationStatusValues,
  feedbackTypeValues,
  mainEmailVerificationContractStatusValues,
  pinKindValues,
  pollResultVisibilityValues,
  pollVoteModeValues,
  postKindValues,
  unitAliasKindValues,
  unitAliasStatusValues,
  unitStatusValues,
  unitVisibilityValues,
  userUnitProgressStatusValues,
} from "@rezics/contract";
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
  "PostUnitReference",
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
  "ShelfItem",
  "SlugScope",
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
  "UnitExternalLink",
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
  "UserSubscriptionListEntry",
  "UserSubscriptionListEntryState",
  "UserTagApplication",
  "UserUnitProgress",
  "UserUnitProgressStatus",
  "Zone",
  "createdAt",
  "accountEnforcementKindStorageValues",
  "accountEnforcementStateStorageValues",
  "governanceGrantStateStorageValues",
  "jsonData",
  "ltree",
  "moderationActionKindStorageValues",
  "moderationActorKindStorageValues",
  "moderationAuthorityStorageValues",
  "moderationCaseStateStorageValues",
  "moderationScopeStorageValues",
  "moderationStatusStorageValues",
  "moderationTargetKindStorageValues",
  "nullableTimestamp",
  "pgEnumName",
  "post_path_label_seq",
  "realmMemberStateStorageValues",
  "textArray",
  "timestampMs",
  "timestamps",
  "unitTypeStorageValues",
  "updatedAt",
  "userSubscriptionListEntryStateStorageValues",
  "uuidv7",
  "uuidv7PrimaryKey",
] as const;

const schemaDir = import.meta.dir;
const compositeForeignKeys = [
  {
    file: "shelf.ts",
    constraintName: "ShelfItem_parent_fkey",
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

  test("public enum storage values are owned by contract modules", () => {
    expect(schema.UnitStatus.enumValues).toEqual([...unitStatusValues]);
    expect(schema.UnitVisibility.enumValues).toEqual([...unitVisibilityValues]);
    expect(schema.ContentRating.enumValues).toEqual([...contentRatingValues]);
    expect(schema.UserUnitProgressStatus.enumValues).toEqual([
      ...userUnitProgressStatusValues,
    ]);
    expect(schema.PostKind.enumValues).toEqual([...postKindValues]);
    expect(schema.EmailVerificationContractStatus.enumValues).toEqual([
      ...mainEmailVerificationContractStatusValues,
    ]);
    expect(schema.FeedbackType.enumValues).toEqual([...feedbackTypeValues]);
    expect(schema.UnitAliasKind.enumValues).toEqual([...unitAliasKindValues]);
    expect(schema.UnitAliasStatus.enumValues).toEqual([
      ...unitAliasStatusValues,
    ]);
    expect(schema.AiDisclosureMode.enumValues).toEqual([
      ...aiDisclosureModeValues,
    ]);
    expect(schema.PinKind.enumValues).toEqual([...pinKindValues]);
    expect(schema.PollVoteMode.enumValues).toEqual([...pollVoteModeValues]);
    expect(schema.PollResultVisibility.enumValues).toEqual([
      ...pollResultVisibilityValues,
    ]);
    expect(schema.CatalogEntryKind.enumValues).toEqual([
      ...catalogEntryKindValues,
    ]);
    expect(schema.ContentTranslationStatus.enumValues).toEqual([
      ...contentTranslationStatusValues,
    ]);
  });

  test("application code does not derive public types from Drizzle enum objects", () => {
    const sourceRoots = [
      join(import.meta.dir, "../../governance"),
      join(import.meta.dir, "../../unit-alias-record"),
    ];
    const sources = sourceRoots.flatMap((dir) =>
      readdirSync(dir)
        .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"))
        .map((file) => readFileSync(join(dir, file), "utf8")),
    );

    expect(sources.join("\n")).not.toContain(".enumValues");
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
