import { PlatformOwnerValues } from "@rezics/reference";
import { readUnitStateById } from "./query";
import { unitOwnerTable } from "../database/schema/unit-reference-columns";
import { nextUnitUpdatedAt } from "./update-values";
import { AvatarTypeValues, FontAwesomeIconPrefixValues } from "@rezics/avatar";
import {
	assertBlockQueryBudget,
	assertUnitReferencedBlockDocument,
	assertWikiPostPortableTextDocument,
	isDocument,
	isPortableTextDocument,
	PollContentBlock,
	type PortableTextDocument as PortableTextDocumentValue,
	UnitReferencedBlockDocument,
	WikiPostBlockHostPolicy,
	ZoneAppearanceDocument,
	ZonePageBlockHostPolicy,
} from "@rezics/block";
import {
	type ContentLanguageSupport,
	normalizeContentLanguageSupport,
} from "@rezics/content-language";
import { assertFilterDocument, type FilterDocument } from "@rezics/filter";
import { type ContentLanguage, ContentLanguageValues, isContentLanguage } from "@rezics/i18n";
import { and, desc, eq, inArray, isNull, max, notInArray, sql } from "drizzle-orm";
import { createSchemaFactory } from "drizzle-orm/zod";
import type { StaticDecode, TSchema } from "typebox";
import { z } from "zod";

import { ensurePublicZoneThemeHeroAsset } from "../api/image-assets/service";
import type { Authorization } from "../authorization";
import { syncUnitLocalizationContentMetrics } from "../content-metrics/service";
import type { DatabaseTransaction } from "../database";
import {
	audio,
	entityIdentity,
	tag,
	tagPath,
	label,
	customTheme,
	collection,
	creditAttribution,
	CreditAttributionRoleValues,
	MaximumAudioTracksPerVideo,
	poll,
	pollOption,
	PollOptionSourceKindValues,
	post,
	realm,
	realmPin,
	realmRule,
	RealmRuleAcknowledgementModeValues,
	realmRuleRevision,
	revisionContent,
	subjectAssociation,
	SubjectAssociationRoleValues,
	unitContentLanguageSupport,
	unitLocalization,
	unitRevision,
	unitRevisionCreditAttribution,
	unitRevisionHead,
	unitRevisionSlot,
	UnitRevisionSlotRoleValues,
	unitRevisionTag,
	unitTag,
	video,
	videoAudioTrack,
	zone,
} from "../database/schema";
import {
	canonicalRevisionJson as canonicalJson,
	findOrCreateRevisionContent,
	type MaterializedRevisionContent,
	materializeStoredRevisionContent,
	normalizeRevisionJson as normalizeJson,
} from "../history/content";
import { recordProfileResourceParticipation } from "../history/participation";
import {
	compareBytewisePositions,
	compareFractionalPositions,
	FractionalPositionStorageMaximumBytes,
	isFractionalPosition,
} from "../ordering/position";
import { ensureSubjectPostTargetingAllowed } from "../posts/targeting";
import { ensureWikiAssociationContextPosts } from "./association-context";
import { ensureDirectCreditAttributionAllowed } from "./attribution-authorization";
import {
	isContentLanguageSupportUnitKind,
	replaceUnitContentLanguageSupport,
} from "./content-language-support";
import { insertPlatformUnit } from "./create";
import {
	AssociationContextPostInvalid,
	RevisionContributionActorRequired,
	RevisionCreditEntityInvalid,
	UnitRevisionConflict,
} from "./errors";
import { isFirstUnitLocalization } from "./localization";

import type {
	RevisionContributionInput,
	TrustedRevisionContribution,
} from "./revision-contribution";
import { defaultRevisionContribution } from "./revision-contribution";
import { finalizeInitialUnitStatusRevision } from "./status";

import { restoreVideoAudioTracks } from "./video-audio-tracks";

export type UnitRevisionEvent = "create" | "update" | "delete" | "restore";

type SnapshotRow = Record<string, unknown>;

const SnapshotRowSchema = z.record(z.string(), z.unknown());
function createDocumentSchema<TSchemaValue extends TSchema>(schema: TSchemaValue) {
	return z.custom<StaticDecode<TSchemaValue>>((value): value is StaticDecode<TSchemaValue> =>
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
const FilterDocumentSchema = z.custom<FilterDocument>((value): value is FilterDocument => {
	try {
		assertFilterDocument(value);
		return true;
	} catch {
		return false;
	}
});
const ZoneAppearanceDocumentSchema = createDocumentSchema(ZoneAppearanceDocument);
const FractionalPositionSchema = z
	.string()
	.max(FractionalPositionStorageMaximumBytes)
	.refine(isFractionalPosition);
export const UnitRevisionSchemaVersion = 1 as const;
export const UnitRevisionSlotSchemaVersions = {
	main: 1,
	localization: 1,
	content_language_support: 1,
	relations: 1,
	structure: 1,
	rules: 1,
} as const satisfies Record<(typeof UnitRevisionSlotRoleValues)[number], number>;
const ContentLanguageSupportSchema = z.unknown().transform((value, context) => {
	try {
		return normalizeContentLanguageSupport(value);
	} catch (error) {
		context.addIssue({
			code: "custom",
			message: error instanceof Error ? error.message : "Invalid content language support",
		});
		return z.NEVER;
	}
});
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
const VideoAudioTrackStateSchema = z.object({ audioUnitId: z.string().uuid() }).strict();
const VideoAudioTracksSchema = z
	.array(VideoAudioTrackStateSchema)
	.max(MaximumAudioTracksPerVideo)
	.refine(
		(values) => new Set(values.map(({ audioUnitId }) => audioUnitId)).size === values.length,
		"contains duplicate Audio Unit IDs",
	);
const UnitRevisionKindValues = PlatformOwnerValues;

const UnitSnapshotSchema = z.object({
	version: z.literal(UnitRevisionSchemaVersion),
	kind: z.enum(UnitRevisionKindValues),
	unit: SnapshotRowSchema,
	localizations: z.array(SnapshotRowSchema),
	contentLanguageSupport: ContentLanguageSupportSchema.default([]),
	extension: SnapshotRowSchema.nullable(),
	preference: SnapshotRowSchema.nullable(),
	owned: z.object({
		credits: z.array(SnapshotRowSchema),
		subjectAssociations: z.array(SnapshotRowSchema),
		tags: z.array(SnapshotRowSchema),
		/** Released v1 relation documents without this key represent no external Audio tracks. */
		videoAudioTracks: VideoAudioTracksSchema.default([]),
		pollOptions: z.array(SnapshotRowSchema),
		realmPins: z.array(SnapshotRowSchema),
		realmUnit: z.array(SnapshotRowSchema),
		realmRules: RuleSnapshotSchema.nullable(),
	}),
});
type RuleSnapshot = z.infer<typeof RuleSnapshotSchema>;
type UnitSnapshot = z.infer<typeof UnitSnapshotSchema>;

const schemaFactory = createSchemaFactory({ coerce: { date: true } });
/** Only public editable metadata is versioned. Private creators, lifecycle, routing and revision counters are never copied into history. */
const unitStateSchema = schemaFactory.createSelectSchema(audio).pick({
	contentRating: true,
	aiDisclosure: true,
	postTargetingLocked: true,
});
const platformIdentityFields = {
	id: true,
	revision: true,
	routingGeneration: true,
	createdByAuthUserId: true,
	status: true,
	visibility: true,
	contentRating: true,
	aiDisclosure: true,
	moderationStatus: true,
	postTargetingLocked: true,
	publishedAt: true,
	deletedAt: true,
	createdAt: true,
	updatedAt: true,
} as const;

/** Parses a persisted Unit revision row, stripping retired keys such as `license`. @internal */
export function parsePersistedUnitRevisionState(value: unknown) {
	return unitStateSchema.parse(value);
}

const unitLocalizationStateSchema = schemaFactory
	.createSelectSchema(unitLocalization, {
		language: z.enum(ContentLanguageValues),
		position: FractionalPositionSchema,
		avatarType: z.enum(AvatarTypeValues).nullable(),
		avatarIconPrefix: z.enum(FontAwesomeIconPrefixValues).nullable(),
		description: PortableTextDocumentSchema.nullable(),
		content: UnitLocalizationContentSchema.nullable(),
	})
	.pick({
		language: true,
		position: true,
		avatarType: true,
		avatarAssetId: true,
		avatarEmoji: true,
		avatarIconPrefix: true,
		avatarIconName: true,
		bannerAssetId: true,
		coverAssetId: true,
		title: true,
		summary: true,
		description: true,
		content: true,
		contentStatus: true,
	});
const UnitLocalizationRevisionDocumentSchema = z.object({
	version: z.literal(UnitRevisionSlotSchemaVersions.localization),
	localization: unitLocalizationStateSchema,
});
type UnitLocalizationState = z.infer<typeof unitLocalizationStateSchema>;
const videoStateSchema = schemaFactory.createSelectSchema(video).omit(platformIdentityFields);
const audioStateSchema = schemaFactory.createSelectSchema(audio).omit(platformIdentityFields);
const postStateSchema = schemaFactory
	.createSelectSchema(post)
	.pick({ kind: true, subjectUnitId: true });
const realmStateSchema = schemaFactory.createSelectSchema(realm).omit(platformIdentityFields);
const zoneStateSchema = schemaFactory
	.createSelectSchema(zone, {
		filterDocument: FilterDocumentSchema,
		appearanceDocument: ZoneAppearanceDocumentSchema,
	})
	.omit(platformIdentityFields);
const collectionStateSchema = z.object({});
const tagStateSchema = schemaFactory
	.createSelectSchema(tag, { nodeKind: z.literal("concept") })
	.omit(platformIdentityFields);
const tagPathStateSchema = schemaFactory.createSelectSchema(tagPath).omit(platformIdentityFields);
const realmRuleStateSchema = schemaFactory
	.createSelectSchema(realmRule)
	.omit(platformIdentityFields);
const labelStateSchema = z.object({});
const customThemeStateSchema = z.object({});

class UnitSnapshotBlockDocumentInvalid extends TypeError {}

function assertUnitSnapshotBlockWriteBudgets(snapshot: UnitSnapshot): void {
	try {
		if (
			snapshot.kind === "post" &&
			snapshot.extension &&
			postStateSchema.parse(snapshot.extension).kind === "page"
		) {
			for (const localization of snapshot.localizations) {
				if (localization.content === null) continue;
				assertUnitReferencedBlockDocument(localization.content, ZonePageBlockHostPolicy);
				assertBlockQueryBudget(localization.content, ZonePageBlockHostPolicy);
			}
			return;
		}
		if (snapshot.kind !== "post" || !snapshot.extension) return;
		const postState = postStateSchema.parse(snapshot.extension);
		if (postState.kind !== "wiki") return;
		for (const localization of snapshot.localizations) {
			if (localization.content === null) continue;
			assertWikiPostPortableTextDocument(localization.content);
			assertBlockQueryBudget({ blocks: [localization.content] }, WikiPostBlockHostPolicy);
		}
	} catch (cause) {
		throw new UnitSnapshotBlockDocumentInvalid(
			"Unit snapshot Block document violates its host limits",
			{ cause },
		);
	}
}
const pollStateSchema = schemaFactory
	.createSelectSchema(poll)
	.omit({ ...platformIdentityFields, closedAt: true });
const creditAttributionRowSchema = schemaFactory
	.createSelectSchema(creditAttribution, {
		position: FractionalPositionSchema,
		role: z.enum(CreditAttributionRoleValues),
	})
	.pick({
		id: true,
		sourceUnitId: true,
		creditedEntityId: true,
		role: true,
		position: true,
		createdAt: true,
		updatedAt: true,
	});
const subjectAssociationRowSchema = schemaFactory
	.createSelectSchema(subjectAssociation, {
		position: FractionalPositionSchema,
		role: z.enum(SubjectAssociationRoleValues),
	})
	.pick({
		id: true,
		unitId: true,
		entityId: true,
		contextPostId: true,
		role: true,
		position: true,
		createdAt: true,
		updatedAt: true,
	});
const unitTagRowSchema = schemaFactory
	.createSelectSchema(unitTag, {
		position: FractionalPositionSchema.nullable(),
	})
	.pick({
		unitId: true,
		tagId: true,
		createdByProfileId: true,
		pinned: true,
		position: true,
		createdAt: true,
		updatedAt: true,
	});
const pollOptionRowSchema = schemaFactory
	.createSelectSchema(pollOption, {
		sourceKind: z.enum(PollOptionSourceKindValues),
		position: z.int().nonnegative(),
	})
	.pick({
		id: true,
		pollId: true,
		sourceKind: true,
		targetUnitId: true,
		position: true,
		deletedAt: true,
		createdAt: true,
		updatedAt: true,
	})
	.refine(
		(row) =>
			(row.sourceKind === "literal" && row.targetUnitId === null) ||
			(row.sourceKind === "unit" && row.targetUnitId !== null),
		{ message: "Poll option source and target Unit do not match" },
	);
const realmPinRowSchema = schemaFactory
	.createSelectSchema(realmPin, {
		position: FractionalPositionSchema,
	})
	.pick({
		realmId: true,
		unitId: true,
		kind: true,
		position: true,
		createdByProfileId: true,
		createdAt: true,
		updatedAt: true,
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
		case "video":
			return parseSnapshotState(
				videoStateSchema,
				(await tx.select().from(video).where(eq(video.id, unitId)).limit(1))[0],
			);
		case "audio":
			return parseSnapshotState(
				audioStateSchema,
				(await tx.select().from(audio).where(eq(audio.id, unitId)).limit(1))[0],
			);
		case "post":
			return parseSnapshotState(
				postStateSchema,
				(await tx.select().from(post).where(eq(post.id, unitId)).limit(1))[0],
			);
		case "poll":
			return parseSnapshotState(
				pollStateSchema,
				(await tx.select().from(poll).where(eq(poll.id, unitId)).limit(1))[0],
			);
		case "zone":
			return parseSnapshotState(
				zoneStateSchema,
				(await tx.select().from(zone).where(eq(zone.id, unitId)).limit(1))[0],
			);
		case "realm":
			return parseSnapshotState(
				realmStateSchema,
				(await tx.select().from(realm).where(eq(realm.id, unitId)).limit(1))[0],
			);
		case "realm_rule":
			return parseSnapshotState(
				realmRuleStateSchema,
				(await tx.select().from(realmRule).where(eq(realmRule.id, unitId)).limit(1))[0],
			);
		case "custom_theme":
			return parseSnapshotState(
				customThemeStateSchema,
				(await tx.select().from(customTheme).where(eq(customTheme.id, unitId)).limit(1))[0],
			);
		case "collection":
			return parseSnapshotState(
				collectionStateSchema,
				(await tx.select().from(collection).where(eq(collection.id, unitId)).limit(1))[0],
			);
		case "tag":
			return parseSnapshotState(
				tagStateSchema,
				(await tx.select().from(tag).where(eq(tag.id, unitId)).limit(1))[0],
			);
		case "tag_path":
			return parseSnapshotState(
				tagPathStateSchema,
				(await tx.select().from(tagPath).where(eq(tagPath.id, unitId)).limit(1))[0],
			);
		case "label":
			return parseSnapshotState(
				labelStateSchema,
				(await tx.select().from(label).where(eq(label.id, unitId)).limit(1))[0],
			);
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
				isFirstUnitLocalization(unitLocalization.unitId),
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
	const record = await readUnitStateById(tx, unitId);
	if (!record) throw new Error(`Cannot snapshot missing platform owner ${unitId}`);
	const kind = z.enum(PlatformOwnerValues).parse(record.reference.owner);
	const localizations = await tx
		.select()
		.from(unitLocalization)
		.where(eq(unitLocalization.unitId, unitId))
		.orderBy(unitLocalization.language);
	const [contentLanguageSupportRow] = await tx
		.select({ value: unitContentLanguageSupport.value })
		.from(unitContentLanguageSupport)
		.where(eq(unitContentLanguageSupport.unitId, unitId))
		.limit(1);
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
	const tags = await tx
		.select()
		.from(unitTag)
		.where(eq(unitTag.unitId, unitId))
		.orderBy(unitTag.tagId);
	const videoAudioTracks = await tx
		.select({ audioUnitId: videoAudioTrack.audioUnitId })
		.from(videoAudioTrack)
		.where(eq(videoAudioTrack.videoUnitId, unitId))
		.orderBy(videoAudioTrack.audioUnitId)
		.limit(MaximumAudioTracksPerVideo + 1);
	if (videoAudioTracks.length > MaximumAudioTracksPerVideo)
		throw new Error(`Video ${unitId} exceeds the Audio track snapshot bound`);

	const empty: SnapshotRow[] = [];
	const owned: UnitSnapshot["owned"] = {
		credits: credits.map((row) => creditAttributionRowSchema.parse(row)),
		subjectAssociations: subjectAssociations.map((row) => subjectAssociationRowSchema.parse(row)),
		tags: tags.map((row) => unitTagRowSchema.parse(row)),
		videoAudioTracks,
		pollOptions:
			kind === "poll"
				? await tx
						.select()
						.from(pollOption)
						.where(eq(pollOption.pollId, unitId))
						.orderBy(pollOption.position, pollOption.id)
				: empty,
		realmPins:
			kind === "realm"
				? await tx
						.select()
						.from(realmPin)
						.where(eq(realmPin.realmId, unitId))
						.orderBy(realmPin.kind, realmPin.position, realmPin.unitId)
				: empty,
		realmUnit: empty,
		realmRules: kind === "realm" ? await snapshotRealmRules(tx, unitId) : null,
	};
	return {
		version: UnitRevisionSchemaVersion,
		kind: kind,
		unit: unitStateSchema.parse(record),
		localizations: localizations.map((localization) =>
			unitLocalizationStateSchema.parse(localization),
		),
		contentLanguageSupport: contentLanguageSupportRow
			? ContentLanguageSupportSchema.parse(contentLanguageSupportRow.value)
			: [],
		extension: await snapshotExtension(tx, unitId, kind),
		preference: null,
		owned: {
			...owned,
			pollOptions: owned.pollOptions.map((row) => pollOptionRowSchema.parse(row)),
			realmPins: owned.realmPins.map((row) => realmPinRowSchema.parse(row)),
		},
	} satisfies UnitSnapshot;
}

async function restoreExtension(
	tx: DatabaseTransaction,
	unitId: string,
	kind: UnitSnapshot["kind"],
	value: SnapshotRow | null,
) {
	if (!value) throw new Error(`Missing ${kind} owner state in platform snapshot`);
	switch (kind) {
		case "video":
			await tx.update(video).set(videoStateSchema.parse(value)).where(eq(video.id, unitId));
			return;
		case "audio":
			await tx.update(audio).set(audioStateSchema.parse(value)).where(eq(audio.id, unitId));
			return;
		case "post":
			await tx.update(post).set(postStateSchema.parse(value)).where(eq(post.id, unitId));
			return;
		case "poll":
			await tx.update(poll).set(pollStateSchema.parse(value)).where(eq(poll.id, unitId));
			return;
		case "zone":
			await tx.update(zone).set(zoneStateSchema.parse(value)).where(eq(zone.id, unitId));
			return;
		case "realm":
			await tx.update(realm).set(realmStateSchema.parse(value)).where(eq(realm.id, unitId));
			return;
		case "realm_rule": {
			const [current] = await tx.select().from(realmRule).where(eq(realmRule.id, unitId)).limit(1);
			if (
				!current ||
				canonicalJson(realmRuleStateSchema.parse(current)) !==
					canonicalJson(realmRuleStateSchema.parse(value))
			)
				throw new Error("Immutable realm_rule structure cannot be changed by revision restore");
			return;
		}
		case "custom_theme":
			customThemeStateSchema.parse(value);
			return;
		case "collection":
			collectionStateSchema.parse(value);
			return;
		case "tag":
			await tx.update(tag).set(tagStateSchema.parse(value)).where(eq(tag.id, unitId));
			return;
		case "tag_path": {
			const [current] = await tx.select().from(tagPath).where(eq(tagPath.id, unitId)).limit(1);
			if (
				!current ||
				canonicalJson(tagPathStateSchema.parse(current)) !==
					canonicalJson(tagPathStateSchema.parse(value))
			)
				throw new Error("Immutable tag_path structure cannot be changed by revision restore");
			return;
		}
		case "label":
			labelStateSchema.parse(value);
			return;
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
	actorAuthUserId: string | null,
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
		const ruleUnit = await insertPlatformUnit(tx, {
			owner: "realm_rule",
			values: {
				createdByAuthUserId: actorAuthUserId,
				revisionId: revision.id,
				position: rule.position,
				status: "published",
				visibility: "unlisted",
				publishedAt: new Date(),
			},
			statusActor: { kind: "profile", profileId: actorProfileId },
		});
		await tx.insert(unitLocalization).values({
			unitId: ruleUnit.id,
			language: rule.language,
			title: rule.title,
			content: rule.content,
			contentStatus: "published",
		});
	}
}

async function restoreUnitTags(
	tx: DatabaseTransaction,
	unitId: string,
	rows: readonly SnapshotRow[],
): Promise<void> {
	const tags = rows.map((row) => unitTagRowSchema.parse(row));
	if (tags.some((row) => row.unitId !== unitId))
		throw new Error("Unit Tag snapshot owner mismatch");
	const tagIds = tags.map(({ tagId }) => tagId);
	if (new Set(tagIds).size !== tagIds.length)
		throw new Error("Unit Tag snapshot contains duplicate identities");

	// Judgments and import evidence intentionally RESTRICT deletion. Keep stable
	// identities for retained Tags so unrelated restores do not discard those facts.
	if (tagIds.length) {
		await tx
			.delete(unitTag)
			.where(and(eq(unitTag.unitId, unitId), notInArray(unitTag.tagId, tagIds)));
		await tx
			.update(unitTag)
			.set({ pinned: false, position: null })
			.where(and(eq(unitTag.unitId, unitId), inArray(unitTag.tagId, tagIds)));
	} else await tx.delete(unitTag).where(eq(unitTag.unitId, unitId));

	if (tags.length)
		await tx
			.insert(unitTag)
			.values(tags)
			.onConflictDoUpdate({
				target: [unitTag.unitId, unitTag.tagId],
				set: {
					createdByProfileId: sql`excluded.created_by_profile_id`,
					pinned: sql`excluded.pinned`,
					position: sql`excluded.position`,
					createdAt: sql`excluded.created_at`,
					updatedAt: sql`excluded.updated_at`,
				},
			});
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
	assertUnitSnapshotBlockWriteBudgets(snapshot);
	const credits = snapshot.owned.credits.map((row) => creditAttributionRowSchema.parse(row));
	const subjectAssociations = snapshot.owned.subjectAssociations.map((row) =>
		subjectAssociationRowSchema.parse(row),
	);
	await authorization.unit.ensureInTransaction(tx, unitId, "unit.update");
	await lockUnitHistory(tx, unitId);
	const currentState = await readUnitStateById(tx, unitId, { lock: "update" });
	if (!currentState || currentState.reference.owner !== snapshot.kind)
		throw new Error("Platform snapshot owner mismatch");
	const table = unitOwnerTable(currentState.reference.owner);
	const [currentPost] =
		snapshot.kind === "post"
			? await tx.select().from(post).where(eq(post.id, unitId)).limit(1)
			: [];
	const [currentZone] =
		snapshot.kind === "zone"
			? await tx.select().from(zone).where(eq(zone.id, unitId)).limit(1)
			: [];
	const current = {
		subjectUnitId: currentPost?.subjectUnitId ?? null,
		zoneAppearanceDocument: currentZone?.appearanceDocument,
	};

	if (snapshot.kind === "zone" && snapshot.extension) {
		const currentTheme = ZoneAppearanceDocumentSchema.parse(current.zoneAppearanceDocument);
		const restoredTheme = zoneStateSchema.parse(snapshot.extension).appearanceDocument;
		if (canonicalJson(currentTheme) !== canonicalJson(restoredTheme)) {
			const level1Changed =
				currentTheme.heroAssetId !== restoredTheme.heroAssetId ||
				currentTheme.cardRadius !== restoredTheme.cardRadius ||
				currentTheme.headingFontScale !== restoredTheme.headingFontScale ||
				currentTheme.surfaceTint !== restoredTheme.surfaceTint;
			await authorization.zone.ensureThemeMutation(
				unitId,
				level1Changed ? "development_preview" : "released",
			);
			await ensurePublicZoneThemeHeroAsset(tx, restoredTheme.heroAssetId);
		}
	}
	const currentCredits = await tx
		.select({ creditedEntityId: creditAttribution.creditedEntityId })
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
		currentCredits.map(({ creditedEntityId }) => creditedEntityId),
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
		.map(({ creditedEntityId }) => creditedEntityId)
		.filter((targetUnitId) => !currentCreditTargetIds.has(targetUnitId))
		.sort((left, right) => left.localeCompare(right)))
		await ensureDirectCreditAttributionAllowed(authorization, tx, targetUnitId);
	for (const targetEntityId of subjectAssociations
		.map(({ entityId }) => entityId)
		.filter((targetEntityId) => !currentSubjectTargetIds.has(targetEntityId))
		.sort((left, right) => left.localeCompare(right)))
		await authorization.entity.ensureAssociationAllowed(tx, targetEntityId, "subject");
	const newContextPostIds = [
		...new Set(
			subjectAssociations.flatMap(({ contextPostId }) => (contextPostId ? [contextPostId] : [])),
		),
	]
		.filter((contextPostId) => !currentContextPostIds.has(contextPostId))
		.sort((left, right) => left.localeCompare(right));
	await authorization.unit.ensureCanReadMany(
		newContextPostIds,
		() => new AssociationContextPostInvalid(),
	);
	await ensureWikiAssociationContextPosts(tx, newContextPostIds);
	if (snapshot.kind === "post" && snapshot.extension) {
		const postState = postStateSchema.parse(snapshot.extension);
		if (postState.subjectUnitId !== current.subjectUnitId && postState.subjectUnitId)
			await authorization.entity.ensureSubjectAssociationAllowedIfEntity(
				tx,
				postState.subjectUnitId,
			);
	}
	if (snapshot.kind === "post" && snapshot.extension) {
		const postState = postStateSchema.parse(snapshot.extension);
		if (postState.subjectUnitId !== current.subjectUnitId)
			await ensureSubjectPostTargetingAllowed(tx, {
				sourcePostId: unitId,
				subjectUnitId: postState.subjectUnitId,
			});
	}
	await tx
		.update(table)
		.set({
			...unitStateSchema.parse(snapshot.unit),
			revision: sql`${table.revision} + 1`,
			updatedAt: nextUnitUpdatedAt(currentState.updatedAt),
		})
		.where(eq(table.id, unitId));
	if (isContentLanguageSupportUnitKind(snapshot.kind))
		await replaceUnitContentLanguageSupport(
			tx,
			unitId,
			snapshot.kind,
			snapshot.contentLanguageSupport,
		);
	else if (snapshot.contentLanguageSupport.length)
		throw new Error(`${snapshot.kind} cannot restore content language support`);
	await tx.delete(unitLocalization).where(eq(unitLocalization.unitId, unitId));
	if (snapshot.localizations.length)
		await tx.insert(unitLocalization).values(
			snapshot.localizations.map((localization) => ({
				unitId,
				...unitLocalizationStateSchema.parse(localization),
			})),
		);
	await restoreExtension(tx, unitId, snapshot.kind, snapshot.extension);
	await tx.delete(creditAttribution).where(eq(creditAttribution.sourceUnitId, unitId));
	await tx.delete(subjectAssociation).where(eq(subjectAssociation.unitId, unitId));
	if (snapshot.owned.credits.length) await tx.insert(creditAttribution).values(credits);
	if (subjectAssociations.length) await tx.insert(subjectAssociation).values(subjectAssociations);
	await restoreUnitTags(tx, unitId, snapshot.owned.tags);
	await restoreVideoAudioTracks(
		tx,
		unitId,
		snapshot.kind,
		snapshot.owned.videoAudioTracks.map(({ audioUnitId }) => audioUnitId),
	);

	// Dynamic Content Structure slots are restored by their content-model adapter.
	if (snapshot.kind === "poll") await restoreSoftRows(tx, unitId, snapshot.owned.pollOptions);
	if (snapshot.kind === "realm") {
		await tx.delete(realmPin).where(eq(realmPin.realmId, unitId));
		if (snapshot.owned.realmPins.length)
			await tx
				.insert(realmPin)
				.values(snapshot.owned.realmPins.map((row) => realmPinRowSchema.parse(row)));
		await restoreRealmRules(
			tx,
			unitId,
			snapshot.owned.realmRules,
			authorization.profileId,
			authorization.authUserId ?? null,
		);
	}
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
	content_language_support?: SlotDocument;
	relations?: SlotDocument;
	structure?: SlotDocument;
	rules?: SlotDocument;
};

export type UnitRevisionCommitResult = {
	readonly revisionId: string;
	readonly revisionCreated: boolean;
};

const SlotModels = {
	main: `rezics.unit.main.v${UnitRevisionSlotSchemaVersions.main}`,
	localization: `rezics.unit.localization.v${UnitRevisionSlotSchemaVersions.localization}`,
	content_language_support: `rezics.unit.content-language-support.v${UnitRevisionSlotSchemaVersions.content_language_support}`,
	relations: `rezics.unit.relations.v${UnitRevisionSlotSchemaVersions.relations}`,
	structure: `rezics.unit.structure.v${UnitRevisionSlotSchemaVersions.structure}`,
	rules: `rezics.unit.rules.v${UnitRevisionSlotSchemaVersions.rules}`,
} as const satisfies Record<(typeof UnitRevisionSlotRoleValues)[number], string>;

function snapshotToDocuments(snapshot: UnitSnapshot): UnitRevisionDocuments {
	const documents: UnitRevisionDocuments = {
		main: {
			model: SlotModels.main,
			payload: {
				version: UnitRevisionSlotSchemaVersions.main,
				kind: snapshot.kind,
				unit: snapshot.unit,
				extension: snapshot.extension,
			},
		},
		localizations: {},
		content_language_support: {
			model: SlotModels.content_language_support,
			payload: {
				version: UnitRevisionSlotSchemaVersions.content_language_support,
				value: snapshot.contentLanguageSupport,
			},
		},
		relations: {
			model: SlotModels.relations,
			payload: {
				version: UnitRevisionSlotSchemaVersions.relations,
				credits: snapshot.owned.credits,
				subjectAssociations: snapshot.owned.subjectAssociations,
				tags: snapshot.owned.tags,
				videoAudioTracks: snapshot.owned.videoAudioTracks,
			},
		},
		structure: {
			model: SlotModels.structure,
			payload: {
				version: UnitRevisionSlotSchemaVersions.structure,
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
				version: UnitRevisionSlotSchemaVersions.localization,
				localization,
			} satisfies z.infer<typeof UnitLocalizationRevisionDocumentSchema>,
		};
	}
	if (snapshot.owned.realmRules)
		documents.rules = {
			model: SlotModels.rules,
			payload: {
				version: UnitRevisionSlotSchemaVersions.rules,
				...snapshot.owned.realmRules,
			},
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

/** A missing slot is the released v1 legacy representation of an empty field. */
function parseContentLanguageSupportSlot(documents: UnitRevisionDocuments): ContentLanguageSupport {
	const document = documents.content_language_support;
	if (!document) return [];
	assertSlotDocumentModel("content_language_support", document);
	const payload = asRecord(document.payload, "content_language_support");
	if (payload.version !== UnitRevisionSlotSchemaVersions.content_language_support)
		throw new Error("Unsupported content language support Unit revision version");
	return ContentLanguageSupportSchema.parse(payload.value);
}

/** Exposes the legacy-empty slot semantics to history readers and tests. @internal */
export function unitRevisionDocumentsToContentLanguageSupport(
	documents: UnitRevisionDocuments,
): ContentLanguageSupport {
	return parseContentLanguageSupportSlot(documents);
}

/** A released v1 relations document without this key represents no external Audio tracks. */
function parseVideoAudioTracksSlot(documents: UnitRevisionDocuments) {
	const document = documents.relations;
	if (!document) return [];
	assertSlotDocumentModel("relations", document);
	const payload = asRecord(document.payload, "relations");
	if (payload.version !== UnitRevisionSlotSchemaVersions.relations)
		throw new Error("Unsupported relations Unit revision version");
	return VideoAudioTracksSchema.parse(payload.videoAudioTracks ?? []);
}

/** Exposes legacy-empty Video Audio track semantics to history readers and tests. @internal */
export function unitRevisionDocumentsToVideoAudioTracks(documents: UnitRevisionDocuments) {
	return parseVideoAudioTracksSlot(documents);
}

function documentsToSnapshot(documents: UnitRevisionDocuments): UnitSnapshot {
	const main = fixedSlotPayload(documents, "main");
	const relations = fixedSlotPayload(documents, "relations");
	const structure = fixedSlotPayload(documents, "structure");
	const rules = documents.rules ? fixedSlotPayload(documents, "rules") : null;
	return UnitSnapshotSchema.parse({
		version: UnitRevisionSchemaVersion,
		kind: main.kind,
		unit: main.unit,
		localizations: orderedLocalizationStates(documents),
		contentLanguageSupport: parseContentLanguageSupportSlot(documents),
		extension: main.extension,
		preference: null,
		owned: {
			credits: relations.credits,
			subjectAssociations: relations.subjectAssociations,
			tags: relations.tags,
			videoAudioTracks: parseVideoAudioTracksSlot(documents),
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
	const snapshot = documentsToSnapshot(documents);
	const localizations: Partial<Record<ContentLanguage, UnitLocalizationState>> = {};
	for (const language of ContentLanguageValues) {
		const document = documents.localizations[language];
		if (document) localizations[language] = parseLocalizationSlot(language, document);
	}
	return {
		main: withoutRevisionDocumentVersion(fixedSlotPayload(documents, "main")),
		localizations,
		contentLanguageSupport: parseContentLanguageSupportSlot(documents),
		relations: {
			...withoutRevisionDocumentVersion(fixedSlotPayload(documents, "relations")),
			videoAudioTracks: snapshot.owned.videoAudioTracks,
		},
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
	if (!document) throw new Error(`Missing Unit revision slot ${identity.role}:${identity.slotKey}`);
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

async function resolveRevisionContribution(
	tx: DatabaseTransaction,
	actorProfileId: string | null | undefined,
	input: RevisionContributionInput | undefined,
): Promise<TrustedRevisionContribution> {
	const contribution = input ?? defaultRevisionContribution;
	if (contribution.primary === "unattributed") return contribution;
	if (!actorProfileId) throw new RevisionContributionActorRequired();
	if (contribution.primary === "human") return contribution;

	const [eligibleEntity] = await tx
		.select({ id: entityIdentity.id })
		.from(entityIdentity)
		.where(
			and(
				eq(entityIdentity.id, contribution.creditedEntityId),
				eq(entityIdentity.shape, "service_actor"),
				eq(entityIdentity.status, "published"),
				inArray(entityIdentity.visibility, ["public", "unlisted"]),
				eq(entityIdentity.moderationStatus, "approved"),
				isNull(entityIdentity.deletedAt),
			),
		)
		.limit(1);
	if (!eligibleEntity) throw new RevisionCreditEntityInvalid();
	return {
		primary: "ai",
		creditedEntityId: eligibleEntity.id,
		role: contribution.role,
		assurance: "self_declared",
	};
}

export async function recordUnitRevision(
	tx: DatabaseTransaction,
	input: {
		unitId: string;
		actorProfileId?: string | null;
		/** Workflows that omit a declaration are intentionally unattributed. */
		contribution?: RevisionContributionInput;
		event: UnitRevisionEvent;
		message?: string;
		minor?: boolean;
		baseRevisionId?: string;
		sourceRevisionId?: string;
		tags?: readonly UnitRevisionChangeTag[];
	},
): Promise<UnitRevisionCommitResult> {
	const contribution = await resolveRevisionContribution(
		tx,
		input.actorProfileId,
		input.contribution,
	);
	await lockUnitHistory(tx, input.unitId);
	const [head] = await tx
		.select({ revisionId: unitRevisionHead.revisionId })
		.from(unitRevisionHead)
		.where(eq(unitRevisionHead.unitId, input.unitId))
		.limit(1);
	if (input.baseRevisionId !== undefined && head?.revisionId !== input.baseRevisionId) {
		throw new UnitRevisionConflict(head?.revisionId ?? null);
	}
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
			(content) => previousByIdentity.get(slotIdentityMapKey(content))?.contentId === content.id,
		);
	if (unchanged && head) return { revisionId: head.revisionId, revisionCreated: false };

	const byteSize = contents.reduce((total, content) => total + content.byteSize, 0);
	const [revision] = await tx
		.insert(unitRevision)
		.values({
			unitId: input.unitId,
			parentRevisionId: head?.revisionId,
			actorProfileId: input.actorProfileId,
			primaryContributionKind: contribution.primary,
			editSummary: input.message,
			minor: input.minor ?? false,
			byteSize,
		})
		.returning({ id: unitRevision.id, createdAt: unitRevision.createdAt });
	if (!revision) throw new Error("Unit revision insertion did not return an id");
	if (contribution.primary === "ai")
		await tx.insert(unitRevisionCreditAttribution).values({
			revisionId: revision.id,
			creditedEntityId: contribution.creditedEntityId,
			role: contribution.role,
			assurance: contribution.assurance,
		});

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
				metadata: input.sourceRevisionId ? { sourceRevisionId: input.sourceRevisionId } : {},
			})),
		);
	if (input.event !== "create")
		await recordProfileResourceParticipation(tx, {
			profileId: input.actorProfileId,
			relation: "contributed",
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
		contribution?: RevisionContributionInput;
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
	try {
		await restoreUnitSnapshot(
			tx,
			input.unitId,
			documentsToSnapshot(documents),
			input.authorization,
		);
	} catch (cause) {
		if (cause instanceof UnitSnapshotBlockDocumentInvalid)
			throw new UnitRevisionConflict(head.revisionId, ["/localizations"]);
		throw cause;
	}
	return recordUnitRevision(tx, {
		unitId: input.unitId,
		actorProfileId: input.actorProfileId,
		contribution: input.contribution,
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
	["audioUnitId"],
	["id"],
	["language"],
	["tagId"],
	["unitId", "role"],
	["entityId", "role"],
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
		contribution?: RevisionContributionInput;
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
	try {
		await restoreUnitSnapshot(
			tx,
			input.unitId,
			documentsToSnapshot(result.documents),
			input.authorization,
		);
	} catch (cause) {
		if (cause instanceof UnitSnapshotBlockDocumentInvalid)
			throw new UnitRevisionConflict(head.revisionId, ["/localizations"]);
		throw cause;
	}
	return recordUnitRevision(tx, {
		unitId: input.unitId,
		actorProfileId: input.actorProfileId,
		contribution: input.contribution,
		event: "update",
		message: input.message,
		minor: input.minor,
		baseRevisionId: input.baseRevisionId,
		sourceRevisionId: input.targetRevisionId,
		tags: ["mw-undo"],
	});
}
