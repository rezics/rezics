import { resolveCanonicalUnitId } from "./merge/canonical";
import {
	isAvailableZonePageSlug,
	ZoneHomePageSlug,
	type PublicSlugAddressValue,
} from "@rezics/slug";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";

import { recordAuditEvent } from "../audit";
import type { Authorization } from "../authorization";
import { database, type DatabaseExecutor, type DatabaseTransaction } from "../database";
import { unitSlugAddress, zonePage } from "../database/schema";
import type { UnitOwner } from "@rezics/reference";
import { readUnitStateById, type UnitState } from "./query";
import { unitStateRelation } from "./state-relation";
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
import { parseSlugLabel, SlugAddressMaximumDepth, type SlugLabel } from "./slug";
import {
	TopLevelSlugNamespaceSlugById,
	TopLevelSlugNamespaceIdBySlug,
	TopLevelSlugNamespaceIds,
} from "./slug-system";

export interface UnitSlugAddressValue {
	readonly scopeUnitId: string | null;
	readonly scopeNamespaceId: string | null;
	readonly slug: SlugLabel;
}

export interface CanonicalUnitSlugAddress extends UnitSlugAddressValue {
	readonly addressId: string;
	readonly unitId: string;
}

export interface ResolvedUnitPath {
	readonly id: string;
	readonly owner: UnitOwner;
	readonly shape: string;
	readonly path: readonly SlugLabel[];
	readonly canonicalPath: readonly SlugLabel[];
	readonly redirected: boolean;
}

export interface PublicCanonicalUnitSlugAddress extends PublicSlugAddressValue {
	readonly slug: SlugLabel;
	readonly scopeUnitId: string | null;
	readonly canonicalPath: SlugLabel[];
}

export interface UnitAddressMutationResult extends CanonicalUnitSlugAddress {
	readonly redirectAddressId: string | null;
	readonly canonicalPath: readonly SlugLabel[];
}

interface StoredCanonicalAddress {
	readonly id: string;
	readonly scopeUnitId: string | null;
	readonly scopeNamespaceId: string | null;
	readonly slug: string;
}

interface CanonicalAddressMutation {
	readonly addressId: string;
	readonly redirectAddressId: string | null;
	readonly before: UnitSlugAddressValue | null;
	readonly after: UnitSlugAddressValue;
	readonly changed: boolean;
}

/** Lock only the moving object and its direct parent. Namespace collisions use the unique key. */
async function lockSlugObjects(tx: DatabaseTransaction, ids: readonly string[]): Promise<void> {
	for (const id of [...new Set(ids)].sort())
		await tx.execute(
			sql`select pg_advisory_xact_lock(hashtextextended(${"rezics-slug:" + id}, 0))`,
		);
}
function fixedPublicSlugNamespace(owner: UnitOwner): string | undefined {
	if (owner === "realm") return TopLevelSlugNamespaceIds.realms;
	if (owner === "zone") return TopLevelSlugNamespaceIds.zones;
	return undefined;
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

function scopeMatches(scope: {
	readonly scopeUnitId: string | null;
	readonly scopeNamespaceId: string | null;
}) {
	return and(
		scope.scopeUnitId === null
			? isNull(unitSlugAddress.scopeUnitId)
			: eq(unitSlugAddress.scopeUnitId, scope.scopeUnitId),
		scope.scopeNamespaceId === null
			? isNull(unitSlugAddress.scopeNamespaceId)
			: eq(unitSlugAddress.scopeNamespaceId, scope.scopeNamespaceId),
	);
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
				scopeNamespaceId: unitSlugAddress.scopeNamespaceId,
				slug: unitSlugAddress.slug,
			})
			.from(unitSlugAddress)
			.where(and(eq(unitSlugAddress.kind, "canonical"), eq(unitSlugAddress.targetUnitId, unitId)))
			.limit(1)
	)[0];
}

async function replaceCanonicalAddress(
	tx: DatabaseTransaction,
	input: {
		readonly unitId: string;
		readonly scopeUnitId: string | null;
		readonly scopeNamespaceId: string | null;
		readonly slug: SlugLabel;
		/** Direct scoped lookup remains valid when the parent has no public canonical path. */
		readonly allowUnaddressedScope?: boolean;
	},
): Promise<CanonicalAddressMutation> {
	await lockSlugObjects(tx, [input.unitId, ...(input.scopeUnitId ? [input.scopeUnitId] : [])]);
	const target = await readUnitStateById(tx, input.unitId);
	if (!target) throw new UnitNotFound();
	if ((input.scopeUnitId === null) === (input.scopeNamespaceId === null))
		throw new UnitAddressMutationForbidden();
	const current = await loadCanonicalAddress(tx, target.reference.id);
	if (input.scopeNamespaceId !== null && !TopLevelSlugNamespaceSlugById.has(input.scopeNamespaceId))
		throw new SlugScopeNotFound();
	if (input.scopeUnitId !== null) {
		if (input.scopeUnitId === input.unitId) throw new SlugScopeCycle();
		const scope = await readUnitStateById(tx, input.scopeUnitId);
		if (!scope) throw new SlugScopeUnavailable();
		const parentAddress = await loadCanonicalAddress(tx, input.scopeUnitId);
		// A namespace plus two resource labels is the maximum supported address shape.
		// Locking the parent prevents concurrent reparenting or insertion below this target.
		if (parentAddress?.scopeUnitId) throw new SlugDepthExceeded();
		if (!parentAddress && !(input.allowUnaddressedScope && scope.reference.owner === "zone"))
			throw new SlugScopeNotFound();
		const [child] = await tx
			.select({ id: unitSlugAddress.id })
			.from(unitSlugAddress)
			.where(eq(unitSlugAddress.scopeUnitId, input.unitId))
			.limit(1);
		if (child) throw new SlugDepthExceeded();
	}

	const after: UnitSlugAddressValue = {
		scopeUnitId: input.scopeUnitId,
		scopeNamespaceId: input.scopeNamespaceId,
		slug: input.slug,
	};
	if (
		current &&
		current.scopeUnitId === input.scopeUnitId &&
		current.scopeNamespaceId === input.scopeNamespaceId &&
		current.slug === input.slug
	)
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
		.where(and(scopeMatches(input), eq(unitSlugAddress.slug, input.slug)))
		.limit(1);
	if (occupant) {
		if (occupant.kind === "redirect" && occupant.targetUnitId === target.reference.id)
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
					scopeNamespaceId: input.scopeNamespaceId,
					slug: input.slug,
					targetUnitId: target.reference.id,
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
			.set({
				scopeUnitId: input.scopeUnitId,
				scopeNamespaceId: input.scopeNamespaceId,
				slug: input.slug,
				updatedAt: new Date(),
			})
			.where(eq(unitSlugAddress.id, current.id));
		const [redirect] = await tx
			.insert(unitSlugAddress)
			.values({
				kind: "redirect",
				scopeUnitId: current.scopeUnitId,
				scopeNamespaceId: current.scopeNamespaceId,
				slug: current.slug,
				targetUnitId: target.reference.id,
			})
			.returning({ id: unitSlugAddress.id });
		if (!redirect) throw new Error("Slug Redirect insertion did not return an id");
		return {
			addressId: current.id,
			redirectAddressId: redirect.id,
			before: {
				scopeUnitId: current.scopeUnitId,
				scopeNamespaceId: current.scopeNamespaceId,
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

/** Bounded ID input; each depth uses one index seek and one concrete owner lookup per candidate. */
export async function getPublicCanonicalUnitSlugAddresses(
	unitIds: readonly string[],
	executor: DatabaseExecutor = database,
): Promise<ReadonlyMap<string, PublicCanonicalUnitSlugAddress>> {
	if (unitIds.length > 512)
		throw new RangeError("At most 512 canonical addresses can be projected at once");
	const result = new Map<string, PublicCanonicalUnitSlugAddress>();
	const states = [...new Set(unitIds)].map((id) => ({
		id,
		currentId: id,
		path: [] as SlugLabel[],
		direct: null as UnitSlugAddressValue | null,
		visited: new Set<string>(),
		done: false,
	}));
	for (let depth = 0; depth < SlugAddressMaximumDepth - 1; depth++) {
		const ids = [...new Set(states.filter((s) => !s.done).map((s) => s.currentId))];
		if (!ids.length) break;
		const state = unitStateRelation(unitSlugAddress.targetUnitId, "slug_target_state");
		const rows = await executor
			.select({
				targetId: unitSlugAddress.targetUnitId,
				scopeUnitId: unitSlugAddress.scopeUnitId,
				scopeNamespaceId: unitSlugAddress.scopeNamespaceId,
				slug: unitSlugAddress.slug,
				status: state.status,
				visibility: state.visibility,
				moderationStatus: state.moderationStatus,
				deletedAt: state.deletedAt,
			})
			.from(unitSlugAddress)
			.innerJoinLateral(state, sql`true`)
			.where(
				and(eq(unitSlugAddress.kind, "canonical"), inArray(unitSlugAddress.targetUnitId, ids)),
			);
		const byId = new Map(rows.map((r) => [r.targetId, r]));
		for (const s of states) {
			if (s.done) continue;
			const row = byId.get(s.currentId);
			if (s.visited.has(s.currentId) || !row || !isPublicAddressNode(row)) {
				s.done = true;
				continue;
			}
			s.visited.add(s.currentId);
			let slug: SlugLabel;
			try {
				slug = parseSlugLabel(row.slug);
			} catch {
				s.done = true;
				continue;
			}
			s.direct ??= { scopeUnitId: row.scopeUnitId, scopeNamespaceId: row.scopeNamespaceId, slug };
			s.path.push(slug);
			if (row.scopeNamespaceId) {
				const namespace = TopLevelSlugNamespaceSlugById.get(row.scopeNamespaceId);
				if (namespace && row.scopeUnitId === null)
					result.set(s.id, {
						...s.direct,
						canonicalPath: [parseSlugLabel(namespace), ...s.path.toReversed()],
					});
				s.done = true;
			} else if (row.scopeUnitId) s.currentId = row.scopeUnitId;
			else s.done = true;
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
	for (let depth = 0; depth < SlugAddressMaximumDepth - 1; depth++) {
		if (visited.has(currentId)) throw new SlugScopeCycle();
		visited.add(currentId);
		const state = await readUnitStateById(database, currentId);
		if (!state || (requirePublicAncestors && !isPublicAddressNode(state))) throw new UnitNotFound();
		const [address] = await database
			.select({
				scopeUnitId: unitSlugAddress.scopeUnitId,
				scopeNamespaceId: unitSlugAddress.scopeNamespaceId,
				slug: unitSlugAddress.slug,
			})
			.from(unitSlugAddress)
			.where(
				and(eq(unitSlugAddress.kind, "canonical"), eq(unitSlugAddress.targetUnitId, currentId)),
			)
			.limit(1);
		if (!address) throw new UnitSlugAddressNotFound();
		path.push(parseSlugLabel(address.slug));
		if (address.scopeNamespaceId) {
			const namespace = TopLevelSlugNamespaceSlugById.get(address.scopeNamespaceId);
			if (!namespace || address.scopeUnitId !== null) throw new UnitSlugAddressNotFound();
			return [parseSlugLabel(namespace), ...path.reverse()];
		}
		if (!address.scopeUnitId) throw new UnitSlugAddressNotFound();
		currentId = address.scopeUnitId;
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
	if (!(await readUnitStateById(database, unitId))) throw new UnitNotFound();
	const [record] = await database
		.select({
			addressId: unitSlugAddress.id,
			scopeUnitId: unitSlugAddress.scopeUnitId,
			scopeNamespaceId: unitSlugAddress.scopeNamespaceId,
			slug: unitSlugAddress.slug,
		})
		.from(unitSlugAddress)
		.where(and(eq(unitSlugAddress.kind, "canonical"), eq(unitSlugAddress.targetUnitId, unitId)))
		.limit(1);
	if (!record) throw new UnitSlugAddressNotFound();
	return { ...record, unitId, slug: parseSlugLabel(record.slug) };
}

async function loadPublicScopedTarget(
	scope: { scopeUnitId: string | null; scopeNamespaceId: string | null },
	slug: SlugLabel,
) {
	const [address] = await database
		.select({ addressKind: unitSlugAddress.kind, targetId: unitSlugAddress.targetUnitId })
		.from(unitSlugAddress)
		.where(and(scopeMatches(scope), eq(unitSlugAddress.slug, slug)))
		.limit(1);
	if (!address) throw new UnitNotFound();
	const original = await readUnitStateById(database, address.targetId);
	const canonicalId = await resolveCanonicalUnitId(database, address.targetId);
	if (
		canonicalId !== address.targetId &&
		(!original ||
			original.visibility !== "public" ||
			original.moderationStatus !== "approved" ||
			original.deletedAt)
	)
		throw new UnitNotFound();
	const state =
		canonicalId === address.targetId ? original : await readUnitStateById(database, canonicalId);
	if (!state || !isPublicAddressNode(state)) throw new UnitNotFound();
	return {
		...address,
		addressKind: canonicalId === address.targetId ? address.addressKind : ("redirect" as const),
		state,
	};
}
function resolvedAddress(
	state: UnitState,
	path: readonly SlugLabel[],
	canonicalPath: readonly SlugLabel[],
	redirected: boolean,
): ResolvedUnitPath {
	return {
		id: state.reference.id,
		owner: state.reference.owner,
		shape: state.shape,
		path,
		canonicalPath,
		redirected:
			redirected ||
			path.length !== canonicalPath.length ||
			path.some((s, i) => s !== canonicalPath[i]),
	};
}
/** The first label addresses control data; a namespace alone never resolves to a content identity. */
export async function resolveUnitPath(segments: readonly string[]): Promise<ResolvedUnitPath> {
	if (segments.length < 2 || segments.length > SlugAddressMaximumDepth)
		throw new SlugDepthExceeded();
	const path = segments.map(parseSlugLabel);
	const namespaceId = TopLevelSlugNamespaceIdBySlug.get(path[0] ?? "");
	if (!namespaceId) throw new UnitNotFound();
	let scope: { scopeUnitId: string | null; scopeNamespaceId: string | null } = {
		scopeUnitId: null,
		scopeNamespaceId: namespaceId,
	};
	let state: UnitState | undefined;
	let redirected = false;
	for (const slug of path.slice(1)) {
		const target = await loadPublicScopedTarget(scope, slug);
		state = target.state;
		redirected ||= target.addressKind === "redirect";
		scope = { scopeUnitId: target.targetId, scopeNamespaceId: null };
	}
	if (!state) throw new UnitNotFound();
	return resolvedAddress(
		state,
		path,
		await loadPublicCanonicalUnitPathOrNotFound(state.reference.id),
		redirected,
	);
}
/** A scope reference explicitly distinguishes a content parent from a permanent namespace. */
export async function resolveScopedUnitAddress(
	scope: { scopeUnitId: string | null; scopeNamespaceId: string | null },
	slugValue: string,
	expectedOwner?: UnitOwner,
): Promise<ResolvedUnitPath> {
	if ((scope.scopeUnitId === null) === (scope.scopeNamespaceId === null)) throw new UnitNotFound();
	let scopePath: readonly SlugLabel[];
	if (scope.scopeNamespaceId) {
		const label = TopLevelSlugNamespaceSlugById.get(scope.scopeNamespaceId);
		if (!label) throw new UnitNotFound();
		scopePath = [parseSlugLabel(label)];
	} else if (scope.scopeUnitId)
		scopePath = await loadPublicCanonicalUnitPathOrNotFound(scope.scopeUnitId);
	else throw new UnitNotFound();
	const slug = parseSlugLabel(slugValue);
	const target = await loadPublicScopedTarget(scope, slug);
	if (expectedOwner && target.state.reference.owner !== expectedOwner) throw new UnitNotFound();
	const path = [...scopePath, slug];
	if (path.length > SlugAddressMaximumDepth) throw new UnitNotFound();
	return resolvedAddress(
		target.state,
		path,
		await loadPublicCanonicalUnitPathOrNotFound(target.state.reference.id),
		target.addressKind === "redirect",
	);
}

type PublicAddressableUnitKind = "realm" | "zone";

const PublicUnitSlugScopeByKind = {
	realm: TopLevelSlugNamespaceIds.realms,
	zone: TopLevelSlugNamespaceIds.zones,
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
	const scopeNamespaceId = PublicUnitSlugScopeByKind[input.kind];
	const mutation = await database.transaction(async (tx) => {
		const target = await readUnitStateById(tx, input.unitId);
		if (!target || target.reference.owner !== input.kind) throw new UnitNotFound();
		const result = await replaceCanonicalAddress(tx, {
			unitId: input.unitId,
			scopeUnitId: null,
			scopeNamespaceId,
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
		scopeNamespaceId: mutation.after.scopeNamespaceId,
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
	await lockSlugObjects(tx, [input.zoneId, input.pageUnitId]);
	const target = await readUnitStateById(tx, input.pageUnitId);
	const scope = await readUnitStateById(tx, input.zoneId);
	const [page] = await tx
		.select({ zoneId: zonePage.zoneId })
		.from(zonePage)
		.where(eq(zonePage.id, input.pageUnitId))
		.limit(1);
	if (
		!target ||
		target.reference.owner !== "post" ||
		!scope ||
		scope.reference.owner !== "zone" ||
		page?.zoneId !== input.zoneId
	)
		throw new UnitNotFound();
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
		scopeNamespaceId: null,
		slug,
		allowUnaddressedScope: true,
	});
	return {
		addressId: mutation.addressId,
		unitId: input.pageUnitId,
		scopeUnitId: input.zoneId,
		scopeNamespaceId: null,
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
		readonly scopeNamespaceId: string | null;
		readonly slug: string;
		readonly rules: readonly GovernanceRuleReference[];
	},
): Promise<UnitAddressMutationResult> {
	await authorization.platform.ensureCapability("unit.slug.manage");
	const slug = parseSlugLabel(input.slug);
	const mutation = await database.transaction(async (tx) => {
		const target = await readUnitStateById(tx, input.unitId);
		if (!target) throw new UnitNotFound();
		const [page] = await tx
			.select({ zoneId: zonePage.zoneId })
			.from(zonePage)
			.where(eq(zonePage.id, input.unitId))
			.limit(1);
		if (
			page &&
			(input.scopeUnitId !== page.zoneId ||
				input.scopeNamespaceId !== null ||
				!isAvailableZonePageSlug(slug))
		)
			throw new UnitAddressMutationForbidden();
		const fixedNamespace = fixedPublicSlugNamespace(target.reference.owner);
		if (fixedNamespace && (input.scopeNamespaceId !== fixedNamespace || input.scopeUnitId !== null))
			throw new UnitAddressMutationForbidden();
		const result = await replaceCanonicalAddress(tx, { ...input, slug });
		if (result.changed) {
			const action = !result.before
				? "unit.slug.assign"
				: result.before.scopeUnitId === result.after.scopeUnitId &&
						result.before.scopeNamespaceId === result.after.scopeNamespaceId
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
		scopeNamespaceId: mutation.after.scopeNamespaceId,
		slug: mutation.after.slug,
		redirectAddressId: mutation.redirectAddressId,
		canonicalPath: await loadCanonicalUnitPath(input.unitId, false),
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
		const [redirect] = await tx
			.select({
				id: unitSlugAddress.id,
				scopeUnitId: unitSlugAddress.scopeUnitId,
				scopeNamespaceId: unitSlugAddress.scopeNamespaceId,
				slug: unitSlugAddress.slug,
				targetUnitId: unitSlugAddress.targetUnitId,
			})
			.from(unitSlugAddress)
			.where(
				and(eq(unitSlugAddress.id, input.redirectAddressId), eq(unitSlugAddress.kind, "redirect")),
			)
			.limit(1)
			.for("update");
		if (!redirect) throw new SlugRedirectNotFound();
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
				before: {
					scopeUnitId: redirect.scopeUnitId,
					scopeNamespaceId: redirect.scopeNamespaceId,
					slug: redirect.slug,
				},
				after: null,
			},
		});
	});
}
