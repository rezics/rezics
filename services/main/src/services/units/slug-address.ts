import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import {
	isAvailableZonePageSlug,
	ZoneHomePageSlug,
	type PublicSlugAddressValue,
} from "@rezics/slug";

import { recordAuditEvent } from "../audit";
import type { Authorization } from "../authorization";
import { database, type DatabaseTransaction } from "../database";
import { profile, unit, unitSlugAddress, zonePage, type UnitKind } from "../database/schema";
import {
	createGovernanceDecision,
	type GovernanceRuleReference,
} from "../governance/decision-service";
import {
	InvalidSlug,
	SlugDepthExceeded,
	SlugRedirectNotFound,
	SlugScopeCycle,
	SlugScopeNotFound,
	SlugScopeUnavailable,
	SlugTaken,
	UnitAddressMutationForbidden,
	UnitNotFound,
	UnitSlugAddressNotFound,
} from "./errors";
import { insertUnit } from "./create";
import { recordUnitRevision } from "./history";
import { decideProfileSlugAssignment, parseAssignableProfileSlug } from "./profile-slug-policy";
import {
	SystemSlugNamespaceUnitIds,
	TopLevelSlugNamespaceSlugByUnitId,
	TopLevelSlugNamespaceUnitIdBySlug,
	TopLevelSlugNamespaceUnitIds,
} from "./slug-system";
import { parseSlugLabel, SlugAddressMaximumDepth, type SlugLabel } from "./slug";

export interface UnitSlugAddressValue {
	readonly scopeUnitId: string | null;
	readonly slug: SlugLabel;
}

export interface CanonicalUnitSlugAddress extends UnitSlugAddressValue {
	readonly addressId: string;
	readonly unitId: string;
}

export interface ResolvedUnitPath {
	readonly id: string;
	readonly kind: UnitKind;
	readonly path: readonly SlugLabel[];
	readonly canonicalPath: readonly SlugLabel[];
	readonly redirected: boolean;
}

export interface PublicCanonicalUnitSlugAddress extends PublicSlugAddressValue {
	readonly slug: SlugLabel;
	readonly scopeUnitId: string;
	readonly canonicalPath: SlugLabel[];
}

export interface UnitAddressMutationResult extends CanonicalUnitSlugAddress {
	readonly redirectAddressId: string | null;
	readonly canonicalPath: readonly SlugLabel[];
}

interface StoredCanonicalAddress {
	readonly id: string;
	readonly scopeUnitId: string | null;
	readonly slug: string;
}

interface CanonicalAddressMutation {
	readonly addressId: string;
	readonly redirectAddressId: string | null;
	readonly before: UnitSlugAddressValue | null;
	readonly after: UnitSlugAddressValue;
	readonly changed: boolean;
}

const SlugTreeMutationLock = "rezics-unit-slug-addresses";
const SystemSlugNamespaceUnitIdSet: ReadonlySet<string> = new Set(SystemSlugNamespaceUnitIds);

function fixedPublicSlugScope(kind: UnitKind): string | undefined {
	switch (kind) {
		case "profile":
			return TopLevelSlugNamespaceUnitIds.users;
		case "realm":
			return TopLevelSlugNamespaceUnitIds.realms;
		case "zone":
			return TopLevelSlugNamespaceUnitIds.zones;
		default:
			return undefined;
	}
}

function objectField(value: unknown, key: string): unknown {
	return typeof value === "object" && value !== null && key in value
		? Reflect.get(value, key)
		: undefined;
}

function hasDatabaseConstraint(error: unknown, constraint: string): boolean {
	let current: unknown = error;
	for (let depth = 0; depth < 6 && current; depth += 1) {
		if (objectField(current, "constraint") === constraint) return true;
		current = objectField(current, "cause");
	}
	return false;
}

function mapSlugCollision(
	error: unknown,
	address: { readonly scopeUnitId: string | null; readonly slug: string },
): never {
	if (hasDatabaseConstraint(error, "unit_slug_address_scope_slug_key"))
		throw new SlugTaken(address.scopeUnitId, address.slug);
	throw error;
}

async function lockSlugTree(tx: DatabaseTransaction): Promise<void> {
	await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${SlugTreeMutationLock}, 0))`);
}

function scopeMatches(scopeUnitId: string | null) {
	return scopeUnitId === null
		? isNull(unitSlugAddress.scopeUnitId)
		: eq(unitSlugAddress.scopeUnitId, scopeUnitId);
}

async function loadCanonicalAddress(
	tx: DatabaseTransaction,
	unitId: string,
): Promise<StoredCanonicalAddress | undefined> {
	return (
		await tx
			.select({
				id: unitSlugAddress.id,
				scopeUnitId: unitSlugAddress.scopeUnitId,
				slug: unitSlugAddress.slug,
			})
			.from(unitSlugAddress)
			.where(and(eq(unitSlugAddress.kind, "canonical"), eq(unitSlugAddress.targetUnitId, unitId)))
			.limit(1)
	)[0];
}

async function loadScopeDepth(
	tx: DatabaseTransaction,
	scopeUnitId: string | null,
	movingUnitId: string,
): Promise<number> {
	if (scopeUnitId === null) return 0;
	let currentId = scopeUnitId;
	let depth = 0;
	const visited = new Set<string>();

	while (true) {
		if (currentId === movingUnitId || visited.has(currentId)) throw new SlugScopeCycle();
		visited.add(currentId);

		if (TopLevelSlugNamespaceSlugByUnitId.has(currentId)) return depth + 1;

		const [current] = await tx
			.select({
				scopeUnitId: unitSlugAddress.scopeUnitId,
				deletedAt: unit.deletedAt,
			})
			.from(unitSlugAddress)
			.innerJoin(unit, eq(unit.id, unitSlugAddress.targetUnitId))
			.where(
				and(eq(unitSlugAddress.kind, "canonical"), eq(unitSlugAddress.targetUnitId, currentId)),
			)
			.limit(1);
		if (!current) throw new SlugScopeNotFound();
		if (current.deletedAt) throw new SlugScopeUnavailable();

		depth += 1;
		if (current.scopeUnitId === null) return depth;
		currentId = current.scopeUnitId;
	}
}

async function replaceCanonicalAddress(
	tx: DatabaseTransaction,
	input: {
		readonly unitId: string;
		readonly scopeUnitId: string | null;
		readonly slug: SlugLabel;
		/** Direct scoped lookup remains valid when the parent has no public canonical path. */
		readonly allowUnaddressedScope?: boolean;
	},
): Promise<CanonicalAddressMutation> {
	await lockSlugTree(tx);
	const [target] = await tx
		.select({ id: unit.id, kind: unit.kind, deletedAt: unit.deletedAt })
		.from(unit)
		.where(eq(unit.id, input.unitId))
		.limit(1);
	if (!target || target.deletedAt) throw new UnitNotFound();

	const current = await loadCanonicalAddress(tx, target.id);
	if (SystemSlugNamespaceUnitIdSet.has(target.id)) {
		const declaredSlug = TopLevelSlugNamespaceSlugByUnitId.get(target.id);
		if (
			!current ||
			input.scopeUnitId !== null ||
			input.slug !== declaredSlug ||
			current.scopeUnitId !== null ||
			current.slug !== declaredSlug
		)
			throw new UnitAddressMutationForbidden();
	}
	if (input.scopeUnitId === null && target.kind !== "slug_namespace")
		throw new UnitAddressMutationForbidden();

	let scopeDepth: number;
	try {
		scopeDepth = await loadScopeDepth(tx, input.scopeUnitId, target.id);
	} catch (cause) {
		if (!(cause instanceof SlugScopeNotFound) || !input.allowUnaddressedScope || !input.scopeUnitId)
			throw cause;
		const [scope] = await tx
			.select({ deletedAt: unit.deletedAt })
			.from(unit)
			.where(eq(unit.id, input.scopeUnitId))
			.limit(1);
		if (!scope) throw cause;
		if (scope.deletedAt) throw new SlugScopeUnavailable();
		// The direct scope is still one address level even though no complete
		// public canonical path can be projected for it yet.
		scopeDepth = 1;
	}
	if (scopeDepth + 1 > SlugAddressMaximumDepth) throw new SlugDepthExceeded();

	const after: UnitSlugAddressValue = {
		scopeUnitId: input.scopeUnitId,
		slug: input.slug,
	};
	if (current && current.scopeUnitId === input.scopeUnitId && current.slug === input.slug)
		return {
			addressId: current.id,
			redirectAddressId: null,
			before: after,
			after,
			changed: false,
		};

	const [occupant] = await tx
		.select({
			id: unitSlugAddress.id,
			kind: unitSlugAddress.kind,
			targetUnitId: unitSlugAddress.targetUnitId,
		})
		.from(unitSlugAddress)
		.where(and(scopeMatches(input.scopeUnitId), eq(unitSlugAddress.slug, input.slug)))
		.limit(1);
	if (occupant) {
		if (occupant.kind === "redirect" && occupant.targetUnitId === target.id)
			await tx.delete(unitSlugAddress).where(eq(unitSlugAddress.id, occupant.id));
		else throw new SlugTaken(input.scopeUnitId, input.slug);
	}

	try {
		if (!current) {
			const [created] = await tx
				.insert(unitSlugAddress)
				.values({
					kind: "canonical",
					scopeUnitId: input.scopeUnitId,
					slug: input.slug,
					targetUnitId: target.id,
				})
				.returning({ id: unitSlugAddress.id });
			if (!created) throw new Error("Canonical slug address insertion did not return an id");
			return {
				addressId: created.id,
				redirectAddressId: null,
				before: null,
				after,
				changed: true,
			};
		}

		await tx
			.update(unitSlugAddress)
			.set({ scopeUnitId: input.scopeUnitId, slug: input.slug, updatedAt: new Date() })
			.where(eq(unitSlugAddress.id, current.id));
		const [redirect] = await tx
			.insert(unitSlugAddress)
			.values({
				kind: "redirect",
				scopeUnitId: current.scopeUnitId,
				slug: current.slug,
				targetUnitId: target.id,
			})
			.returning({ id: unitSlugAddress.id });
		if (!redirect) throw new Error("Slug Redirect insertion did not return an id");
		return {
			addressId: current.id,
			redirectAddressId: redirect.id,
			before: {
				scopeUnitId: current.scopeUnitId,
				slug: parseSlugLabel(current.slug),
			},
			after,
			changed: true,
		};
	} catch (error) {
		mapSlugCollision(error, input);
	}
}

function isPublicAddressNode(value: {
	readonly status: string;
	readonly visibility: string;
	readonly moderationStatus: string;
	readonly deletedAt: Date | null;
}): boolean {
	return (
		!value.deletedAt &&
		value.status === "published" &&
		value.visibility === "public" &&
		value.moderationStatus === "approved"
	);
}

interface PublicAddressProjectionState {
	readonly unitId: string;
	readonly visited: Set<string>;
	readonly reversePath: SlugLabel[];
	currentUnitId: string;
	directAddress?: {
		readonly scopeUnitId: string | null;
		readonly slug: SlugLabel;
	};
	finished: boolean;
}

function finishPublicAddressProjection(
	state: PublicAddressProjectionState,
	result: Map<string, PublicCanonicalUnitSlugAddress>,
): void {
	state.finished = true;
	const directAddress = state.directAddress;
	if (!directAddress?.scopeUnitId || state.reversePath.length < 2) return;
	result.set(state.unitId, {
		slug: directAddress.slug,
		scopeUnitId: directAddress.scopeUnitId,
		canonicalPath: [...state.reversePath].reverse(),
	});
}

/**
 * Projects public canonical addresses for resource responses in bounded batches.
 *
 * The result is keyed by immutable Unit ID. Missing, private, moderated,
 * deleted, malformed, cyclic, or unaddressed Units are deliberately omitted.
 */
export async function getPublicCanonicalUnitSlugAddresses(
	unitIds: readonly string[],
): Promise<ReadonlyMap<string, PublicCanonicalUnitSlugAddress>> {
	const result = new Map<string, PublicCanonicalUnitSlugAddress>();
	const states = [...new Set(unitIds)].map<PublicAddressProjectionState>((unitId) => ({
		unitId,
		currentUnitId: unitId,
		visited: new Set<string>(),
		reversePath: [],
		finished: false,
	}));

	for (let depth = 0; depth < SlugAddressMaximumDepth; depth += 1) {
		for (const state of states) {
			if (state.finished) continue;
			if (state.visited.has(state.currentUnitId)) {
				state.finished = true;
				continue;
			}
			state.visited.add(state.currentUnitId);
			const namespaceSlug = TopLevelSlugNamespaceSlugByUnitId.get(state.currentUnitId);
			if (!namespaceSlug) continue;
			state.reversePath.push(parseSlugLabel(namespaceSlug));
			finishPublicAddressProjection(state, result);
		}

		const targetIds = [
			...new Set(states.filter((state) => !state.finished).map((state) => state.currentUnitId)),
		];
		if (!targetIds.length) break;
		const records = await database
			.select({
				targetUnitId: unitSlugAddress.targetUnitId,
				scopeUnitId: unitSlugAddress.scopeUnitId,
				slug: unitSlugAddress.slug,
				status: unit.status,
				visibility: unit.visibility,
				moderationStatus: unit.moderationStatus,
				deletedAt: unit.deletedAt,
			})
			.from(unitSlugAddress)
			.innerJoin(unit, eq(unit.id, unitSlugAddress.targetUnitId))
			.where(
				and(
					eq(unitSlugAddress.kind, "canonical"),
					inArray(unitSlugAddress.targetUnitId, targetIds),
				),
			);
		const recordByUnitId = new Map(records.map((record) => [record.targetUnitId, record]));

		for (const state of states) {
			if (state.finished) continue;
			const record = recordByUnitId.get(state.currentUnitId);
			if (!record || !isPublicAddressNode(record)) {
				state.finished = true;
				continue;
			}
			let slug: SlugLabel;
			try {
				slug = parseSlugLabel(record.slug);
			} catch {
				state.finished = true;
				continue;
			}
			state.directAddress ??= { scopeUnitId: record.scopeUnitId, slug };
			state.reversePath.push(slug);
			if (record.scopeUnitId === null) finishPublicAddressProjection(state, result);
			else state.currentUnitId = record.scopeUnitId;
		}
	}

	return result;
}

/** Returns one Unit's public canonical address, or null when it has none. */
export async function getPublicCanonicalUnitSlugAddress(
	unitId: string,
): Promise<PublicCanonicalUnitSlugAddress | null> {
	return (await getPublicCanonicalUnitSlugAddresses([unitId])).get(unitId) ?? null;
}

async function loadCanonicalUnitPath(
	unitId: string,
	requirePublicAncestors: boolean,
): Promise<readonly SlugLabel[]> {
	let currentId = unitId;
	const path: SlugLabel[] = [];
	const visited = new Set<string>();

	for (let depth = 0; depth < SlugAddressMaximumDepth; depth += 1) {
		if (visited.has(currentId)) throw new SlugScopeCycle();
		visited.add(currentId);

		const cachedNamespaceSlug = TopLevelSlugNamespaceSlugByUnitId.get(currentId);
		if (cachedNamespaceSlug) {
			path.push(parseSlugLabel(cachedNamespaceSlug));
			return path.reverse();
		}

		const [current] = await database
			.select({
				scopeUnitId: unitSlugAddress.scopeUnitId,
				slug: unitSlugAddress.slug,
				status: unit.status,
				visibility: unit.visibility,
				moderationStatus: unit.moderationStatus,
				deletedAt: unit.deletedAt,
			})
			.from(unitSlugAddress)
			.innerJoin(unit, eq(unit.id, unitSlugAddress.targetUnitId))
			.where(
				and(eq(unitSlugAddress.kind, "canonical"), eq(unitSlugAddress.targetUnitId, currentId)),
			)
			.limit(1);
		if (!current) throw new UnitSlugAddressNotFound();
		if (requirePublicAncestors && !isPublicAddressNode(current)) throw new UnitNotFound();
		path.push(parseSlugLabel(current.slug));
		if (current.scopeUnitId === null) return path.reverse();
		currentId = current.scopeUnitId;
	}
	throw new SlugDepthExceeded();
}

async function loadPublicCanonicalUnitPathOrNotFound(
	unitId: string,
): Promise<readonly SlugLabel[]> {
	try {
		return await loadCanonicalUnitPath(unitId, true);
	} catch (error) {
		if (
			error instanceof InvalidSlug ||
			error instanceof UnitSlugAddressNotFound ||
			error instanceof SlugDepthExceeded ||
			error instanceof SlugScopeCycle
		)
			throw new UnitNotFound();
		throw error;
	}
}

/**
 * Returns canonical registry details after proving platform access.
 *
 * @remarks
 * Ordinary resource reads use the public projection helpers and do not expose
 * administrative address IDs.
 */
export async function getCanonicalUnitSlugAddressWithPlatformAccess(
	authorization: Authorization<string>,
	unitId: string,
): Promise<CanonicalUnitSlugAddress> {
	await authorization.platform.ensureCapability("unit.slug.manage");
	const [record] = await database
		.select({
			unitId: unit.id,
			addressId: unitSlugAddress.id,
			scopeUnitId: unitSlugAddress.scopeUnitId,
			slug: unitSlugAddress.slug,
		})
		.from(unit)
		.leftJoin(
			unitSlugAddress,
			and(eq(unitSlugAddress.kind, "canonical"), eq(unitSlugAddress.targetUnitId, unit.id)),
		)
		.where(and(eq(unit.id, unitId), isNull(unit.deletedAt)))
		.limit(1);
	if (!record) throw new UnitNotFound();
	if (!record.addressId || record.slug === null) throw new UnitSlugAddressNotFound();
	return {
		addressId: record.addressId,
		unitId: record.unitId,
		scopeUnitId: record.scopeUnitId,
		slug: parseSlugLabel(record.slug),
	};
}

/** Resolves a complete public slug path to an immutable Unit identity. */
export async function resolveUnitPath(segments: readonly string[]): Promise<ResolvedUnitPath> {
	if (!segments.length || segments.length > SlugAddressMaximumDepth) throw new SlugDepthExceeded();
	const path = segments.map(parseSlugLabel);
	let resolved:
		| {
				readonly id: string;
				readonly kind: UnitKind;
				readonly status: string;
				readonly visibility: string;
				readonly moderationStatus: string;
				readonly deletedAt: Date | null;
		  }
		| undefined;
	let followedRedirect = false;
	let scopeUnitId: string | null = null;
	let startIndex = 0;

	const cachedNamespaceId = TopLevelSlugNamespaceUnitIdBySlug.get(path[0] ?? "");
	if (cachedNamespaceId) {
		resolved = {
			id: cachedNamespaceId,
			kind: "slug_namespace",
			status: "published",
			visibility: "public",
			moderationStatus: "approved",
			deletedAt: null,
		};
		scopeUnitId = cachedNamespaceId;
		startIndex = 1;
	}

	for (let index = startIndex; index < path.length; index += 1) {
		const slug = path[index];
		if (!slug) throw new InvalidSlug();
		const [address] = await database
			.select({
				addressKind: unitSlugAddress.kind,
				id: unit.id,
				kind: unit.kind,
				status: unit.status,
				visibility: unit.visibility,
				moderationStatus: unit.moderationStatus,
				deletedAt: unit.deletedAt,
			})
			.from(unitSlugAddress)
			.innerJoin(unit, eq(unit.id, unitSlugAddress.targetUnitId))
			.where(and(scopeMatches(scopeUnitId), eq(unitSlugAddress.slug, slug)))
			.limit(1);
		if (!address || !isPublicAddressNode(address)) throw new UnitNotFound();
		resolved = address;
		followedRedirect ||= address.addressKind === "redirect";
		scopeUnitId = address.id;
	}

	if (!resolved) throw new UnitNotFound();
	const canonicalPath = await loadCanonicalUnitPath(resolved.id, true);
	return {
		id: resolved.id,
		kind: resolved.kind,
		path,
		canonicalPath,
		redirected:
			followedRedirect ||
			path.length !== canonicalPath.length ||
			path.some((slug, index) => canonicalPath[index] !== slug),
	};
}

/**
 * Resolves exactly one label under its direct scope Unit.
 *
 * Callers do not supply ancestor IDs. The backend proves that the scope has a
 * public canonical path, validates the target's public state and optional kind,
 * and returns the target's complete canonical path for redirect handling.
 */
export async function resolveScopedUnitAddress(
	scopeUnitId: string,
	slugValue: string,
	expectedKind?: UnitKind,
): Promise<ResolvedUnitPath> {
	const slug = parseSlugLabel(slugValue);
	const scopePath = await loadPublicCanonicalUnitPathOrNotFound(scopeUnitId);
	const [address] = await database
		.select({
			addressKind: unitSlugAddress.kind,
			id: unit.id,
			kind: unit.kind,
			status: unit.status,
			visibility: unit.visibility,
			moderationStatus: unit.moderationStatus,
			deletedAt: unit.deletedAt,
		})
		.from(unitSlugAddress)
		.innerJoin(unit, eq(unit.id, unitSlugAddress.targetUnitId))
		.where(and(eq(unitSlugAddress.scopeUnitId, scopeUnitId), eq(unitSlugAddress.slug, slug)))
		.limit(1);
	if (!address || !isPublicAddressNode(address) || (expectedKind && address.kind !== expectedKind))
		throw new UnitNotFound();
	const path = [...scopePath, slug];
	if (path.length > SlugAddressMaximumDepth) throw new UnitNotFound();
	const canonicalPath = await loadPublicCanonicalUnitPathOrNotFound(address.id);
	return {
		id: address.id,
		kind: address.kind,
		path,
		canonicalPath,
		redirected:
			address.addressKind === "redirect" ||
			path.length !== canonicalPath.length ||
			path.some((segment, index) => canonicalPath[index] !== segment),
	};
}

/**
 * Assigns the current Profile's canonical slug address once.
 *
 * @remarks
 * This is a temporary first-party governance command. The route proves the
 * Profile identity from an interactive session, while this transaction fixes
 * the permanent `users` namespace, rejects reserved labels, and permits only
 * an initial assignment or an idempotent repeat. The one-time rule is not a
 * database constraint and may be replaced by a future audited rename flow.
 *
 * @alpha
 */
export async function assignCurrentProfileSlugAddress(
	profileId: string,
	input: { readonly slug: string },
): Promise<PublicCanonicalUnitSlugAddress> {
	const slug = parseAssignableProfileSlug(input.slug);
	const mutation = await database.transaction(async (tx) => {
		await lockSlugTree(tx);
		const [ownedProfile] = await tx
			.select({ id: profile.id })
			.from(profile)
			.where(eq(profile.id, profileId))
			.limit(1);
		if (!ownedProfile) throw new UnitNotFound();
		const current = await loadCanonicalAddress(tx, ownedProfile.id);
		decideProfileSlugAssignment(
			current
				? {
						scopeUnitId: current.scopeUnitId,
						slug: parseSlugLabel(current.slug),
					}
				: null,
			slug,
		);
		const result = await replaceCanonicalAddress(tx, {
			unitId: ownedProfile.id,
			scopeUnitId: TopLevelSlugNamespaceUnitIds.users,
			slug,
		});
		if (result.changed)
			await recordAuditEvent(tx, {
				category: "admin_activity",
				outcome: "succeeded",
				actor: { kind: "profile", profileId },
				authority: { kind: "unit", id: ownedProfile.id },
				action: "unit.slug.assign",
				target: { kind: "unit", id: ownedProfile.id },
				details: {
					before: result.before,
					after: result.after,
					redirectAddressId: result.redirectAddressId,
				},
			});
		return result;
	});
	return {
		scopeUnitId: TopLevelSlugNamespaceUnitIds.users,
		slug: mutation.after.slug,
		canonicalPath: [...(await loadCanonicalUnitPath(profileId, false))],
	};
}

type PublicAddressableUnitKind = "realm" | "zone";

const PublicUnitSlugScopeByKind = {
	realm: TopLevelSlugNamespaceUnitIds.realms,
	zone: TopLevelSlugNamespaceUnitIds.zones,
} satisfies Record<PublicAddressableUnitKind, string>;

async function replacePublicUnitSlugAddress(
	authorization: Authorization<string>,
	input: {
		readonly unitId: string;
		readonly kind: PublicAddressableUnitKind;
		readonly slug: string;
	},
): Promise<UnitAddressMutationResult> {
	const slug = parseSlugLabel(input.slug);
	const scopeUnitId = PublicUnitSlugScopeByKind[input.kind];
	const mutation = await database.transaction(async (tx) => {
		const [target] = await tx
			.select({ kind: unit.kind, deletedAt: unit.deletedAt })
			.from(unit)
			.where(eq(unit.id, input.unitId))
			.limit(1);
		if (!target || target.deletedAt || target.kind !== input.kind) throw new UnitNotFound();
		const result = await replaceCanonicalAddress(tx, {
			unitId: input.unitId,
			scopeUnitId,
			slug,
		});
		if (result.changed)
			await recordAuditEvent(tx, {
				category: "admin_activity",
				outcome: "succeeded",
				actor: { kind: "profile", profileId: authorization.profileId },
				authority:
					input.kind === "realm"
						? { kind: "realm", id: input.unitId }
						: { kind: "unit", id: input.unitId },
				action: result.before ? "unit.slug.rename" : "unit.slug.assign",
				target: { kind: "unit", id: input.unitId },
				details: {
					before: result.before,
					after: result.after,
					redirectAddressId: result.redirectAddressId,
				},
			});
		return result;
	});
	return {
		addressId: mutation.addressId,
		unitId: input.unitId,
		scopeUnitId: mutation.after.scopeUnitId,
		slug: mutation.after.slug,
		redirectAddressId: mutation.redirectAddressId,
		canonicalPath: await loadCanonicalUnitPath(input.unitId, false),
	};
}

/** Replaces a Realm address after proving Realm settings authority. */
export async function replaceRealmSlugAddress(
	authorization: Authorization<string>,
	input: { readonly realmId: string; readonly slug: string },
): Promise<UnitAddressMutationResult> {
	await authorization.realm.ensureCapability(input.realmId, "realm.settings.update");
	return replacePublicUnitSlugAddress(authorization, {
		unitId: input.realmId,
		kind: "realm",
		slug: input.slug,
	});
}

/** Replaces a Zone address after proving Unit update authority. */
export async function replaceZoneSlugAddress(
	authorization: Authorization<string>,
	input: { readonly zoneId: string; readonly slug: string },
): Promise<UnitAddressMutationResult> {
	await authorization.unit.ensureCanUpdate(input.zoneId, [["slug-address"]]);
	return replacePublicUnitSlugAddress(authorization, {
		unitId: input.zoneId,
		kind: "zone",
		slug: input.slug,
	});
}

/**
 * Assigns, renames, or removes a Zone Page Unit address inside its owning Zone scope.
 *
 * `home` is a transferable role address. Assigning it atomically removes it
 * from the former home Page, which remains reachable by its stable ID route.
 * Unlike ordinary renames, moving away from `home` does not retain a redirect:
 * the Zone root always identifies the current home Page.
 */
export async function replaceZonePageSlugAddress(
	tx: DatabaseTransaction,
	input: {
		readonly zoneId: string;
		readonly pageUnitId: string;
		readonly slug: string | null;
	},
): Promise<CanonicalUnitSlugAddress | null> {
	const slug = input.slug === null ? null : parseSlugLabel(input.slug);
	if (slug !== null && !isAvailableZonePageSlug(slug)) throw new InvalidSlug();
	const [target] = await tx
		.select({ kind: unit.kind, deletedAt: unit.deletedAt })
		.from(unit)
		.where(eq(unit.id, input.pageUnitId))
		.limit(1);
	const [scope] = await tx
		.select({ kind: unit.kind, deletedAt: unit.deletedAt })
		.from(unit)
		.where(eq(unit.id, input.zoneId))
		.limit(1);
	if (
		!target ||
		target.kind !== "zone_page" ||
		target.deletedAt ||
		!scope ||
		scope.kind !== "zone" ||
		scope.deletedAt
	)
		throw new UnitNotFound();

	await lockSlugTree(tx);
	const current = await loadCanonicalAddress(tx, input.pageUnitId);
	if (slug === null) {
		if (current) await tx.delete(unitSlugAddress).where(eq(unitSlugAddress.id, current.id));
		return null;
	}

	if (slug === ZoneHomePageSlug) {
		const [occupant] = await tx
			.select({
				id: unitSlugAddress.id,
				targetUnitId: unitSlugAddress.targetUnitId,
			})
			.from(unitSlugAddress)
			.where(
				and(
					eq(unitSlugAddress.scopeUnitId, input.zoneId),
					eq(unitSlugAddress.slug, ZoneHomePageSlug),
				),
			)
			.limit(1);
		if (occupant && occupant.targetUnitId !== input.pageUnitId)
			await tx.delete(unitSlugAddress).where(eq(unitSlugAddress.id, occupant.id));
	}

	// `home` is a role address, not a durable alias for the former home Page.
	if (current?.slug === ZoneHomePageSlug && slug !== ZoneHomePageSlug)
		await tx.delete(unitSlugAddress).where(eq(unitSlugAddress.id, current.id));

	const mutation = await replaceCanonicalAddress(tx, {
		unitId: input.pageUnitId,
		scopeUnitId: input.zoneId,
		slug,
		allowUnaddressedScope: true,
	});
	return {
		addressId: mutation.addressId,
		unitId: input.pageUnitId,
		scopeUnitId: input.zoneId,
		slug,
	};
}

/**
 * Replaces any Unit's canonical slug address through the platform access contract.
 *
 * @remarks
 * Resource-specific Profile, Realm, and Zone commands fix their namespaces and
 * prove narrower authority. This command remains for platform-governed kinds and
 * namespace administration. Permanent platform namespaces are immutable
 * because the resolver caches them.
 */
export async function replaceUnitSlugAddressWithPlatformAccess(
	authorization: Authorization<string>,
	input: {
		readonly unitId: string;
		readonly scopeUnitId: string | null;
		readonly slug: string;
		readonly rules: readonly GovernanceRuleReference[];
	},
): Promise<UnitAddressMutationResult> {
	await authorization.platform.ensureCapability("unit.slug.manage");
	const slug = parseSlugLabel(input.slug);
	const mutation = await database.transaction(async (tx) => {
		const [target] = await tx
			.select({ kind: unit.kind })
			.from(unit)
			.where(eq(unit.id, input.unitId))
			.limit(1);
		if (!target) throw new UnitNotFound();
		if (target.kind === "zone_page") {
			const [ownership] = await tx
				.select({ zoneId: zonePage.zoneId })
				.from(zonePage)
				.where(eq(zonePage.id, input.unitId))
				.limit(1);
			if (!ownership || input.scopeUnitId !== ownership.zoneId)
				throw new UnitAddressMutationForbidden();
			if (!isAvailableZonePageSlug(slug)) throw new InvalidSlug();
		}
		const fixedScopeUnitId = fixedPublicSlugScope(target.kind);
		if (fixedScopeUnitId && input.scopeUnitId !== fixedScopeUnitId)
			throw new UnitAddressMutationForbidden();
		if (target.kind === "slug_namespace" || input.scopeUnitId === null)
			await authorization.platform.ensureCapability("unit.slug.namespace.manage");
		const result = await replaceCanonicalAddress(tx, { ...input, slug });
		if (result.changed) {
			const action = !result.before
				? "unit.slug.assign"
				: result.before.scopeUnitId === result.after.scopeUnitId
					? "unit.slug.rename"
					: "unit.slug.move";
			const decision = await createGovernanceDecision(tx, {
				action,
				actorProfileId: authorization.profileId,
				authority: { kind: "platform" },
				targetUnitId: input.unitId,
				subject: { kind: "unit_slug_address", id: result.addressId },
				basis: { kind: "rules", rules: input.rules },
			});
			await recordAuditEvent(tx, {
				category: "admin_activity",
				outcome: "succeeded",
				actor: { kind: "profile", profileId: authorization.profileId },
				authority: { kind: "platform" },
				action,
				governanceDecisionId: decision.id,
				target: { kind: "unit", id: input.unitId },
				details: {
					before: result.before,
					after: result.after,
					redirectAddressId: result.redirectAddressId,
				},
			});
		}
		return result;
	});
	return {
		addressId: mutation.addressId,
		unitId: input.unitId,
		scopeUnitId: mutation.after.scopeUnitId,
		slug: mutation.after.slug,
		redirectAddressId: mutation.redirectAddressId,
		canonicalPath: await loadCanonicalUnitPath(input.unitId, false),
	};
}

/** Creates an explicitly addressed namespace through the platform access API. */
export async function createSlugNamespace(
	authorization: Authorization<string>,
	input: {
		readonly scopeUnitId: string | null;
		readonly slug: string;
		readonly rules: readonly GovernanceRuleReference[];
	},
): Promise<UnitAddressMutationResult> {
	await authorization.platform.ensureCapability("unit.slug.namespace.manage");
	const slug = parseSlugLabel(input.slug);
	const result = await database.transaction(async (tx) => {
		const created = await insertUnit(tx, {
			kind: "slug_namespace",
			status: "published",
			visibility: "public",
			publishedAt: new Date(),
			statusActor: { kind: "profile", profileId: authorization.profileId },
		});
		const mutation = await replaceCanonicalAddress(tx, {
			unitId: created.id,
			scopeUnitId: input.scopeUnitId,
			slug,
		});
		const decision = await createGovernanceDecision(tx, {
			action: "unit.slug_namespace.create",
			actorProfileId: authorization.profileId,
			authority: { kind: "platform" },
			targetUnitId: created.id,
			subject: { kind: "unit_slug_address", id: mutation.addressId },
			basis: { kind: "rules", rules: input.rules },
		});
		await recordAuditEvent(tx, {
			category: "admin_activity",
			outcome: "succeeded",
			actor: { kind: "profile", profileId: authorization.profileId },
			authority: { kind: "platform" },
			action: "unit.slug_namespace.create",
			governanceDecisionId: decision.id,
			target: { kind: "unit", id: created.id },
			details: { after: mutation.after, addressId: mutation.addressId },
		});
		await recordUnitRevision(tx, {
			unitId: created.id,
			actorProfileId: authorization.profileId,
			event: "create",
		});
		return { unitId: created.id, mutation };
	});
	return {
		addressId: result.mutation.addressId,
		unitId: result.unitId,
		scopeUnitId: result.mutation.after.scopeUnitId,
		slug: result.mutation.after.slug,
		redirectAddressId: null,
		canonicalPath: await loadCanonicalUnitPath(result.unitId, false),
	};
}

/** Releases one retained Redirect address through the platform access API. */
export async function releaseSlugRedirect(
	authorization: Authorization<string>,
	input: {
		readonly redirectAddressId: string;
		readonly rules: readonly GovernanceRuleReference[];
	},
): Promise<void> {
	await authorization.platform.ensureCapability("unit.slug.redirect.release");
	await database.transaction(async (tx) => {
		await lockSlugTree(tx);
		const [redirect] = await tx
			.select({
				id: unitSlugAddress.id,
				scopeUnitId: unitSlugAddress.scopeUnitId,
				slug: unitSlugAddress.slug,
				targetUnitId: unitSlugAddress.targetUnitId,
			})
			.from(unitSlugAddress)
			.where(
				and(eq(unitSlugAddress.id, input.redirectAddressId), eq(unitSlugAddress.kind, "redirect")),
			)
			.limit(1);
		if (!redirect) throw new SlugRedirectNotFound();
		if (redirect.scopeUnitId === null)
			await authorization.platform.ensureCapability("unit.slug.namespace.manage");
		const decision = await createGovernanceDecision(tx, {
			action: "unit.slug_redirect.release",
			actorProfileId: authorization.profileId,
			authority: { kind: "platform" },
			targetUnitId: redirect.targetUnitId,
			subject: { kind: "unit_slug_address", id: redirect.id },
			basis: { kind: "rules", rules: input.rules },
		});
		await tx.delete(unitSlugAddress).where(eq(unitSlugAddress.id, redirect.id));
		await recordAuditEvent(tx, {
			category: "admin_activity",
			outcome: "succeeded",
			actor: { kind: "profile", profileId: authorization.profileId },
			authority: { kind: "platform" },
			action: "unit.slug_redirect.release",
			governanceDecisionId: decision.id,
			target: { kind: "unit", id: redirect.targetUnitId },
			details: {
				redirectAddressId: redirect.id,
				before: { scopeUnitId: redirect.scopeUnitId, slug: redirect.slug },
				after: null,
			},
		});
	});
}
