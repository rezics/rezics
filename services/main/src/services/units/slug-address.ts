import { and, eq, isNull, sql } from "drizzle-orm";

import type { Authorization } from "../authorization";
import { database, type DatabaseTransaction } from "../database";
import {
	auditEvent,
	profile,
	unit,
	unitSlugAddress,
	type GovernanceReasonCodeValues,
	type UnitKind,
} from "../database/schema";
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
import {
	SystemSlugNamespaceUnitIds,
	TopLevelSlugNamespaceSlugByUnitId,
	TopLevelSlugNamespaceUnitIdBySlug,
	TopLevelSlugNamespaceUnitIds,
} from "./slug-system";
import { parseSlugLabel, SlugAddressMaximumDepth, type SlugLabel } from "./slug";

type GovernanceReasonCode = (typeof GovernanceReasonCodeValues)[number];

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
	await tx.execute(
		sql`select pg_advisory_xact_lock(hashtextextended(${SlugTreeMutationLock}, 0))`,
	);
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
			.where(
				and(
					eq(unitSlugAddress.kind, "canonical"),
					eq(unitSlugAddress.targetUnitId, unitId),
				),
			)
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
				and(
					eq(unitSlugAddress.kind, "canonical"),
					eq(unitSlugAddress.targetUnitId, currentId),
				),
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

	const scopeDepth = await loadScopeDepth(tx, input.scopeUnitId, target.id);
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
				and(
					eq(unitSlugAddress.kind, "canonical"),
					eq(unitSlugAddress.targetUnitId, currentId),
				),
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

/**
 * Returns a Unit's optional canonical address as a proved address value.
 *
 * @remarks
 * Core Unit reads deliberately do not call this function or expose slug data.
 */
export async function getCanonicalUnitSlugAddressAsStaff(
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

/**
 * Resolves a backend slug path without changing the ID-based Unit contract.
 *
 * @remarks
 * Permanent platform namespaces use immutable process-local routing data. The
 * frontend intentionally does not consume this resolver yet.
 *
 * @todo
 * Define frontend routing, cache observability, and canonical redirect behavior
 * before enabling public slug routes.
 */
export async function resolveUnitPath(segments: readonly string[]): Promise<ResolvedUnitPath> {
	if (!segments.length || segments.length > SlugAddressMaximumDepth)
		throw new SlugDepthExceeded();
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
 * Replaces the current Profile's canonical slug address.
 *
 * @remarks
 * This is the only non-staff slug mutation. The caller supplies only the label;
 * the backend proves Profile ownership from the session and fixes the scope to
 * the permanent `users` namespace. Repeating the same replacement is idempotent.
 *
 * @todo
 * Complete abuse controls and the public Profile slug lifecycle before frontend
 * integration.
 */
export async function replaceOwnProfileSlugAddress(
	authorization: Authorization<string>,
	input: { readonly slug: string },
): Promise<UnitAddressMutationResult> {
	const slug = parseSlugLabel(input.slug);
	const mutation = await database.transaction(async (tx) => {
		const [ownedProfile] = await tx
			.select({ id: profile.id })
			.from(profile)
			.where(eq(profile.id, authorization.profileId))
			.limit(1);
		if (!ownedProfile) throw new UnitNotFound();
		const result = await replaceCanonicalAddress(tx, {
			unitId: ownedProfile.id,
			scopeUnitId: TopLevelSlugNamespaceUnitIds.users,
			slug,
		});
		if (result.changed)
			await tx.insert(auditEvent).values({
				actorProfileId: authorization.profileId,
				action: result.before ? "unit.slug.rename" : "unit.slug.assign",
				decisionCode: "allowed",
				subjectKind: "unit",
				subjectId: ownedProfile.id,
				metadata: {
					before: result.before,
					after: result.after,
					redirectAddressId: result.redirectAddressId,
				},
			});
		return result;
	});
	return {
		addressId: mutation.addressId,
		unitId: authorization.profileId,
		scopeUnitId: mutation.after.scopeUnitId,
		slug: mutation.after.slug,
		redirectAddressId: mutation.redirectAddressId,
		canonicalPath: await loadCanonicalUnitPath(authorization.profileId, false),
	};
}

/**
 * Replaces any Unit's canonical slug address through the staff-only contract.
 *
 * @remarks
 * Non-Profile public slug mutation is intentionally unavailable. Permanent
 * platform namespace addresses are immutable because the resolver caches them.
 *
 * @todo
 * Design per-kind public policies before exposing any narrower non-staff API.
 * In particular, define ownership validation and rendering semantics for posts
 * whose explicit staff-selected scope differs from their author Profile ID.
 */
export async function replaceUnitSlugAddressAsStaff(
	authorization: Authorization<string>,
	input: {
		readonly unitId: string;
		readonly scopeUnitId: string | null;
		readonly slug: string;
		readonly reasonCode: GovernanceReasonCode;
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
		if (target.kind === "slug_namespace" || input.scopeUnitId === null)
			await authorization.platform.ensureCapability("unit.slug.namespace.manage");
		const result = await replaceCanonicalAddress(tx, { ...input, slug });
		if (result.changed)
			await tx.insert(auditEvent).values({
				actorProfileId: authorization.profileId,
				action: !result.before
					? "unit.slug.assign"
					: result.before.scopeUnitId === result.after.scopeUnitId
						? "unit.slug.rename"
						: "unit.slug.move",
				decisionCode: input.reasonCode,
				subjectKind: "unit",
				subjectId: input.unitId,
				metadata: {
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

/** Creates an explicitly addressed namespace through the staff-only slug API. */
export async function createSlugNamespace(
	authorization: Authorization<string>,
	input: {
		readonly scopeUnitId: string | null;
		readonly slug: string;
		readonly reasonCode: GovernanceReasonCode;
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
		await tx.insert(auditEvent).values({
			actorProfileId: authorization.profileId,
			action: "unit.slug_namespace.create",
			decisionCode: input.reasonCode,
			subjectKind: "unit",
			subjectId: created.id,
			metadata: { after: mutation.after, addressId: mutation.addressId },
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

/** Releases one retained Redirect address through the staff-only slug API. */
export async function releaseSlugRedirect(
	authorization: Authorization<string>,
	input: {
		readonly redirectAddressId: string;
		readonly reasonCode: GovernanceReasonCode;
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
				and(
					eq(unitSlugAddress.id, input.redirectAddressId),
					eq(unitSlugAddress.kind, "redirect"),
				),
			)
			.limit(1);
		if (!redirect) throw new SlugRedirectNotFound();
		if (redirect.scopeUnitId === null)
			await authorization.platform.ensureCapability("unit.slug.namespace.manage");
		await tx.delete(unitSlugAddress).where(eq(unitSlugAddress.id, redirect.id));
		await tx.insert(auditEvent).values({
			actorProfileId: authorization.profileId,
			action: "unit.slug_redirect.release",
			decisionCode: input.reasonCode,
			subjectKind: "unit",
			subjectId: redirect.targetUnitId,
			metadata: {
				redirectAddressId: redirect.id,
				before: { scopeUnitId: redirect.scopeUnitId, slug: redirect.slug },
				after: null,
			},
		});
	});
}
