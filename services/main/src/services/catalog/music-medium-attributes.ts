import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { catalogDefinition, catalogDefinitionRevision } from "@rezics/schema/postgres/catalog/identity";
import {
	musicMedium,
	musicMediumAttribute,
	musicMediumAttributePolicy,
	musicMediumAttributeAllowedFormat,
	musicMediumAttributeAllowedValueFormat,
} from "@rezics/schema/postgres/music/music";
import { CatalogPageSchema, CatalogReferenceSchema, type CatalogReference } from "@rezics/schema/contracts/native/catalog";
import { CatalogReferenceNotFound, loadCatalogIdentity, recordCatalogChange } from "./storage";
import {
	MusicMediumAttributeInputSchema,
	MusicMediumAttributePolicyInputSchema,
} from "./music-medium-attribute-contracts";
import { assertCatalogDefinitionRevision, validateCatalogScalar } from "./definitions";

async function requireRelease(
	tx: DatabaseTransaction,
	release: CatalogReference,
	actor: string | null,
	write: boolean,
) {
	const ref = CatalogReferenceSchema.parse({ owner: release.owner, id: release.id });
	if (ref.owner !== "music") throw new TypeError("Expected music storage owner");
	const identity = await loadCatalogIdentity(tx, ref, actor, write);
	if (identity.shape !== "release") throw new TypeError("Expected music release");
}

async function requirePolicyVocabulary(tx: DatabaseTransaction, ids: readonly string[]) {
	const unique = [...new Set(ids)];
	for (let offset = 0; offset < unique.length; offset += 100) {
		const batch = unique.slice(offset, offset + 100);
		const rows = await tx
			.select({ id: catalogDefinitionRevision.id, kind: catalogDefinition.kind })
			.from(catalogDefinitionRevision)
			.innerJoin(
				catalogDefinition,
				eq(catalogDefinition.id, catalogDefinitionRevision.definitionId),
			)
			.where(inArray(catalogDefinitionRevision.id, batch))
			.limit(100);
		if (rows.length !== batch.length || rows.some((row) => row.kind !== "vocabulary"))
			throw new TypeError("Medium policy formats and values require vocabulary revisions");
	}
}

/**
 * @internal Reviewed installation operation, deliberately separate from actor-facing authoring.
 * @remarks The trusted maintenance caller owns authorization, as with ensureCatalogDefinition.
 * Never expose this installer as a catalog actor endpoint. Conflicting meaning is rejected.
 */
export async function installReviewedMusicMediumPolicy(
	tx: DatabaseTransaction,
	input: z.input<typeof MusicMediumAttributePolicyInputSchema>,
) {
	const value = MusicMediumAttributePolicyInputSchema.parse(input);
	const definition = await assertCatalogDefinitionRevision(
		tx,
		value.definitionRevisionId,
		value.valueMode === "text" ? "property" : "vocabulary",
	);
	if (value.valueMode === "text" && definition.valueKind !== "string")
		throw new TypeError("Text medium attributes require a string property");
	if (
		value.valueMode === "vocabulary" &&
		value.valueFormats.some(
			(pair) => !definition.constraints.memberRevisionIds?.includes(pair.valueRevisionId),
		)
	)
		throw new TypeError("Medium policy value is not a member of its governed vocabulary");
	await requirePolicyVocabulary(tx, [
		...value.formatRevisionIds,
		...value.valueFormats.map((pair) => pair.valueRevisionId),
	]);
	await tx
		.select({ id: catalogDefinitionRevision.id })
		.from(catalogDefinitionRevision)
		.where(eq(catalogDefinitionRevision.id, value.definitionRevisionId))
		.limit(1)
		.for("update");
	const [existing] = await tx
		.select()
		.from(musicMediumAttributePolicy)
		.where(eq(musicMediumAttributePolicy.definitionRevisionId, value.definitionRevisionId))
		.limit(1);
	if (existing) {
		const formats: string[] = [];
		let afterFormat: string | undefined;
		for (;;) {
			const page = await tx
				.select()
				.from(musicMediumAttributeAllowedFormat)
				.where(
					and(
						eq(musicMediumAttributeAllowedFormat.definitionRevisionId, value.definitionRevisionId),
						afterFormat
							? gt(musicMediumAttributeAllowedFormat.formatRevisionId, afterFormat)
							: undefined,
					),
				)
				.orderBy(musicMediumAttributeAllowedFormat.formatRevisionId)
				.limit(100);
			formats.push(...page.map((row) => row.formatRevisionId));
			if (formats.length > 512)
				throw new Error("Installed medium policy exceeds the reviewed configuration bound");
			if (page.length < 100) break;
			afterFormat = page.at(-1)?.formatRevisionId;
		}
		const pairs: string[] = [];
		let afterPair: { valueRevisionId: string; formatRevisionId: string } | undefined;
		for (;;) {
			const table = musicMediumAttributeAllowedValueFormat;
			const page = await tx
				.select()
				.from(table)
				.where(
					and(
						eq(table.definitionRevisionId, value.definitionRevisionId),
						afterPair
							? sql`(${table.valueRevisionId}, ${table.formatRevisionId}) > (${afterPair.valueRevisionId}::uuid, ${afterPair.formatRevisionId}::uuid)`
							: undefined,
					),
				)
				.orderBy(table.valueRevisionId, table.formatRevisionId)
				.limit(100);
			pairs.push(...page.map((row) => `${row.valueRevisionId}/${row.formatRevisionId}`));
			if (pairs.length > 512)
				throw new Error("Installed medium policy exceeds the reviewed configuration bound");
			if (page.length < 100) break;
			afterPair = page.at(-1);
		}
		if (
			existing.valueMode !== value.valueMode ||
			JSON.stringify(formats.sort()) !== JSON.stringify([...value.formatRevisionIds].sort()) ||
			JSON.stringify(pairs.sort()) !==
				JSON.stringify(
					value.valueFormats
						.map((pair) => `${pair.valueRevisionId}/${pair.formatRevisionId}`)
						.sort(),
				)
		)
			throw new TypeError("Medium attribute policy already has another immutable meaning");
		return { definitionRevisionId: value.definitionRevisionId };
	}
	await tx
		.insert(musicMediumAttributePolicy)
		.values({ definitionRevisionId: value.definitionRevisionId, valueMode: value.valueMode });
	for (let offset = 0; offset < value.formatRevisionIds.length; offset += 100)
		await tx.insert(musicMediumAttributeAllowedFormat).values(
			value.formatRevisionIds.slice(offset, offset + 100).map((formatRevisionId) => ({
				definitionRevisionId: value.definitionRevisionId,
				formatRevisionId,
			})),
		);
	for (let offset = 0; offset < value.valueFormats.length; offset += 100)
		await tx
			.insert(musicMediumAttributeAllowedValueFormat)
			.values(
				value.valueFormats
					.slice(offset, offset + 100)
					.map((pair) => ({ definitionRevisionId: value.definitionRevisionId, ...pair })),
			);
	return { definitionRevisionId: value.definitionRevisionId };
}

/** @internal Validates one complete carrier assertion against its immutable definition and format policy. */
export async function assertMusicMediumAttributeValue(
	tx: DatabaseTransaction,
	releaseId: string,
	mediumId: string,
	input: z.input<typeof MusicMediumAttributeInputSchema>,
) {
	const value = MusicMediumAttributeInputSchema.parse(input);
	const [medium] = await tx
		.select()
		.from(musicMedium)
		.where(and(eq(musicMedium.releaseId, releaseId), eq(musicMedium.id, mediumId)))
		.limit(1);
	if (!medium) throw new CatalogReferenceNotFound("Music medium is missing from this release");
	if (medium.formatRevisionId === null)
		throw new TypeError("Choose a medium format before adding its attributes");
	const [policy] = await tx
		.select()
		.from(musicMediumAttributePolicy)
		.where(eq(musicMediumAttributePolicy.definitionRevisionId, value.definitionRevisionId))
		.limit(1);
	if (!policy || policy.valueMode !== value.valueMode)
		throw new TypeError("Attribute value does not match an installed medium policy");
	const definition = await assertCatalogDefinitionRevision(
		tx,
		value.definitionRevisionId,
		value.valueMode === "text" ? "property" : "vocabulary",
	);
	if (value.valueMode === "text") {
		if (definition.valueKind !== "string")
			throw new TypeError("Text medium attributes require a string property");
		validateCatalogScalar(
			{
				position: 0,
				parentPosition: null,
				parentKind: null,
				memberKey: null,
				kind: "string",
				textValue: value.textValue,
				numberValue: null,
				booleanValue: null,
			},
			definition.constraints,
			"string",
		);
		const [allowed] = await tx
			.select({ id: musicMediumAttributeAllowedFormat.formatRevisionId })
			.from(musicMediumAttributeAllowedFormat)
			.where(
				and(
					eq(musicMediumAttributeAllowedFormat.definitionRevisionId, value.definitionRevisionId),
					eq(musicMediumAttributeAllowedFormat.formatRevisionId, medium.formatRevisionId),
				),
			)
			.limit(1);
		if (!allowed) throw new TypeError("Attribute is not allowed for the medium format");
	} else {
		if (!definition.constraints.memberRevisionIds?.includes(value.valueRevisionId))
			throw new TypeError("Attribute value is not a governed vocabulary member");
		const [allowed] = await tx
			.select({ id: musicMediumAttributeAllowedValueFormat.valueRevisionId })
			.from(musicMediumAttributeAllowedValueFormat)
			.where(
				and(
					eq(
						musicMediumAttributeAllowedValueFormat.definitionRevisionId,
						value.definitionRevisionId,
					),
					eq(musicMediumAttributeAllowedValueFormat.valueRevisionId, value.valueRevisionId),
					eq(musicMediumAttributeAllowedValueFormat.formatRevisionId, medium.formatRevisionId),
				),
			)
			.limit(1);
		if (!allowed) throw new TypeError("Attribute value is not allowed for the medium format");
	}
}

/** @alpha @remarks Adds one governed carrier characteristic under the owning release revision. */
export async function addMusicMediumAttribute(
	tx: DatabaseTransaction,
	release: CatalogReference,
	actor: string,
	expectedVersion: number,
	mediumId: string,
	input: z.input<typeof MusicMediumAttributeInputSchema>,
) {
	z.uuid().parse(mediumId);
	const value = MusicMediumAttributeInputSchema.parse(input);
	await requireRelease(tx, release, actor, true);
	await assertMusicMediumAttributeValue(tx, release.id, mediumId, value);
	const revision = await recordCatalogChange(
		tx,
		release,
		actor,
		expectedVersion,
		"music.medium.attribute.add",
	);
	const [row] = await tx
		.insert(musicMediumAttribute)
		.values({
			releaseId: release.id,
			mediumId,
			definitionRevisionId: value.definitionRevisionId,
			...(value.valueMode === "text"
				? { textValue: value.textValue }
				: { valueRevisionId: value.valueRevisionId }),
		})
		.returning({ id: musicMediumAttribute.id });
	if (!row) throw new Error("Medium attribute insertion returned no row");
	return { id: row.id, revision };
}

/**
 * @internal Checks a format transition without materializing the medium's attribute collection.
 * @remarks Caller holds the owning release write lock. Expected fanout is at most 32 attributes;
 * extreme skew remains complete but may time out and require a staged transition. The indexed
 * anti-join visits only this medium and returns the first conflict; it never scans the corpus.
 */
export async function assertMusicMediumFormatCompatibility(
	tx: DatabaseTransaction,
	releaseId: string,
	mediumId: string,
	formatRevisionId: string | null,
) {
	z.uuid().parse(releaseId);
	z.uuid().parse(mediumId);
	z.uuid().nullable().parse(formatRevisionId);
	const attribute = musicMediumAttribute;
	const format = musicMediumAttributeAllowedFormat;
	const member = musicMediumAttributeAllowedValueFormat;
	const [invalid] = await tx
		.select({ id: attribute.id })
		.from(attribute)
		.where(
			and(
				eq(attribute.releaseId, releaseId),
				eq(attribute.mediumId, mediumId),
				formatRevisionId === null
					? undefined
					: sql`not (( ${attribute.textValue} is not null and exists (select 1 from ${format} where ${format.definitionRevisionId} = ${attribute.definitionRevisionId} and ${format.formatRevisionId} = ${formatRevisionId}::uuid)) or (${attribute.valueRevisionId} is not null and exists (select 1 from ${member} where ${member.definitionRevisionId} = ${attribute.definitionRevisionId} and ${member.valueRevisionId} = ${attribute.valueRevisionId} and ${member.formatRevisionId} = ${formatRevisionId}::uuid)))`,
			),
		)
		.limit(1);
	if (invalid)
		throw new TypeError(
			"Medium format conflicts with existing attributes; revise those attributes before changing format",
		);
}

/** @alpha @remarks Native attribute export uses release/medium/id keyset pagination, without a medium-wide cap. */
export async function listMusicMediumAttributes(
	tx: DatabaseTransaction,
	release: CatalogReference,
	actor: string | null,
	mediumId: string,
	input: z.input<typeof CatalogPageSchema> = {},
) {
	z.uuid().parse(mediumId);
	const page = CatalogPageSchema.parse(input);
	await requireRelease(tx, release, actor, false);
	return tx
		.select()
		.from(musicMediumAttribute)
		.where(
			and(
				eq(musicMediumAttribute.releaseId, release.id),
				eq(musicMediumAttribute.mediumId, mediumId),
				page.afterId ? gt(musicMediumAttribute.id, page.afterId) : undefined,
			),
		)
		.orderBy(musicMediumAttribute.id)
		.limit(page.limit);
}

/** @alpha @remarks Removes one carrier assertion; the immutable policy and vocabulary remain intact. */
export async function removeMusicMediumAttribute(
	tx: DatabaseTransaction,
	release: CatalogReference,
	actor: string,
	expectedVersion: number,
	mediumId: string,
	attributeId: string,
) {
	z.uuid().parse(mediumId);
	z.uuid().parse(attributeId);
	await requireRelease(tx, release, actor, true);
	const revision = await recordCatalogChange(
		tx,
		release,
		actor,
		expectedVersion,
		"music.medium.attribute.remove",
	);
	const rows = await tx
		.delete(musicMediumAttribute)
		.where(
			and(
				eq(musicMediumAttribute.releaseId, release.id),
				eq(musicMediumAttribute.mediumId, mediumId),
				eq(musicMediumAttribute.id, attributeId),
			),
		)
		.returning({ id: musicMediumAttribute.id });
	if (!rows.length) throw new CatalogReferenceNotFound("Medium attribute is missing");
	return { revision };
}
