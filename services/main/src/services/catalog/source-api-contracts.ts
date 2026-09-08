import { z } from "zod";
import { CatalogReferenceSchema } from "./contracts";
import { CatalogRevisionNumberSchema } from "./name-contracts";
import { MusicReleaseSourceJobSchema } from "./music-release-source-jobs";
export { CatalogSourceIntakeKeySchema } from "./source-native-registry";
const revision = CatalogRevisionNumberSchema;
export const CatalogSourceBindingKeySchema = z.strictObject({ sourceRecordId: z.uuid(), mappingKey: z.uuid() });
export const CatalogSourceProposalKeySchema = z.strictObject({ sourceRecordId: z.uuid(), proposalId: z.uuid() });
export const CatalogSourcePageQuerySchema = z.strictObject({ afterId: z.uuid().optional(), limit: z.coerce.number().int().min(1).max(100).default(50) });
export const CatalogSourceJobKeySchema = z.strictObject({ sourceRecordId: z.uuid(), jobId: z.uuid() });
export const CatalogSourceJobControlSchema = z.strictObject({ action: z.enum(["pause", "resume"]) });
export const CatalogSourceJobSchema = MusicReleaseSourceJobSchema;
const queuedJob = z.strictObject({ status: z.literal("queued"), job: CatalogSourceJobSchema });
export const CatalogSourceIntakeResultSchema = z.union([z.strictObject({
	status: z.enum(["created", "unchanged", "paused", "review_required"]),
	reference: CatalogReferenceSchema, revision, sourceRecordId: z.uuid(), snapshotId: z.uuid(), mappingKey: z.uuid(),
}), queuedJob]);
export const CatalogResourceBindingsQuerySchema = z.strictObject({
	afterMappingKey: z.uuid().optional(), afterSourceRecordId: z.uuid().optional(),
	limit: z.coerce.number().int().min(1).max(100).default(50),
}).refine(value => Boolean(value.afterMappingKey) === Boolean(value.afterSourceRecordId), "Binding cursor requires both key parts");
export const CatalogResourceBindingsPageSchema = z.strictObject({
	items: z.array(z.strictObject({
		sourceRecordId: z.uuid(), mappingKey: z.uuid(), source: z.string(), objectType: z.string(), externalId: z.string(),
		mappingVersion: z.string(), bindingRevision: revision, state: z.enum(["active", "paused", "withdrawn"]), mode: z.enum(["review", "manual"]),
		observedSnapshotId: z.uuid().nullable(), headSnapshotId: z.uuid().nullable(),
	})).max(100),
	after: z.strictObject({ afterMappingKey: z.uuid(), afterSourceRecordId: z.uuid() }).nullable(),
});
export const CatalogSourceProposalSchema = z.strictObject({
	id: z.uuid(), sourceRecordId: z.uuid(), snapshotId: z.uuid(), mappingKey: z.uuid(), mappingVersion: z.string(),
	expectedTargetRevision: revision, expectedBindingRevision: revision, expectedPolicyRevision: revision,
	state: z.enum(["pending", "applied", "rejected", "superseded", "withdrawn"]),
	decisionReason: z.string().nullable(), appliedTargetRevision: revision.nullable(),
	createdAt: z.iso.datetime(), decidedAt: z.iso.datetime().nullable(),
});
export const CatalogSourceProposalPageSchema = z.strictObject({ items: z.array(CatalogSourceProposalSchema).max(100), afterId: z.uuid().nullable() });
export const CatalogSourceProposeSchema = z.strictObject({ snapshotId: z.uuid(), mappingVersion: z.string().min(1).max(128) });
export const CatalogSourceProposeResultSchema = z.strictObject({ status: z.enum(["paused", "unchanged", "proposed"]), proposal: CatalogSourceProposalSchema.nullable() });
export const CatalogSourceDecisionSchema = z.strictObject({ mappingVersion: z.string().min(1).max(128),
	action: z.enum(["apply", "reject", "supersede", "withdraw"]), reason: z.string().min(1).max(2048) });
export const CatalogSourceDecisionResultSchema = z.union([
	z.strictObject({ status: z.enum(["repeated", "applied", "rejected", "superseded", "withdrawn"]) }), queuedJob,
]);
export const CatalogSourceBindingEditSchema = z.strictObject({ expectedRevision: revision,
	state: z.enum(["active", "paused", "withdrawn"]), mode: z.enum(["review", "manual"]), reason: z.string().min(1).max(2048),
	target: CatalogReferenceSchema.optional(), mappingVersion: z.string().min(1).max(128).optional() });
export const CatalogSourceBindingMutationSchema = z.strictObject({ revision, policyRevision: revision,
	reference: CatalogReferenceSchema, state: z.enum(["active", "paused", "withdrawn"]) });
