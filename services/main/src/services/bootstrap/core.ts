import { UnitOwnerValues } from "@rezics/reference";
import { unitOwnerTable } from "../database/schema/unit-reference-columns";
import { inArray } from "drizzle-orm";

import { database, type DatabaseExecutor } from "../database";
import { accounts, entityIdentity, users, slugNamespace } from "../database/schema";
import {
	BootstrapAccountIds,
	BootstrapAuthUserIds,
	BootstrapEntityIds,
	BootstrapUnitIds,
	BootstrapPlatformReferences,
	BootstrapNamespaceIds,
} from "./data";

export const PlatformInstallationLockName = "rezics-platform-installation";

export type PlatformCoreIdentityKind =
	| "unit"
	| "entity"
	| "auth_user"
	| "account"
	| "slug_namespace";

export interface PlatformCoreIdentity {
	readonly kind: PlatformCoreIdentityKind;
	readonly id: string;
}

const PlatformCoreIdentities: readonly PlatformCoreIdentity[] = [
	...BootstrapNamespaceIds.map((id) => ({ kind: "slug_namespace" as const, id })),
	...BootstrapEntityIds.map((id) => ({ kind: "entity" as const, id })),
	...BootstrapUnitIds.map((id) => ({ kind: "unit" as const, id })),
	...BootstrapAuthUserIds.map((id) => ({ kind: "auth_user" as const, id })),
	...BootstrapAccountIds.map((id) => ({ kind: "account" as const, id })),
];

export interface PlatformCoreReady {
	readonly status: "ready";
}

export interface PlatformCoreUninstalled {
	readonly status: "uninstalled";
}

export interface PlatformCoreOccupied {
	readonly status: "occupied";
}

export interface PlatformCoreIncomplete {
	readonly status: "incomplete";
	readonly missingIdentities: readonly PlatformCoreIdentity[];
}

export type PlatformCoreState =
	| PlatformCoreReady
	| PlatformCoreUninstalled
	| PlatformCoreOccupied
	| PlatformCoreIncomplete;

export function classifyPlatformCore(
	presentIdentityIds: ReadonlySet<string>,
	hasApplicationData: boolean,
): PlatformCoreState {
	const missingIdentities = PlatformCoreIdentities.filter(
		(identity) => !presentIdentityIds.has(identity.id),
	);
	if (missingIdentities.length === 0) return { status: "ready" };
	if (presentIdentityIds.size > 0) return { status: "incomplete", missingIdentities };
	return hasApplicationData ? { status: "occupied" } : { status: "uninstalled" };
}

/**
 * Inspect only permanent platform identities. Product-owned fields and content
 * are deliberately outside this deployment gate after installation.
 */
export async function readBootstrapPlatformIdentityIds(executor: DatabaseExecutor) {
	const result: string[] = [];
	for (const owner of new Set(BootstrapPlatformReferences.map((reference) => reference.owner))) {
		const table = unitOwnerTable(owner);
		const rows = await executor
			.select({ id: table.id })
			.from(table)
			.where(
				inArray(
					table.id,
					BootstrapPlatformReferences.filter((reference) => reference.owner === owner).map(
						(reference) => reference.id,
					),
				),
			);
		result.push(...rows.map((row) => row.id));
	}
	return result;
}

export async function inspectPlatformCore(
	executor: DatabaseExecutor = database,
): Promise<PlatformCoreState> {
	// A transaction executor owns one PostgreSQL client, so keep these reads sequential.
	const storedUnits = await readBootstrapPlatformIdentityIds(executor);
	const storedNamespaces = await executor
		.select({ id: slugNamespace.id })
		.from(slugNamespace)
		.where(inArray(slugNamespace.id, BootstrapNamespaceIds));
	const storedEntities = await executor
		.select({ id: entityIdentity.id })
		.from(entityIdentity)
		.where(inArray(entityIdentity.id, BootstrapEntityIds));
	const storedUsers = await executor
		.select({ id: users.id })
		.from(users)
		.where(inArray(users.id, BootstrapAuthUserIds));
	const storedAccounts = await executor
		.select({ id: accounts.id })
		.from(accounts)
		.where(inArray(accounts.id, BootstrapAccountIds));
	const presentIdentityIds = new Set([
		...storedEntities.map(({ id }) => id),
		...storedUnits,
		...storedNamespaces.map((row) => row.id),
		...storedUsers.map(({ id }) => id),
		...storedAccounts.map(({ id }) => id),
	]);
	if (presentIdentityIds.size > 0) return classifyPlatformCore(presentIdentityIds, true);

	let anyUnit = false;
	for (const owner of UnitOwnerValues) {
		const table = unitOwnerTable(owner);
		const [row] = await executor.select({ id: table.id }).from(table).limit(1);
		if (row) {
			anyUnit = true;
			break;
		}
	}
	const [anyUser] = await executor.select({ id: users.id }).from(users).limit(1);
	const [anyAccount] = await executor.select({ id: accounts.id }).from(accounts).limit(1);
	return classifyPlatformCore(presentIdentityIds, Boolean(anyUnit || anyUser || anyAccount));
}

export function describePlatformCoreState(
	state: Exclude<PlatformCoreState, PlatformCoreReady>,
): string {
	switch (state.status) {
		case "uninstalled":
			return "the platform has not been installed";
		case "occupied":
			return "the database contains application data but no complete platform installation";
		case "incomplete":
			return `the platform is missing fixed identities: ${state.missingIdentities
				.map(({ kind, id }) => `${kind}:${id}`)
				.join(", ")}`;
	}
}

export function assertPlatformCoreReady(
	state: PlatformCoreState,
): asserts state is PlatformCoreReady {
	if (state.status !== "ready")
		throw new Error(`Platform core verification failed: ${describePlatformCoreState(state)}`);
}

export type PlatformEnsureDecision = "ensure" | "refuse-occupied";

/** Occupied databases are the only state that must not receive reserved IDs. */
export function decidePlatformEnsureAction(state: PlatformCoreState): PlatformEnsureDecision {
	return state.status === "occupied" ? "refuse-occupied" : "ensure";
}
