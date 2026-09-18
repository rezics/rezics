import { and, desc, eq, gt, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { canonicalizeContentLanguageTag } from "@rezics/content-language";
import type { DatabaseTransaction } from "../database";
import { softwareIdentity, referenceIdentity } from "@rezics/schema/postgres/catalog/identity";
import {
	readCatalogAuthorityScope,
	catalogIdentityReadPredicate,
	canAccessCatalog,
} from "../participation/policy";
import {
	softwareContent,
	softwareVersion,
	softwareVisualNovel,
	softwareRelease,
	softwareReleaseContent,
	softwareReleasePlatform,
	softwareReleaseMedium,
	softwareReleaseLanguage,
	softwareReleaseEvent,
	softwarePatchTarget,
	softwareRecordRevision,
	softwareComponentRevision,
} from "@rezics/schema/postgres/software/software";
import { CatalogPageSchema, CatalogPartialDateSchema, type CatalogReference } from "@rezics/schema/contracts/native/catalog";
import {
	CatalogAccessDenied,
	addCatalogName,
	createCatalogIdentity,
	loadCatalogIdentity,
	recordCatalogChange,
} from "./storage";

const text = (maximum: number) =>
	z
		.string()
		.refine((value) => Buffer.byteLength(value, "utf8") <= maximum, "Text exceeds byte budget");
const language = text(255).transform(canonicalizeContentLanguageTag);
const name = z.strictObject({ value: text(131072).min(1), languageTag: language.nullable() });
const integer = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const date = CatalogPartialDateSchema.extend({ text: text(4096).nullable().default(null) });

export const SoftwareContentDetailsSchema = z.strictObject({
	originalLanguageTag: language.nullable().default(null),
	developmentStatus: z.enum(["finished", "in_development", "cancelled"]).nullable().default(null),
	description: text(524288).nullable().default(null),
});

export const SoftwareReleaseDetailsSchema = z.strictObject({
	typeRevisionId: z.uuid().nullable().default(null),
	isPatch: z.boolean().nullable().default(null),
	freeware: z.boolean().nullable().default(null),
	uncensored: z.boolean().nullable().default(null),
	hasEroticContent: z.boolean().nullable().default(null),
	minimumAge: z.number().int().min(0).max(255).nullable().default(null),
	resolution: z
		.discriminatedUnion("kind", [
			z.strictObject({
				kind: z.literal("pixels"),
				width: z.number().int().min(1).max(2147483647),
				height: z.number().int().min(1).max(2147483647),
			}),
			z.strictObject({ kind: z.literal("non_standard") }),
		])
		.nullable()
		.default(null),
	engine: text(4096).nullable().default(null),
	voicing: z.enum(["none", "erotic_only", "partial", "full"]).nullable().default(null),
	notes: text(524288).nullable().default(null),
	gtin: text(128).nullable().default(null),
	catalogNumber: text(4096).nullable().default(null),
	date: date.default({ year: null, month: null, day: null, text: null }),
});

export const SoftwareVersionDetailsSchema = z.strictObject({
	kind: z.enum(["revision", "translation", "localization", "port", "variant"]),
	versionLabel: text(4096).min(1).nullable().default(null),
	languageTag: language.nullable().default(null),
	distinguishingEvidence: text(16384).min(1),
});

export const SoftwareReleaseComponentSchema = z.discriminatedUnion("kind", [
	z.strictObject({
		kind: z.literal("content"),
		contentId: z.uuid(),
		versionId: z.uuid().nullable().default(null),
		releaseTypeRevisionId: z.uuid().nullable().default(null),
	}),
	z.strictObject({ kind: z.literal("platform"), platformRevisionId: z.uuid() }),
	z.strictObject({
		kind: z.literal("medium"),
		mediumTypeRevisionId: z.uuid(),
		quantity: integer.nullable().default(null),
	}),
	z.strictObject({
		kind: z.literal("language"),
		languageTag: language,
		channelRevisionId: z.uuid().nullable().default(null),
		machineTranslated: z.boolean().nullable().default(null),
		main: z.boolean().nullable().default(null),
		title: text(131072).nullable().default(null),
		transliteratedTitle: text(131072).nullable().default(null),
	}),
	z.strictObject({ kind: z.literal("event"), areaId: z.uuid().nullable().default(null), date }),
	z.strictObject({
		kind: z.literal("patch_target"),
		baseReleaseId: z.uuid(),
		compatibility: text(16384).nullable().default(null),
	}),
]);

async function softwareShape(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string | null,
	shape: string,
	write: boolean,
) {
	if (reference.owner !== "software") throw new TypeError("Expected software owner");
	const identity = await loadCatalogIdentity(tx, reference, actor, write);
	if (identity.shape !== shape) throw new TypeError(`Expected software ${shape}`);
	return identity;
}

function releaseValues(value: z.output<typeof SoftwareReleaseDetailsSchema>) {
	const { resolution, date: releaseDate, ...details } = value;
	return {
		...details,
		resolutionKind: resolution?.kind ?? null,
		resolutionWidth: resolution?.kind === "pixels" ? resolution.width : null,
		resolutionHeight: resolution?.kind === "pixels" ? resolution.height : null,
		dateYear: releaseDate.year,
		dateMonth: releaseDate.month,
		dateDay: releaseDate.day,
		dateText: releaseDate.text,
	};
}

/** @alpha Native source-free software operations; these are the canonical importer write path. */
export async function createNativeSoftwareContent(
	tx: DatabaseTransaction,
	actor: string,
	input: {
		name: z.input<typeof name>;
		visualNovel?: boolean;
		details?: z.input<typeof SoftwareContentDetailsSchema>;
	},
) {
	const title = name.parse(input.name);
	const details = SoftwareContentDetailsSchema.parse(input.details ?? {});
	const identity = await createCatalogIdentity(tx, { owner: "software", shape: "content" }, actor);
	await tx.insert(softwareContent).values({ id: identity.id, ...details });
	if (input.visualNovel === true) await tx.insert(softwareVisualNovel).values({ id: identity.id });
	const named = await addCatalogName(tx, identity, actor, identity.revision, {
		...title,
		kind: "primary",
	});
	return {
		...identity,
		revision: named.revision,
		nameId: named.id,
		nameRevision: named.nameRevision,
	};
}

export async function reviseSoftwareContent(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	expectedRevision: number,
	input: z.input<typeof SoftwareContentDetailsSchema>,
) {
	const value = SoftwareContentDetailsSchema.parse(input);
	await softwareShape(tx, reference, actor, "content", true);
	const revision = await recordCatalogChange(
		tx,
		reference,
		actor,
		expectedRevision,
		"software.content.revise",
	);
	await tx
		.insert(softwareContent)
		.values({ id: reference.id, ...value })
		.onConflictDoUpdate({ target: softwareContent.id, set: value });
	return { revision };
}

export async function createSoftwareVersion(
	tx: DatabaseTransaction,
	actor: string,
	input: {
		content: CatalogReference;
		name: z.input<typeof name>;
		details: z.input<typeof SoftwareVersionDetailsSchema>;
	},
) {
	const title = name.parse(input.name);
	const details = SoftwareVersionDetailsSchema.parse(input.details);
	await softwareShape(tx, input.content, actor, "content", false);
	const identity = await createCatalogIdentity(tx, { owner: "software", shape: "version" }, actor);
	await tx
		.insert(softwareVersion)
		.values({ id: identity.id, contentId: input.content.id, ...details });
	const named = await addCatalogName(tx, identity, actor, identity.revision, {
		...title,
		kind: "primary",
	});
	return {
		...identity,
		revision: named.revision,
		nameId: named.id,
		nameRevision: named.nameRevision,
	};
}

export async function reviseSoftwareVersion(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	expectedRevision: number,
	input: z.input<typeof SoftwareVersionDetailsSchema>,
) {
	const value = SoftwareVersionDetailsSchema.parse(input);
	await softwareShape(tx, reference, actor, "version", true);
	const revision = await recordCatalogChange(
		tx,
		reference,
		actor,
		expectedRevision,
		"software.version.revise",
	);
	await tx.update(softwareVersion).set(value).where(eq(softwareVersion.id, reference.id));
	return { revision };
}

export async function createNativeSoftwareRelease(
	tx: DatabaseTransaction,
	actor: string,
	input: { name: z.input<typeof name>; details?: z.input<typeof SoftwareReleaseDetailsSchema> },
) {
	const title = name.parse(input.name);
	const details = releaseValues(SoftwareReleaseDetailsSchema.parse(input.details ?? {}));
	const identity = await createCatalogIdentity(tx, { owner: "software", shape: "release" }, actor);
	await tx.insert(softwareRelease).values({ id: identity.id, ...details });
	const named = await addCatalogName(tx, identity, actor, identity.revision, {
		...title,
		kind: "primary",
	});
	return {
		...identity,
		revision: named.revision,
		nameId: named.id,
		nameRevision: named.nameRevision,
	};
}

export async function reviseSoftwareRelease(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	expectedRevision: number,
	input: z.input<typeof SoftwareReleaseDetailsSchema>,
) {
	const value = releaseValues(SoftwareReleaseDetailsSchema.parse(input));
	await softwareShape(tx, reference, actor, "release", true);
	const revision = await recordCatalogChange(
		tx,
		reference,
		actor,
		expectedRevision,
		"software.release.revise",
	);
	await tx
		.insert(softwareRelease)
		.values({ id: reference.id, ...value })
		.onConflictDoUpdate({ target: softwareRelease.id, set: value });
	return { revision };
}

/** A command admits at most 128 components; callers stream larger source records in batches. */
export async function appendSoftwareReleaseComponents(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	expectedRevision: number,
	input: readonly z.input<typeof SoftwareReleaseComponentSchema>[],
) {
	const values = z.array(SoftwareReleaseComponentSchema).min(1).max(128).parse(input);
	if (Buffer.byteLength(JSON.stringify(values), "utf8") > 524288)
		throw new RangeError("Software component batch exceeds byte budget");
	await softwareShape(tx, reference, actor, "release", true);
	for (const value of values) {
		if (value.kind === "content") {
			await softwareShape(tx, { owner: "software", id: value.contentId }, actor, "content", false);
			if (value.versionId)
				await softwareShape(
					tx,
					{ owner: "software", id: value.versionId },
					actor,
					"version",
					false,
				);
		} else if (value.kind === "event" && value.areaId) {
			const area = await loadCatalogIdentity(
				tx,
				{ owner: "reference", id: value.areaId },
				actor,
				false,
			);
			if (area.shape !== "area") throw new TypeError("Release territory requires an Area");
		} else if (value.kind === "patch_target") {
			await softwareShape(
				tx,
				{ owner: "software", id: value.baseReleaseId },
				actor,
				"release",
				false,
			);
			const [release] = await tx
				.select({ isPatch: softwareRelease.isPatch })
				.from(softwareRelease)
				.where(eq(softwareRelease.id, reference.id))
				.limit(1);
			if (release?.isPatch !== true) throw new TypeError("Only patches can declare base releases");
		}
	}
	const revision = await recordCatalogChange(
		tx,
		reference,
		actor,
		expectedRevision,
		"software.release.components.append",
	);
	const ids: string[] = [];
	for (const value of values) {
		switch (value.kind) {
			case "content": {
				const [row] = await tx
					.insert(softwareReleaseContent)
					.values({
						releaseId: reference.id,
						contentId: value.contentId,
						versionId: value.versionId,
						releaseTypeRevisionId: value.releaseTypeRevisionId,
					})
					.returning({ id: softwareReleaseContent.id });
				if (!row) throw new Error("Content membership insertion failed");
				ids.push(row.id);
				break;
			}
			case "platform":
				await tx
					.insert(softwareReleasePlatform)
					.values({ releaseId: reference.id, platformRevisionId: value.platformRevisionId });
				ids.push(value.platformRevisionId);
				break;
			case "medium": {
				const [row] = await tx
					.insert(softwareReleaseMedium)
					.values({
						releaseId: reference.id,
						mediumTypeRevisionId: value.mediumTypeRevisionId,
						quantity: value.quantity,
					})
					.returning({ id: softwareReleaseMedium.id });
				if (!row) throw new Error("Medium insertion failed");
				ids.push(row.id);
				break;
			}
			case "language": {
				const [row] = await tx
					.insert(softwareReleaseLanguage)
					.values({
						releaseId: reference.id,
						languageTag: value.languageTag,
						channelRevisionId: value.channelRevisionId,
						machineTranslated: value.machineTranslated,
						main: value.main,
						title: value.title,
						transliteratedTitle: value.transliteratedTitle,
					})
					.returning({ id: softwareReleaseLanguage.id });
				if (!row) throw new Error("Language insertion failed");
				ids.push(row.id);
				break;
			}
			case "event": {
				const [row] = await tx
					.insert(softwareReleaseEvent)
					.values({
						releaseId: reference.id,
						areaId: value.areaId,
						dateYear: value.date.year,
						dateMonth: value.date.month,
						dateDay: value.date.day,
						dateText: value.date.text,
					})
					.returning({ id: softwareReleaseEvent.id });
				if (!row) throw new Error("Release event insertion failed");
				ids.push(row.id);
				break;
			}
			case "patch_target":
				await tx.insert(softwarePatchTarget).values({
					releaseId: reference.id,
					baseReleaseId: value.baseReleaseId,
					compatibility: value.compatibility,
				});
				ids.push(value.baseReleaseId);
				break;
		}
	}
	return { revision, ids };
}

export async function readSoftwareDetails(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string | null,
) {
	if (reference.owner !== "software") throw new TypeError("Expected software owner");
	const identity = await loadCatalogIdentity(tx, reference, actor, false);
	switch (identity.shape) {
		case "content": {
			const [value] = await tx
				.select()
				.from(softwareContent)
				.where(eq(softwareContent.id, reference.id))
				.limit(1);
			return { identity, kind: "content" as const, value };
		}
		case "version": {
			const [value] = await tx
				.select()
				.from(softwareVersion)
				.where(eq(softwareVersion.id, reference.id))
				.limit(1);
			if (value)
				await softwareShape(
					tx,
					{ owner: "software", id: value.contentId },
					actor,
					"content",
					false,
				);
			return { identity, kind: "version" as const, value };
		}
		case "release": {
			const [value] = await tx
				.select()
				.from(softwareRelease)
				.where(eq(softwareRelease.id, reference.id))
				.limit(1);
			return { identity, kind: "release" as const, value };
		}
		default:
			throw new TypeError("Unsupported software shape");
	}
}

/** Fixed structure pages also serve native export; no operation materializes an owner's entire graph. */
export async function readSoftwareReleaseComponents(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string | null,
	kind: z.output<typeof SoftwareReleaseComponentSchema>["kind"],
	input: z.input<typeof CatalogPageSchema> = {},
) {
	await softwareShape(tx, reference, actor, "release", false);
	const page = CatalogPageSchema.parse(input);
	const scope = await readCatalogAuthorityScope(tx, actor);
	const visibleSoftware = (
		column:
			| typeof softwareReleaseContent.contentId
			| typeof softwareReleaseContent.versionId
			| typeof softwarePatchTarget.baseReleaseId,
	) =>
		sql`exists (select 1 from ${softwareIdentity} where ${softwareIdentity.id} = ${column} and ${catalogIdentityReadPredicate(scope, "software", softwareIdentity)})`;
	switch (kind) {
		case "content": {
			const t = softwareReleaseContent;
			return tx
				.select()
				.from(t)
				.where(
					and(
						eq(t.releaseId, reference.id),
						page.afterId ? gt(t.id, page.afterId) : undefined,
						visibleSoftware(t.contentId),
						sql`(${t.versionId} is null or ${visibleSoftware(t.versionId)})`,
					),
				)
				.orderBy(t.id)
				.limit(page.limit);
		}
		case "platform": {
			const t = softwareReleasePlatform;
			return tx
				.select()
				.from(t)
				.where(
					and(
						eq(t.releaseId, reference.id),
						page.afterId ? gt(t.platformRevisionId, page.afterId) : undefined,
					),
				)
				.orderBy(t.platformRevisionId)
				.limit(page.limit);
		}
		case "medium": {
			const t = softwareReleaseMedium;
			return tx
				.select()
				.from(t)
				.where(
					and(eq(t.releaseId, reference.id), page.afterId ? gt(t.id, page.afterId) : undefined),
				)
				.orderBy(t.id)
				.limit(page.limit);
		}
		case "language": {
			const t = softwareReleaseLanguage;
			return tx
				.select()
				.from(t)
				.where(
					and(eq(t.releaseId, reference.id), page.afterId ? gt(t.id, page.afterId) : undefined),
				)
				.orderBy(t.id)
				.limit(page.limit);
		}
		case "event": {
			const t = softwareReleaseEvent;
			return tx
				.select()
				.from(t)
				.where(
					and(
						eq(t.releaseId, reference.id),
						page.afterId ? gt(t.id, page.afterId) : undefined,
						sql`(${t.areaId} is null or exists (select 1 from ${referenceIdentity} where ${referenceIdentity.id} = ${t.areaId} and ${catalogIdentityReadPredicate(scope, "reference", referenceIdentity)}))`,
					),
				)
				.orderBy(t.id)
				.limit(page.limit);
		}
		case "patch_target": {
			const t = softwarePatchTarget;
			return tx
				.select()
				.from(t)
				.where(
					and(
						eq(t.releaseId, reference.id),
						page.afterId ? gt(t.baseReleaseId, page.afterId) : undefined,
						visibleSoftware(t.baseReleaseId),
					),
				)
				.orderBy(t.baseReleaseId)
				.limit(page.limit);
		}
	}
}

export async function removeSoftwareReleaseComponent(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	expectedRevision: number,
	kind: z.output<typeof SoftwareReleaseComponentSchema>["kind"],
	componentId: string,
) {
	z.uuid().parse(componentId);
	await softwareShape(tx, reference, actor, "release", true);
	const revision = await recordCatalogChange(
		tx,
		reference,
		actor,
		expectedRevision,
		"software.release.component.remove",
	);
	let removed: { id: string }[];
	switch (kind) {
		case "content": {
			const t = softwareReleaseContent;
			removed = await tx
				.delete(t)
				.where(and(eq(t.releaseId, reference.id), eq(t.id, componentId)))
				.returning({ id: t.id });
			break;
		}
		case "platform": {
			const t = softwareReleasePlatform;
			removed = await tx
				.delete(t)
				.where(and(eq(t.releaseId, reference.id), eq(t.platformRevisionId, componentId)))
				.returning({ id: t.platformRevisionId });
			break;
		}
		case "medium": {
			const t = softwareReleaseMedium;
			removed = await tx
				.delete(t)
				.where(and(eq(t.releaseId, reference.id), eq(t.id, componentId)))
				.returning({ id: t.id });
			break;
		}
		case "language": {
			const t = softwareReleaseLanguage;
			removed = await tx
				.delete(t)
				.where(and(eq(t.releaseId, reference.id), eq(t.id, componentId)))
				.returning({ id: t.id });
			break;
		}
		case "event": {
			const t = softwareReleaseEvent;
			removed = await tx
				.delete(t)
				.where(and(eq(t.releaseId, reference.id), eq(t.id, componentId)))
				.returning({ id: t.id });
			break;
		}
		case "patch_target": {
			const t = softwarePatchTarget;
			removed = await tx
				.delete(t)
				.where(and(eq(t.releaseId, reference.id), eq(t.baseReleaseId, componentId)))
				.returning({ id: t.baseReleaseId });
			break;
		}
	}
	if (removed.length !== 1) throw new Error("Software release component is missing");
	return { revision };
}

const historyPage = z.strictObject({
	beforeRevision: integer.min(1).optional(),
	limit: z.number().int().min(1).max(100).default(50),
});
const historicalUuidPattern =
	"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$";
function historicalSoftwareTarget(
	scope: Awaited<ReturnType<typeof readCatalogAuthorityScope>>,
	value: typeof softwareRecordRevision.value | typeof softwareComponentRevision.value,
	key: "content_id" | "version_id" | "base_release_id",
) {
	return sql`exists (select 1 from ${softwareIdentity} where ${softwareIdentity.id} = case when (${value}->>${key}) ~ ${historicalUuidPattern} then (${value}->>${key})::uuid else null end and ${catalogIdentityReadPredicate(scope, "software", softwareIdentity)})`;
}
export async function readSoftwareHistory(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string | null,
	input: z.input<typeof historyPage> = {},
) {
	const identity = await loadCatalogIdentity(tx, reference, actor, false);
	if (!(await canAccessCatalog(tx, reference, actor, identity.createdByAuthUserId, false)))
		throw new CatalogAccessDenied("Software history requires owner access");
	if (reference.owner !== "software") throw new TypeError("Expected software owner");
	const page = historyPage.parse(input);
	const t = softwareRecordRevision;
	const scope = await readCatalogAuthorityScope(tx, actor);
	return tx
		.select()
		.from(t)
		.where(
			and(
				eq(t.ownerId, reference.id),
				sql`(${t.shape} <> 'version' or ${historicalSoftwareTarget(scope, t.value, "content_id")})`,
				page.beforeRevision ? lt(t.revision, page.beforeRevision) : undefined,
			),
		)
		.orderBy(desc(t.revision))
		.limit(page.limit);
}

/** Restoring prior values appends history and never decrements the owner's revision. */
export async function restoreSoftwareDetails(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	expectedRevision: number,
	historicalRevision: number,
) {
	integer.min(1).parse(historicalRevision);
	if (reference.owner !== "software") throw new TypeError("Expected software owner");
	await loadCatalogIdentity(tx, reference, actor, true);
	const [historical] = await tx
		.select()
		.from(softwareRecordRevision)
		.where(
			and(
				eq(softwareRecordRevision.ownerId, reference.id),
				eq(softwareRecordRevision.revision, historicalRevision),
			),
		)
		.limit(1);
	if (!historical) throw new Error("Software history revision is missing");
	const value = z.record(z.string(), z.unknown()).parse(historical.value);
	switch (historical.shape) {
		case "content":
			return reviseSoftwareContent(
				tx,
				reference,
				actor,
				expectedRevision,
				SoftwareContentDetailsSchema.parse({
					originalLanguageTag: value.original_language_tag,
					developmentStatus: value.development_status,
					description: value.description,
				}),
			);
		case "version":
			return reviseSoftwareVersion(
				tx,
				reference,
				actor,
				expectedRevision,
				SoftwareVersionDetailsSchema.parse({
					kind: value.kind,
					versionLabel: value.version_label,
					languageTag: value.language_tag,
					distinguishingEvidence: value.distinguishing_evidence,
				}),
			);
		case "release":
			return reviseSoftwareRelease(
				tx,
				reference,
				actor,
				expectedRevision,
				decodeSoftwareReleaseSnapshot(value),
			);
	}
}

export async function readSoftwareComponentHistory(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string | null,
	kind: z.output<typeof SoftwareReleaseComponentSchema>["kind"],
	componentId: string,
	input: z.input<typeof historyPage> = {},
) {
	const identity = await softwareShape(tx, reference, actor, "release", false);
	if (!(await canAccessCatalog(tx, reference, actor, identity.createdByAuthUserId, false)))
		throw new CatalogAccessDenied("Software history requires owner access");
	z.uuid().parse(componentId);
	const page = historyPage.parse(input);
	const t = softwareComponentRevision;
	const scope = await readCatalogAuthorityScope(tx, actor);
	const visibleTargets =
		kind === "content"
			? sql`${historicalSoftwareTarget(scope, t.value, "content_id")} and (${t.value}->>'version_id' is null or ${historicalSoftwareTarget(scope, t.value, "version_id")})`
			: kind === "patch_target"
				? historicalSoftwareTarget(scope, t.value, "base_release_id")
				: kind === "event"
					? sql`(${t.value}->>'area_id' is null or exists (select 1 from ${referenceIdentity} where ${referenceIdentity.id} = case when (${t.value}->>'area_id') ~ ${historicalUuidPattern} then (${t.value}->>'area_id')::uuid else null end and ${catalogIdentityReadPredicate(scope, "reference", referenceIdentity)}))`
					: undefined;
	return tx
		.select()
		.from(t)
		.where(
			and(
				eq(t.releaseId, reference.id),
				eq(t.kind, kind),
				eq(t.componentId, componentId),
				visibleTargets,
				page.beforeRevision ? lt(t.revision, page.beforeRevision) : undefined,
			),
		)
		.orderBy(desc(t.revision))
		.limit(page.limit);
}

/** Release discovery is anchored to a content identity; each qualifier applies to the same release. */
export async function findSoftwareReleases(
	tx: DatabaseTransaction,
	content: CatalogReference,
	actor: string | null,
	input: {
		afterId?: string;
		limit?: number;
		languageTag?: string;
		machineTranslated?: boolean;
		platformRevisionId?: string;
		mediumTypeRevisionId?: string;
		isPatch?: boolean;
	},
) {
	await softwareShape(tx, content, actor, "content", false);
	const page = z
		.strictObject({
			afterId: z.uuid().optional(),
			limit: z.number().int().min(1).max(100).default(50),
			languageTag: language.optional(),
			machineTranslated: z.boolean().optional(),
			platformRevisionId: z.uuid().optional(),
			mediumTypeRevisionId: z.uuid().optional(),
			isPatch: z.boolean().optional(),
		})
		.parse(input);
	const c = softwareReleaseContent;
	const r = softwareRelease;
	const i = softwareIdentity;
	const scope = await readCatalogAuthorityScope(tx, actor);
	return tx
		.selectDistinct({
			id: r.id,
			isPatch: r.isPatch,
			engine: r.engine,
			dateYear: r.dateYear,
			dateMonth: r.dateMonth,
			dateDay: r.dateDay,
		})
		.from(c)
		.innerJoin(r, eq(r.id, c.releaseId))
		.innerJoin(i, eq(i.id, r.id))
		.where(
			and(
				eq(c.contentId, content.id),
				page.afterId ? gt(r.id, page.afterId) : undefined,
				catalogIdentityReadPredicate(scope, "software", i),
				page.isPatch !== undefined ? eq(r.isPatch, page.isPatch) : undefined,
				page.languageTag !== undefined || page.machineTranslated !== undefined
					? sql`exists (select 1 from ${softwareReleaseLanguage} where ${softwareReleaseLanguage.releaseId} = ${r.id} ${page.languageTag ? sql`and ${softwareReleaseLanguage.languageTag} = ${page.languageTag}` : sql``} ${page.machineTranslated !== undefined ? sql`and ${softwareReleaseLanguage.machineTranslated} = ${page.machineTranslated}` : sql``})`
					: undefined,
				page.platformRevisionId
					? sql`exists (select 1 from ${softwareReleasePlatform} where ${softwareReleasePlatform.releaseId} = ${r.id} and ${softwareReleasePlatform.platformRevisionId} = ${page.platformRevisionId})`
					: undefined,
				page.mediumTypeRevisionId
					? sql`exists (select 1 from ${softwareReleaseMedium} where ${softwareReleaseMedium.releaseId} = ${r.id} and ${softwareReleaseMedium.mediumTypeRevisionId} = ${page.mediumTypeRevisionId})`
					: undefined,
			),
		)
		.orderBy(r.id)
		.limit(page.limit);
}

/** @internal Native row snapshots reenter the same canonical release-value parser on restore and source updates. */
export function decodeSoftwareReleaseSnapshot(input: unknown) {
	const value = z.record(z.string(), z.unknown()).parse(input);
	return SoftwareReleaseDetailsSchema.parse({
		typeRevisionId: value.type_revision_id,
		isPatch: value.is_patch,
		freeware: value.freeware,
		uncensored: value.uncensored,
		hasEroticContent: value.has_erotic_content,
		minimumAge: value.minimum_age,
		resolution:
			value.resolution_kind === "pixels"
				? { kind: "pixels", width: value.resolution_width, height: value.resolution_height }
				: value.resolution_kind === "non_standard"
					? { kind: "non_standard" }
					: null,
		engine: value.engine,
		voicing: value.voicing,
		notes: value.notes,
		gtin: value.gtin,
		catalogNumber: value.catalog_number,
		date: {
			year: value.date_year,
			month: value.date_month,
			day: value.date_day,
			text: value.date_text,
		},
	});
}
