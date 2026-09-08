import { CatalogReferenceSchema } from "@rezics/reference";
import { readUnitStateById } from "../../units/query";
import { unitOwnerTable } from "../../database/schema/unit-reference-columns";
import { withCatalogViewerPolicy } from "../../catalog/read-policy";
import {
	loadCatalogIdentity,
	CatalogAccessDenied,
	CatalogReferenceNotFound,
} from "../../catalog/storage";
import {
	currentParticipationAuthority,
	readCatalogAuthorityScope,
	catalogIdentityReadPredicate,
	runWithParticipationAuthority,
	type ParticipationAuthority,
} from "../../participation/policy";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";

import { ensureAccountAuthenticationAllowed } from "../../auth/account-state";
import { database, type DatabaseExecutor, type DatabaseTransaction } from "../../database";
import {
	authEntity,
	realm,
	catalogUnitLocator,
	catalogRoutingControl,
	unitAccessGrant,
	unitAccessRestriction,
	unitOwnership,
	users,
} from "../../database/schema";
import { UnitAccessRestricted, UnitNotFound, UnitPermissionForbidden } from "../../units/errors";
import type { PlatformAuthorization } from "../platform/authorization";
import {
	isUnitPermissionApplicable,
	isUnitPermissionDelegable,
	isUnitPermissionOwnerOnly,
	resolveUnitAccessOverride,
	type UnitPermission,
} from "./policy";
import { getUnitReadCondition } from "./query";
import { profileMatchesRealmAccessSubject } from "./realm-subject";
import { scopeCovers, scopeKey, type UnitScope } from "./scope";

export type UnitAccessDecision =
	| { readonly allowed: true; readonly source: "public" | "platform" | "owner" | "native" }
	| {
			readonly allowed: true;
			readonly source: "grant";
			readonly grantId: string;
			readonly subjectKind: "auth" | "realm" | "authenticated";
	  }
	| {
			readonly allowed: false;
			readonly reason: "missing" | "anonymous" | "ungranted";
	  }
	| {
			readonly allowed: false;
			readonly reason: "restricted";
			readonly restrictionId: string;
			readonly subjectKind: "auth" | "realm";
	  };

function active(expiresAt: typeof unitAccessGrant.expiresAt) {
	return and(isNull(unitAccessGrant.revokedAt), or(isNull(expiresAt), sql`${expiresAt} > now()`));
}

function activeRestriction() {
	return and(
		isNull(unitAccessRestriction.revokedAt),
		or(isNull(unitAccessRestriction.expiresAt), sql`${unitAccessRestriction.expiresAt} > now()`),
	);
}

export class UnitAuthorization<ProfileId extends string | undefined> {
	readonly #decisions = new Map<string, Promise<UnitAccessDecision>>();

	constructor(
		readonly profileId: ProfileId,
		private readonly platform: PlatformAuthorization<ProfileId>,
		readonly authUserId?: string,
		readonly participationAuthority?: ParticipationAuthority,
	) {
		if (participationAuthority && participationAuthority.principal.authUserId !== authUserId)
			throw new Error("Request participation authority does not match its authenticated account");
	}

	#withParticipation<T>(work: () => T): T {
		return this.participationAuthority
			? runWithParticipationAuthority(this.participationAuthority, work)
			: work();
	}

	#nativeActor(): string | null {
		const principal = currentParticipationAuthority()?.principal;
		return principal && principal.authUserId === this.authUserId ? principal.authUserId : null;
	}

	async #authenticatedSelf(executor: DatabaseExecutor): Promise<boolean> {
		if (!this.profileId || !this.authUserId) return false;
		const [binding] = await executor
			.select({ id: authEntity.entityId })
			.from(authEntity)
			.innerJoin(users, eq(users.id, authEntity.authUserId))
			.where(
				and(
					eq(authEntity.authUserId, this.authUserId),
					eq(authEntity.entityId, this.profileId),
					eq(authEntity.state, "active"),
					isNull(users.erasedAt),
				),
			)
			.limit(1)
			.for("share");
		if (binding) await ensureAccountAuthenticationAllowed(this.authUserId, executor);
		return binding !== undefined;
	}

	decide(unitId: string, permission: UnitPermission, scope: UnitScope = []) {
		const key = `unit:${unitId}:${permission}:${scopeKey(scope)}`;
		const current = this.#decisions.get(key);
		if (current) return current;
		const decision = database.transaction((tx) => this.#decide(tx, unitId, permission, scope));
		this.#decisions.set(key, decision);
		return decision;
	}

	async #decide(
		executor: DatabaseTransaction,
		unitId: string,
		permission: UnitPermission,
		scope: UnitScope,
	): Promise<UnitAccessDecision> {
		return this.#withParticipation(() => this.#decideCurrent(executor, unitId, permission, scope));
	}

	async #decideCurrent(
		executor: DatabaseTransaction,
		unitId: string,
		permission: UnitPermission,
		scope: UnitScope,
	): Promise<UnitAccessDecision> {
		await executor.execute(
			sql`select pg_advisory_xact_lock_shared(hashtextextended(${`unit-access:${unitId}`}::text, 0))`,
		);
		const record = await readUnitStateById(executor, unitId);
		if (!record || record.deletedAt) return { allowed: false, reason: "missing" };
		if (!isUnitPermissionApplicable(record.reference.owner, permission))
			return { allowed: false, reason: "ungranted" };
		const nativeReference = CatalogReferenceSchema.safeParse(record.reference);
		if (nativeReference.success) {
			if (permission !== "unit.read") return { allowed: false, reason: "ungranted" };
			const actor = this.#nativeActor();
			try {
				await withCatalogViewerPolicy(executor, actor, () =>
					loadCatalogIdentity(executor, nativeReference.data, actor, false),
				);
				return { allowed: true, source: "native" };
			} catch (error) {
				if (error instanceof CatalogAccessDenied || error instanceof CatalogReferenceNotFound)
					return { allowed: false, reason: "missing" };
				throw error;
			}
		}
		if (!(await this.#authenticatedSelf(executor)))
			return permission === "unit.read" &&
				record.status === "published" &&
				record.moderationStatus === "approved" &&
				(record.visibility === "public" || record.visibility === "unlisted")
				? { allowed: true, source: "public" }
				: { allowed: false, reason: "anonymous" };

		if (isUnitPermissionOwnerOnly(permission)) {
			if (!this.profileId) return { allowed: false, reason: "anonymous" };
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
			return ownership
				? { allowed: true, source: "owner" }
				: { allowed: false, reason: "ungranted" };
		}

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
					realmRelation: unitAccessRestriction.realmRelation,
					scope: unitAccessRestriction.scope,
				})
				.from(unitAccessRestriction)
				.where(
					and(
						eq(unitAccessRestriction.unitId, unitId),
						eq(unitAccessRestriction.permission, permission),
						or(
							and(
								eq(unitAccessRestriction.subjectKind, "auth"),
								this.authUserId
									? eq(unitAccessRestriction.authUserId, this.authUserId)
									: sql`false`,
							),
							and(
								eq(unitAccessRestriction.subjectKind, "realm"),
								profileMatchesRealmAccessSubject(
									executor,
									unitAccessRestriction.realmId,
									unitAccessRestriction.realmRelation,
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
				realmRelation: unitAccessGrant.realmRelation,
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
							eq(unitAccessGrant.subjectKind, "auth"),
							this.authUserId ? eq(unitAccessGrant.authUserId, this.authUserId) : sql`false`,
						),
						and(
							eq(unitAccessGrant.subjectKind, "realm"),
							profileMatchesRealmAccessSubject(
								executor,
								unitAccessGrant.realmId,
								unitAccessGrant.realmRelation,
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
				(left, right) => right.scope.length - left.scope.length || left.id.localeCompare(right.id),
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

	async ensureCanReadMany(unitIds: readonly string[]): Promise<void>;
	async ensureCanReadMany<E extends Error>(
		unitIds: readonly string[],
		onDenied: (unitId: string) => E,
	): Promise<void>;
	async ensureCanReadMany<E extends Error>(
		unitIds: readonly string[],
		onDenied: (unitId: string) => E | UnitNotFound = () => new UnitNotFound(),
	): Promise<void> {
		const readableIds = await this.readableUnitIds(unitIds);
		const deniedId = unitIds.find((id) => !readableIds.has(id));
		if (deniedId) throw onDenied(deniedId);
	}

	/** Bounded mixed-owner visibility filtering with the same native/private policy as point reads. */
	async readableUnitIds(unitIds: readonly string[]): Promise<ReadonlySet<string>> {
		const uniqueIds = [...new Set(unitIds)];
		if (!uniqueIds.length) return new Set<string>();
		if (uniqueIds.length > 500) throw new RangeError("Unit read batches cannot exceed 500 targets");
		const readableIds = await this.#withParticipation(() =>
			database.transaction(async (tx) => {
				const actor = this.#nativeActor();
				return withCatalogViewerPolicy(tx, actor, async () => {
					const viewerId = (await this.#authenticatedSelf(tx)) ? this.profileId : undefined;
					const [control] = await tx
						.select({ ready: catalogRoutingControl.ready })
						.from(catalogRoutingControl)
						.where(eq(catalogRoutingControl.singleton, true))
						.limit(1);
					if (!control?.ready) return new Set<string>();
					const routes = await tx
						.select()
						.from(catalogUnitLocator)
						.where(inArray(catalogUnitLocator.id, uniqueIds));
					const nativeScope = await readCatalogAuthorityScope(tx, actor);
					const result = new Set<string>();
					for (const owner of new Set(routes.map((route) => route.owner))) {
						const table = unitOwnerTable(owner);
						const group = routes.filter((route) => route.owner === owner);
						const native = CatalogReferenceSchema.safeParse({ owner, id: group[0]!.id });
						const rows = await tx
							.select({ id: table.id, generation: table.routingGeneration })
							.from(table)
							.where(
								and(
									inArray(
										table.id,
										group.map((route) => route.id),
									),
									native.success
										? catalogIdentityReadPredicate(nativeScope, native.data.owner, table)
										: getUnitReadCondition(viewerId, {}, table),
								),
							);
						const generations = new Map(group.map((route) => [route.id, route.generation]));
						for (const row of rows)
							if (generations.get(row.id) === row.generation) result.add(row.id);
					}
					return result;
				});
			}),
		);
		return readableIds;
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
		if (!isUnitPermissionDelegable(permission)) return undefined;

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
							eq(unitAccessGrant.subjectKind, "auth"),
							this.authUserId ? eq(unitAccessGrant.authUserId, this.authUserId) : sql`false`,
						),
						and(
							eq(unitAccessGrant.subjectKind, "realm"),
							profileMatchesRealmAccessSubject(
								database,
								unitAccessGrant.realmId,
								unitAccessGrant.realmRelation,
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
			(left, right) => left.length - right.length || scopeKey(left).localeCompare(scopeKey(right)),
		))
			if ((await this.decide(unitId, permission, candidate)).allowed) return candidate;
		return undefined;
	}

	async matchesActiveGrant(grantId: string, permission: UnitPermission): Promise<boolean> {
		if (!this.profileId) return false;
		if (!(await this.#authenticatedSelf(database))) return false;
		if (!isUnitPermissionDelegable(permission)) return false;
		const [grant] = await database
			.select({
				subjectKind: unitAccessGrant.subjectKind,
				authUserId: unitAccessGrant.authUserId,
				realmId: unitAccessGrant.realmId,
				realmRelation: unitAccessGrant.realmRelation,
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
		if (grant.subjectKind === "auth") return grant.authUserId === this.authUserId;
		if (!grant.realmId || !grant.realmRelation) return false;
		const [match] = await database
			.select({ id: realm.id })
			.from(realm)
			.where(
				and(
					eq(realm.id, grant.realmId),
					profileMatchesRealmAccessSubject(
						database,
						realm.id,
						sql`${grant.realmRelation}`,
						this.profileId,
					),
				),
			)
			.limit(1);
		return Boolean(match);
	}

	async ensureCanUpdate(unitId: string, scopes: readonly UnitScope[]): Promise<void> {
		for (const scope of scopes.length ? scopes : [[]])
			await this.ensure(unitId, "unit.update", scope);
	}
}
