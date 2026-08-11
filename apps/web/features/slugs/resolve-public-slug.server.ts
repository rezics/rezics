import {
	isAvailableZonePageSlug,
	isSlugLabel,
	publicSlugHref,
	SlugAddressMaximumDepth,
	TopLevelSlugNamespaceUnitIds,
	type PublicSlugAddressValue,
	type PublicSlugTargetKind,
} from "@rezics/slug";
import { cache } from "react";

const UuidPattern =
	/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

const NamespaceByKind = {
	profile: TopLevelSlugNamespaceUnitIds.users,
	realm: TopLevelSlugNamespaceUnitIds.realms,
	zone: TopLevelSlugNamespaceUnitIds.zones,
} satisfies Record<PublicSlugTargetKind, string>;

interface ResolvedPublicSlug {
	readonly id: string;
	readonly canonicalHref: string;
	readonly redirected: boolean;
}

function apiOrigin(): string {
	const origin = new URL(process.env.REZICS_API_ORIGIN ?? "http://localhost:3001");
	if (
		(origin.protocol !== "http:" && origin.protocol !== "https:") ||
		origin.pathname !== "/" ||
		origin.search ||
		origin.hash
	)
		throw new Error("REZICS_API_ORIGIN must be an HTTP(S) origin");
	return origin.origin;
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function parseAddress(value: unknown): PublicSlugAddressValue | undefined {
	if (!isObject(value)) return undefined;
	const { slug, scopeUnitId, canonicalPath } = value;
	if (
		typeof slug !== "string" ||
		!isSlugLabel(slug) ||
		typeof scopeUnitId !== "string" ||
		!UuidPattern.test(scopeUnitId) ||
		!Array.isArray(canonicalPath) ||
		canonicalPath.length < 2 ||
		canonicalPath.length > SlugAddressMaximumDepth ||
		canonicalPath.some((segment) => typeof segment !== "string" || !isSlugLabel(segment))
	)
		return undefined;
	return { slug, scopeUnitId, canonicalPath: canonicalPath as string[] };
}

async function readJson(response: Response): Promise<unknown> {
	try {
		return await response.json();
	} catch {
		throw new Error("Slug address API returned invalid JSON");
	}
}

async function resolvePublicSlugUncached(
	kind: PublicSlugTargetKind,
	slug: string,
): Promise<ResolvedPublicSlug | null> {
	if (!isSlugLabel(slug)) return null;
	const scopeUnitId = NamespaceByKind[kind];
	const url = new URL(
		`/api/v1/slug-addresses/scopes/${scopeUnitId}/${encodeURIComponent(slug)}`,
		apiOrigin(),
	);
	url.searchParams.set("kind", kind);
	const response = await fetch(url, { cache: "no-store" });
	if (response.status === 404) return null;
	if (!response.ok) throw new Error(`Slug address API failed with status ${response.status}`);
	const value = await readJson(response);
	if (
		!isObject(value) ||
		typeof value.id !== "string" ||
		!UuidPattern.test(value.id) ||
		value.kind !== kind ||
		typeof value.redirected !== "boolean"
	)
		throw new Error("Slug address API returned an invalid Unit identity");
	const address = parseAddress({
		slug: Array.isArray(value.canonicalPath) ? value.canonicalPath.at(-1) : undefined,
		scopeUnitId,
		canonicalPath: value.canonicalPath,
	});
	const canonicalHref = publicSlugHref(kind, address);
	if (!canonicalHref) throw new Error("Slug address API returned an unsupported canonical path");
	return {
		id: value.id,
		canonicalHref,
		redirected: value.redirected || address?.slug !== slug,
	};
}

export const resolvePublicSlug = cache(resolvePublicSlugUncached);

export interface ZonePageAddress {
	readonly id: string;
	readonly zoneId: string;
	readonly slug: string | null;
}

async function getZonePageAddressByIdUncached(
	zoneId: string,
	pageId: string,
): Promise<ZonePageAddress | null> {
	if (!UuidPattern.test(zoneId) || !UuidPattern.test(pageId)) return null;
	const response = await fetch(
		new URL(
			`/api/v1/zones/${encodeURIComponent(zoneId)}/page-addresses/by-id/${encodeURIComponent(pageId)}`,
			apiOrigin(),
		),
		{ cache: "no-store" },
	);
	if (response.status === 404) return null;
	if (!response.ok) throw new Error(`Zone Page API failed with status ${response.status}`);
	const value = await readJson(response);
	if (
		!isObject(value) ||
		value.id !== pageId ||
		value.zoneId !== zoneId ||
		value.redirected !== false ||
		!(
			value.slug === null ||
			(typeof value.slug === "string" && isAvailableZonePageSlug(value.slug))
		)
	)
		throw new Error("Zone Page API returned an invalid address");
	return { id: pageId, zoneId, slug: value.slug };
}

export const getZonePageAddressById = cache(getZonePageAddressByIdUncached);

export interface ResolvedPublicZonePageSlug {
	readonly id: string;
	readonly slug: string;
	readonly redirected: boolean;
}

async function resolvePublicZonePageSlugUncached(
	zoneId: string,
	slug: string,
): Promise<ResolvedPublicZonePageSlug | null> {
	if (!UuidPattern.test(zoneId) || !isAvailableZonePageSlug(slug)) return null;
	const url = new URL(
		`/api/v1/zones/${encodeURIComponent(zoneId)}/page-addresses/by-slug/${encodeURIComponent(slug)}`,
		apiOrigin(),
	);
	const response = await fetch(url, { cache: "no-store" });
	if (response.status === 404) return null;
	if (!response.ok) throw new Error(`Zone Page slug API failed with status ${response.status}`);
	const value = await readJson(response);
	if (
		!isObject(value) ||
		typeof value.id !== "string" ||
		!UuidPattern.test(value.id) ||
		value.zoneId !== zoneId ||
		typeof value.redirected !== "boolean" ||
		typeof value.slug !== "string" ||
		!isAvailableZonePageSlug(value.slug)
	)
		throw new Error("Zone Page slug API returned an invalid Unit identity");
	return {
		id: value.id,
		slug: value.slug,
		redirected: value.redirected || value.slug !== slug,
	};
}

export const resolvePublicZonePageSlug = cache(resolvePublicZonePageSlugUncached);

async function getPublicSlugHrefByUnitIdUncached(
	kind: PublicSlugTargetKind,
	unitId: string,
): Promise<string | null> {
	if (!UuidPattern.test(unitId)) return null;
	const response = await fetch(
		new URL(`/api/v1/slug-addresses/public-units/${unitId}`, apiOrigin()),
		{ cache: "no-store" },
	);
	if (response.status === 404) return null;
	if (!response.ok) throw new Error(`Slug address API failed with status ${response.status}`);
	const canonicalHref = publicSlugHref(kind, parseAddress(await readJson(response)));
	if (!canonicalHref) return null;
	return canonicalHref;
}

export const getPublicSlugHrefByUnitId = cache(getPublicSlugHrefByUnitIdUncached);

export function isUuid(value: string): boolean {
	return UuidPattern.test(value);
}
