import { and, desc, eq, max, sql } from "drizzle-orm";
import { createSchemaFactory } from "drizzle-orm/zod";
import { z } from "zod";
import { AvatarTypeValues, FontAwesomeIconPrefixValues } from "@rezics/avatar";
import {
	CollectionDefinitionDocument,
	CollectionPresentationDocument,
	PollContentBlock,
	UnitReferencedBlockDocument,
	ZoneBoundaryDocument,
	ZoneThemeDocument,
	isDocument,
	isPortableTextDocument,
	type PortableTextDocument as PortableTextDocumentValue,
} from "@rezics/block";
import type { Static, TSchema } from "@sinclair/typebox";
import { type ContentLanguage, ContentLanguageValues, isContentLanguage } from "@rezics/i18n";
import { PublicationLicenseIds } from "@rezics/license";

import { recordAuditEvent } from "../audit";
import type { DatabaseTransaction } from "../database";
import type { Authorization } from "../authorization";
import { isPrimaryUnitLocalization } from "./localization";
import {
	book,
	collection,
	collectionItem,
	entity,
	software,
	softwareRequirement,
	media,
	poll,
	pollOption,
	PollOptionSourceKindValues,
	post,
	profile,
	realm,
	realmPin,
	realmRule,
	realmRuleRevision,
	RealmRuleAcknowledgementModeValues,
	release,
	revisionContent,
	series,
	seriesRelease,
	subjectAssociation,
	unit,
	UnitKindValues,
	VariantCapableUnitKindValues,
	unitAlias,
	creditAttribution,
	unitLink,
	unitLocalization,
	unitRevision,
	unitRevisionHead,
	unitRevisionSlot,
	UnitRevisionSlotRoleValues,
	CreditAttributionRoleValues,
	SubjectAssociationRoleValues,
	unitRevisionTag,
	unitStructure,
	unitStructureApplication,
	unitTag,
	unitVariant,
	zone,
} from "../database/schema";
import {
	canonicalRevisionJson as canonicalJson,
	findOrCreateRevisionContent,
	materializeStoredRevisionContent,
	normalizeRevisionJson as normalizeJson,
	type MaterializedRevisionContent,
} from "../history/content";
import {
	compareBytewisePositions,
	compareFractionalPositions,
	isFractionalPosition,
} from "../ordering/position";
import { AssociationContextPostInvalid, UnitRevisionConflict } from "./errors";
import { ensureWikiAssociationContextPost } from "./association-context";
import { insertUnit } from "./create";
import { finalizeInitialUnitStatusRevision } from "./status";
import { ensureUnitVariantLifecycle } from "./variant-policy";
import { ensureDirectCreditAttributionAllowed } from "./attribution-authorization";
import { ensureSubjectPostTargetingAllowed } from "../posts/targeting";
import {
	nextUnitStructureDefinitionUpdatedAt,
	replaceUnitStructureDefinition,
} from "../tag-structures/definition";
import { syncUnitLocalizationContentMetrics } from "../content-metrics/service";
import { recordStudioWorkRelation } from "../studio/projection";

export type UnitRevisionEvent = "create" | "update" | "delete" | "restore";

type SnapshotRow = Record<string, unknown>;

const SnapshotRowSchema = z.record(z.string(), z.unknown());
const JsonObjectSchema = z.record(z.string(), z.unknown());
function createDocumentSchema<TSchemaValue extends TSchema>(schema: TSchemaValue) {
	return z.custom<Static<TSchemaValue>>((value): value is Static<TSchemaValue> =>
		isDocument(schema, value),
	);
}
const PortableTextDocumentSchema = z.custom<PortableTextDocumentValue>(isPortableTextDocument);
const PollContentBlockSchema = createDocumentSchema(PollContentBlock);
const UnitReferencedBlockDocumentSchema = createDocumentSchema(UnitReferencedBlockDocument);
const UnitLocalizationContentSchema = z.union([
	PortableTextDocumentSchema,
	PollContentBlockSchema,
	UnitReferencedBlockDocumentSchema,
]);
const CollectionDefinitionDocumentSchema = createDocumentSchema(CollectionDefinitionDocument);
const CollectionPresentationDocumentSchema = createDocumentSchema(CollectionPresentationDocument);
const ZoneBoundaryDocumentSchema = createDocumentSchema(ZoneBoundaryDocument);
const ZoneThemeDocumentSchema = createDocumentSchema(ZoneThemeDocument);
const FractionalPositionSchema = z.string().refine(isFractionalPosition);
const RuleSnapshotSchema = z.object({
	acknowledgementMode: z.enum(RealmRuleAcknowledgementModeValues),
	requireOnJoin: z.boolean(),
	requireOnPost: z.boolean(),
	rules: z.array(
		z.object({
			position: z.int().nonnegative(),
			language: z.enum(ContentLanguageValues),
			title: z.string(),
			content: PortableTextDocumentSchema,
		}),
	),
});
const UnitSnapshotSchema = z.object({
	version: z.literal(6),
	kind: z.enum(UnitKindValues),
	unit: SnapshotRowSchema,
	localizations: z.array(SnapshotRowSchema),
	extension: SnapshotRowSchema.nullable(),
	preference: SnapshotRowSchema.nullable(),
	owned: z.object({
		aliases: z.array(SnapshotRowSchema),
		credits: z.array(SnapshotRowSchema),
		subjectAssociations: z.array(SnapshotRowSchema),
		links: z.array(SnapshotRowSchema),
		tags: z.array(SnapshotRowSchema),
		structureApplications: z.array(SnapshotRowSchema),
		variants: z.array(SnapshotRowSchema),
		seriesReleases: z.array(SnapshotRowSchema),
		softwareRequirements: z.array(SnapshotRowSchema),
		collectionItems: z.array(SnapshotRowSchema),
		pollOptions: z.array(SnapshotRowSchema),
		realmPins: z.array(SnapshotRowSchema),
		realmUnit: z.array(SnapshotRowSchema),
		realmRules: RuleSnapshotSchema.nullable(),
	}),
});
type RuleSnapshot = z.infer<typeof RuleSnapshotSchema>;
type UnitSnapshot = z.infer<typeof UnitSnapshotSchema>;

const schemaFactory = createSchemaFactory({ coerce: { date: true } });
const unitStateSchema = schemaFactory
	.createSelectSchema(unit, { license: z.enum(PublicationLicenseIds).nullable() })
	.omit({
		id: true,
		kind: true,
		status: true,
		visibility: true,
		moderationStatus: true,
		publishedAt: true,
		deletedAt: true,
		createdAt: true,
		updatedAt: true,
	});
const unitLocalizationStateSchema = schemaFactory
	.createSelectSchema(unitLocalization, {
		language: z.enum(ContentLanguageValues),
		position: FractionalPositionSchema,
		avatarType: z.enum(AvatarTypeValues).nullable(),
		avatarIconPrefix: z.enum(FontAwesomeIconPrefixValues).nullable(),
		description: PortableTextDocumentSchema.nullable(),
		content: UnitLocalizationContentSchema.nullable(),
	})
	.omit({ unitId: true, createdAt: true, updatedAt: true });
const UnitLocalizationRevisionDocumentSchema = z.object({
	version: z.literal(1),
	localization: unitLocalizationStateSchema,
});
type UnitLocalizationState = z.infer<typeof unitLocalizationStateSchema>;
const profileStateSchema = schemaFactory
	.createSelectSchema(profile)
	.omit({ id: true, authUserId: true, joinedAt: true, createdAt: true, updatedAt: true });
const bookStateSchema = schemaFactory
	.createSelectSchema(book)
	.omit({ id: true, createdAt: true, updatedAt: true });
const softwareStateSchema = schemaFactory
	.createSelectSchema(software)
	.omit({ id: true, createdAt: true, updatedAt: true });
const mediaStateSchema = schemaFactory
	.createSelectSchema(media)
	.omit({ id: true, createdAt: true, updatedAt: true });
const entityStateSchema = schemaFactory
	.createSelectSchema(entity)
	.omit({ id: true, createdAt: true, updatedAt: true });
const seriesStateSchema = schemaFactory
	.createSelectSchema(series)
	.omit({ id: true, createdAt: true, updatedAt: true });
const releaseStateSchema = schemaFactory
	.createSelectSchema(release)
	.omit({ id: true, createdAt: true, updatedAt: true });
const postStateSchema = schemaFactory
	.createSelectSchema(post)
	.omit({ id: true, createdAt: true, updatedAt: true });
const realmStateSchema = schemaFactory
	.createSelectSchema(realm)
	.omit({ id: true, createdAt: true, updatedAt: true });
const zoneStateSchema = schemaFactory
	.createSelectSchema(zone, {
		boundaryDocument: ZoneBoundaryDocumentSchema,
		themeDocument: ZoneThemeDocumentSchema,
	})
	.omit({ id: true, createdAt: true, updatedAt: true });
const collectionStateSchema = schemaFactory
	.createSelectSchema(collection, {
		definitionDocument: CollectionDefinitionDocumentSchema,
		presentationDocument: CollectionPresentationDocumentSchema,
	})
	.omit({ id: true, ownerProfileId: true, createdAt: true, updatedAt: true });
const pollStateSchema = schemaFactory
	.createSelectSchema(poll)
	.omit({ id: true, closedAt: true, createdAt: true, updatedAt: true });
const unitStructureStateSchema = schemaFactory
	.createSelectSchema(unitStructure)
	.omit({ id: true, unitKind: true, createdAt: true, updatedAt: true });
const unitAliasRowSchema = schemaFactory.createSelectSchema(unitAlias, {
	language: z.enum(ContentLanguageValues).nullable(),
});
const creditAttributionRowSchema = schemaFactory.createSelectSchema(creditAttribution, {
	position: FractionalPositionSchema,
	role: z.enum(CreditAttributionRoleValues),
});
const subjectAssociationRowSchema = schemaFactory.createSelectSchema(subjectAssociation, {
	position: FractionalPositionSchema,
	role: z.enum(SubjectAssociationRoleValues),
});
const unitLinkRowSchema = schemaFactory.createSelectSchema(unitLink, {
	position: FractionalPositionSchema,
});
const unitTagRowSchema = schemaFactory.createSelectSchema(unitTag, {
	position: FractionalPositionSchema.nullable(),
});
const unitStructureApplicationRowSchema = schemaFactory.createSelectSchema(
	unitStructureApplication,
	{ position: FractionalPositionSchema.nullable() },
);
const unitVariantRowSchema = schemaFactory.createSelectSchema(unitVariant, {
	unitKind: z.enum(VariantCapableUnitKindValues),
});
const seriesReleaseRowSchema = schemaFactory.createSelectSchema(seriesRelease, {
	position: FractionalPositionSchema,
});
const softwareRequirementRowSchema = schemaFactory.createSelectSchema(softwareRequirement, {
	hardware: JsonObjectSchema,
});
const collectionItemRowSchema = schemaFactory.createSelectSchema(collectionItem, {
	position: FractionalPositionSchema,
});
const pollOptionRowSchema = schemaFactory
	.createSelectSchema(pollOption, {
		sourceKind: z.enum(PollOptionSourceKindValues),
		position: z.int().nonnegative(),
	})
	.refine(
		(row) =>
			(row.sourceKind === "literal" && row.targetUnitId === null) ||
			(row.sourceKind === "unit" && row.targetUnitId !== null),
		{ message: "Poll option source and target Unit do not match" },
	);
const realmPinRowSchema = schemaFactory.createSelectSchema(realmPin, {
	position: FractionalPositionSchema,
});
function parseSnapshotState(
	schema: { parse(value: unknown): SnapshotRow },
	row: SnapshotRow | undefined,
) {
	return row ? schema.parse(row) : null;
}

export async function lockUnitHistory(tx: DatabaseTransaction, unitId: string) {
	await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${unitId}::text, 0))`);
}

async function snapshotExtension(
	tx: DatabaseTransaction,
	unitId: string,
	kind: UnitSnapshot["kind"],
) {
	switch (kind) {
		case "profile":
			return parseSnapshotState(
				profileStateSchema,
				(await tx.select().from(profile).where(eq(profile.id, unitId)).limit(1))[0],
			);
		case "book":
			return parseSnapshotState(
				bookStateSchema,
				(await tx.select().from(book).where(eq(book.id, unitId)).limit(1))[0],
			);
		case "software":
			return parseSnapshotState(
				softwareStateSchema,
				(await tx.select().from(software).where(eq(software.id, unitId)).limit(1))[0],
			);
		case "media":
			return parseSnapshotState(
				mediaStateSchema,
				(await tx.select().from(media).where(eq(media.id, unitId)).limit(1))[0],
			);
		case "entity":
			return parseSnapshotState(
				entityStateSchema,
				(await tx.select().from(entity).where(eq(entity.id, unitId)).limit(1))[0],
			);
		case "series":
			return parseSnapshotState(
				seriesStateSchema,
				(await tx.select().from(series).where(eq(series.id, unitId)).limit(1))[0],
			);
		case "release":
			return parseSnapshotState(
				releaseStateSchema,
				(await tx.select().from(release).where(eq(release.id, unitId)).limit(1))[0],
			);
		case "post":
			return parseSnapshotState(
				postStateSchema,
				(await tx.select().from(post).where(eq(post.id, unitId)).limit(1))[0],
			);
		case "realm":
			return parseSnapshotState(
				realmStateSchema,
				(await tx.select().from(realm).where(eq(realm.id, unitId)).limit(1))[0],
			);
		case "zone":
			return parseSnapshotState(
				zoneStateSchema,
				(await tx.select().from(zone).where(eq(zone.id, unitId)).limit(1))[0],
			);
		case "collection":
			return parseSnapshotState(
				collectionStateSchema,
				(await tx.select().from(collection).where(eq(collection.id, unitId)).limit(1))[0],
			);
		case "poll":
			return parseSnapshotState(
				pollStateSchema,
				(await tx.select().from(poll).where(eq(poll.id, unitId)).limit(1))[0],
			);
		case "structure":
			return parseSnapshotState(
				unitStructureStateSchema,
				(
					await tx
						.select()
						.from(unitStructure)
						.where(eq(unitStructure.id, unitId))
						.limit(1)
				)[0],
			);
		case "tag":
		case "label":
		case "realm_rule":
		case "slug_namespace":
		case "zone_page":
			return null;
	}
}

async function snapshotRealmRules(tx: DatabaseTransaction, realmId: string) {
	const [revision] = await tx
		.select()
		.from(realmRuleRevision)
		.where(eq(realmRuleRevision.realmId, realmId))
		.orderBy(desc(realmRuleRevision.version))
		.limit(1);
	if (!revision) return null;
	const rules = await tx
		.select({
			position: realmRule.position,
			language: unitLocalization.language,
			title: unitLocalization.title,
			content: unitLocalization.content,
		})
		.from(realmRule)
		.innerJoin(
			unitLocalization,
			and(
				eq(unitLocalization.unitId, realmRule.id),
				isPrimaryUnitLocalization(unitLocalization.unitId),
			),
		)
		.where(eq(realmRule.revisionId, revision.id))
		.orderBy(realmRule.position, realmRule.id);
	return RuleSnapshotSchema.parse({
		acknowledgementMode: revision.acknowledgementMode,
		requireOnJoin: revision.requireOnJoin,
		requireOnPost: revision.requireOnPost,
		rules,
	});
}

async function snapshotUnit(tx: DatabaseTransaction, unitId: string) {
	const [record] = await tx.select().from(unit).where(eq(unit.id, unitId)).limit(1);
	if (!record) throw new Error(`Cannot snapshot missing Unit ${unitId}`);
	const localizations = await tx
		.select()
		.from(unitLocalization)
		.where(eq(unitLocalization.unitId, unitId))
		.orderBy(unitLocalization.language);
	const aliases = await tx
		.select()
		.from(unitAlias)
		.where(eq(unitAlias.unitId, unitId))
		.orderBy(unitAlias.id);
	const credits = await tx
		.select()
		.from(creditAttribution)
		.where(eq(creditAttribution.sourceUnitId, unitId))
		.orderBy(creditAttribution.id);
	const subjectAssociations = await tx
		.select()
		.from(subjectAssociation)
		.where(eq(subjectAssociation.unitId, unitId))
		.orderBy(subjectAssociation.id);
	const links = await tx
		.select()
		.from(unitLink)
		.where(eq(unitLink.unitId, unitId))
		.orderBy(unitLink.id);
	const tags = await tx
		.select()
		.from(unitTag)
		.where(eq(unitTag.unitId, unitId))
		.orderBy(unitTag.tagId);
	const structureApplications = await tx
		.select()
		.from(unitStructureApplication)
		.where(eq(unitStructureApplication.unitId, unitId))
		.orderBy(unitStructureApplication.structureId);
	const variants = await tx
		.select()
		.from(unitVariant)
		.where(eq(unitVariant.variantUnitId, unitId))
		.orderBy(unitVariant.variantUnitId);

	const empty: SnapshotRow[] = [];
	const owned: UnitSnapshot["owned"] = {
		aliases,
		credits,
		subjectAssociations,
		links,
		tags,
		structureApplications,
		variants,
		seriesReleases:
			record.kind === "series"
				? await tx
						.select()
						.from(seriesRelease)
						.where(eq(seriesRelease.seriesId, unitId))
						.orderBy(seriesRelease.position, seriesRelease.releaseUnitId)
				: empty,
		softwareRequirements:
			record.kind === "software"
				? await tx
						.select()
						.from(softwareRequirement)
						.where(eq(softwareRequirement.softwareId, unitId))
						.orderBy(softwareRequirement.id)
				: empty,
		collectionItems:
			record.kind === "collection"
				? await tx
						.select()
						.from(collectionItem)
						.where(eq(collectionItem.collectionId, unitId))
						.orderBy(collectionItem.position, collectionItem.unitId)
				: empty,
		pollOptions:
			record.kind === "poll"
				? await tx
						.select()
						.from(pollOption)
						.where(eq(pollOption.pollId, unitId))
						.orderBy(pollOption.position, pollOption.id)
				: empty,
		realmPins:
			record.kind === "realm"
				? await tx
						.select()
						.from(realmPin)
						.where(eq(realmPin.realmId, unitId))
						.orderBy(realmPin.kind, realmPin.position, realmPin.unitId)
				: empty,
		realmUnit: empty,
		realmRules: record.kind === "realm" ? await snapshotRealmRules(tx, unitId) : null,
	};
	return {
		version: 6,
		kind: record.kind,
		unit: unitStateSchema.parse(record),
		localizations: localizations.map((localization) =>
			unitLocalizationStateSchema.parse(localization),
		),
		extension: await snapshotExtension(tx, unitId, record.kind),
		preference: null,
		owned,
	} satisfies UnitSnapshot;
}

async function restoreExtension(
	tx: DatabaseTransaction,
	unitId: string,
	kind: UnitSnapshot["kind"],
	value: SnapshotRow | null,
) {
	if (
		kind === "tag" ||
		kind === "label" ||
		kind === "realm_rule" ||
		kind === "slug_namespace" ||
		kind === "zone_page"
	)
		return;
	if (!value) throw new Error(`Missing ${kind} extension in Unit snapshot`);
	switch (kind) {
		case "profile":
			await tx
				.update(profile)
				.set(profileStateSchema.parse(value))
				.where(eq(profile.id, unitId));
			break;
		case "book":
			await tx.update(book).set(bookStateSchema.parse(value)).where(eq(book.id, unitId));
			break;
		case "software":
			await tx
				.update(software)
				.set(softwareStateSchema.parse(value))
				.where(eq(software.id, unitId));
			break;
		case "media":
			await tx.update(media).set(mediaStateSchema.parse(value)).where(eq(media.id, unitId));
			break;
		case "entity":
			await tx
				.update(entity)
				.set(entityStateSchema.parse(value))
				.where(eq(entity.id, unitId));
			break;
		case "series":
			await tx
				.update(series)
				.set(seriesStateSchema.parse(value))
				.where(eq(series.id, unitId));
			break;
		case "release":
			await tx
				.update(release)
				.set(releaseStateSchema.parse(value))
				.where(eq(release.id, unitId));
			break;
		case "post":
			await tx.update(post).set(postStateSchema.parse(value)).where(eq(post.id, unitId));
			break;
		case "realm":
			await tx.update(realm).set(realmStateSchema.parse(value)).where(eq(realm.id, unitId));
			break;
		case "zone":
			await tx.update(zone).set(zoneStateSchema.parse(value)).where(eq(zone.id, unitId));
			break;
		case "collection":
			await tx
				.update(collection)
				.set(collectionStateSchema.parse(value))
				.where(eq(collection.id, unitId));
			break;
		case "poll":
			await tx.update(poll).set(pollStateSchema.parse(value)).where(eq(poll.id, unitId));
			break;
		case "structure": {
			const expected = unitStructureStateSchema.parse(value);
			const [current] = await tx
				.select()
				.from(unitStructure)
				.where(eq(unitStructure.id, unitId))
				.limit(1);
			if (!current) throw new Error("Unit Structure definition is missing");
			if (
				current.kind !== expected.kind ||
				current.definitionVersion !== expected.definitionVersion ||
				current.createdByProfileId !== expected.createdByProfileId
			)
				throw new Error("Unit Structure identity does not match its snapshot");
			if (canonicalJson(current.memberUnitIds) !== canonicalJson(expected.memberUnitIds))
				await replaceUnitStructureDefinition(tx, {
					structureId: unitId,
					memberUnitIds: expected.memberUnitIds,
					updatedAt: nextUnitStructureDefinitionUpdatedAt(current.updatedAt),
				});
			break;
		}
	}
}

async function restoreAliases(tx: DatabaseTransaction, unitId: string, rows: SnapshotRow[]) {
	await tx.update(unitAlias).set({ deletedAt: new Date() }).where(eq(unitAlias.unitId, unitId));
	for (const value of rows) {
		const row = unitAliasRowSchema.parse(value);
		const { createdAt: _createdAt, updatedAt: _updatedAt, ...state } = row;
		await tx
			.insert(unitAlias)
			.values(row)
			.onConflictDoUpdate({ target: unitAlias.id, set: state });
	}
}

async function restoreSoftRows(tx: DatabaseTransaction, unitId: string, rows: SnapshotRow[]) {
	await tx.update(pollOption).set({ deletedAt: new Date() }).where(eq(pollOption.pollId, unitId));
	for (const value of rows) {
		const row = pollOptionRowSchema.parse(value);
		const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...state } = row;
		await tx
			.insert(pollOption)
			.values(row)
			.onConflictDoUpdate({ target: pollOption.id, set: state });
	}
}

async function restoreRealmRules(
	tx: DatabaseTransaction,
	realmId: string,
	value: RuleSnapshot | null,
	actorProfileId: string,
) {
	const [latest] = await tx
		.select({ value: max(realmRuleRevision.version) })
		.from(realmRuleRevision)
		.where(eq(realmRuleRevision.realmId, realmId));
	const [revision] = await tx
		.insert(realmRuleRevision)
		.values({
			realmId,
			version: Number(latest?.value ?? 0) + 1,
			acknowledgementMode: value?.acknowledgementMode ?? "explicit",
			requireOnJoin: value?.requireOnJoin ?? false,
			requireOnPost: value?.requireOnPost ?? false,
		})
		.returning({ id: realmRuleRevision.id });
	if (!revision) throw new Error("Realm rule restore did not return a revision");
	for (const rule of value?.rules ?? []) {
		const ruleUnit = await insertUnit(tx, {
			kind: "realm_rule",
			status: "published",
			visibility: "unlisted",
			publishedAt: new Date(),
			statusActor: { kind: "profile", profileId: actorProfileId },
		});
		await tx.insert(unitLocalization).values({
			unitId: ruleUnit.id,
			language: rule.language,
			title: rule.title,
			content: rule.content,
			contentStatus: "published",
		});
		await tx.insert(realmRule).values({
			id: ruleUnit.id,
			revisionId: revision.id,
			position: rule.position,
		});
	}
}

export async function restoreUnitSnapshot(
	tx: DatabaseTransaction,
	unitId: string,
	value: unknown,
	authorization: Authorization<string>,
) {
	const result = UnitSnapshotSchema.safeParse(value);
	if (!result.success) throw new Error("Unsupported Unit snapshot", { cause: result.error });
	const snapshot = result.data;
	const credits = snapshot.owned.credits.map((row) => creditAttributionRowSchema.parse(row));
	const subjectAssociations = snapshot.owned.subjectAssociations.map((row) =>
		subjectAssociationRowSchema.parse(row),
	);
	await lockUnitHistory(tx, unitId);
	const [current] = await tx
		.select({ kind: unit.kind, subjectUnitId: post.subjectUnitId })
		.from(unit)
		.leftJoin(post, eq(post.id, unit.id))
		.where(eq(unit.id, unitId))
		.limit(1);
	if (!current || current.kind !== snapshot.kind) throw new Error("Unit snapshot kind mismatch");
	const currentCredits = await tx
		.select({ creditedUnitId: creditAttribution.creditedUnitId })
		.from(creditAttribution)
		.where(eq(creditAttribution.sourceUnitId, unitId));
	const currentSubjectAssociations = await tx
		.select({
			entityId: subjectAssociation.entityId,
			contextPostId: subjectAssociation.contextPostId,
		})
		.from(subjectAssociation)
		.where(eq(subjectAssociation.unitId, unitId));
	const currentCreditTargetIds = new Set(
		currentCredits.map(({ creditedUnitId }) => creditedUnitId),
	);
	const currentSubjectTargetIds = new Set(
		currentSubjectAssociations.map(({ entityId }) => entityId),
	);
	const currentContextPostIds = new Set(
		currentSubjectAssociations.flatMap(({ contextPostId }) =>
			contextPostId ? [contextPostId] : [],
		),
	);
	for (const targetUnitId of credits
		.map(({ creditedUnitId }) => creditedUnitId)
		.filter((targetUnitId) => !currentCreditTargetIds.has(targetUnitId))
		.sort((left, right) => left.localeCompare(right)))
		await ensureDirectCreditAttributionAllowed(authorization, tx, targetUnitId);
	for (const targetEntityId of subjectAssociations
		.map(({ entityId }) => entityId)
		.filter((targetEntityId) => !currentSubjectTargetIds.has(targetEntityId))
		.sort((left, right) => left.localeCompare(right)))
		await authorization.entity.ensureAssociationAllowed(tx, targetEntityId, "subject");
	for (const contextPostId of [
		...new Set(
			subjectAssociations.flatMap(({ contextPostId }) =>
				contextPostId ? [contextPostId] : [],
			),
		),
	]
		.filter((contextPostId) => !currentContextPostIds.has(contextPostId))
		.sort((left, right) => left.localeCompare(right))) {
		await authorization.unit.ensureCanRead(
			contextPostId,
			() => new AssociationContextPostInvalid(),
		);
		await ensureWikiAssociationContextPost(tx, contextPostId);
	}
	if (snapshot.kind === "post" && snapshot.extension) {
		const postState = postStateSchema.parse(snapshot.extension);
		if (postState.subjectUnitId !== current.subjectUnitId && postState.subjectUnitId)
			await authorization.entity.ensureSubjectAssociationAllowedIfEntity(
				tx,
				postState.subjectUnitId,
			);
	}
	if (snapshot.kind === "structure")
		await authorization.platform.ensureCapability("unit.edit", tx);
	if (snapshot.kind === "post" && snapshot.extension) {
		const postState = postStateSchema.parse(snapshot.extension);
		if (postState.subjectUnitId !== current.subjectUnitId)
			await ensureSubjectPostTargetingAllowed(tx, {
				sourcePostId: unitId,
				subjectUnitId: postState.subjectUnitId,
			});
	}
	await tx.update(unit).set(unitStateSchema.parse(snapshot.unit)).where(eq(unit.id, unitId));
	await tx.delete(unitLocalization).where(eq(unitLocalization.unitId, unitId));
	if (snapshot.localizations.length)
		await tx.insert(unitLocalization).values(
			snapshot.localizations.map((localization) => ({
				unitId,
				...unitLocalizationStateSchema.parse(localization),
			})),
		);
	await restoreExtension(tx, unitId, snapshot.kind, snapshot.extension);
	await restoreAliases(tx, unitId, snapshot.owned.aliases);
	if (snapshot.kind === "software")
		await tx.delete(softwareRequirement).where(eq(softwareRequirement.softwareId, unitId));
	await tx.delete(creditAttribution).where(eq(creditAttribution.sourceUnitId, unitId));
	await tx.delete(subjectAssociation).where(eq(subjectAssociation.unitId, unitId));
	await tx.delete(unitLink).where(eq(unitLink.unitId, unitId));
	await tx.delete(unitTag).where(eq(unitTag.unitId, unitId));
	await tx.delete(unitStructureApplication).where(eq(unitStructureApplication.unitId, unitId));
	await tx.delete(unitVariant).where(eq(unitVariant.variantUnitId, unitId));
	if (snapshot.owned.credits.length) await tx.insert(creditAttribution).values(credits);
	if (subjectAssociations.length) await tx.insert(subjectAssociation).values(subjectAssociations);
	if (snapshot.owned.links.length)
		await tx
			.insert(unitLink)
			.values(snapshot.owned.links.map((row) => unitLinkRowSchema.parse(row)));
	if (snapshot.owned.tags.length)
		await tx
			.insert(unitTag)
			.values(snapshot.owned.tags.map((row) => unitTagRowSchema.parse(row)));
	if (snapshot.owned.structureApplications.length)
		await tx
			.insert(unitStructureApplication)
			.values(
				snapshot.owned.structureApplications.map((row) =>
					unitStructureApplicationRowSchema.parse(row),
				),
			);
	if (snapshot.owned.variants.length)
		await tx
			.insert(unitVariant)
			.values(snapshot.owned.variants.map((row) => unitVariantRowSchema.parse(row)));

	if (snapshot.kind === "series") {
		await tx.delete(seriesRelease).where(eq(seriesRelease.seriesId, unitId));
		if (snapshot.owned.seriesReleases.length)
			await tx
				.insert(seriesRelease)
				.values(
					snapshot.owned.seriesReleases.map((row) => seriesReleaseRowSchema.parse(row)),
				);
	}
	if (snapshot.kind === "software" && snapshot.owned.softwareRequirements.length)
		await tx
			.insert(softwareRequirement)
			.values(
				snapshot.owned.softwareRequirements.map((row) =>
					softwareRequirementRowSchema.parse(row),
				),
			);
	if (snapshot.kind === "collection") {
		await tx.delete(collectionItem).where(eq(collectionItem.collectionId, unitId));
		if (snapshot.owned.collectionItems.length)
			await tx
				.insert(collectionItem)
				.values(
					snapshot.owned.collectionItems.map((row) => collectionItemRowSchema.parse(row)),
				);
	}
	// Dynamic Content Structure slots are restored by their content-model adapter.
	if (snapshot.kind === "poll") await restoreSoftRows(tx, unitId, snapshot.owned.pollOptions);
	if (snapshot.kind === "realm") {
		await tx.delete(realmPin).where(eq(realmPin.realmId, unitId));
		if (snapshot.owned.realmPins.length)
			await tx
				.insert(realmPin)
				.values(snapshot.owned.realmPins.map((row) => realmPinRowSchema.parse(row)));
		await restoreRealmRules(tx, unitId, snapshot.owned.realmRules, authorization.profileId);
	}
	await ensureUnitVariantLifecycle(tx, unitId);
}

export const UnitRevisionChangeTags = ["mw-undo", "mw-manual-revert"] as const;
export type UnitRevisionChangeTag = (typeof UnitRevisionChangeTags)[number];

type SlotRole = (typeof UnitRevisionSlotRoleValues)[number];
type FixedSlotRole = Exclude<SlotRole, "localization">;
type SlotDocument = { readonly model: string; readonly payload: unknown };
const SlotDocumentSchema = z.object({
	model: z.string().min(1),
	payload: z.unknown(),
});
export type UnitRevisionSlotIdentity =
	| { readonly role: "localization"; readonly slotKey: ContentLanguage }
	| { readonly role: FixedSlotRole; readonly slotKey: "" };
type UnitRevisionDocumentSlot = UnitRevisionSlotIdentity & {
	readonly document: SlotDocument;
};
export type UnitRevisionDocuments = {
	main?: SlotDocument;
	localizations: Partial<Record<ContentLanguage, SlotDocument>>;
	relations?: SlotDocument;
	structure?: SlotDocument;
	rules?: SlotDocument;
};

export type UnitRevisionCommitResult = {
	readonly revisionId: string;
	readonly revisionCreated: boolean;
};

const SlotModels = {
	main: "rezics.unit.main.v1",
	localization: "rezics.unit.localization.v1",
	relations: "rezics.unit.relations.v3",
	structure: "rezics.unit.structure.v5",
	rules: "rezics.unit.rules.v1",
} as const satisfies Record<(typeof UnitRevisionSlotRoleValues)[number], string>;

function snapshotToDocuments(snapshot: UnitSnapshot): UnitRevisionDocuments {
	const documents: UnitRevisionDocuments = {
		main: {
			model: SlotModels.main,
			payload: {
				version: 1,
				kind: snapshot.kind,
				unit: snapshot.unit,
				extension: snapshot.extension,
			},
		},
		localizations: {},
		relations: {
			model: SlotModels.relations,
			payload: {
				version: 3,
				aliases: snapshot.owned.aliases,
				credits: snapshot.owned.credits,
				subjectAssociations: snapshot.owned.subjectAssociations,
				links: snapshot.owned.links,
				tags: snapshot.owned.tags,
				structureApplications: snapshot.owned.structureApplications,
				variants: snapshot.owned.variants,
			},
		},
		structure: {
			model: SlotModels.structure,
			payload: {
				version: 5,
				seriesReleases: snapshot.owned.seriesReleases,
				softwareRequirements: snapshot.owned.softwareRequirements,
				collectionItems: snapshot.owned.collectionItems,
				pollOptions: snapshot.owned.pollOptions,
				realmPins: snapshot.owned.realmPins,
			},
		},
	};
	for (const value of snapshot.localizations) {
		const localization = unitLocalizationStateSchema.parse(value);
		if (documents.localizations[localization.language])
			throw new Error(`Duplicate ${localization.language} Unit localization snapshot`);
		documents.localizations[localization.language] = {
			model: SlotModels.localization,
			payload: {
				version: 1,
				localization,
			} satisfies z.infer<typeof UnitLocalizationRevisionDocumentSchema>,
		};
	}
	if (snapshot.owned.realmRules)
		documents.rules = {
			model: SlotModels.rules,
			payload: { version: 1, ...snapshot.owned.realmRules },
		};
	return documents;
}

function asRecord(value: unknown, name: string): Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value))
		throw new Error(`Invalid ${name} revision content`);
	return value as Record<string, unknown>;
}

function assertSlotDocumentModel(role: SlotRole, document: SlotDocument): void {
	if (document.model !== SlotModels[role])
		throw new Error(`Unsupported ${role} Unit revision content model ${document.model}`);
}

function fixedSlotPayload(
	documents: UnitRevisionDocuments,
	role: FixedSlotRole,
): Record<string, unknown> {
	const document = documents[role];
	if (!document) throw new Error(`Missing ${role} Unit revision content`);
	assertSlotDocumentModel(role, document);
	return asRecord(document.payload, role);
}

function parseLocalizationSlot(
	language: ContentLanguage,
	document: SlotDocument,
): UnitLocalizationState {
	assertSlotDocumentModel("localization", document);
	const parsed = UnitLocalizationRevisionDocumentSchema.parse(document.payload).localization;
	if (parsed.language !== language)
		throw new Error(
			`Unit localization revision slot ${language} contains ${parsed.language} content`,
		);
	return parsed;
}

function orderedLocalizationStates(documents: UnitRevisionDocuments): UnitLocalizationState[] {
	const localizations = ContentLanguageValues.flatMap((language) => {
		const document = documents.localizations[language];
		return document ? [parseLocalizationSlot(language, document)] : [];
	});
	return localizations.sort(
		(left, right) =>
			compareFractionalPositions(left.position, right.position) ||
			compareBytewisePositions(left.language, right.language),
	);
}

function documentsToSnapshot(documents: UnitRevisionDocuments): UnitSnapshot {
	const main = fixedSlotPayload(documents, "main");
	const relations = fixedSlotPayload(documents, "relations");
	const structure = fixedSlotPayload(documents, "structure");
	const rules = documents.rules ? fixedSlotPayload(documents, "rules") : null;
	return UnitSnapshotSchema.parse({
		version: 6,
		kind: main.kind,
		unit: main.unit,
		localizations: orderedLocalizationStates(documents),
		extension: main.extension,
		preference: null,
		owned: {
			aliases: relations.aliases,
			credits: relations.credits,
			subjectAssociations: relations.subjectAssociations,
			links: relations.links,
			tags: relations.tags,
			structureApplications: relations.structureApplications,
			variants: relations.variants,
			seriesReleases: structure.seriesReleases,
			softwareRequirements: structure.softwareRequirements,
			collectionItems: structure.collectionItems,
			pollOptions: structure.pollOptions,
			realmPins: structure.realmPins,
			realmUnit: [],
			realmRules: rules
				? {
						acknowledgementMode: rules.acknowledgementMode,
						requireOnJoin: rules.requireOnJoin,
						requireOnPost: rules.requireOnPost,
						rules: rules.rules,
					}
				: null,
		},
	});
}

function withoutRevisionDocumentVersion(payload: Record<string, unknown>): Record<string, unknown> {
	const { version: _version, ...content } = payload;
	return content;
}

export function unitRevisionDocumentsToComparisonValue(
	documents: UnitRevisionDocuments,
): Record<string, unknown> {
	documentsToSnapshot(documents);
	const localizations: Partial<Record<ContentLanguage, UnitLocalizationState>> = {};
	for (const language of ContentLanguageValues) {
		const document = documents.localizations[language];
		if (document) localizations[language] = parseLocalizationSlot(language, document);
	}
	return {
		main: withoutRevisionDocumentVersion(fixedSlotPayload(documents, "main")),
		localizations,
		relations: withoutRevisionDocumentVersion(fixedSlotPayload(documents, "relations")),
		structure: withoutRevisionDocumentVersion(fixedSlotPayload(documents, "structure")),
		...(documents.rules
			? {
					rules: withoutRevisionDocumentVersion(fixedSlotPayload(documents, "rules")),
				}
			: {}),
	};
}

export function parseUnitRevisionSlotIdentity(row: {
	readonly role: SlotRole;
	readonly slotKey: ContentLanguage | "";
}): UnitRevisionSlotIdentity {
	if (row.role === "localization") {
		if (!isContentLanguage(row.slotKey))
			throw new Error(`Invalid Unit localization revision slot key ${row.slotKey}`);
		return { role: row.role, slotKey: row.slotKey };
	}
	if (row.slotKey !== "")
		throw new Error(`Fixed Unit revision slot ${row.role} has key ${row.slotKey}`);
	return { role: row.role, slotKey: "" };
}

function slotIdentityMapKey(identity: UnitRevisionSlotIdentity): string {
	return `${identity.role}\u0000${identity.slotKey}`;
}

export function getUnitRevisionSlotContent(
	documents: UnitRevisionDocuments,
	identity: UnitRevisionSlotIdentity,
): unknown {
	const document =
		identity.role === "localization"
			? documents.localizations[identity.slotKey]
			: documents[identity.role];
	if (!document)
		throw new Error(`Missing Unit revision slot ${identity.role}:${identity.slotKey}`);
	assertSlotDocumentModel(identity.role, document);
	if (identity.role === "localization") parseLocalizationSlot(identity.slotKey, document);
	return document.payload;
}

function setRevisionDocument(
	documents: UnitRevisionDocuments,
	identity: UnitRevisionSlotIdentity,
	document: SlotDocument,
): void {
	assertSlotDocumentModel(identity.role, document);
	if (identity.role === "localization") {
		if (documents.localizations[identity.slotKey])
			throw new Error(`Duplicate Unit localization revision slot ${identity.slotKey}`);
		parseLocalizationSlot(identity.slotKey, document);
		documents.localizations[identity.slotKey] = document;
		return;
	}
	if (documents[identity.role]) throw new Error(`Duplicate Unit revision slot ${identity.role}`);
	documents[identity.role] = document;
}

function documentsToSlots(documents: UnitRevisionDocuments): UnitRevisionDocumentSlot[] {
	const slots: UnitRevisionDocumentSlot[] = [];
	for (const role of UnitRevisionSlotRoleValues) {
		if (role === "localization") {
			for (const slotKey of ContentLanguageValues) {
				const document = documents.localizations[slotKey];
				if (document) slots.push({ role, slotKey, document });
			}
			continue;
		}
		const document = documents[role];
		if (document) slots.push({ role, slotKey: "", document });
	}
	return slots;
}

export async function getUnitRevisionDocuments(
	tx: DatabaseTransaction,
	revisionId: string,
): Promise<UnitRevisionDocuments> {
	const rows = await tx
		.select({
			role: unitRevisionSlot.role,
			slotKey: unitRevisionSlot.slotKey,
			contentId: unitRevisionSlot.contentId,
			model: revisionContent.model,
		})
		.from(unitRevisionSlot)
		.innerJoin(revisionContent, eq(revisionContent.id, unitRevisionSlot.contentId))
		.where(eq(unitRevisionSlot.revisionId, revisionId));
	const cache = new Map<string, MaterializedRevisionContent>();
	const documents: UnitRevisionDocuments = { localizations: {} };
	for (const row of rows) {
		const identity = parseUnitRevisionSlotIdentity(row);
		const document = {
			model: row.model,
			payload: (
				await materializeStoredRevisionContent(
					tx,
					row.contentId,
					{
						maxDeltaDepth: 0,
						applyDelta: (model) => {
							throw new Error(`Unsupported Unit revision delta model ${model}`);
						},
					},
					cache,
				)
			).payload,
		};
		setRevisionDocument(documents, identity, document);
	}
	return documents;
}

export async function recordUnitRevision(
	tx: DatabaseTransaction,
	input: {
		unitId: string;
		actorProfileId?: string | null;
		event: UnitRevisionEvent;
		message?: string;
		minor?: boolean;
		baseRevisionId?: string;
		sourceRevisionId?: string;
		tags?: readonly UnitRevisionChangeTag[];
	},
): Promise<UnitRevisionCommitResult> {
	await lockUnitHistory(tx, input.unitId);
	const [head] = await tx
		.select({ revisionId: unitRevisionHead.revisionId })
		.from(unitRevisionHead)
		.where(eq(unitRevisionHead.unitId, input.unitId))
		.limit(1);
	if (input.baseRevisionId !== undefined && head?.revisionId !== input.baseRevisionId) {
		throw new UnitRevisionConflict(head?.revisionId ?? null);
	}
	if (input.event === "delete")
		await recordAuditEvent(tx, {
			category: "admin_activity",
			outcome: "succeeded",
			actor: input.actorProfileId
				? { kind: "profile", profileId: input.actorProfileId }
				: { kind: "system" },
			authority: { kind: "unit", id: input.unitId },
			action: "unit.delete",
			target: { kind: "unit", id: input.unitId },
		});

	const documents = snapshotToDocuments(await snapshotUnit(tx, input.unitId));
	await syncUnitLocalizationContentMetrics(tx, input.unitId);
	const previousSlots = head
		? await tx
				.select({
					role: unitRevisionSlot.role,
					slotKey: unitRevisionSlot.slotKey,
					contentId: unitRevisionSlot.contentId,
					originRevisionId: unitRevisionSlot.originRevisionId,
					byteSize: revisionContent.byteSize,
				})
				.from(unitRevisionSlot)
				.innerJoin(revisionContent, eq(revisionContent.id, unitRevisionSlot.contentId))
				.where(eq(unitRevisionSlot.revisionId, head.revisionId))
		: [];
	const parsedPreviousSlots = previousSlots.map((slot) => ({
		...parseUnitRevisionSlotIdentity(slot),
		contentId: slot.contentId,
		originRevisionId: slot.originRevisionId,
		byteSize: slot.byteSize,
	}));
	const previousByIdentity = new Map(
		parsedPreviousSlots.map((slot) => [slotIdentityMapKey(slot), slot]),
	);
	const sourceSlots = input.sourceRevisionId
		? await tx
				.select({
					role: unitRevisionSlot.role,
					slotKey: unitRevisionSlot.slotKey,
					contentId: unitRevisionSlot.contentId,
					originRevisionId: unitRevisionSlot.originRevisionId,
				})
				.from(unitRevisionSlot)
				.where(eq(unitRevisionSlot.revisionId, input.sourceRevisionId))
		: [];
	const sourceByIdentity = new Map(
		sourceSlots.map((slot) => {
			const identity = parseUnitRevisionSlotIdentity(slot);
			return [
				slotIdentityMapKey(identity),
				{
					...identity,
					contentId: slot.contentId,
					originRevisionId: slot.originRevisionId,
				},
			] as const;
		}),
	);

	const contents: Array<
		UnitRevisionSlotIdentity & { readonly id: string; readonly byteSize: number }
	> = [];
	for (const slot of documentsToSlots(documents)) {
		const content = await findOrCreateRevisionContent(tx, slot.document);
		const identity = parseUnitRevisionSlotIdentity(slot);
		contents.push({
			...identity,
			id: content.id,
			byteSize: content.byteSize,
		});
	}
	const unchanged =
		Boolean(head) &&
		parsedPreviousSlots.length === contents.length &&
		contents.every(
			(content) =>
				previousByIdentity.get(slotIdentityMapKey(content))?.contentId === content.id,
		);
	if (unchanged && head) return { revisionId: head.revisionId, revisionCreated: false };

	const byteSize = contents.reduce((total, content) => total + content.byteSize, 0);
	const [revision] = await tx
		.insert(unitRevision)
		.values({
			unitId: input.unitId,
			parentRevisionId: head?.revisionId,
			actorProfileId: input.actorProfileId,
			editSummary: input.message,
			minor: input.minor ?? false,
			byteSize,
		})
		.returning({ id: unitRevision.id, createdAt: unitRevision.createdAt });
	if (!revision) throw new Error("Unit revision insertion did not return an id");

	await tx.insert(unitRevisionSlot).values(
		contents.map((content) => {
			const identityKey = slotIdentityMapKey(content);
			const previous = previousByIdentity.get(identityKey);
			const source = sourceByIdentity.get(identityKey);
			return {
				revisionId: revision.id,
				unitId: input.unitId,
				role: content.role,
				slotKey: content.slotKey,
				contentId: content.id,
				originRevisionId:
					previous?.contentId === content.id
						? previous.originRevisionId
						: source?.contentId === content.id
							? source.originRevisionId
							: revision.id,
			};
		}),
	);
	await tx
		.insert(unitRevisionHead)
		.values({ unitId: input.unitId, revisionId: revision.id })
		.onConflictDoUpdate({
			target: unitRevisionHead.unitId,
			set: { revisionId: revision.id },
		});
	if (!head)
		await finalizeInitialUnitStatusRevision(tx, {
			unitId: input.unitId,
			revisionId: revision.id,
		});
	const tags = new Set(input.tags ?? []);
	if (input.event === "restore") tags.add("mw-manual-revert");
	if (tags.size)
		await tx.insert(unitRevisionTag).values(
			[...tags].map((tag) => ({
				revisionId: revision.id,
				tag,
				metadata: input.sourceRevisionId
					? { sourceRevisionId: input.sourceRevisionId }
					: {},
			})),
		);
	if (input.event !== "create")
		await recordStudioWorkRelation(tx, {
			profileId: input.actorProfileId,
			relation: "contributed",
			source: "unit_revision",
			occurredAt: revision.createdAt,
			target: {
				kind: "unit_contribution",
				unitId: input.unitId,
				authorizationScope: null,
			},
		});
	return { revisionId: revision.id, revisionCreated: true };
}

export async function restoreUnitRevision(
	tx: DatabaseTransaction,
	input: {
		unitId: string;
		sourceRevisionId: string;
		baseRevisionId: string;
		actorProfileId: string;
		message?: string;
		minor?: boolean;
		authorization: Authorization<string>;
	},
) {
	await lockUnitHistory(tx, input.unitId);
	const [head] = await tx
		.select({ revisionId: unitRevisionHead.revisionId })
		.from(unitRevisionHead)
		.where(eq(unitRevisionHead.unitId, input.unitId))
		.limit(1);
	if (head?.revisionId !== input.baseRevisionId)
		throw new UnitRevisionConflict(head?.revisionId ?? null);
	const [source] = await tx
		.select({ unitId: unitRevision.unitId })
		.from(unitRevision)
		.where(eq(unitRevision.id, input.sourceRevisionId))
		.limit(1);
	if (!source || source.unitId !== input.unitId)
		throw new UnitRevisionConflict(head.revisionId, ["/"]);
	const documents = await getUnitRevisionDocuments(tx, input.sourceRevisionId);
	if (!documents.main) throw new Error("Unit revision not found");
	await restoreUnitSnapshot(
		tx,
		input.unitId,
		documentsToSnapshot(documents),
		input.authorization,
	);
	return recordUnitRevision(tx, {
		unitId: input.unitId,
		actorProfileId: input.actorProfileId,
		event: "restore",
		message: input.message,
		minor: input.minor,
		baseRevisionId: input.baseRevisionId,
		sourceRevisionId: input.sourceRevisionId,
	});
}

const Missing = Symbol("missing revision value");
type MergeValue = unknown | typeof Missing;

function revisionValueEquals(left: MergeValue, right: MergeValue) {
	if (left === Missing || right === Missing) return left === right;
	return canonicalJson(normalizeJson(left)) === canonicalJson(normalizeJson(right));
}

function revisionPath(path: string, key: string) {
	return `${path}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`;
}

const StableArrayKeys = [
	["id"],
	["language"],
	["tagId"],
	["unitId", "role"],
	["entityId", "role"],
	["sourceEntityId", "role", "position"],
	["seriesId", "releaseUnitId"],
	["softwareId", "kind"],
	["zoneId", "unitId"],
	["collectionId", "unitId"],
	["position"],
] as const;

function getStableArrayKey(lists: readonly unknown[][]) {
	for (const fields of StableArrayKeys) {
		const getKey = (value: unknown) => {
			if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
			const record = value as Record<string, unknown>;
			const parts = fields.map((field) => record[field]);
			if (parts.some((part) => part === undefined || part === null)) return undefined;
			return parts.map((part) => String(part)).join("\u0000");
		};
		if (
			lists.every((values) => {
				const keys = values.map(getKey);
				return keys.every((key) => key !== undefined) && new Set(keys).size === keys.length;
			})
		)
			return getKey as (value: unknown) => string;
	}
	return undefined;
}

function undoArrayChange(
	before: unknown[],
	after: unknown[],
	current: unknown[],
	path: string,
	conflicts: string[],
): unknown[] | undefined {
	const getKey = getStableArrayKey([before, after, current]);
	if (!getKey) return undefined;
	const toMap = (values: unknown[]) => new Map(values.map((value) => [getKey(value), value]));
	const beforeByKey = toMap(before);
	const afterByKey = toMap(after);
	const currentByKey = toMap(current);
	const touchedKeys = new Set([...beforeByKey.keys(), ...afterByKey.keys()]);
	for (const key of touchedKeys) {
		const beforeValue = beforeByKey.get(key) ?? Missing;
		const afterValue = afterByKey.get(key) ?? Missing;
		if (revisionValueEquals(beforeValue, afterValue)) continue;
		const currentValue = currentByKey.get(key) ?? Missing;
		const merged = undoRevisionValue(
			beforeValue,
			afterValue,
			currentValue,
			revisionPath(path, key),
			conflicts,
		);
		if (merged === Missing) currentByKey.delete(key);
		else currentByKey.set(key, merged);
	}
	const result = current
		.map(getKey)
		.filter((key) => currentByKey.has(key))
		.map((key) => currentByKey.get(key));
	for (const value of before) {
		const key = getKey(value);
		if (!result.includes(currentByKey.get(key)) && currentByKey.has(key))
			result.push(currentByKey.get(key));
	}
	return result;
}

function undoRevisionValue(
	before: MergeValue,
	after: MergeValue,
	current: MergeValue,
	path: string,
	conflicts: string[],
): MergeValue {
	if (revisionValueEquals(before, after)) return current;
	if (revisionValueEquals(current, after) || revisionValueEquals(current, before)) return before;
	if (before === Missing || after === Missing || current === Missing) {
		conflicts.push(path || "/");
		return current;
	}
	if (Array.isArray(before) && Array.isArray(after) && Array.isArray(current)) {
		const merged = undoArrayChange(before, after, current, path, conflicts);
		if (merged) return merged;
	}
	if (
		before &&
		after &&
		current &&
		typeof before === "object" &&
		typeof after === "object" &&
		typeof current === "object" &&
		!Array.isArray(before) &&
		!Array.isArray(after) &&
		!Array.isArray(current)
	) {
		const beforeRecord = before as Record<string, unknown>;
		const afterRecord = after as Record<string, unknown>;
		const currentRecord = current as Record<string, unknown>;
		const result: Record<string, unknown> = { ...currentRecord };
		for (const key of new Set([...Object.keys(beforeRecord), ...Object.keys(afterRecord)])) {
			const merged = undoRevisionValue(
				key in beforeRecord ? beforeRecord[key] : Missing,
				key in afterRecord ? afterRecord[key] : Missing,
				key in currentRecord ? currentRecord[key] : Missing,
				revisionPath(path, key),
				conflicts,
			);
			if (merged === Missing) delete result[key];
			else result[key] = merged;
		}
		return result;
	}
	conflicts.push(path || "/");
	return current;
}

export function undoRevisionDocuments(
	before: UnitRevisionDocuments,
	after: UnitRevisionDocuments,
	current: UnitRevisionDocuments,
) {
	const conflicts: string[] = [];
	const merged: UnitRevisionDocuments = { localizations: {} };
	for (const role of UnitRevisionSlotRoleValues) {
		if (role === "localization") continue;
		const beforeDocument = before[role] ?? Missing;
		const afterDocument = after[role] ?? Missing;
		const currentDocument = current[role] ?? Missing;
		const value = undoRevisionValue(
			beforeDocument,
			afterDocument,
			currentDocument,
			`/${role}`,
			conflicts,
		);
		if (value !== Missing) {
			const document = SlotDocumentSchema.parse(value);
			assertSlotDocumentModel(role, document);
			merged[role] = document;
		}
	}
	for (const language of ContentLanguageValues) {
		const beforeDocument = before.localizations[language];
		const afterDocument = after.localizations[language];
		const currentDocument = current.localizations[language];
		const value = undoRevisionValue(
			beforeDocument ? parseLocalizationSlot(language, beforeDocument) : Missing,
			afterDocument ? parseLocalizationSlot(language, afterDocument) : Missing,
			currentDocument ? parseLocalizationSlot(language, currentDocument) : Missing,
			`/localizations/${language}`,
			conflicts,
		);
		if (value === Missing) continue;
		const localization = unitLocalizationStateSchema.parse(value);
		if (localization.language !== language)
			throw new Error(`Undo changed Unit localization identity ${language}`);
		merged.localizations[language] = {
			model: SlotModels.localization,
			payload: {
				version: 1,
				localization,
			} satisfies z.infer<typeof UnitLocalizationRevisionDocumentSchema>,
		};
	}
	return { documents: merged, conflictPaths: [...new Set(conflicts)].sort() };
}

export async function undoUnitRevision(
	tx: DatabaseTransaction,
	input: {
		unitId: string;
		targetRevisionId: string;
		baseRevisionId: string;
		actorProfileId: string;
		message?: string;
		minor?: boolean;
		authorization: Authorization<string>;
	},
) {
	await lockUnitHistory(tx, input.unitId);
	const [head] = await tx
		.select({ revisionId: unitRevisionHead.revisionId })
		.from(unitRevisionHead)
		.where(eq(unitRevisionHead.unitId, input.unitId))
		.limit(1);
	if (head?.revisionId !== input.baseRevisionId)
		throw new UnitRevisionConflict(head?.revisionId ?? null);
	const [target] = await tx
		.select({ unitId: unitRevision.unitId, parentRevisionId: unitRevision.parentRevisionId })
		.from(unitRevision)
		.where(eq(unitRevision.id, input.targetRevisionId))
		.limit(1);
	if (!target || target.unitId !== input.unitId || !target.parentRevisionId)
		throw new UnitRevisionConflict(head?.revisionId ?? null, ["/"]);
	const before = await getUnitRevisionDocuments(tx, target.parentRevisionId);
	const after = await getUnitRevisionDocuments(tx, input.targetRevisionId);
	const current = await getUnitRevisionDocuments(tx, input.baseRevisionId);
	const result = undoRevisionDocuments(before, after, current);
	if (result.conflictPaths.length)
		throw new UnitRevisionConflict(head.revisionId, result.conflictPaths);
	await restoreUnitSnapshot(
		tx,
		input.unitId,
		documentsToSnapshot(result.documents),
		input.authorization,
	);
	return recordUnitRevision(tx, {
		unitId: input.unitId,
		actorProfileId: input.actorProfileId,
		event: "update",
		message: input.message,
		minor: input.minor,
		baseRevisionId: input.baseRevisionId,
		sourceRevisionId: input.targetRevisionId,
		tags: ["mw-undo"],
	});
}
