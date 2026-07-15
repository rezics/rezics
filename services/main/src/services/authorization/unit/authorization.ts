import { and, eq, inArray } from "drizzle-orm";

import { database } from "../../database";
import { unit, unitCollaborator, unitFieldLock } from "../../database/schema";
import {
	UnitEditForbidden,
	UnitFieldLocked,
	UnitNotFound,
	UnitRestoreForbidden,
} from "../../units/errors";
import type { PlatformAuthorization } from "../platform/authorization";
import { getUnitReadCondition } from "./query";

const UnitEditorRoles = ["owner", "editor"] as const;

async function canReadUnit(unitId: string, profileId?: string) {
	const [unitRecord] = await database
		.select({ id: unit.id })
		.from(unit)
		.where(and(eq(unit.id, unitId), getUnitReadCondition(profileId)))
		.limit(1);
	return Boolean(unitRecord);
}

export class UnitAuthorization<ProfileId extends string | undefined> {
	readonly #booleanDecisions = new Map<string, Promise<boolean>>();

	constructor(
		readonly profileId: ProfileId,
		private readonly platform: PlatformAuthorization<ProfileId>,
	) {}

	#onceBoolean(key: string, decide: () => Promise<boolean>): Promise<boolean> {
		const current = this.#booleanDecisions.get(key);
		if (current) return current;
		const decision = decide();
		this.#booleanDecisions.set(key, decision);
		return decision;
	}

	canRead(unitId: string) {
		return this.#onceBoolean(`unit:${unitId}:read`, () => canReadUnit(unitId, this.profileId));
	}

	ensureCanRead(unitId: string): Promise<void>;
	ensureCanRead<E extends Error>(unitId: string, onDenied: () => E): Promise<void>;
	async ensureCanRead<E extends Error>(
		unitId: string,
		onDenied: () => E | UnitNotFound = () => new UnitNotFound(),
	): Promise<void> {
		if (!(await this.canRead(unitId))) throw onDenied();
	}

	async ensureCanEdit(this: UnitAuthorization<string>, unitId: string): Promise<void> {
		const decision = await this.#getEditDecision(unitId);
		if (decision === "missing") throw new UnitNotFound();
		if (decision === "denied") throw new UnitEditForbidden();
	}

	async ensureFieldsUnlocked(
		this: UnitAuthorization<string>,
		unitId: string,
		changedPaths: readonly string[],
	): Promise<void> {
		if (await this.platform.hasCapability("unit.edit")) return;
		const locks = await database
			.select({ path: unitFieldLock.path, lockedById: unitFieldLock.lockedByProfileId })
			.from(unitFieldLock)
			.where(eq(unitFieldLock.unitId, unitId));
		const blocked = locks.find(
			(lock) =>
				lock.lockedById !== this.profileId &&
				changedPaths.some(
					(path) =>
						path === lock.path ||
						path.startsWith(`${lock.path}/`) ||
						lock.path.startsWith(`${path}/`) ||
						path === "/",
				),
		);
		if (blocked) throw new UnitFieldLocked(blocked.path);
	}

	async ensureCanRestore(this: UnitAuthorization<string>, unitId: string): Promise<void> {
		const [unitRecord] = await database
			.select({ id: unit.id })
			.from(unit)
			.where(eq(unit.id, unitId))
			.limit(1);
		if (!unitRecord) throw new UnitNotFound();
		if (await this.platform.hasCapability("unit.edit")) return;
		const [permission] = await database
			.select({ unitId: unitCollaborator.unitId })
			.from(unitCollaborator)
			.where(
				and(
					eq(unitCollaborator.unitId, unitId),
					eq(unitCollaborator.profileId, this.profileId),
					inArray(unitCollaborator.role, UnitEditorRoles),
				),
			)
			.limit(1);
		if (!permission) throw new UnitRestoreForbidden();
	}

	canEdit(unitId: string) {
		return this.#onceBoolean(`unit:${unitId}:can-edit`, async () => {
			if (!this.profileId) return false;
			return (await this.#getEditDecision(unitId)) === "allowed";
		});
	}

	async #getEditDecision(unitId: string) {
		if (!this.profileId) return "denied" as const;
		const [unitRecord] = await database
			.select({ status: unit.status })
			.from(unit)
			.where(eq(unit.id, unitId))
			.limit(1);
		if (!unitRecord) return "missing" as const;
		if (await this.platform.hasCapability("unit.edit")) return "allowed" as const;
		const [permission] = await database
			.select({ role: unitCollaborator.role })
			.from(unitCollaborator)
			.where(
				and(
					eq(unitCollaborator.unitId, unitId),
					eq(unitCollaborator.profileId, this.profileId),
					inArray(unitCollaborator.role, UnitEditorRoles),
				),
			)
			.limit(1);
		return permission ? ("allowed" as const) : ("denied" as const);
	}
}
