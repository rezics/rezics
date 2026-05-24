import * as v from "valibot";
import { createIdempotencyKey } from "../idempotency";
import { JOB_LANES } from "../lanes";
import { jobTags, uniqueTags } from "../tags";
import { commandSchema, StringRecordSchema } from "./common";

export const SEARCH_COMMAND_KINDS = {
  contentSync: "search.content.sync",
  contentDelete: "search.content.delete",
  contentPatchMetadata: "search.content.patchMetadata",
  contentPatchTags: "search.content.patchTags",
  contentPatchAliases: "search.content.patchAliases",
  contentPatchCredits: "search.content.patchCredits",
  contentPatchSubjects: "search.content.patchSubjects",
  contentPatchTranslations: "search.content.patchTranslations",
  contentPatchRealmIds: "search.content.patchRealmIds",
  contentPatchRealmTagKeys: "search.content.patchRealmTagKeys",
  contentPatchContainedUnitIds: "search.content.patchContainedUnitIds",
  contentFullSync: "search.content.fullSync",

  postSync: "search.post.sync",
  postDelete: "search.post.delete",
  postPatchFields: "search.post.patchFields",
  postPatchAuthorFanout: "search.post.patchAuthorFanout",
  postPatchTargetFanout: "search.post.patchTargetFanout",
  postPatchRealmIds: "search.post.patchRealmIds",
  postRepairRootTarget: "search.post.repairRootTarget",
  postFullSync: "search.post.fullSync",

  realmSync: "search.realm.sync",
  realmDelete: "search.realm.delete",
  realmPatchMetadata: "search.realm.patchMetadata",
  realmPatchTranslations: "search.realm.patchTranslations",
  realmPatchAliases: "search.realm.patchAliases",
  realmPatchMemberCount: "search.realm.patchMemberCount",
  realmFullSync: "search.realm.fullSync",

  entitySync: "search.entity.sync",
  entityDelete: "search.entity.delete",
  entityPatchAliases: "search.entity.patchAliases",
  entityFullSync: "search.entity.fullSync",

  userSync: "search.user.sync",
  userDelete: "search.user.delete",
  userPatchFields: "search.user.patchFields",
  userPostsAuthorFanout: "search.user.postsAuthorFanout",
  userFullSync: "search.user.fullSync",

  feedbackSync: "search.feedback.sync",
  feedbackDelete: "search.feedback.delete",
  feedbackPatchResolution: "search.feedback.patchResolution",
  feedbackFullSync: "search.feedback.fullSync",

  progressSync: "search.progress.sync",
  progressRemove: "search.progress.remove",
  progressFullSync: "search.progress.fullSync",
} as const;

export type SearchCommandKind =
  (typeof SEARCH_COMMAND_KINDS)[keyof typeof SEARCH_COMMAND_KINDS];

const UnitTargetPayloadSchema = v.strictObject({ unitId: v.string() });
const PostTargetPayloadSchema = v.strictObject({ postId: v.string() });
const RealmTargetPayloadSchema = v.strictObject({ unitId: v.string() });
const EntityTargetPayloadSchema = v.strictObject({ unitId: v.string() });
const UserTargetPayloadSchema = v.strictObject({ userId: v.string() });
const FeedbackTargetPayloadSchema = v.strictObject({ feedbackId: v.string() });
const ProgressTargetPayloadSchema = v.strictObject({
  userId: v.string(),
  unitId: v.string(),
});
const PatchPayloadSchema = v.strictObject({
  targetId: v.string(),
  fields: v.optional(StringRecordSchema),
});
const FullSyncPayloadSchema = v.strictObject({
  cursor: v.optional(v.string()),
  limit: v.optional(v.number()),
});
const FanoutPayloadSchema = v.strictObject({
  targetId: v.string(),
  cursor: v.optional(v.string()),
  limit: v.optional(v.number()),
});

export const ContentSyncCommandSchema = commandSchema(
  SEARCH_COMMAND_KINDS.contentSync,
  JOB_LANES.searchSyncFast,
  UnitTargetPayloadSchema,
);
export const ContentDeleteCommandSchema = commandSchema(
  SEARCH_COMMAND_KINDS.contentDelete,
  JOB_LANES.searchSyncFast,
  UnitTargetPayloadSchema,
);
export const ContentPatchMetadataCommandSchema = commandSchema(
  SEARCH_COMMAND_KINDS.contentPatchMetadata,
  JOB_LANES.searchSyncSlow,
  PatchPayloadSchema,
);
export const ContentPatchTagsCommandSchema = commandSchema(
  SEARCH_COMMAND_KINDS.contentPatchTags,
  JOB_LANES.searchSyncSlow,
  UnitTargetPayloadSchema,
);
export const ContentPatchAliasesCommandSchema = commandSchema(
  SEARCH_COMMAND_KINDS.contentPatchAliases,
  JOB_LANES.searchSyncSlow,
  UnitTargetPayloadSchema,
);
export const ContentPatchCreditsCommandSchema = commandSchema(
  SEARCH_COMMAND_KINDS.contentPatchCredits,
  JOB_LANES.searchSyncSlow,
  UnitTargetPayloadSchema,
);
export const ContentPatchSubjectsCommandSchema = commandSchema(
  SEARCH_COMMAND_KINDS.contentPatchSubjects,
  JOB_LANES.searchSyncSlow,
  UnitTargetPayloadSchema,
);
export const ContentPatchTranslationsCommandSchema = commandSchema(
  SEARCH_COMMAND_KINDS.contentPatchTranslations,
  JOB_LANES.searchSyncSlow,
  UnitTargetPayloadSchema,
);
export const ContentPatchRealmIdsCommandSchema = commandSchema(
  SEARCH_COMMAND_KINDS.contentPatchRealmIds,
  JOB_LANES.searchSyncSlow,
  UnitTargetPayloadSchema,
);
export const ContentPatchRealmTagKeysCommandSchema = commandSchema(
  SEARCH_COMMAND_KINDS.contentPatchRealmTagKeys,
  JOB_LANES.searchSyncSlow,
  UnitTargetPayloadSchema,
);
export const ContentPatchContainedUnitIdsCommandSchema = commandSchema(
  SEARCH_COMMAND_KINDS.contentPatchContainedUnitIds,
  JOB_LANES.searchSyncSlow,
  UnitTargetPayloadSchema,
);
export const ContentFullSyncCommandSchema = commandSchema(
  SEARCH_COMMAND_KINDS.contentFullSync,
  JOB_LANES.maintenance,
  FullSyncPayloadSchema,
);

export const PostSyncCommandSchema = commandSchema(
  SEARCH_COMMAND_KINDS.postSync,
  JOB_LANES.searchSyncFast,
  PostTargetPayloadSchema,
);
export const PostDeleteCommandSchema = commandSchema(
  SEARCH_COMMAND_KINDS.postDelete,
  JOB_LANES.searchSyncFast,
  PostTargetPayloadSchema,
);
export const PostPatchFieldsCommandSchema = commandSchema(
  SEARCH_COMMAND_KINDS.postPatchFields,
  JOB_LANES.searchSyncSlow,
  PatchPayloadSchema,
);
export const PostPatchAuthorFanoutCommandSchema = commandSchema(
  SEARCH_COMMAND_KINDS.postPatchAuthorFanout,
  JOB_LANES.searchSyncSlow,
  FanoutPayloadSchema,
);
export const PostPatchTargetFanoutCommandSchema = commandSchema(
  SEARCH_COMMAND_KINDS.postPatchTargetFanout,
  JOB_LANES.searchSyncSlow,
  FanoutPayloadSchema,
);
export const PostPatchRealmIdsCommandSchema = commandSchema(
  SEARCH_COMMAND_KINDS.postPatchRealmIds,
  JOB_LANES.searchSyncSlow,
  FanoutPayloadSchema,
);
export const PostRepairRootTargetCommandSchema = commandSchema(
  SEARCH_COMMAND_KINDS.postRepairRootTarget,
  JOB_LANES.searchSyncSlow,
  FanoutPayloadSchema,
);
export const PostFullSyncCommandSchema = commandSchema(
  SEARCH_COMMAND_KINDS.postFullSync,
  JOB_LANES.maintenance,
  FullSyncPayloadSchema,
);

export const RealmSyncCommandSchema = commandSchema(
  SEARCH_COMMAND_KINDS.realmSync,
  JOB_LANES.searchSyncFast,
  RealmTargetPayloadSchema,
);
export const RealmDeleteCommandSchema = commandSchema(
  SEARCH_COMMAND_KINDS.realmDelete,
  JOB_LANES.searchSyncFast,
  RealmTargetPayloadSchema,
);
export const RealmPatchMetadataCommandSchema = commandSchema(
  SEARCH_COMMAND_KINDS.realmPatchMetadata,
  JOB_LANES.searchSyncSlow,
  PatchPayloadSchema,
);
export const RealmPatchTranslationsCommandSchema = commandSchema(
  SEARCH_COMMAND_KINDS.realmPatchTranslations,
  JOB_LANES.searchSyncSlow,
  RealmTargetPayloadSchema,
);
export const RealmPatchAliasesCommandSchema = commandSchema(
  SEARCH_COMMAND_KINDS.realmPatchAliases,
  JOB_LANES.searchSyncSlow,
  RealmTargetPayloadSchema,
);
export const RealmPatchMemberCountCommandSchema = commandSchema(
  SEARCH_COMMAND_KINDS.realmPatchMemberCount,
  JOB_LANES.searchSyncSlow,
  RealmTargetPayloadSchema,
);
export const RealmFullSyncCommandSchema = commandSchema(
  SEARCH_COMMAND_KINDS.realmFullSync,
  JOB_LANES.maintenance,
  FullSyncPayloadSchema,
);

export const EntitySyncCommandSchema = commandSchema(
  SEARCH_COMMAND_KINDS.entitySync,
  JOB_LANES.searchSyncFast,
  EntityTargetPayloadSchema,
);
export const EntityDeleteCommandSchema = commandSchema(
  SEARCH_COMMAND_KINDS.entityDelete,
  JOB_LANES.searchSyncFast,
  EntityTargetPayloadSchema,
);
export const EntityPatchAliasesCommandSchema = commandSchema(
  SEARCH_COMMAND_KINDS.entityPatchAliases,
  JOB_LANES.searchSyncSlow,
  EntityTargetPayloadSchema,
);
export const EntityFullSyncCommandSchema = commandSchema(
  SEARCH_COMMAND_KINDS.entityFullSync,
  JOB_LANES.maintenance,
  FullSyncPayloadSchema,
);

export const UserSyncCommandSchema = commandSchema(
  SEARCH_COMMAND_KINDS.userSync,
  JOB_LANES.searchSyncFast,
  UserTargetPayloadSchema,
);
export const UserDeleteCommandSchema = commandSchema(
  SEARCH_COMMAND_KINDS.userDelete,
  JOB_LANES.searchSyncFast,
  UserTargetPayloadSchema,
);
export const UserPatchFieldsCommandSchema = commandSchema(
  SEARCH_COMMAND_KINDS.userPatchFields,
  JOB_LANES.searchSyncSlow,
  PatchPayloadSchema,
);
export const UserPostsAuthorFanoutCommandSchema = commandSchema(
  SEARCH_COMMAND_KINDS.userPostsAuthorFanout,
  JOB_LANES.searchSyncSlow,
  FanoutPayloadSchema,
);
export const UserFullSyncCommandSchema = commandSchema(
  SEARCH_COMMAND_KINDS.userFullSync,
  JOB_LANES.maintenance,
  FullSyncPayloadSchema,
);

export const FeedbackSyncCommandSchema = commandSchema(
  SEARCH_COMMAND_KINDS.feedbackSync,
  JOB_LANES.searchSyncFast,
  FeedbackTargetPayloadSchema,
);
export const FeedbackDeleteCommandSchema = commandSchema(
  SEARCH_COMMAND_KINDS.feedbackDelete,
  JOB_LANES.searchSyncFast,
  FeedbackTargetPayloadSchema,
);
export const FeedbackPatchResolutionCommandSchema = commandSchema(
  SEARCH_COMMAND_KINDS.feedbackPatchResolution,
  JOB_LANES.searchSyncSlow,
  FeedbackTargetPayloadSchema,
);
export const FeedbackFullSyncCommandSchema = commandSchema(
  SEARCH_COMMAND_KINDS.feedbackFullSync,
  JOB_LANES.maintenance,
  FullSyncPayloadSchema,
);

export const ProgressSyncCommandSchema = commandSchema(
  SEARCH_COMMAND_KINDS.progressSync,
  JOB_LANES.searchSyncFast,
  ProgressTargetPayloadSchema,
);
export const ProgressRemoveCommandSchema = commandSchema(
  SEARCH_COMMAND_KINDS.progressRemove,
  JOB_LANES.searchSyncFast,
  ProgressTargetPayloadSchema,
);
export const ProgressFullSyncCommandSchema = commandSchema(
  SEARCH_COMMAND_KINDS.progressFullSync,
  JOB_LANES.maintenance,
  FullSyncPayloadSchema,
);

export const SearchCommandSchema = v.union([
  ContentSyncCommandSchema,
  ContentDeleteCommandSchema,
  ContentPatchMetadataCommandSchema,
  ContentPatchTagsCommandSchema,
  ContentPatchAliasesCommandSchema,
  ContentPatchCreditsCommandSchema,
  ContentPatchSubjectsCommandSchema,
  ContentPatchTranslationsCommandSchema,
  ContentPatchRealmIdsCommandSchema,
  ContentPatchRealmTagKeysCommandSchema,
  ContentPatchContainedUnitIdsCommandSchema,
  ContentFullSyncCommandSchema,
  PostSyncCommandSchema,
  PostDeleteCommandSchema,
  PostPatchFieldsCommandSchema,
  PostPatchAuthorFanoutCommandSchema,
  PostPatchTargetFanoutCommandSchema,
  PostPatchRealmIdsCommandSchema,
  PostRepairRootTargetCommandSchema,
  PostFullSyncCommandSchema,
  RealmSyncCommandSchema,
  RealmDeleteCommandSchema,
  RealmPatchMetadataCommandSchema,
  RealmPatchTranslationsCommandSchema,
  RealmPatchAliasesCommandSchema,
  RealmPatchMemberCountCommandSchema,
  RealmFullSyncCommandSchema,
  EntitySyncCommandSchema,
  EntityDeleteCommandSchema,
  EntityPatchAliasesCommandSchema,
  EntityFullSyncCommandSchema,
  UserSyncCommandSchema,
  UserDeleteCommandSchema,
  UserPatchFieldsCommandSchema,
  UserPostsAuthorFanoutCommandSchema,
  UserFullSyncCommandSchema,
  FeedbackSyncCommandSchema,
  FeedbackDeleteCommandSchema,
  FeedbackPatchResolutionCommandSchema,
  FeedbackFullSyncCommandSchema,
  ProgressSyncCommandSchema,
  ProgressRemoveCommandSchema,
  ProgressFullSyncCommandSchema,
]);

export type SearchCommand = v.InferOutput<typeof SearchCommandSchema>;

export function createSearchCommand(
  kind: SearchCommandKind,
  payload: SearchCommand["payload"],
  source: SearchCommand["source"] = { type: "server" },
): SearchCommand {
  const getStringPart = (key: string) => {
    if (!payload || typeof payload !== "object") return undefined;
    const value = (payload as Record<string, unknown>)[key];
    return typeof value === "string" || typeof value === "number"
      ? String(value)
      : undefined;
  };
  const targetPart =
    getStringPart("unitId") ??
    getStringPart("postId") ??
    getStringPart("userId") ??
    getStringPart("feedbackId") ??
    getStringPart("targetId") ??
    "all";
  const progressTarget =
    getStringPart("userId") && getStringPart("unitId")
      ? `${getStringPart("userId")}:${getStringPart("unitId")}`
      : targetPart;

  const idempotencyKey = createIdempotencyKey(
    kind,
    progressTarget,
    getStringPart("cursor"),
  );
  const lane = kind.includes(".fullSync")
    ? JOB_LANES.maintenance
    : kind.includes(".sync") ||
        kind.includes(".delete") ||
        kind.includes(".remove")
      ? JOB_LANES.searchSyncFast
      : JOB_LANES.searchSyncSlow;
  const [, domain, operation] = kind.split(".");
  return v.parse(SearchCommandSchema, {
    kind,
    lane,
    payload,
    idempotencyKey,
    source,
    tags: uniqueTags([
      jobTags.domain("search"),
      jobTags.effect(operation ?? "sync"),
      jobTags.index(domain ?? "unknown"),
      jobTags.source(source.type),
    ]),
  });
}
