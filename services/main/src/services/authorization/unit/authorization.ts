import { and, eq, isNull, or, sql } from "drizzle-orm";

import { database } from "../../database";
import {
	capabilityGrant,
	realmMember,
	unit,
	unitAccessBinding,
	unitAccessRestriction,
	unitProtection,
} from "../../database/schema";
import {
	UnitAccessRestricted,
	UnitNotFound,
	UnitPermissionForbidden,
	UnitProtected,
} from "../../units/errors";
import type { PlatformAuthorization } from "../platform/authorization";
import { canRealmRolePerform, type RealmCapability } from "../realm/policy";
import { roleAllows, type UnitAccessRole, type UnitPermission } from "./policy";
import { getUnitReadCondition } from "./query";
import { scopeCovers, scopeKey, type UnitScope } from "./scope";

export type UnitAccessDecision =
	| { readonly allowed: true; readonly source: "public" | "platform" }
	| {
			readonly allowed: true;
			readonly source: "binding";
			readonly bindingId: string;
			readonly role: UnitAccessRole;
	  }
	| {
			readonly allowed: false;
			readonly reason: "missing" | "anonymous" | "restricted" | "ungranted";
	  }
	| {
			readonly allowed: false;
			readonly reason: "protected";
			readonly mode: "frozen" | "owner_only";
	  };

async function canReadUnit(unitId: string, profileId?: string) {
	const [record] = await database
		.select({ id: unit.id })
		.from(unit)
		.where(and(eq(unit.id, unitId), getUnitReadCondition(profileId)))
		.limit(1);
	return Boolean(record);
}

async function hasRealmCapability(
	realmId: string,
	profileId: string,
	capability: RealmCapability,
): Promise<boolean> {
	const [membership] = await database
		.select({ role: realmMember.role })
		.from(realmMember)
		.where(
			and(
				eq(realmMember.realmId, realmId),
				eq(realmMember.profileId, profileId),
				eq(realmMember.state, "active"),
			),
		)
		.limit(1);
	if (!membership) return false;
	if (canRealmRolePerform(membership.role, capability)) return true;
	const [grant] = await database
		.select({ id: capabilityGrant.id })
		.from(capabilityGrant)
		.where(
			and(
				eq(capabilityGrant.authority, "realm"),
				eq(capabilityGrant.realmId, realmId),
				eq(capabilityGrant.profileId, profileId),
				eq(capabilityGrant.capability, capability),
				isNull(capabilityGrant.revokedAt),
				or(isNull(capabilityGrant.expiresAt), sql`${capabilityGrant.expiresAt} > now()`),
			),
		)
		.limit(1);
	return Boolean(grant);
}

async function realmBindingMatches(
	binding: {
		realmId: string | null;
		realmRelation: "member" | "content_editor" | "governor" | null;
	},
	profileId: string,
): Promise<boolean> {
	if (!binding.realmId || !binding.realmRelation) return false;
	const capability =
		binding.realmRelation === "governor"
			? "realm.settings.update"
			: binding.realmRelation === "content_editor"
				? "realm.contribute"
				: undefined;
	if (capability) return hasRealmCapability(binding.realmId, profileId, capability);
	const [membership] = await database
		.select({ profileId: realmMember.profileId })
		.from(realmMember)
		.where(
			and(
				eq(realmMember.realmId, binding.realmId),
				eq(realmMember.profileId, profileId),
				eq(realmMember.state, "active"),
			),
		)
		.limit(1);
	return Boolean(membership);
}

const MutatingPermissions: readonly UnitPermission[] = [
	"unit.update",
	"unit.publish",
	"unit.history.restore",
	"unit.delete",
];

export class UnitAuthorization<ProfileId extends string | undefined> {
	readonly #decisions = new Map<string, Promise<UnitAccessDecision>>();

	constructor(
		readonly profileId: ProfileId,
		private readonly platform: PlatformAuthorization<ProfileId>,
	) {}

	decide(unitId: string, permission: UnitPermission, scope: UnitScope = []) {
		const key = `unit:${unitId}:${permission}:${scopeKey(scope)}`;
		const current = this.#decisions.get(key);
		if (current) return current;
		const decision = this.#decide(unitId, permission, scope);
		this.#decisions.set(key, decision);
		return decision;
	}

	async #decide(
		unitId: string,
		permission: UnitPermission,
		scope: UnitScope,
	): Promise<UnitAccessDecision> {
		const [record] = await database
			.select({
				status: unit.status,
				visibility: unit.visibility,
				moderationStatus: unit.moderationStatus,
				deletedAt: unit.deletedAt,
			})
			.from(unit)
			.where(eq(unit.id, unitId))
			.limit(1);
		if (!record || record.deletedAt) return { allowed: false, reason: "missing" };

		if (this.profileId && (await this.platform.hasCapability("unit.edit")))
			return { allowed: true, source: "platform" };

		if (this.profileId) {
			const restrictions = await database
				.select({ scope: unitAccessRestriction.scope })
				.from(unitAccessRestriction)
				.where(
					and(
						eq(unitAccessRestriction.unitId, unitId),
						eq(unitAccessRestriction.profileId, this.profileId),
						eq(unitAccessRestriction.permission, permission),
						isNull(unitAccessRestriction.revokedAt),
						or(
							isNull(unitAccessRestriction.expiresAt),
							sql`${unitAccessRestriction.expiresAt} > now()`,
						),
					),
				);
			if (restrictions.some((restriction) => scopeCovers(restriction.scope, scope)))
				return { allowed: false, reason: "restricted" };
		}

		if (
			permission === "unit.read" &&
			record.status === "published" &&
			record.moderationStatus === "approved" &&
			(record.visibility === "public" || record.visibility === "unlisted")
		)
			return { allowed: true, source: "public" };
		if (!this.profileId) return { allowed: false, reason: "anonymous" };

		const bindings = await database
			.select({
				id: unitAccessBinding.id,
				subjectKind: unitAccessBinding.subjectKind,
				profileId: unitAccessBinding.profileId,
				realmId: unitAccessBinding.realmId,
				realmRelation: unitAccessBinding.realmRelation,
				role: unitAccessBinding.role,
				scope: unitAccessBinding.scope,
			})
			.from(unitAccessBinding)
			.where(
				and(
					eq(unitAccessBinding.unitId, unitId),
					isNull(unitAccessBinding.revokedAt),
					or(
						isNull(unitAccessBinding.expiresAt),
						sql`${unitAccessBinding.expiresAt} > now()`,
					),
				),
			);

		let matched:
			| { readonly id: string; readonly role: UnitAccessRole; readonly scope: string[] }
			| undefined;
		for (const binding of bindings) {
			if (!roleAllows(binding.role, permission)) continue;
			if (permission !== "unit.read" && !scopeCovers(binding.scope, scope)) continue;
			const subjectMatches =
				binding.subjectKind === "authenticated" ||
				(binding.subjectKind === "profile" && binding.profileId === this.profileId) ||
				(binding.subjectKind === "realm" &&
					(await realmBindingMatches(binding, this.profileId)));
			if (!subjectMatches) continue;
			if (!matched || binding.scope.length > matched.scope.length)
				matched = { id: binding.id, role: binding.role, scope: binding.scope };
		}
		if (!matched) return { allowed: false, reason: "ungranted" };

		if (MutatingPermissions.includes(permission)) {
			const protections = await database
				.select({ scope: unitProtection.scope, mode: unitProtection.mode })
				.from(unitProtection)
				.where(
					and(
						eq(unitProtection.unitId, unitId),
						isNull(unitProtection.revokedAt),
						or(
							isNull(unitProtection.expiresAt),
							sql`${unitProtection.expiresAt} > now()`,
						),
					),
				);
			const protection = protections
				.filter((candidate) => scopeCovers(candidate.scope, scope))
				.sort((left, right) => right.scope.length - left.scope.length)[0];
			if (protection?.mode === "frozen")
				return { allowed: false, reason: "protected", mode: protection.mode };
			if (protection?.mode === "owner_only" && matched.role !== "owner")
				return { allowed: false, reason: "protected", mode: protection.mode };
		}

		return {
			allowed: true,
			source: "binding",
			bindingId: matched.id,
			role: matched.role,
		};
	}

	async ensure(unitId: string, permission: UnitPermission, scope: UnitScope = []): Promise<void> {
		const decision = await this.decide(unitId, permission, scope);
		if (decision.allowed) return;
		if (decision.reason === "missing") throw new UnitNotFound();
		if (decision.reason === "restricted") throw new UnitAccessRestricted();
		if (decision.reason === "protected") throw new UnitProtected(scope, decision.mode);
		throw new UnitPermissionForbidden(permission, scope);
	}

	canRead(unitId: string): Promise<boolean> {
		return canReadUnit(unitId, this.profileId);
	}

	async ensureCanRead(unitId: string): Promise<void>;
	async ensureCanRead<E extends Error>(unitId: string, onDenied: () => E): Promise<void>;
	async ensureCanRead<E extends Error>(
		unitId: string,
		onDenied: () => E | UnitNotFound = () => new UnitNotFound(),
	): Promise<void> {
		if (!(await this.canRead(unitId))) throw onDenied();
	}

	async canUpdate(unitId: string, scope: UnitScope = []): Promise<boolean> {
		return (await this.decide(unitId, "unit.update", scope)).allowed;
	}

	async ensureCanUpdate(unitId: string, scopes: readonly UnitScope[]): Promise<void> {
		for (const scope of scopes.length ? scopes : [[]])
			await this.ensure(unitId, "unit.update", scope);
	}

	/** Apply Unit protection to domain-authorized operations such as Realm self-service membership. */
	async ensureOperationAllowed(unitId: string, scope: UnitScope): Promise<void> {
		if (this.profileId && (await this.platform.hasCapability("unit.edit"))) return;
		const [record] = await database
			.select({ id: unit.id })
			.from(unit)
			.where(and(eq(unit.id, unitId), isNull(unit.deletedAt)))
			.limit(1);
		if (!record) throw new UnitNotFound();
		const protections = await database
			.select({ scope: unitProtection.scope, mode: unitProtection.mode })
			.from(unitProtection)
			.where(
				and(
					eq(unitProtection.unitId, unitId),
					isNull(unitProtection.revokedAt),
					or(isNull(unitProtection.expiresAt), sql`${unitProtection.expiresAt} > now()`),
				),
			);
		const protection = protections
			.filter((candidate) => scopeCovers(candidate.scope, scope))
			.sort((left, right) => right.scope.length - left.scope.length)[0];
		if (!protection) return;
		if (
			protection.mode === "owner_only" &&
			(await this.decide(unitId, "unit.update", scope)).allowed
		)
			return;
		throw new UnitProtected(scope, protection.mode);
	}
}
