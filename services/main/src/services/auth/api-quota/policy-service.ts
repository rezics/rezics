import { and, eq, sql } from "drizzle-orm";
import { getActiveObservability } from "@rezics/observability";

import { database, type DatabaseExecutor, type DatabaseTransaction } from "../../database";
import {
	apiAccountQuotaBinding,
	apiQuotaPolicy,
	apiQuotaPolicyRevision,
	apiTokenQuotaBinding,
	apiTokenQuotaOverride,
	type ApiQuotaPolicyClass,
	type ApiQuotaPolicySubjectKind,
} from "../../database/schema";
import {
	ApiQuotaPolicyDocumentInvalid,
	ApiQuotaPolicySchemaVersion,
	DefaultApiQuotaPolicies,
	applyApiAccountQuotaOverride,
	applyApiTokenQuotaOverride,
	decodeApiAccountQuotaOverride,
	decodeApiAccountQuotaPolicyConfiguration,
	decodeApiQuotaPolicyConfiguration,
	decodeApiTokenQuotaPolicyConfiguration,
	decodeApiTokenQuotaOverride,
	type ApiAccountQuotaOverride,
	type ApiAccountQuotaPolicyConfiguration,
	type ApiQuotaPolicyConfiguration,
	type ApiTokenQuotaOverride,
	type ApiTokenQuotaPolicyConfiguration,
} from "./policy-schema";

const { logger } = getActiveObservability();

type PolicyRow = typeof apiQuotaPolicy.$inferSelect;
type PolicyRevisionRow = typeof apiQuotaPolicyRevision.$inferSelect;
type AccountBindingRow = typeof apiAccountQuotaBinding.$inferSelect;
type TokenBindingRow = typeof apiTokenQuotaBinding.$inferSelect;

type CurrentPolicyRecord = {
	policy: PolicyRow;
	revision: PolicyRevisionRow;
};

export type ResolvedApiAccountQuotaPolicy = {
	userId: string;
	policyId: string;
	key: string;
	class: ApiQuotaPolicyClass;
	schemaVersion: number;
	policyRevision: number;
	bindingRevision: number | null;
	validUntil: Date | null;
	assignmentReason: string | null;
	configurationOverride: ApiAccountQuotaOverride;
	configuration: ApiAccountQuotaPolicyConfiguration;
	source: "assigned" | "standard_default" | "privileged_fallback";
};

export type ResolvedApiTokenQuotaPolicy = {
	tokenId: string;
	policyId: string;
	key: string;
	class: ApiQuotaPolicyClass;
	schemaVersion: number;
	policyRevision: number;
	bindingRevision: number | null;
	validUntil: Date | null;
	assignmentReason: string | null;
	configurationOverride: ApiTokenQuotaOverride;
	configuration: ApiTokenQuotaPolicyConfiguration;
	source: "assigned" | "standard_default" | "privileged_fallback";
};

export type ApiQuotaPolicySummary = {
	id: string;
	key: string;
	subjectKind: ApiQuotaPolicySubjectKind;
	class: ApiQuotaPolicyClass;
	schemaVersion: number;
	configuration: ApiQuotaPolicyConfiguration;
	revision: number;
	enabled: boolean;
	updatedAt: Date;
};

export type ApiTokenQuotaOverrideSummary = {
	tokenId: string;
	configurationOverride: ApiTokenQuotaOverride;
	revision: number;
	updatedAt: Date;
};

export class ApiQuotaAssignmentInvalid extends Error {
	constructor() {
		super("Privileged API quota assignments require a future expiry and a reason");
		this.name = "ApiQuotaAssignmentInvalid";
	}
}

async function findCurrentPolicyByKey(
	executor: DatabaseExecutor,
	key: string,
): Promise<CurrentPolicyRecord | undefined> {
	const [record] = await executor
		.select({ policy: apiQuotaPolicy, revision: apiQuotaPolicyRevision })
		.from(apiQuotaPolicy)
		.innerJoin(
			apiQuotaPolicyRevision,
			and(
				eq(apiQuotaPolicyRevision.policyId, apiQuotaPolicy.id),
				eq(apiQuotaPolicyRevision.revision, apiQuotaPolicy.currentRevision),
			),
		)
		.where(eq(apiQuotaPolicy.key, key))
		.limit(1);
	return record;
}

async function requireStandardPolicy(
	executor: DatabaseExecutor,
	subjectKind: ApiQuotaPolicySubjectKind,
): Promise<CurrentPolicyRecord> {
	const key =
		subjectKind === "account"
			? DefaultApiQuotaPolicies.accountStandard.key
			: DefaultApiQuotaPolicies.tokenStandard.key;
	const standard = await findCurrentPolicyByKey(executor, key);
	if (
		!standard?.policy.enabled ||
		standard.policy.class !== "standard" ||
		standard.policy.subjectKind !== subjectKind
	)
		throw new Error(`The default Standard ${subjectKind} API quota policy is unavailable`);
	return standard;
}

function resolvePolicyDocument(
	userId: string,
	record: CurrentPolicyRecord,
	binding: AccountBindingRow | undefined,
	source: ResolvedApiAccountQuotaPolicy["source"],
): ResolvedApiAccountQuotaPolicy {
	const configuration = decodeApiAccountQuotaPolicyConfiguration(
		record.policy.class,
		record.revision.schemaVersion,
		record.revision.configuration,
	);
	const override = binding
		? decodeApiAccountQuotaOverride(
				record.policy.class,
				record.revision.schemaVersion,
				binding.configurationOverride,
			)
		: {};
	return {
		userId,
		policyId: record.policy.id,
		key: record.policy.key,
		class: record.policy.class,
		schemaVersion: record.revision.schemaVersion,
		policyRevision: record.revision.revision,
		bindingRevision: binding?.revision ?? null,
		validUntil: binding?.validUntil ?? null,
		assignmentReason: binding?.assignmentReason ?? null,
		configurationOverride: override,
		configuration: applyApiAccountQuotaOverride(configuration, override),
		source,
	};
}

async function resolveStandardFallback(
	executor: DatabaseExecutor,
	userId: string,
	source: "standard_default" | "privileged_fallback",
	binding?: AccountBindingRow,
): Promise<ResolvedApiAccountQuotaPolicy> {
	const resolved = resolvePolicyDocument(
		userId,
		await requireStandardPolicy(executor, "account"),
		undefined,
		source,
	);
	return binding
		? {
				...resolved,
				bindingRevision: binding.revision,
				validUntil: binding.validUntil,
				assignmentReason: binding.assignmentReason,
				configurationOverride: {},
			}
		: resolved;
}

export async function resolveApiAccountQuotaPolicy(
	userId: string,
	options: { executor?: DatabaseExecutor; now?: Date } = {},
): Promise<ResolvedApiAccountQuotaPolicy> {
	const executor = options.executor ?? database;
	const now = options.now ?? new Date();
	const [record] = await executor
		.select({
			binding: apiAccountQuotaBinding,
			policy: apiQuotaPolicy,
			revision: apiQuotaPolicyRevision,
		})
		.from(apiAccountQuotaBinding)
		.innerJoin(apiQuotaPolicy, eq(apiQuotaPolicy.id, apiAccountQuotaBinding.policyId))
		.innerJoin(
			apiQuotaPolicyRevision,
			and(
				eq(apiQuotaPolicyRevision.policyId, apiQuotaPolicy.id),
				eq(apiQuotaPolicyRevision.revision, apiQuotaPolicy.currentRevision),
			),
		)
		.where(eq(apiAccountQuotaBinding.userId, userId))
		.limit(1);

	if (!record) return resolveStandardFallback(executor, userId, "standard_default");

	const currentPolicy = { policy: record.policy, revision: record.revision };
	const privilegedUnavailable =
		record.policy.class === "privileged" &&
		(!record.policy.enabled ||
			record.binding.validUntil === null ||
			record.binding.validUntil <= now);
	if (privilegedUnavailable)
		return resolveStandardFallback(executor, userId, "privileged_fallback", record.binding);
	if (!record.policy.enabled)
		throw new Error(`Assigned API quota policy is disabled: ${record.policy.key}`);

	try {
		return resolvePolicyDocument(userId, currentPolicy, record.binding, "assigned");
	} catch (error) {
		if (record.policy.class !== "privileged" || !(error instanceof ApiQuotaPolicyDocumentInvalid))
			throw error;
		logger.error("Invalid Privileged API quota policy; using Standard fallback", {
			eventName: "api_quota.policy.privileged_fallback",
			errorCode: "ApiQuotaPolicyDocumentInvalid",
			error,
			attributes: {
				userId,
				policyId: record.policy.id,
				policyKey: record.policy.key,
			},
		});
		return resolveStandardFallback(executor, userId, "privileged_fallback", record.binding);
	}
}

function presentPolicy(record: CurrentPolicyRecord): ApiQuotaPolicySummary {
	return {
		id: record.policy.id,
		key: record.policy.key,
		class: record.policy.class,
		schemaVersion: record.revision.schemaVersion,
		subjectKind: record.policy.subjectKind,
		configuration: decodeApiQuotaPolicyConfiguration(
			record.policy.subjectKind,
			record.policy.class,
			record.revision.schemaVersion,
			record.revision.configuration,
		),
		revision: record.revision.revision,
		enabled: record.policy.enabled,
		updatedAt: record.policy.updatedAt,
	};
}

export async function listApiQuotaPolicies(
	executor: DatabaseExecutor = database,
): Promise<ApiQuotaPolicySummary[]> {
	const records = await executor
		.select({ policy: apiQuotaPolicy, revision: apiQuotaPolicyRevision })
		.from(apiQuotaPolicy)
		.innerJoin(
			apiQuotaPolicyRevision,
			and(
				eq(apiQuotaPolicyRevision.policyId, apiQuotaPolicy.id),
				eq(apiQuotaPolicyRevision.revision, apiQuotaPolicy.currentRevision),
			),
		)
		.orderBy(apiQuotaPolicy.key);
	return records.map(presentPolicy);
}

export async function createApiQuotaPolicy(
	tx: DatabaseTransaction,
	input: {
		key: string;
		subjectKind: ApiQuotaPolicySubjectKind;
		class: ApiQuotaPolicyClass;
		configuration: unknown;
		reason: string;
		actorProfileId: string;
	},
): Promise<ApiQuotaPolicySummary | undefined> {
	const reason = input.reason.trim();
	if (reason === "") throw new ApiQuotaAssignmentInvalid();
	const configuration = decodeApiQuotaPolicyConfiguration(
		input.subjectKind,
		input.class,
		ApiQuotaPolicySchemaVersion,
		input.configuration,
	);
	const [policy] = await tx
		.insert(apiQuotaPolicy)
		.values({
			key: input.key,
			subjectKind: input.subjectKind,
			class: input.class,
			currentRevision: 1,
			enabled: true,
		})
		.onConflictDoNothing({ target: apiQuotaPolicy.key })
		.returning();
	if (!policy) return undefined;
	const [revision] = await tx
		.insert(apiQuotaPolicyRevision)
		.values({
			policyId: policy.id,
			revision: 1,
			schemaVersion: ApiQuotaPolicySchemaVersion,
			configuration,
			changeReason: reason,
			createdByProfileId: input.actorProfileId,
		})
		.returning();
	if (!revision) throw new Error("API quota policy initial revision was not created");
	return presentPolicy({ policy, revision });
}

export async function reviseApiQuotaPolicy(
	tx: DatabaseTransaction,
	input: {
		key: string;
		expectedRevision: number;
		configuration: unknown;
		reason: string;
		actorProfileId: string;
	},
): Promise<ApiQuotaPolicySummary | undefined> {
	const current = await findCurrentPolicyByKey(tx, input.key);
	if (!current || current.revision.revision !== input.expectedRevision) return undefined;
	const reason = input.reason.trim();
	if (reason === "") throw new ApiQuotaAssignmentInvalid();
	const configuration = decodeApiQuotaPolicyConfiguration(
		current.policy.subjectKind,
		current.policy.class,
		ApiQuotaPolicySchemaVersion,
		input.configuration,
	);
	const nextRevision = input.expectedRevision + 1;
	const [updated] = await tx
		.update(apiQuotaPolicy)
		.set({ currentRevision: nextRevision })
		.where(
			and(
				eq(apiQuotaPolicy.id, current.policy.id),
				eq(apiQuotaPolicy.currentRevision, input.expectedRevision),
			),
		)
		.returning();
	if (!updated) return undefined;
	const [revision] = await tx
		.insert(apiQuotaPolicyRevision)
		.values({
			policyId: current.policy.id,
			revision: nextRevision,
			schemaVersion: ApiQuotaPolicySchemaVersion,
			configuration,
			changeReason: reason,
			createdByProfileId: input.actorProfileId,
		})
		.returning();
	if (!revision) throw new Error("API quota policy revision was not created");
	return presentPolicy({ policy: updated, revision });
}

export async function assignApiAccountQuotaPolicy(
	tx: DatabaseTransaction,
	input: {
		userId: string;
		policyKey: string;
		expectedRevision: number;
		validUntil?: Date;
		reason: string;
		override: unknown;
		actorProfileId: string;
		now?: Date;
	},
): Promise<ResolvedApiAccountQuotaPolicy | undefined> {
	const current = await findCurrentPolicyByKey(tx, input.policyKey);
	if (!current?.policy.enabled || current.policy.subjectKind !== "account") return undefined;
	decodeApiAccountQuotaPolicyConfiguration(
		current.policy.class,
		current.revision.schemaVersion,
		current.revision.configuration,
	);
	const override: ApiAccountQuotaOverride = decodeApiAccountQuotaOverride(
		current.policy.class,
		current.revision.schemaVersion,
		input.override,
	);
	const reason = input.reason.trim();
	const now = input.now ?? new Date();
	if (
		reason === "" ||
		(current.policy.class === "privileged" && (!input.validUntil || input.validUntil <= now))
	)
		throw new ApiQuotaAssignmentInvalid();

	if (input.expectedRevision === 0) {
		const [inserted] = await tx
			.insert(apiAccountQuotaBinding)
			.values({
				userId: input.userId,
				policyId: current.policy.id,
				configurationOverride: override,
				validUntil: current.policy.class === "privileged" ? input.validUntil : null,
				assignmentReason: reason,
				assignedByProfileId: input.actorProfileId,
			})
			.onConflictDoNothing({ target: apiAccountQuotaBinding.userId })
			.returning({ userId: apiAccountQuotaBinding.userId });
		if (!inserted) return undefined;
	} else {
		const [updated] = await tx
			.update(apiAccountQuotaBinding)
			.set({
				policyId: current.policy.id,
				configurationOverride: override,
				validUntil: current.policy.class === "privileged" ? input.validUntil : null,
				assignmentReason: reason,
				assignedByProfileId: input.actorProfileId,
				revision: sql`${apiAccountQuotaBinding.revision} + 1`,
			})
			.where(
				and(
					eq(apiAccountQuotaBinding.userId, input.userId),
					eq(apiAccountQuotaBinding.revision, input.expectedRevision),
				),
			)
			.returning({ userId: apiAccountQuotaBinding.userId });
		if (!updated) return undefined;
	}
	return resolveApiAccountQuotaPolicy(input.userId, { executor: tx, now });
}

export async function resetApiAccountQuotaPolicy(
	tx: DatabaseTransaction,
	input: { userId: string; expectedRevision: number },
): Promise<boolean> {
	const [deleted] = await tx
		.delete(apiAccountQuotaBinding)
		.where(
			and(
				eq(apiAccountQuotaBinding.userId, input.userId),
				eq(apiAccountQuotaBinding.revision, input.expectedRevision),
			),
		)
		.returning({ userId: apiAccountQuotaBinding.userId });
	return deleted !== undefined;
}

function resolveTokenPolicyDocument(
	tokenId: string,
	record: CurrentPolicyRecord,
	binding: TokenBindingRow | undefined,
	source: ResolvedApiTokenQuotaPolicy["source"],
): ResolvedApiTokenQuotaPolicy {
	const configuration = decodeApiTokenQuotaPolicyConfiguration(
		record.policy.class,
		record.revision.schemaVersion,
		record.revision.configuration,
	);
	const override = binding ? decodeApiTokenQuotaOverride(binding.configurationOverride) : {};
	return {
		tokenId,
		policyId: record.policy.id,
		key: record.policy.key,
		class: record.policy.class,
		schemaVersion: record.revision.schemaVersion,
		policyRevision: record.revision.revision,
		bindingRevision: binding?.revision ?? null,
		validUntil: binding?.validUntil ?? null,
		assignmentReason: binding?.assignmentReason ?? null,
		configurationOverride: override,
		configuration: applyApiTokenQuotaOverride(configuration, override),
		source,
	};
}

async function resolveTokenStandardFallback(
	executor: DatabaseExecutor,
	tokenId: string,
	source: "standard_default" | "privileged_fallback",
	binding?: TokenBindingRow,
): Promise<ResolvedApiTokenQuotaPolicy> {
	const resolved = resolveTokenPolicyDocument(
		tokenId,
		await requireStandardPolicy(executor, "token"),
		undefined,
		source,
	);
	return binding
		? {
				...resolved,
				bindingRevision: binding.revision,
				validUntil: binding.validUntil,
				assignmentReason: binding.assignmentReason,
				configurationOverride: {},
			}
		: resolved;
}

export async function resolveApiTokenQuotaPolicy(
	tokenId: string,
	options: { executor?: DatabaseExecutor; now?: Date } = {},
): Promise<ResolvedApiTokenQuotaPolicy> {
	const executor = options.executor ?? database;
	const now = options.now ?? new Date();
	const [record] = await executor
		.select({
			binding: apiTokenQuotaBinding,
			policy: apiQuotaPolicy,
			revision: apiQuotaPolicyRevision,
		})
		.from(apiTokenQuotaBinding)
		.innerJoin(apiQuotaPolicy, eq(apiQuotaPolicy.id, apiTokenQuotaBinding.policyId))
		.innerJoin(
			apiQuotaPolicyRevision,
			and(
				eq(apiQuotaPolicyRevision.policyId, apiQuotaPolicy.id),
				eq(apiQuotaPolicyRevision.revision, apiQuotaPolicy.currentRevision),
			),
		)
		.where(eq(apiTokenQuotaBinding.tokenId, tokenId))
		.limit(1);

	if (!record) return resolveTokenStandardFallback(executor, tokenId, "standard_default");

	const currentPolicy = { policy: record.policy, revision: record.revision };
	const privilegedUnavailable =
		record.policy.class === "privileged" &&
		(!record.policy.enabled ||
			record.binding.validUntil === null ||
			record.binding.validUntil <= now);
	if (privilegedUnavailable)
		return resolveTokenStandardFallback(executor, tokenId, "privileged_fallback", record.binding);
	if (!record.policy.enabled)
		throw new Error(`Assigned API quota policy is disabled: ${record.policy.key}`);

	try {
		return resolveTokenPolicyDocument(tokenId, currentPolicy, record.binding, "assigned");
	} catch (error) {
		if (record.policy.class !== "privileged" || !(error instanceof ApiQuotaPolicyDocumentInvalid))
			throw error;
		logger.error("Invalid Privileged token API quota policy; using Standard fallback", {
			eventName: "api_quota.token_policy.privileged_fallback",
			errorCode: "ApiQuotaPolicyDocumentInvalid",
			error,
			attributes: {
				tokenId,
				policyId: record.policy.id,
				policyKey: record.policy.key,
			},
		});
		return resolveTokenStandardFallback(executor, tokenId, "privileged_fallback", record.binding);
	}
}

export async function assignApiTokenQuotaPolicy(
	tx: DatabaseTransaction,
	input: {
		tokenId: string;
		policyKey: string;
		expectedRevision: number;
		validUntil?: Date;
		reason: string;
		override: unknown;
		actorProfileId: string;
		now?: Date;
	},
): Promise<ResolvedApiTokenQuotaPolicy | undefined> {
	const current = await findCurrentPolicyByKey(tx, input.policyKey);
	if (!current?.policy.enabled || current.policy.subjectKind !== "token") return undefined;
	decodeApiTokenQuotaPolicyConfiguration(
		current.policy.class,
		current.revision.schemaVersion,
		current.revision.configuration,
	);
	const override = decodeApiTokenQuotaOverride(input.override);
	const reason = input.reason.trim();
	const now = input.now ?? new Date();
	if (
		reason === "" ||
		(current.policy.class === "privileged" && (!input.validUntil || input.validUntil <= now))
	)
		throw new ApiQuotaAssignmentInvalid();

	if (input.expectedRevision === 0) {
		const [inserted] = await tx
			.insert(apiTokenQuotaBinding)
			.values({
				tokenId: input.tokenId,
				policyId: current.policy.id,
				configurationOverride: override,
				validUntil: current.policy.class === "privileged" ? input.validUntil : null,
				assignmentReason: reason,
				assignedByProfileId: input.actorProfileId,
			})
			.onConflictDoNothing({ target: apiTokenQuotaBinding.tokenId })
			.returning({ tokenId: apiTokenQuotaBinding.tokenId });
		if (!inserted) return undefined;
	} else {
		const [updated] = await tx
			.update(apiTokenQuotaBinding)
			.set({
				policyId: current.policy.id,
				configurationOverride: override,
				validUntil: current.policy.class === "privileged" ? input.validUntil : null,
				assignmentReason: reason,
				assignedByProfileId: input.actorProfileId,
				revision: sql`${apiTokenQuotaBinding.revision} + 1`,
			})
			.where(
				and(
					eq(apiTokenQuotaBinding.tokenId, input.tokenId),
					eq(apiTokenQuotaBinding.revision, input.expectedRevision),
				),
			)
			.returning({ tokenId: apiTokenQuotaBinding.tokenId });
		if (!updated) return undefined;
	}
	return resolveApiTokenQuotaPolicy(input.tokenId, { executor: tx, now });
}

export async function resetApiTokenQuotaPolicy(
	tx: DatabaseTransaction,
	input: { tokenId: string; expectedRevision: number },
): Promise<boolean> {
	const [deleted] = await tx
		.delete(apiTokenQuotaBinding)
		.where(
			and(
				eq(apiTokenQuotaBinding.tokenId, input.tokenId),
				eq(apiTokenQuotaBinding.revision, input.expectedRevision),
			),
		)
		.returning({ tokenId: apiTokenQuotaBinding.tokenId });
	return deleted !== undefined;
}

export async function getApiTokenQuotaOverride(
	tokenId: string,
	executor: DatabaseExecutor = database,
): Promise<ApiTokenQuotaOverrideSummary | undefined> {
	const [row] = await executor
		.select()
		.from(apiTokenQuotaOverride)
		.where(eq(apiTokenQuotaOverride.tokenId, tokenId))
		.limit(1);
	return row
		? {
				tokenId: row.tokenId,
				configurationOverride: decodeApiTokenQuotaOverride(row.configurationOverride),
				revision: row.revision,
				updatedAt: row.updatedAt,
			}
		: undefined;
}

export async function replaceApiTokenQuotaOverride(
	tx: DatabaseTransaction,
	input: {
		tokenId: string;
		expectedRevision: number;
		override: unknown;
		actorProfileId: string;
	},
): Promise<ApiTokenQuotaOverrideSummary | undefined> {
	const override = decodeApiTokenQuotaOverride(input.override);
	if (input.expectedRevision === 0) {
		const [inserted] = await tx
			.insert(apiTokenQuotaOverride)
			.values({
				tokenId: input.tokenId,
				configurationOverride: override,
				updatedByProfileId: input.actorProfileId,
			})
			.onConflictDoNothing({ target: apiTokenQuotaOverride.tokenId })
			.returning();
		return inserted
			? {
					tokenId: inserted.tokenId,
					configurationOverride: override,
					revision: inserted.revision,
					updatedAt: inserted.updatedAt,
				}
			: undefined;
	}
	const [updated] = await tx
		.update(apiTokenQuotaOverride)
		.set({
			configurationOverride: override,
			updatedByProfileId: input.actorProfileId,
			revision: sql`${apiTokenQuotaOverride.revision} + 1`,
		})
		.where(
			and(
				eq(apiTokenQuotaOverride.tokenId, input.tokenId),
				eq(apiTokenQuotaOverride.revision, input.expectedRevision),
			),
		)
		.returning();
	return updated
		? {
				tokenId: updated.tokenId,
				configurationOverride: decodeApiTokenQuotaOverride(updated.configurationOverride),
				revision: updated.revision,
				updatedAt: updated.updatedAt,
			}
		: undefined;
}

export async function deleteApiTokenQuotaOverride(
	tx: DatabaseTransaction,
	input: { tokenId: string; expectedRevision: number },
): Promise<boolean> {
	const [deleted] = await tx
		.delete(apiTokenQuotaOverride)
		.where(
			and(
				eq(apiTokenQuotaOverride.tokenId, input.tokenId),
				eq(apiTokenQuotaOverride.revision, input.expectedRevision),
			),
		)
		.returning({ tokenId: apiTokenQuotaOverride.tokenId });
	return deleted !== undefined;
}
