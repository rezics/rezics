import { and, eq, gt, sql, type SQL } from "drizzle-orm";
import type { PrincipalRequestContext } from "../auth/principal-session";
import type { DatabaseTransaction } from "../database";
import { connectedApp, connectedAppEvent } from "@rezics/schema/postgres/integrations/connected-app";
import { users } from "@rezics/schema/postgres/identity/auth";
import { workloadPrincipal } from "@rezics/schema/postgres/identity/workload-principal";
import { allocateAccessScope, resolveAccessScope } from "../authorization/identities";
import { resolveReferenceValue } from "../units/reference-value";
import { scopeLifecycleAdmission } from "../authorization/scope-policy";
import { readManagementAuthority } from "../authorization/management-authority";
import { requireAccessAdmission, runAccessTransaction } from "../authorization/transaction";
import { AccessInputInvalid, AccessRecordUnavailable } from "../authorization/http-errors";
import { applyConnectedAppCommand, readConnectedAppDefinition, ConnectedAppUnavailable, type ConnectedAppCommand, type ConnectedAppReceipt } from "./apps";

async function controllerLifecycle(tx: DatabaseTransaction, scopeId: string, change: boolean): Promise<SQL<boolean | null>> {
	const scope = await resolveAccessScope(tx, scopeId);
	if (!scope) throw new AccessRecordUnavailable();
	if (scope.kind === "platform" || (scope.kind === "resource" && (await resolveReferenceValue(tx, scope.referenceValueId))?.owner !== "entity"))
		throw new AccessInputInvalid();
	if (scope.kind === "account") {
		const [owner] = await tx.select({ kind: users.principalKind }).from(users).where(eq(users.id, scope.id)).for("share");
		if (!owner) throw new AccessRecordUnavailable();
		if (owner.kind === "service") {
			const [workload] = await tx.select({ purpose: workloadPrincipal.purpose }).from(workloadPrincipal).where(eq(workloadPrincipal.authUserId, scope.id)).limit(1);
			if (workload?.purpose !== "system") throw new AccessInputInvalid();
		}
	}
	return scopeLifecycleAdmission(tx, scopeId, change);
}
type PublisherCommand = Exclude<ConnectedAppCommand, { operation: "set-trust" }> extends infer Command
	? Command extends { operatorAuthUserId: string; authoritySubjectId: string }
		? Omit<Command, "operatorAuthUserId" | "authoritySubjectId"> : never : never;

function presentReceipt(value: ConnectedAppReceipt) {
	return { appId: value.appId, operationId: value.operationId, version: value.version,
		declaredRevision: value.declaredRevision, state: value.state, trust: value.trust };
}

/** App publishers control declarations/lifecycle; this path cannot change platform trust. @internal */
export async function manageConnectedApp(context: PrincipalRequestContext, input: PublisherCommand) {
	return runAccessTransaction(async tx => {
		const lifecycle = await controllerLifecycle(tx, input.scopeId, true);
		const permission = input.operation === "create" ? "app.create"
			: input.operation === "disable" ? "app.disable" : input.operation === "retire" ? "app.retire" : "app.update";
		const authority = await readManagementAuthority(tx, { proof: context.credentialProof(), selection: context.selection, scopeId: input.scopeId,
			path: ["apps", input.appId], permission, apiPermission: "app:manage", mutation: true,
			requireFreshSession: input.operation === "retire" }, lifecycle);
		return presentReceipt(await applyConnectedAppCommand(tx, { ...input, operatorAuthUserId: authority.principalId, authoritySubjectId: authority.subjectId }, authority.admission));
	});
}

/** Platform trust review resolves the private controller internally and cannot be conferred by an App publisher. @internal */
export async function setConnectedAppTrust(context: PrincipalRequestContext, input: {
	appId: string; operationId: string; expectedVersion: number; trust: "unreviewed" | "trusted" | "blocked";
}) {
	return runAccessTransaction(async tx => {
		const platformScope = await allocateAccessScope(tx, { kind: "platform" });
		const authority = await readManagementAuthority(tx, { proof: context.credentialProof(), selection: context.selection, scopeId: platformScope,
			path: ["apps", input.appId], permission: "app.trust.manage", apiPermission: null, mutation: true, requireFreshSession: true }, sql<boolean>`true`);
		const [app] = await tx.select({ scopeId: connectedApp.scopeId }).from(connectedApp).where(eq(connectedApp.id, input.appId)).limit(1);
		if (!app) throw new AccessRecordUnavailable();
		return presentReceipt(await applyConnectedAppCommand(tx, { ...input, scopeId: app.scopeId, operation: "set-trust",
			operatorAuthUserId: authority.principalId, authoritySubjectId: authority.subjectId }, authority.admission));
	});
}

/** Disclose one declaration through its controller root, without private actor/root identifiers. @internal */
export async function getManagedConnectedApp(context: PrincipalRequestContext, scopeId: string, appId: string, revision?: number) {
	return runAccessTransaction(async tx => {
		const lifecycle = await controllerLifecycle(tx, scopeId, false);
		const authority = await readManagementAuthority(tx, { proof: context.credentialProof(), selection: context.selection, scopeId,
			path: ["apps", appId], permission: "app.read", apiPermission: "app:read", mutation: false, requireFreshSession: false }, lifecycle);
		const [head] = await tx.select().from(connectedApp).where(and(eq(connectedApp.id, appId), eq(connectedApp.scopeId, scopeId))).for("share");
		if (!head) throw new AccessRecordUnavailable();
		if (head.state === "draft" || head.declaredRevision === null) throw new ConnectedAppUnavailable();
		const value = await readConnectedAppDefinition(tx, { appId, revision: revision ?? "declared" });
		if (!value) throw new AccessRecordUnavailable();
		await requireAccessAdmission(tx, authority.admission);
		const definition = value.definition;
		return { id: head.id, version: head.version, state: head.state, trust: head.trust, declaredRevision: head.declaredRevision,
			definition: { revision: definition.revision, label: definition.label, description: definition.description,
				capabilities: definition.capabilities, offlineAccess: definition.offlineAccess, entityDisclosure: definition.entityDisclosure } };
	});
}

/** Keyset-paginated App inventory within one explicitly disclosed controller root. @internal */
export async function listManagedConnectedApps(context: PrincipalRequestContext, scopeId: string, afterId?: string) {
	return runAccessTransaction(async tx => {
		const lifecycle = await controllerLifecycle(tx, scopeId, false);
		const authority = await readManagementAuthority(tx, { proof: context.credentialProof(), selection: context.selection, scopeId,
			path: ["apps"], permission: "app.read", apiPermission: "app:read", mutation: false, requireFreshSession: false }, lifecycle);
		const rows = (await tx.execute<{ id: string; version: string; state: "active" | "disabled" | "retired"; trust: "unreviewed" | "trusted" | "blocked"; declared_revision: string; label: string }>(sql`
			select a.id,a.version::text,a.state,a.trust,a.declared_revision::text,r.label from public.connected_app a
			join public.connected_app_revision r on r.app_id=a.id and r.revision=a.declared_revision and r.sealed
			where a.scope_id=${scopeId}::uuid ${afterId ? sql`and a.id>${afterId}::uuid` : sql``} order by a.id limit 101`)).rows;
		await requireAccessAdmission(tx, authority.admission);
		const page = rows.slice(0, 100);
		return { items: page.map(row => ({ id: row.id, version: Number(row.version), state: row.state, trust: row.trust,
			declaredRevision: Number(row.declared_revision), label: row.label })), nextCursor: rows.length > 100 ? page.at(-1)?.id ?? null : null };
	});
}

/** Redacted control history; trust reviews and private issuer identities have separate disclosure policy. @internal */
export async function listManagedConnectedAppHistory(context: PrincipalRequestContext, scopeId: string, appId: string, afterVersion?: number) {
	return runAccessTransaction(async tx => {
		const lifecycle = await controllerLifecycle(tx, scopeId, false);
		const authority = await readManagementAuthority(tx, { proof: context.credentialProof(), selection: context.selection, scopeId,
			path: ["apps", appId], permission: "app.read", apiPermission: "app:read", mutation: false, requireFreshSession: false }, lifecycle);
		const [head] = await tx.select({ id: connectedApp.id }).from(connectedApp).where(and(eq(connectedApp.id, appId), eq(connectedApp.scopeId, scopeId))).limit(1);
		if (!head) throw new AccessRecordUnavailable();
		const rows = await tx.select({ version: connectedAppEvent.version, operationId: connectedAppEvent.operationId,
			operation: connectedAppEvent.operation, state: connectedAppEvent.stateAfter, trust: connectedAppEvent.trustAfter,
			retainedRevision: connectedAppEvent.retainedDeclaredRevision, createdAt: connectedAppEvent.createdAt }).from(connectedAppEvent)
			.where(and(eq(connectedAppEvent.appId, appId), afterVersion === undefined ? undefined : gt(connectedAppEvent.version, afterVersion)))
			.orderBy(connectedAppEvent.version).limit(101);
		await requireAccessAdmission(tx, authority.admission);
		const page = rows.slice(0, 100);
		return { items: page.map(({ retainedRevision, createdAt, ...row }) => {
			const declaredRevision = row.operation === "create" || row.operation === "revise" ? row.version : retainedRevision;
			if (declaredRevision === null) throw new ConnectedAppUnavailable();
			return { ...row, declaredRevision, createdAt: createdAt.toISOString() };
		}),
			nextCursor: rows.length > 100 ? page.at(-1)?.version ?? null : null };
	});
}
