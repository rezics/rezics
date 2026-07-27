import { and, eq, exists, isNull, or, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

import { database, type DatabaseExecutor, type DatabaseTransaction } from "../../database";
import {
	realmMember,
	unit,
	unitAccessGrant,
	unitAccessRestriction,
	unitOwnership,
} from "../../database/schema";
import { UnitAccessRestricted, UnitNotFound, UnitPermissionForbidden } from "../../units/errors";
import type { PlatformAuthorization } from "../platform/authorization";
import {
	isUnitPermissionApplicable,
	resolveUnitAccessOverride,
	type UnitPermission,
} from "./policy";
import { scopeCovers, scopeKey, type UnitScope } from "./scope";

export type UnitAccessDecision =
	| { readonly allowed: true; readonly source: "public" | "platform" | "owner" }
	| {
			readonly allowed: true;
			readonly source: "grant";
			readonly grantId: string;
			readonly subjectKind: "profile" | "realm" | "authenticated";
	  }
	| {
			readonly allowed: false;
			readonly reason: "missing" | "anonymous" | "ungranted";
	  }
	| {
			readonly allowed: false;
			readonly reason: "restricted";
			readonly restrictionId: string;
			readonly subjectKind: "profile" | "realm";
	  };

function active(expiresAt: typeof unitAccessGrant.expiresAt) {
	return and(isNull(unitAccessGrant.revokedAt), or(isNull(expiresAt), sql`${expiresAt} > now()`));
}

function activeRestriction() {
	return and(
		isNull(unitAccessRestriction.revokedAt),
		or(
			isNull(unitAccessRestriction.expiresAt),
			sql`${unitAccessRestriction.expiresAt} > now()`,
		),
	);
}

function profileBelongsToRealm(
	executor: DatabaseExecutor,
	realmId: AnyPgColumn,
	profileId: string,
) {
	return exists(
		executor
			.select({ profileId: realmMember.profileId })
			.from(realmMember)
			.where(
				and(
					eq(realmMember.realmId, realmId),
					eq(realmMember.profileId, profileId),
					eq(realmMember.state, "active"),
				),
			),
	);
}

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
		const decision = this.#decide(database, unitId, permission, scope);
		this.#decisions.set(key, decision);
		return decision;
	}

	async #decide(
		executor: DatabaseExecutor,
		unitId: string,
		permission: UnitPermission,
		scope: UnitScope,
	): Promise<UnitAccessDecision> {
		const [record] = await executor
			.select({
				kind: unit.kind,
				status: unit.status,
				visibility: unit.visibility,
				moderationStatus: unit.moderationStatus,
				deletedAt: unit.deletedAt,
			})
			.from(unit)
			.where(eq(unit.id, unitId))
			.limit(1);
		if (!record || record.deletedAt) return { allowed: false, reason: "missing" };
		if (!isUnitPermissionApplicable(record.kind, permission))
			return { allowed: false, reason: "ungranted" };

		if (this.profileId) {
			const platformOverride = await this.platform.hasCapability("unit.edit", executor);
			if (platformOverride) return { allowed: true, source: "platform" };

			const [ownership] = await executor
				.select({ id: unitOwnership.id })
				.from(unitOwnership)
				.where(
					and(
						eq(unitOwnership.unitId, unitId),
						eq(unitOwnership.profileId, this.profileId),
						isNull(unitOwnership.revokedAt),
					),
				)
				.limit(1);
			const restrictions = await executor
				.select({
					id: unitAccessRestriction.id,
					subjectKind: unitAccessRestriction.subjectKind,
					scope: unitAccessRestriction.scope,
				})
				.from(unitAccessRestriction)
				.where(
					and(
						eq(unitAccessRestriction.unitId, unitId),
						eq(unitAccessRestriction.permission, permission),
						or(
							and(
								eq(unitAccessRestriction.subjectKind, "profile"),
								eq(unitAccessRestriction.profileId, this.profileId),
							),
							and(
								eq(unitAccessRestriction.subjectKind, "realm"),
								profileBelongsToRealm(
									executor,
									unitAccessRestriction.realmId,
									this.profileId,
								),
							),
						),
						activeRestriction(),
					),
				);
			const applicableRestrictions = restrictions
				.filter((restriction) => scopeCovers(restriction.scope, scope))
				.sort(
					(left, right) =>
						right.scope.length - left.scope.length || left.id.localeCompare(right.id),
				);
			const override = resolveUnitAccessOverride({
				platformOverride: false,
				hasDirectProfileOwner: Boolean(ownership),
				restrictions: applicableRestrictions,
			});
			if (override?.kind === "restriction")
				return {
					allowed: false,
					reason: "restricted",
					restrictionId: override.restriction.id,
					subjectKind: override.restriction.subjectKind,
				};
			if (ownership) return { allowed: true, source: "owner" };
		}

		if (
			permission === "unit.read" &&
			record.status === "published" &&
			record.moderationStatus === "approved" &&
			(record.visibility === "public" || record.visibility === "unlisted")
		)
			return { allowed: true, source: "public" };
		if (!this.profileId) return { allowed: false, reason: "anonymous" };

		const grants = await executor
			.select({
				id: unitAccessGrant.id,
				subjectKind: unitAccessGrant.subjectKind,
				scope: unitAccessGrant.scope,
			})
			.from(unitAccessGrant)
			.where(
				and(
					eq(unitAccessGrant.unitId, unitId),
					eq(unitAccessGrant.permission, permission),
					or(
						eq(unitAccessGrant.subjectKind, "authenticated"),
						and(
							eq(unitAccessGrant.subjectKind, "profile"),
							eq(unitAccessGrant.profileId, this.profileId),
						),
						and(
							eq(unitAccessGrant.subjectKind, "realm"),
							profileBelongsToRealm(
								executor,
								unitAccessGrant.realmId,
								this.profileId,
							),
						),
					),
					active(unitAccessGrant.expiresAt),
				),
			);
		const matched = grants
			.filter((grant) => permission === "unit.read" || scopeCovers(grant.scope, scope))
			.sort(
				(left, right) =>
					right.scope.length - left.scope.length || left.id.localeCompare(right.id),
			)[0];
		if (!matched) return { allowed: false, reason: "ungranted" };
		return {
			allowed: true,
			source: "grant",
			grantId: matched.id,
			subjectKind: matched.subjectKind,
		};
	}

	async ensure(unitId: string, permission: UnitPermission, scope: UnitScope = []): Promise<void> {
		const decision = await this.decide(unitId, permission, scope);
		if (decision.allowed) return;
		if (decision.reason === "missing") throw new UnitNotFound();
		if (decision.reason === "restricted") throw new UnitAccessRestricted();
		throw new UnitPermissionForbidden(permission, scope);
	}

	decideInTransaction(
		tx: DatabaseTransaction,
		unitId: string,
		permission: UnitPermission,
		scope: UnitScope = [],
	): Promise<UnitAccessDecision> {
		return this.#decide(tx, unitId, permission, scope);
	}

	async ensureInTransaction(
		tx: DatabaseTransaction,
		unitId: string,
		permission: UnitPermission,
		scope: UnitScope = [],
	): Promise<void> {
		const decision = await this.decideInTransaction(tx, unitId, permission, scope);
		if (decision.allowed) return;
		if (decision.reason === "missing") throw new UnitNotFound();
		if (decision.reason === "restricted") throw new UnitAccessRestricted();
		throw new UnitPermissionForbidden(permission, scope);
	}

	async canRead(unitId: string): Promise<boolean> {
		return (await this.decide(unitId, "unit.read")).allowed;
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

	async findAllowedScope(
		unitId: string,
		permission: UnitPermission,
	): Promise<UnitScope | undefined> {
		if (!this.profileId) return undefined;
		const rootDecision = await this.decide(unitId, permission);
		if (rootDecision.allowed) return [];

		const grants = await database
			.select({
				scope: unitAccessGrant.scope,
			})
			.from(unitAccessGrant)
			.where(
				and(
					eq(unitAccessGrant.unitId, unitId),
					eq(unitAccessGrant.permission, permission),
					or(
						eq(unitAccessGrant.subjectKind, "authenticated"),
						and(
							eq(unitAccessGrant.subjectKind, "profile"),
							eq(unitAccessGrant.profileId, this.profileId),
						),
						and(
							eq(unitAccessGrant.subjectKind, "realm"),
							profileBelongsToRealm(
								database,
								unitAccessGrant.realmId,
								this.profileId,
							),
						),
					),
					active(unitAccessGrant.expiresAt),
				),
			);
		const candidateScopes = new Map<string, UnitScope>();
		for (const grant of grants) candidateScopes.set(scopeKey(grant.scope), grant.scope);
		for (const candidate of [...candidateScopes.values()].sort(
			(left, right) =>
				left.length - right.length || scopeKey(left).localeCompare(scopeKey(right)),
		))
			if ((await this.decide(unitId, permission, candidate)).allowed) return candidate;
		return undefined;
	}

	async matchesActiveGrant(grantId: string, permission: UnitPermission): Promise<boolean> {
		if (!this.profileId) return false;
		const [grant] = await database
			.select({
				subjectKind: unitAccessGrant.subjectKind,
				profileId: unitAccessGrant.profileId,
				realmId: unitAccessGrant.realmId,
				permission: unitAccessGrant.permission,
			})
			.from(unitAccessGrant)
			.where(
				and(
					eq(unitAccessGrant.id, grantId),
					eq(unitAccessGrant.permission, permission),
					active(unitAccessGrant.expiresAt),
				),
			)
			.limit(1);
		if (!grant) return false;
		if (grant.subjectKind === "authenticated") return true;
		if (grant.subjectKind === "profile") return grant.profileId === this.profileId;
		if (!grant.realmId) return false;
		const [membership] = await database
			.select({ id: realmMember.profileId })
			.from(realmMember)
			.where(
				and(
					eq(realmMember.realmId, grant.realmId),
					eq(realmMember.profileId, this.profileId),
					eq(realmMember.state, "active"),
				),
			)
			.limit(1);
		return Boolean(membership);
	}

	async ensureCanUpdate(unitId: string, scopes: readonly UnitScope[]): Promise<void> {
		for (const scope of scopes.length ? scopes : [[]])
			await this.ensure(unitId, "unit.update", scope);
	}
}
