import { and, eq, isNull, sql } from "drizzle-orm";
import type { RequestedAuthoritySelection } from "@rezics/access";
import type { PrincipalRequestContext } from "../auth/principal-context";
import { readFirstPartyCredentialAuthority } from "../auth/credential-authority";
import { allocateAccessScope } from "./identities";
import { allocateReferenceValue } from "../units/reference-value";
import { applyIdentityPreferenceCommand, captureIdentityPreference } from "./identity-preferences";
import { readPrivateAccountAuthority } from "./private-account-authority";
import { evaluateCurrentRepresentationAuthority } from "./representation-authority";
import { AccessDenied, AccessUnavailable } from "./http-errors";
import { requireAccessAdmission, runAccessTransaction } from "./transaction";
import { entityIdentity } from "@rezics/schema/postgres/catalog/identity";

/** Read the private recorded choice; it is not a current representation or publication admission. @internal */
export async function getMainIdentityPreference(context: PrincipalRequestContext) {
	return runAccessTransaction(async tx => {
		const owner = await readPrivateAccountAuthority(tx, context, false);
		const choice = await captureIdentityPreference(tx, { authUserId: context.principalId, clientId: null });
		await requireAccessAdmission(tx, owner.admission);
		return { version: choice.mainVersion, entityId: choice.entityId };
	});
}

/** Capture and revalidate the preferred context once; stale hints never retarget it to another Entity. @internal */
export async function resolveMainIdentityPreference(context: PrincipalRequestContext) {
	return runAccessTransaction(async tx => {
		const owner = await readPrivateAccountAuthority(tx, context, false);
		const choice = await captureIdentityPreference(tx, { authUserId: owner.principalId, clientId: null });
		if (!choice.entityId) {
			await requireAccessAdmission(tx, owner.admission);
			return { status: "unset" as const, version: choice.mainVersion };
		}
		const selection = { mode: "represented" as const, entityId: choice.entityId, representations: choice.representations };
		const credential = await readFirstPartyCredentialAuthority(tx, { proof: context.credentialProof(), selection,
			apiPermission: "account:read", requireFreshSession: false, requireVerifiedEmail: false });
		const scopeId = await allocateAccessScope(tx, { kind: "resource", referenceValueId: await allocateReferenceValue(tx, { owner: "entity", id: choice.entityId }) });
		const represented = await evaluateCurrentRepresentationAuthority(tx, { principalId: owner.principalId, selection,
			operation: { scopeId, path: ["identity"], permission: { family: "management", key: "access.identity.select" } },
			action: "read", freshSession: credential.freshSession, freshSessionValidUntil: credential.freshSessionValidUntil });
		await requireAccessAdmission(tx, owner.admission);
		if (represented.outcome === "unavailable") throw new AccessUnavailable();
		if (represented.outcome === "deny") return { status: "selection-required" as const, version: choice.mainVersion, entityId: choice.entityId };
		const limits = [credential.validUntil, owner.credential.validUntil, represented.validUntil].filter((value): value is number => typeof value === "number");
		const validUntil = limits.length ? Math.min(...limits) : null;
		await requireAccessAdmission(tx, sql<boolean>`(${owner.admission}) and (${credential.admission}) and public.access_representation_path_is_current(
			array[${sql.join(represented.path.map(ref => sql`${ref.id}::uuid`), sql`, `)}],
			array[${sql.join(represented.path.map(ref => sql`${ref.revision}::bigint`), sql`, `)}],
			${owner.subjectId}::uuid,${choice.entityId}::uuid,'read') is true
			and (${validUntil === null ? sql`true` : sql`clock_timestamp()<${new Date(validUntil)}::timestamptz`})`);
		return { status: "ready" as const, version: choice.mainVersion, selection,
			validUntil: validUntil === null ? null : new Date(validUntil).toISOString() };
	});
}

/** Select or explicitly clear the main identity without changing a grant, consent or prepared request. @internal */
export async function setMainIdentityPreference(context: PrincipalRequestContext, input: {
	operationId: string; expectedVersion: number;
	selection: { mode: "none" } | Extract<RequestedAuthoritySelection, { mode: "represented" }>;
}) {
	return runAccessTransaction(async tx => {
		const owner = await readPrivateAccountAuthority(tx, context, true);
		let admission = owner.admission;
		if (input.selection.mode === "represented") {
			const selected = input.selection;
			const credential = await readFirstPartyCredentialAuthority(tx, { proof: context.credentialProof(), selection: selected,
				apiPermission: "account:update", requireFreshSession: false, requireVerifiedEmail: true });
			const [entity] = await tx.select({ id: entityIdentity.id }).from(entityIdentity)
				.where(and(eq(entityIdentity.id, selected.entityId), isNull(entityIdentity.deletedAt))).for("share");
			if (!entity) throw new AccessDenied();
			const scopeId = await allocateAccessScope(tx, { kind: "resource", referenceValueId: await allocateReferenceValue(tx, { owner: "entity", id: selected.entityId }) });
			const representation = await evaluateCurrentRepresentationAuthority(tx, { principalId: owner.principalId, selection: selected,
				operation: { scopeId, path: ["identity"], permission: { family: "management", key: "access.identity.select" } },
				action: "write", freshSession: credential.freshSession, freshSessionValidUntil: credential.freshSessionValidUntil });
			if (representation.outcome === "deny") throw new AccessDenied();
			if (representation.outcome !== "allow") throw new AccessUnavailable();
			admission = sql<boolean>`(${admission}) and (${credential.admission}) and public.access_representation_path_is_current(
				array[${sql.join(representation.path.map(ref => sql`${ref.id}::uuid`), sql`, `)}],
				array[${sql.join(representation.path.map(ref => sql`${ref.revision}::bigint`), sql`, `)}],
				${owner.subjectId}::uuid,${selected.entityId}::uuid,'write') is true
				and (${representation.validUntil === null ? sql`true` : sql`clock_timestamp()<${new Date(representation.validUntil)}::timestamptz`})`;
		}
		const result = await applyIdentityPreferenceCommand(tx, { authUserId: owner.principalId, clientId: null,
			operationId: input.operationId, expectedVersion: input.expectedVersion,
			operatorAuthUserId: owner.principalId, authoritySubjectId: owner.subjectId,
			selection: input.selection.mode === "none" ? { kind: "none" } : { kind: "entity", entityId: input.selection.entityId,
				representations: input.selection.representations } }, admission);
		return { operationId: result.operationId, version: result.version };
	});
}
