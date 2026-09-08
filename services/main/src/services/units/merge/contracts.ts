import { z } from "zod";
import { CatalogOwnerValues } from "@rezics/reference";
import {
	UnitMergeRequestStateValues,
	UnitMergeOperationStateValues,
	UnitMergeOperationPhaseValues,
	UnitMergeItemKindValues,
	UnitMergeItemStateValues,
} from "../../database/schema/contract-values";
const revision = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
export const MergePlanSchema = z.strictObject({
	names: z.enum(["copy_alternates", "retain_source"]),
	identifiers: z.enum(["copy_claims", "retain_source"]),
	semantics: z.literal("retain_source"),
	structure: z.literal("retain_source"),
	bindings: z.enum(["rebind_paused", "pause_at_source"]),
	retainedAccess: z.literal("target_readers"),
});
export const DefaultMergePlan = MergePlanSchema.parse({
	names: "copy_alternates",
	identifiers: "copy_claims",
	semantics: "retain_source",
	structure: "retain_source",
	bindings: "rebind_paused",
	retainedAccess: "target_readers",
});
export const MergePreflightSchema = z.strictObject({
	sourceUnitId: z.uuid(),
	targetUnitId: z.uuid(),
	plan: MergePlanSchema.default(DefaultMergePlan),
});
export const MergeCreateSchema = MergePreflightSchema.extend({
	confirmationSourceUnitId: z.uuid(),
	confirmationTargetUnitId: z.uuid(),
	expectedSourceRevision: revision,
	expectedTargetRevision: revision,
	requestFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
	idempotencyKey: z.string().min(1).max(200),
	rules: z
		.array(z.strictObject({ sourceRealmId: z.uuid(), revisionId: z.uuid(), ruleId: z.uuid() }))
		.min(1)
		.max(32),
	note: z.string().max(2000).optional(),
});
export const MergeReviewSchema = z.strictObject({
	decision: z.enum(["approve", "reject"]),
	requestFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
	note: z.string().max(2000).optional(),
});
export const MergeListSchema = z.strictObject({
	state: z.enum(UnitMergeRequestStateValues).optional(),
	cursor: z.uuid().optional(),
	limit: z.coerce.number().int().min(1).max(100).default(50),
});
export const MergeItemListSchema = z.strictObject({
	state: z.enum(UnitMergeItemStateValues).optional(),
	cursor: z.uuid().optional(),
	limit: z.coerce.number().int().min(1).max(100).default(50),
});
export const MergeResolveItemSchema = z.strictObject({
	action: z.enum(["retry", "retain_source"]),
	expectedTargetRevision: revision,
	expectedBindingRevision: revision.optional(),
	reason: z.string().min(1).max(2000),
});
const summary = z.strictObject({ id: z.uuid(), title: z.string().max(500).nullable() });
export const MergeManifestSchema = z.strictObject({
	owner: z.enum(CatalogOwnerValues),
	shape: z.string(),
	sourceUnit: summary,
	targetUnit: summary,
	sourceRevision: revision,
	targetRevision: revision,
	sourceUpdatedAt: z.iso.datetime(),
	targetUpdatedAt: z.iso.datetime(),
	status: z.enum(["draft", "published", "archived"]),
	visibility: z.enum(["public", "unlisted", "private"]),
	plan: MergePlanSchema,
	fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
});
export const MergeOperationSchema = z.strictObject({
	id: z.uuid(),
	state: z.enum(UnitMergeOperationStateValues),
	phase: z.enum(UnitMergeOperationPhaseValues),
	processedRows: z.number().int().nonnegative(),
	totalItems: z.number().int().nonnegative(),
	resolvedItems: z.number().int().nonnegative(),
	attemptCount: z.number().int().nonnegative(),
	availableAt: z.iso.datetime(),
	lastErrorCode: z.string().nullable(),
	lastErrorMessage: z.string().nullable(),
	startedAt: z.iso.datetime().nullable(),
	completedAt: z.iso.datetime().nullable(),
});
export const MergeRequestSchema = z.strictObject({
	id: z.uuid(),
	state: z.enum(UnitMergeRequestStateValues),
	manifest: MergeManifestSchema,
	proposer: z.strictObject({ entityId: z.uuid() }),
	note: z.string().nullable(),
	requiredApprovals: z.literal(2),
	rules: z
		.array(z.strictObject({ sourceRealmId: z.uuid(), revisionId: z.uuid(), ruleId: z.uuid() }))
		.min(1)
		.max(32),
	approvals: z.number().int().nonnegative(),
	rejections: z.number().int().nonnegative(),
	reviews: z
		.array(
			z.strictObject({
				entityId: z.uuid(),
				decision: z.enum(["approve", "reject"]),
				note: z.string().nullable(),
				createdAt: z.iso.datetime(),
			}),
		)
		.max(2),
	operation: MergeOperationSchema.nullable(),
	expiresAt: z.iso.datetime(),
	acceptedAt: z.iso.datetime().nullable(),
	canonicalizedAt: z.iso.datetime().nullable(),
	completedAt: z.iso.datetime().nullable(),
	createdAt: z.iso.datetime(),
});
export const MergeItemSchema = z.strictObject({
	id: z.uuid(),
	kind: z.enum(UnitMergeItemKindValues),
	state: z.enum(UnitMergeItemStateValues),
	sourceKey: z.string(),
	decision: z.string().nullable(),
	sourceReference: z.strictObject({ owner: z.enum(CatalogOwnerValues), id: z.uuid() }),
	targetReference: z.strictObject({ owner: z.enum(CatalogOwnerValues), id: z.uuid() }),
	sourceNameId: z.uuid().nullable(),
	sourceNameRevision: revision.nullable(),
	targetNameId: z.uuid().nullable(),
	targetNameRevision: revision.nullable(),
	sourceIdentifierId: z.uuid().nullable(),
	sourceIdentifierRevision: revision.nullable(),
	targetIdentifierId: z.uuid().nullable(),
	targetIdentifierRevision: revision.nullable(),
	sourceSemanticId: z.uuid().nullable(),
	sourceSemanticVersion: revision.nullable(),
	sourceRecordId: z.uuid().nullable(),
	mappingKey: z.uuid().nullable(),
	sourceBindingRevision: revision.nullable(),
	targetBindingRevision: revision.nullable(),
	currentBinding: z.strictObject({
		revision, state: z.enum(["active", "paused", "withdrawn"]),
		reference: z.strictObject({ owner: z.enum(CatalogOwnerValues), id: z.uuid() }),
	}).nullable(),
	errorCode: z.string().nullable(),
	resolvedAt: z.iso.datetime().nullable(),
});
export const MergeSourcePreviewSchema = z.strictObject({
	requestId: z.uuid(),
	readable: z.boolean(),
	source: z.strictObject({
		owner: z.enum(CatalogOwnerValues),
		id: z.uuid(),
		title: z.string().nullable(),
	}),
	state: z.enum(UnitMergeRequestStateValues),
	plan: MergePlanSchema,
	canonicalizedAt: z.iso.datetime(),
});
export const mergePage = <T extends z.ZodType>(item: T) =>
	z.strictObject({ items: z.array(item).max(100), nextCursor: z.string().nullable() });
