import { inArray } from "drizzle-orm";

import { database, type DatabaseExecutor } from "../database";
import { accounts, unit, users } from "../database/schema";
import { BootstrapAccountIds, BootstrapAuthUserIds, BootstrapUnitIds } from "./data";

export const PlatformInstallationLockName = "rezics-platform-installation";

export type PlatformCoreIdentityKind = "unit" | "auth_user" | "account";

export interface PlatformCoreIdentity {
	readonly kind: PlatformCoreIdentityKind;
	readonly id: string;
}

const PlatformCoreIdentities: readonly PlatformCoreIdentity[] = [
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
export async function inspectPlatformCore(
	executor: DatabaseExecutor = database,
): Promise<PlatformCoreState> {
	// A transaction executor owns one PostgreSQL client, so keep these reads sequential.
	const storedUnits = await executor
		.select({ id: unit.id })
		.from(unit)
		.where(inArray(unit.id, [...BootstrapUnitIds]));
	const storedUsers = await executor
		.select({ id: users.id })
		.from(users)
		.where(inArray(users.id, BootstrapAuthUserIds));
	const storedAccounts = await executor
		.select({ id: accounts.id })
		.from(accounts)
		.where(inArray(accounts.id, BootstrapAccountIds));
	const presentIdentityIds = new Set([
		...storedUnits.map(({ id }) => id),
		...storedUsers.map(({ id }) => id),
		...storedAccounts.map(({ id }) => id),
	]);
	if (presentIdentityIds.size > 0) return classifyPlatformCore(presentIdentityIds, true);

	const [anyUnit] = await executor.select({ id: unit.id }).from(unit).limit(1);
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
