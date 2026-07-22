import { and, eq, sql } from "drizzle-orm";
import { getActiveObservability } from "@rezics/observability";

import { database, type DatabaseExecutor, type DatabaseTransaction } from "../../database";
import {
	apiAccessPolicy,
	apiTokenPolicyBinding,
	type ApiTokenPolicyKind,
} from "../../database/schema";
import {
	ApiTokenPolicyDocumentInvalid,
	DefaultApiTokenPolicies,
	decodeTokenPolicyConfiguration,
	decodeTokenPolicyOverride,
	mergeTokenPolicy,
	type TokenPolicyConfiguration,
	type TokenPolicyOverride,
} from "./policy-schema";

const { logger } = getActiveObservability();

type PolicyRow = typeof apiAccessPolicy.$inferSelect;
type BindingRow = typeof apiTokenPolicyBinding.$inferSelect;

export type ResolvedApiTokenPolicy = {
	tokenId: string;
	policyId: string;
	key: string;
	kind: ApiTokenPolicyKind;
	schemaVersion: number;
	policyRevision: number;
	bindingRevision: number | null;
	validUntil: Date | null;
	configuration: TokenPolicyConfiguration;
	source: "assigned" | "standard_default" | "trusted_fallback";
};

export type ApiTokenPolicySummary = {
	id: string;
	key: string;
	kind: ApiTokenPolicyKind;
	schemaVersion: number;
	configuration: TokenPolicyConfiguration;
	revision: number;
	enabled: boolean;
	updatedAt: Date;
};

export class ApiTokenPolicyAssignmentInvalid extends Error {
	constructor() {
		super("Staff Trusted policy assignments require a future expiry and reason");
		this.name = "ApiTokenPolicyAssignmentInvalid";
	}
}

async function findPolicyByKey(executor: DatabaseExecutor, key: string) {
	const [row] = await executor
		.select()
		.from(apiAccessPolicy)
		.where(eq(apiAccessPolicy.key, key))
		.limit(1);
	return row;
}

async function requireStandardPolicy(executor: DatabaseExecutor): Promise<PolicyRow> {
	const standard = await findPolicyByKey(executor, DefaultApiTokenPolicies.standard.key);
	if (!standard?.enabled || standard.kind !== "standard")
		throw new Error("The default Standard API token policy is unavailable");
	return standard;
}

function resolvePolicyDocument(
	tokenId: string,
	policy: PolicyRow,
	binding: BindingRow | undefined,
	source: ResolvedApiTokenPolicy["source"],
): ResolvedApiTokenPolicy {
	const configuration = decodeTokenPolicyConfiguration(
		policy.kind,
		policy.schemaVersion,
		policy.configuration,
	);
	const override = binding
		? decodeTokenPolicyOverride(
				policy.kind,
				policy.schemaVersion,
				binding.configurationOverride,
			)
		: {};
	return {
		tokenId,
		policyId: policy.id,
		key: policy.key,
		kind: policy.kind,
		schemaVersion: policy.schemaVersion,
		policyRevision: policy.revision,
		bindingRevision: binding?.revision ?? null,
		validUntil: binding?.validUntil ?? null,
		configuration: mergeTokenPolicy(configuration, override),
		source,
	};
}

async function resolveStandardFallback(
	executor: DatabaseExecutor,
	tokenId: string,
	source: "standard_default" | "trusted_fallback",
): Promise<ResolvedApiTokenPolicy> {
	const standard = await requireStandardPolicy(executor);
	return resolvePolicyDocument(tokenId, standard, undefined, source);
}

async function resolveTrustedFallback(
	executor: DatabaseExecutor,
	tokenId: string,
	binding: BindingRow,
): Promise<ResolvedApiTokenPolicy> {
	const fallback = await resolveStandardFallback(executor, tokenId, "trusted_fallback");
	return {
		...fallback,
		bindingRevision: binding.revision,
		validUntil: binding.validUntil,
	};
}

export async function resolveApiTokenPolicy(
	tokenId: string,
	options: { executor?: DatabaseExecutor; now?: Date } = {},
): Promise<ResolvedApiTokenPolicy> {
	const executor = options.executor ?? database;
	const now = options.now ?? new Date();
	const [record] = await executor
		.select({ binding: apiTokenPolicyBinding, policy: apiAccessPolicy })
		.from(apiTokenPolicyBinding)
		.innerJoin(apiAccessPolicy, eq(apiAccessPolicy.id, apiTokenPolicyBinding.policyId))
		.where(eq(apiTokenPolicyBinding.tokenId, tokenId))
		.limit(1);

	if (!record) return resolveStandardFallback(executor, tokenId, "standard_default");

	const { binding, policy } = record;
	const trustedUnavailable =
		policy.kind === "staff_trusted" &&
		(!policy.enabled || binding.validUntil === null || binding.validUntil <= now);
	if (trustedUnavailable) return resolveTrustedFallback(executor, tokenId, binding);
	if (!policy.enabled) throw new Error(`Assigned API token policy is disabled: ${policy.key}`);

	try {
		return resolvePolicyDocument(tokenId, policy, binding, "assigned");
	} catch (error) {
		if (policy.kind !== "staff_trusted" || !(error instanceof ApiTokenPolicyDocumentInvalid))
			throw error;
		logger.error("Invalid Staff Trusted API token policy; using Standard fallback", {
			eventName: "api_token.policy.trusted_fallback",
			errorCode: "ApiTokenPolicyDocumentInvalid",
			error,
			attributes: { tokenId, policyId: policy.id, policyKey: policy.key },
		});
		return resolveTrustedFallback(executor, tokenId, binding);
	}
}

export async function bindStandardPolicyToToken(
	executor: DatabaseExecutor,
	input: { tokenId: string; actorProfileId: string; override?: unknown },
): Promise<void> {
	const standard = await requireStandardPolicy(executor);
	decodeTokenPolicyConfiguration(standard.kind, standard.schemaVersion, standard.configuration);
	const override = decodeTokenPolicyOverride(
		standard.kind,
		standard.schemaVersion,
		input.override ?? {},
	);
	await executor
		.insert(apiTokenPolicyBinding)
		.values({
			tokenId: input.tokenId,
			policyId: standard.id,
			configurationOverride: override,
			assignedByProfileId: input.actorProfileId,
		})
		.onConflictDoNothing({ target: apiTokenPolicyBinding.tokenId });
}

export async function replaceTokenPolicyOverride(
	tx: DatabaseTransaction,
	input: {
		tokenId: string;
		actorProfileId: string;
		expectedRevision: number;
		override: unknown;
	},
): Promise<ResolvedApiTokenPolicy | undefined> {
	await bindStandardPolicyToToken(tx, input);
	const resolved = await resolveApiTokenPolicy(input.tokenId, { executor: tx });
	const override = decodeTokenPolicyOverride(
		resolved.kind,
		resolved.schemaVersion,
		input.override,
	);
	const [updated] = await tx
		.update(apiTokenPolicyBinding)
		.set({
			configurationOverride: override,
			...(resolved.source === "trusted_fallback"
				? {
						policyId: resolved.policyId,
						validUntil: null,
						assignedByProfileId: input.actorProfileId,
						assignmentReason: null,
					}
				: {}),
			revision: sql`${apiTokenPolicyBinding.revision} + 1`,
		})
		.where(
			and(
				eq(apiTokenPolicyBinding.tokenId, input.tokenId),
				eq(apiTokenPolicyBinding.revision, input.expectedRevision),
			),
		)
		.returning({ revision: apiTokenPolicyBinding.revision });
	if (!updated) return undefined;
	return resolveApiTokenPolicy(input.tokenId, { executor: tx });
}

export async function listApiTokenPolicies(
	executor: DatabaseExecutor = database,
): Promise<ApiTokenPolicySummary[]> {
	const rows = await executor.select().from(apiAccessPolicy).orderBy(apiAccessPolicy.key);
	return rows.map((row) => ({
		id: row.id,
		key: row.key,
		kind: row.kind,
		schemaVersion: row.schemaVersion,
		configuration: decodeTokenPolicyConfiguration(
			row.kind,
			row.schemaVersion,
			row.configuration,
		),
		revision: row.revision,
		enabled: row.enabled,
		updatedAt: row.updatedAt,
	}));
}

export async function replaceApiTokenPolicyConfiguration(
	tx: DatabaseTransaction,
	input: {
		key: string;
		expectedRevision: number;
		configuration: unknown;
		actorProfileId: string;
	},
): Promise<ApiTokenPolicySummary | undefined> {
	const policy = await findPolicyByKey(tx, input.key);
	if (!policy) return undefined;
	const configuration = decodeTokenPolicyConfiguration(
		policy.kind,
		policy.schemaVersion,
		input.configuration,
	);
	const [updated] = await tx
		.update(apiAccessPolicy)
		.set({
			configuration,
			updatedByProfileId: input.actorProfileId,
			revision: sql`${apiAccessPolicy.revision} + 1`,
		})
		.where(
			and(
				eq(apiAccessPolicy.id, policy.id),
				eq(apiAccessPolicy.revision, input.expectedRevision),
			),
		)
		.returning();
	if (!updated) return undefined;
	return {
		id: updated.id,
		key: updated.key,
		kind: updated.kind,
		schemaVersion: updated.schemaVersion,
		configuration: decodeTokenPolicyConfiguration(
			updated.kind,
			updated.schemaVersion,
			updated.configuration,
		),
		revision: updated.revision,
		enabled: updated.enabled,
		updatedAt: updated.updatedAt,
	};
}

export async function assignApiTokenPolicy(
	tx: DatabaseTransaction,
	input: {
		tokenId: string;
		policyKey: string;
		validUntil?: Date;
		reason: string;
		override: unknown;
		actorProfileId: string;
	},
): Promise<ResolvedApiTokenPolicy | undefined> {
	const policy = await findPolicyByKey(tx, input.policyKey);
	if (!policy?.enabled) return undefined;
	decodeTokenPolicyConfiguration(policy.kind, policy.schemaVersion, policy.configuration);
	const override: TokenPolicyOverride = decodeTokenPolicyOverride(
		policy.kind,
		policy.schemaVersion,
		input.override,
	);
	if (
		policy.kind === "staff_trusted" &&
		(!input.validUntil || input.validUntil <= new Date() || input.reason.trim() === "")
	)
		throw new ApiTokenPolicyAssignmentInvalid();

	await tx
		.insert(apiTokenPolicyBinding)
		.values({
			tokenId: input.tokenId,
			policyId: policy.id,
			configurationOverride: override,
			validUntil: policy.kind === "staff_trusted" ? input.validUntil : null,
			assignedByProfileId: input.actorProfileId,
			assignmentReason: input.reason.trim(),
		})
		.onConflictDoUpdate({
			target: apiTokenPolicyBinding.tokenId,
			set: {
				policyId: policy.id,
				configurationOverride: override,
				validUntil: policy.kind === "staff_trusted" ? input.validUntil : null,
				assignedByProfileId: input.actorProfileId,
				assignmentReason: input.reason.trim(),
				revision: sql`${apiTokenPolicyBinding.revision} + 1`,
			},
		});
	return resolveApiTokenPolicy(input.tokenId, { executor: tx });
}
