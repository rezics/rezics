import { eq } from "drizzle-orm";

import type { DatabaseTransaction } from "../../database";
import { apiQuotaPolicy, apiQuotaPolicyRevision } from "../../database/schema";
import { DefaultApiQuotaPolicies } from "../../auth/api-quota/policy-schema";
import { bootstrapEpoch } from "./common";

export async function ensureDefaultApiQuotaPolicies(tx: DatabaseTransaction): Promise<void> {
	for (const definition of Object.values(DefaultApiQuotaPolicies)) {
		await tx
			.insert(apiQuotaPolicy)
			.values({
				key: definition.key,
				subjectKind: definition.subjectKind,
				class: definition.class,
				currentRevision: 1,
				enabled: true,
				createdAt: bootstrapEpoch(),
				updatedAt: bootstrapEpoch(),
			})
			.onConflictDoNothing({ target: apiQuotaPolicy.key });
		const [policy] = await tx
			.select({ id: apiQuotaPolicy.id })
			.from(apiQuotaPolicy)
			.where(eq(apiQuotaPolicy.key, definition.key))
			.limit(1);
		if (!policy) throw new Error(`Failed to bootstrap API quota policy: ${definition.key}`);
		await tx
			.insert(apiQuotaPolicyRevision)
			.values({
				policyId: policy.id,
				revision: 1,
				schemaVersion: definition.schemaVersion,
				configuration: definition.configuration,
				changeReason: "Bootstrap default",
				createdByProfileId: null,
				createdAt: bootstrapEpoch(),
			})
			.onConflictDoNothing({
				target: [apiQuotaPolicyRevision.policyId, apiQuotaPolicyRevision.revision],
			});
	}
}
