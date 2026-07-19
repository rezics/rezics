import { and, eq, isNull, sql } from "drizzle-orm";

import type { Authorization } from "../authorization";
import { database, type DatabaseTransaction } from "../database";
import {
	auditEvent,
	unit,
	unitRedirect,
	type GovernanceReasonCodeValues,
	type UnitKindValues,
} from "../database/schema";
import {
	SlugDepthExceeded,
	SlugRedirectLoop,
	SlugRedirectNotFound,
	SlugScopeCycle,
	SlugScopeNotFound,
	SlugScopeUnavailable,
	SlugTaken,
	UnitAddressMutationForbidden,
	UnitAddressUnchanged,
	UnitNotFound,
} from "./errors";
import { RootSlugNamespaceUnitId } from "./slug-system";
import { parseSlugLabel, SlugAddressMaximumDepth, type SlugLabel } from "./slug";

type UnitKind = (typeof UnitKindValues)[number];
type GovernanceReasonCode = (typeof GovernanceReasonCodeValues)[number];
type CanonicalUnitKind = Exclude<UnitKind, "redirect">;
type UnitInsert = typeof unit.$inferInsert;

export interface UnitSlugAddress {
	readonly scopeUnitId: string;
	readonly slug: SlugLabel;
}

export interface AddressedUnitInsert extends Omit<UnitInsert, "kind" | "slug" | "slugScopeId"> {
	readonly kind: CanonicalUnitKind;
	readonly slugScopeId: string;
	readonly slug: string;
}

export interface ResolvedUnitPath {
	readonly id: string;
	readonly kind: CanonicalUnitKind;
	readonly path: readonly SlugLabel[];
	readonly canonicalPath: readonly SlugLabel[];
	readonly redirected: boolean;
}

export interface UnitAddressMutationResult {
	readonly unitId: string;
	readonly redirectUnitId: string;
	readonly canonicalPath: readonly SlugLabel[];
}

const SlugTreeMutationLock = "rezics-unit-slug-tree";
const RedirectMaximumHops = 8;

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

function mapSlugCollision(error: unknown, address: UnitSlugAddress): never {
	if (hasDatabaseConstraint(error, "unit_slug_scope_slug_key"))
		throw new SlugTaken(address.scopeUnitId, address.slug);
	throw error;
}

async function lockSlugTree(tx: DatabaseTransaction): Promise<void> {
	await tx.execute(
		sql`select pg_advisory_xact_lock(hashtextextended(${SlugTreeMutationLock}, 0))`,
	);
}

async function lockSlugTreeScopeRead(tx: DatabaseTransaction): Promise<void> {
	await tx.execute(
		sql`select pg_advisory_xact_lock_shared(hashtextextended(${SlugTreeMutationLock}, 0))`,
	);
}

async function loadScopeDepth(
	tx: DatabaseTransaction,
	scopeUnitId: string,
	movingUnitId?: string,
): Promise<number> {
	let currentId = scopeUnitId;
	let depth = 0;
	const visited = new Set<string>();

	while (currentId !== RootSlugNamespaceUnitId) {
		if (currentId === movingUnitId) throw new SlugScopeCycle();
		if (visited.has(currentId)) throw new SlugScopeCycle();
		visited.add(currentId);

		const [current] = await tx
			.select({
				id: unit.id,
				kind: unit.kind,
				slugScopeId: unit.slugScopeId,
				deletedAt: unit.deletedAt,
			})
			.from(unit)
			.where(eq(unit.id, currentId))
			.limit(1);
		if (!current) throw new SlugScopeNotFound();
		if (current.deletedAt || current.kind === "redirect" || !current.slugScopeId)
			throw new SlugScopeUnavailable();

		depth += 1;
		if (depth + 1 > SlugAddressMaximumDepth) throw new SlugDepthExceeded();
		currentId = current.slugScopeId;
	}

	const [root] = await tx
		.select({ id: unit.id, kind: unit.kind, deletedAt: unit.deletedAt })
		.from(unit)
		.where(eq(unit.id, RootSlugNamespaceUnitId))
		.limit(1);
	if (!root) throw new SlugScopeNotFound();
	if (root.deletedAt || root.kind !== "slug_namespace") throw new SlugScopeUnavailable();
	return depth;
}

async function ensureCanonicalScope(
	tx: DatabaseTransaction,
	scopeUnitId: string,
	options: { readonly allowRoot: boolean; readonly movingUnitId?: string },
): Promise<void> {
	if (scopeUnitId === RootSlugNamespaceUnitId && !options.allowRoot)
		throw new UnitAddressMutationForbidden();
	await loadScopeDepth(tx, scopeUnitId, options.movingUnitId);
}

export async function insertAddressedUnit(
	tx: DatabaseTransaction,
	input: AddressedUnitInsert,
): Promise<{ readonly id: string; readonly slug: SlugLabel }> {
	const slug = parseSlugLabel(input.slug);
	await lockSlugTreeScopeRead(tx);
	await ensureCanonicalScope(tx, input.slugScopeId, { allowRoot: false });
	try {
		const [created] = await tx
			.insert(unit)
			.values({ ...input, slug })
			.returning({ id: unit.id, slug: unit.slug });
		if (!created?.slug) throw new Error("Addressed Unit insertion did not return an address");
		return { id: created.id, slug: parseSlugLabel(created.slug) };
	} catch (error) {
		mapSlugCollision(error, { scopeUnitId: input.slugScopeId, slug });
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

async function followRedirect(redirectUnitId: string): Promise<{
	readonly id: string;
	readonly kind: CanonicalUnitKind;
	readonly status: string;
	readonly visibility: string;
	readonly moderationStatus: string;
	readonly deletedAt: Date | null;
}> {
	let currentId = redirectUnitId;
	const visited = new Set<string>();
	for (let hops = 0; hops < RedirectMaximumHops; hops += 1) {
		if (visited.has(currentId)) throw new SlugRedirectLoop();
		visited.add(currentId);
		const [target] = await database
			.select({
				id: unit.id,
				kind: unit.kind,
				status: unit.status,
				visibility: unit.visibility,
				moderationStatus: unit.moderationStatus,
				deletedAt: unit.deletedAt,
			})
			.from(unitRedirect)
			.innerJoin(unit, eq(unit.id, unitRedirect.targetUnitId))
			.where(eq(unitRedirect.id, currentId))
			.limit(1);
		if (!target) throw new SlugRedirectNotFound();
		if (target.kind !== "redirect") return { ...target, kind: target.kind };
		currentId = target.id;
	}
	throw new SlugRedirectLoop();
}

async function loadCanonicalUnitPath(
	unitId: string,
	requirePublicAncestors: boolean,
): Promise<readonly SlugLabel[]> {
	let currentId = unitId;
	const path: SlugLabel[] = [];
	const visited = new Set<string>();

	for (let depth = 0; depth <= SlugAddressMaximumDepth; depth += 1) {
		if (visited.has(currentId)) throw new SlugScopeCycle();
		visited.add(currentId);
		const [current] = await database
			.select({
				id: unit.id,
				kind: unit.kind,
				slugScopeId: unit.slugScopeId,
				slug: unit.slug,
				status: unit.status,
				visibility: unit.visibility,
				moderationStatus: unit.moderationStatus,
				deletedAt: unit.deletedAt,
			})
			.from(unit)
			.where(eq(unit.id, currentId))
			.limit(1);
		if (!current || current.deletedAt) throw new UnitNotFound();
		if (current.kind === "redirect") throw new SlugScopeUnavailable();
		if (requirePublicAncestors && !isPublicAddressNode(current)) throw new UnitNotFound();
		if (current.id === RootSlugNamespaceUnitId) return path.reverse();
		if (!current.slugScopeId || !current.slug) throw new SlugScopeUnavailable();
		path.push(parseSlugLabel(current.slug));
		currentId = current.slugScopeId;
	}
	throw new SlugDepthExceeded();
}

export async function getCanonicalUnitPath(unitId: string): Promise<readonly SlugLabel[]> {
	return loadCanonicalUnitPath(unitId, false);
}

export async function resolveUnitPath(segments: readonly string[]): Promise<ResolvedUnitPath> {
	if (!segments.length || segments.length > SlugAddressMaximumDepth)
		throw new SlugDepthExceeded();
	const path = segments.map(parseSlugLabel);
	let scopeUnitId = RootSlugNamespaceUnitId;
	let resolved:
		| {
				readonly id: string;
				readonly kind: CanonicalUnitKind;
				readonly status: string;
				readonly visibility: string;
				readonly moderationStatus: string;
				readonly deletedAt: Date | null;
		  }
		| undefined;
	let followedRedirect = false;

	for (const slug of path) {
		const [child] = await database
			.select({
				id: unit.id,
				kind: unit.kind,
				status: unit.status,
				visibility: unit.visibility,
				moderationStatus: unit.moderationStatus,
				deletedAt: unit.deletedAt,
			})
			.from(unit)
			.where(
				and(eq(unit.slugScopeId, scopeUnitId), eq(unit.slug, slug), isNull(unit.deletedAt)),
			)
			.limit(1);
		if (!child) throw new UnitNotFound();
		resolved =
			child.kind === "redirect"
				? await followRedirect(child.id)
				: { ...child, kind: child.kind };
		if (child.kind === "redirect") followedRedirect = true;
		if (!isPublicAddressNode(resolved)) throw new UnitNotFound();
		scopeUnitId = resolved.id;
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

export async function createSlugNamespace(
	authorization: Authorization<string>,
	input: {
		readonly scopeUnitId: string;
		readonly slug: string;
		readonly reasonCode: GovernanceReasonCode;
	},
): Promise<{ readonly id: string; readonly canonicalPath: readonly SlugLabel[] }> {
	await authorization.platform.ensureCapability("unit.slug.namespace.manage");
	const slug = parseSlugLabel(input.slug);
	const id = await database.transaction(async (tx) => {
		await lockSlugTreeScopeRead(tx);
		await ensureCanonicalScope(tx, input.scopeUnitId, { allowRoot: true });
		try {
			const [created] = await tx
				.insert(unit)
				.values({
					kind: "slug_namespace",
					slugScopeId: input.scopeUnitId,
					slug,
					status: "published",
					visibility: "public",
					publishedAt: new Date(),
				})
				.returning({ id: unit.id });
			if (!created) throw new Error("Slug Namespace insertion did not return an id");
			await tx.insert(auditEvent).values({
				actorProfileId: authorization.profileId,
				action: "unit.slug_namespace.create",
				decisionCode: input.reasonCode,
				subjectKind: "unit",
				subjectId: created.id,
				metadata: { after: { scopeUnitId: input.scopeUnitId, slug } },
			});
			return created.id;
		} catch (error) {
			mapSlugCollision(error, { scopeUnitId: input.scopeUnitId, slug });
		}
	});
	return { id, canonicalPath: await getCanonicalUnitPath(id) };
}

export async function updateUnitSlugAddress(
	authorization: Authorization<string>,
	input: {
		readonly unitId: string;
		readonly scopeUnitId: string;
		readonly slug: string;
		readonly reasonCode: GovernanceReasonCode;
	},
): Promise<UnitAddressMutationResult> {
	const slug = parseSlugLabel(input.slug);
	const result = await database.transaction(async (tx) => {
		await lockSlugTree(tx);
		const [current] = await tx
			.select({
				id: unit.id,
				kind: unit.kind,
				slugScopeId: unit.slugScopeId,
				slug: unit.slug,
				deletedAt: unit.deletedAt,
			})
			.from(unit)
			.where(eq(unit.id, input.unitId))
			.limit(1);
		if (!current || current.deletedAt) throw new UnitNotFound();
		if (
			current.id === RootSlugNamespaceUnitId ||
			current.kind === "redirect" ||
			!current.slugScopeId ||
			!current.slug
		)
			throw new UnitAddressMutationForbidden();

		const namespaceMutation =
			current.kind === "slug_namespace" ||
			current.slugScopeId === RootSlugNamespaceUnitId ||
			input.scopeUnitId === RootSlugNamespaceUnitId;
		await authorization.platform.ensureCapability(
			namespaceMutation ? "unit.slug.namespace.manage" : "unit.slug.manage",
		);
		if (input.scopeUnitId === RootSlugNamespaceUnitId && current.kind !== "slug_namespace")
			throw new UnitAddressMutationForbidden();
		if (current.slugScopeId === input.scopeUnitId && current.slug === slug)
			throw new UnitAddressUnchanged();

		await ensureCanonicalScope(tx, input.scopeUnitId, {
			allowRoot: current.kind === "slug_namespace",
			movingUnitId: current.id,
		});
		try {
			await tx
				.update(unit)
				.set({ slugScopeId: input.scopeUnitId, slug })
				.where(eq(unit.id, current.id));
		} catch (error) {
			mapSlugCollision(error, { scopeUnitId: input.scopeUnitId, slug });
		}

		let redirectUnitId: string;
		try {
			const [redirect] = await tx
				.insert(unit)
				.values({
					kind: "redirect",
					slugScopeId: current.slugScopeId,
					slug: current.slug,
					status: "published",
					visibility: "public",
					publishedAt: new Date(),
				})
				.returning({ id: unit.id });
			if (!redirect) throw new Error("Slug Redirect insertion did not return an id");
			redirectUnitId = redirect.id;
			await tx.insert(unitRedirect).values({
				id: redirect.id,
				targetUnitId: current.id,
			});
		} catch (error) {
			mapSlugCollision(error, {
				scopeUnitId: current.slugScopeId,
				slug: parseSlugLabel(current.slug),
			});
		}

		await tx.insert(auditEvent).values({
			actorProfileId: authorization.profileId,
			action:
				current.slugScopeId === input.scopeUnitId ? "unit.slug.rename" : "unit.slug.move",
			decisionCode: input.reasonCode,
			subjectKind: "unit",
			subjectId: current.id,
			metadata: {
				before: { scopeUnitId: current.slugScopeId, slug: current.slug },
				after: { scopeUnitId: input.scopeUnitId, slug },
				redirectUnitId,
			},
		});
		return { unitId: current.id, redirectUnitId };
	});

	return { ...result, canonicalPath: await getCanonicalUnitPath(result.unitId) };
}

export async function releaseSlugRedirect(
	authorization: Authorization<string>,
	input: {
		readonly redirectUnitId: string;
		readonly reasonCode: GovernanceReasonCode;
	},
): Promise<void> {
	await authorization.platform.ensureCapability("unit.slug.redirect.release");
	await database.transaction(async (tx) => {
		const [redirect] = await tx
			.select({
				id: unit.id,
				slugScopeId: unit.slugScopeId,
				slug: unit.slug,
				targetUnitId: unitRedirect.targetUnitId,
			})
			.from(unitRedirect)
			.innerJoin(unit, eq(unit.id, unitRedirect.id))
			.where(and(eq(unitRedirect.id, input.redirectUnitId), isNull(unit.deletedAt)))
			.limit(1);
		if (!redirect || !redirect.slugScopeId || !redirect.slug) throw new SlugRedirectNotFound();
		if (redirect.slugScopeId === RootSlugNamespaceUnitId)
			await authorization.platform.ensureCapability("unit.slug.namespace.manage");
		await tx.delete(unit).where(eq(unit.id, redirect.id));
		await tx.insert(auditEvent).values({
			actorProfileId: authorization.profileId,
			action: "unit.slug_redirect.release",
			decisionCode: input.reasonCode,
			subjectKind: "unit",
			subjectId: redirect.targetUnitId,
			metadata: {
				redirectUnitId: redirect.id,
				before: { scopeUnitId: redirect.slugScopeId, slug: redirect.slug },
				after: null,
			},
		});
	});
}
