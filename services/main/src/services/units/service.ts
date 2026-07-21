import { and, desc, eq, exists, isNull, lt, not, or, sql } from "drizzle-orm";
import {
	PortableTextDocument,
	parseNullableDocument,
	type PortableTextDocument as PortableTextDocumentValue,
} from "@rezics/block";
import type { Static } from "elysia";
import type { ContentLanguage } from "@rezics/i18n";
import { parseNullablePublicationLicenseId, type PublicationLicenseId } from "@rezics/license";

import type { Authorization } from "../authorization";
import { createCommunityCatalogAccess } from "../authorization/unit/ownership";
import { database } from "../database";
import { toSafeInteger } from "../database/integer";
import {
	ContentStructureContentModel,
	ContentStructureSnapshotSchema,
	contentStructureSlotRole,
} from "../content-structure/contracts";
import {
	isPrimaryUnitLocalization,
	makePrimaryUnitLocalization,
	firstUnitLocalizationCoverAssetId,
	resolvedUnitLocalizationImageAssetId,
	unitLocalizationImageAssetIds,
} from "./localization";
import {
	book,
	contentStructure,
	entity,
	software,
	media,
	unit,
	creditAttribution,
	subjectAssociation,
	unitLink,
	unitLocalization,
	unitTag,
	unitTagVoteStat,
	unitVariant,
} from "../database/schema";
import { ensureImageAssetsAttachable, imageAssetContentUrl } from "../api/image-assets/service";
import { UnitDetailResponse } from "../api/schema/response";
import { UnitChanged, UnitNotFound, UnitPrimaryLanguageMissing } from "./errors";
import { recordUnitRevision } from "./history";
import { insertUnit } from "./create";
import { getPublisherSummariesByUnitIds, transitionUnitStatus } from "./status";
import { getUnitVariantContext } from "./variants";
import { ensureUnitVariantLifecycle } from "./variant-policy";

export type UnitKind = "book" | "software" | "media";
export type UnitDetail = Static<typeof UnitDetailResponse>;

export interface CreateUnitInput {
	localization: {
		language: ContentLanguage;
		title: string;
		summary?: string;
		description?: PortableTextDocumentValue;
		avatarAssetId?: string | null;
		bannerAssetId?: string | null;
		coverAssetId?: string | null;
	};
	visibility?: "public" | "unlisted" | "private";
	contentRating?: "general" | "r15" | "r18" | "r18g";
	aiDisclosure?: "unknown" | "none" | "ai_assisted" | "ai_originated" | "machine_generated";
	license?: PublicationLicenseId | null;
}

export interface UpdateUnitInput {
	updatedAt: string;
	status?: "draft" | "published" | "archived";
	visibility?: "public" | "unlisted" | "private";
	contentRating?: "general" | "r15" | "r18" | "r18g";
	aiDisclosure?: "unknown" | "none" | "ai_assisted" | "ai_originated" | "machine_generated";
	license?: PublicationLicenseId | null;
	unit?: {
		primaryLanguage?: ContentLanguage;
		releasedOn?: string | null;
	};
	details?: {
		isbn13?: string | null;
		publicationDate?: string | null;
		pageCount?: number | null;
		format?: string | null;
		licensed?: boolean;
		versionLabel?: string | null;
		kind?: string;
		runtimeMinutes?: number | null;
		episodeCount?: number | null;
		seasonCount?: number | null;
	};
}

export function presentImageAsset(assetId: string | null) {
	return assetId ? { id: assetId, url: imageAssetContentUrl(assetId) } : null;
}

export async function createUnit(
	kind: UnitKind,
	authorization: Authorization<string>,
	input: CreateUnitInput,
): Promise<UnitDetail> {
	const ownerId = authorization.profileId;
	const unitId = await database.transaction(async (tx) => {
		await ensureImageAssetsAttachable(
			tx,
			ownerId,
			unitLocalizationImageAssetIds(input.localization),
		);
		const created = await insertUnit(tx, {
			kind,
			visibility: input.visibility ?? "public",
			contentRating: input.contentRating ?? "general",
			aiDisclosure: input.aiDisclosure ?? "unknown",
			license: input.license,
			statusActor: { kind: "profile", profileId: ownerId },
		});
		let bookStructure: typeof contentStructure.$inferSelect | undefined;
		if (kind === "book") {
			await tx.insert(book).values({ id: created.id });
			[bookStructure] = await tx
				.insert(contentStructure)
				.values({ ownerUnitId: created.id, purpose: "book.contents" })
				.returning();
			if (!bookStructure) throw new Error("Book Content Structure insertion returned no row");
		}
		if (kind === "software") await tx.insert(software).values({ id: created.id });
		if (kind === "media") await tx.insert(media).values({ id: created.id, kind: "other" });
		await tx.insert(unitLocalization).values({
			unitId: created.id,
			...input.localization,
		});
		await createCommunityCatalogAccess(tx, created.id, ownerId, "publishing_editor");
		const bookStructureSnapshot = bookStructure
			? ContentStructureSnapshotSchema.parse({
					version: 1,
					structure: bookStructure,
					nodes: [],
				})
			: null;
		await recordUnitRevision(tx, {
			unitId: created.id,
			actorProfileId: ownerId,
			event: "create",
			componentChanges: bookStructureSnapshot
				? [
						{
							role: contentStructureSlotRole(bookStructureSnapshot.structure.id),
							model: ContentStructureContentModel,
							delta: bookStructureSnapshot,
							checkpoint: async () => bookStructureSnapshot,
						},
					]
				: undefined,
		});
		return created.id;
	});
	return getUnit(kind, unitId, authorization);
}

async function getReleaseDate(kind: UnitKind, unitId: string) {
	if (kind === "book")
		return (
			(
				await database
					.select({ value: book.publicationDate })
					.from(book)
					.where(eq(book.id, unitId))
					.limit(1)
			)[0]?.value ?? null
		);
	if (kind === "software")
		return (
			(
				await database
					.select({ value: software.releaseDate })
					.from(software)
					.where(eq(software.id, unitId))
					.limit(1)
			)[0]?.value ?? null
		);
	return (
		(
			await database
				.select({ value: media.releaseDate })
				.from(media)
				.where(eq(media.id, unitId))
				.limit(1)
		)[0]?.value ?? null
	);
}

export async function getUnit(
	kind: UnitKind,
	unitId: string,
	authorization: Authorization,
): Promise<UnitDetail> {
	const [base] = await database
		.select()
		.from(unit)
		.where(and(eq(unit.id, unitId), eq(unit.kind, kind), isNull(unit.deletedAt)))
		.limit(1);
	if (!base) throw new UnitNotFound(kind);
	await authorization.unit.ensureCanRead(base.id, () => new UnitNotFound(kind));

	const localizations = await database
		.select()
		.from(unitLocalization)
		.where(eq(unitLocalization.unitId, base.id))
		.orderBy(unitLocalization.position, unitLocalization.language);
	const primaryLanguage = localizations[0]?.language ?? null;
	const credits = await database
		.select({
			id: creditAttribution.id,
			entityEntryId: creditAttribution.entityId,
			role: creditAttribution.role,
			position: creditAttribution.position,
			title: unitLocalization.title,
		})
		.from(creditAttribution)
		.innerJoin(entity, eq(entity.id, creditAttribution.entityId))
		.leftJoin(
			unitLocalization,
			and(
				eq(unitLocalization.unitId, entity.id),
				primaryLanguage ? eq(unitLocalization.language, primaryLanguage) : sql`false`,
			),
		)
		.where(eq(creditAttribution.unitId, base.id))
		.orderBy(creditAttribution.position, creditAttribution.id);
	const subjectAssociations = await database
		.select({
			id: subjectAssociation.id,
			entityEntryId: subjectAssociation.entityId,
			role: subjectAssociation.role,
			position: subjectAssociation.position,
			title: unitLocalization.title,
		})
		.from(subjectAssociation)
		.innerJoin(entity, eq(entity.id, subjectAssociation.entityId))
		.leftJoin(
			unitLocalization,
			and(
				eq(unitLocalization.unitId, entity.id),
				primaryLanguage ? eq(unitLocalization.language, primaryLanguage) : sql`false`,
			),
		)
		.where(eq(subjectAssociation.unitId, base.id))
		.orderBy(subjectAssociation.position, subjectAssociation.id);
	const links = await database
		.select()
		.from(unitLink)
		.where(eq(unitLink.unitId, base.id))
		.orderBy(unitLink.position, unitLink.id);
	const tags = await database
		.select({
			tagId: unitTag.tagId,
			score: unitTagVoteStat.score,
			voteCount: unitTagVoteStat.voteCount,
			pinned: unitTag.pinned,
			position: unitTag.position,
			title: unitLocalization.title,
		})
		.from(unitTag)
		.leftJoin(
			unitTagVoteStat,
			and(
				eq(unitTagVoteStat.unitId, unitTag.unitId),
				eq(unitTagVoteStat.tagId, unitTag.tagId),
			),
		)
		.leftJoin(
			unitLocalization,
			and(
				eq(unitLocalization.unitId, unitTag.tagId),
				primaryLanguage ? eq(unitLocalization.language, primaryLanguage) : sql`false`,
			),
		)
		.where(eq(unitTag.unitId, base.id))
		.orderBy(desc(unitTag.pinned), unitTag.position, unitTag.tagId);
	const variantContext = await getUnitVariantContext(base.id, authorization.profileId);
	const [canEdit, accessDecision, associationDecision] = await Promise.all([
		authorization.unit.canUpdate(base.id),
		authorization.unit.decide(base.id, "unit.access.manage"),
		authorization.unit.decide(base.id, "unit.association.manage"),
	]);
	const publishers = (await getPublisherSummariesByUnitIds([base.id])).get(base.id) ?? [];
	return {
		id: base.id,
		type: base.kind,
		status: base.status,
		visibility: base.visibility,
		language: primaryLanguage,
		contentRating: base.contentRating,
		aiDisclosure: base.aiDisclosure,
		license: parseNullablePublicationLicenseId(base.license),
		postTargetingLocked: base.postTargetingLocked,
		publishedAt: base.publishedAt,
		publishers,
		createdAt: base.createdAt,
		updatedAt: base.updatedAt,
		primaryLanguage,
		releasedOn: await getReleaseDate(kind, base.id),
		avatar: presentImageAsset(
			localizations.find(({ avatarAssetId }) => avatarAssetId)?.avatarAssetId ?? null,
		),
		banner: presentImageAsset(
			localizations.find(({ bannerAssetId }) => bannerAssetId)?.bannerAssetId ?? null,
		),
		cover: presentImageAsset(
			localizations.find(({ coverAssetId }) => coverAssetId)?.coverAssetId ?? null,
		),
		localizations: localizations.map(
			({
				content: _content,
				contentStatus: _status,
				description,
				avatarAssetId,
				bannerAssetId,
				coverAssetId,
				...row
			}) => ({
				...row,
				description: parseNullableDocument(PortableTextDocument, description),
				avatar: presentImageAsset(avatarAssetId),
				banner: presentImageAsset(bannerAssetId),
				cover: presentImageAsset(coverAssetId),
			}),
		),
		credits: credits.map((credit) => ({ ...credit, evidenceUrl: null, note: null })),
		subjectAssociations,
		links: links.map((link) => ({
			...link,
			kind: link.role,
			sourceEntityEntryId: link.sourceEntityId,
		})),
		tags: tags.map((tag) => ({
			...tag,
			id: tag.tagId,
			realmId: null,
			score: toSafeInteger(tag.score ?? 0n, "tag vote score"),
			voteCount: toSafeInteger(tag.voteCount ?? 0n, "tag vote count"),
		})),
		versions:
			variantContext.role === "standalone"
				? [{ id: base.id, kind: "primary", canonicalUnitId: null }]
				: variantContext.role === "main"
					? [
							{ id: base.id, kind: "primary", canonicalUnitId: null },
							...variantContext.variants.map(({ id }) => ({
								id,
								kind: "version",
								canonicalUnitId: base.id,
							})),
						]
					: variantContext.main.state === "available"
						? [
								{
									id: base.id,
									kind: "version",
									canonicalUnitId: variantContext.main.unit.id,
								},
							]
						: [],
		variantContext,
		capabilities: {
			canEdit,
			canManageAccess: accessDecision.allowed,
			canManageAssociations: associationDecision.allowed,
		},
	};
}

export async function listUnits(kind: UnitKind, cursor?: [string, string], limit = 20) {
	const rows = await database
		.select({
			id: unit.id,
			language: unitLocalization.language,
			contentRating: unit.contentRating,
			publishedAt: unit.publishedAt,
			createdAt: unit.createdAt,
			updatedAt: unit.updatedAt,
			title: unitLocalization.title,
			summary: unitLocalization.summary,
			avatarAssetId: resolvedUnitLocalizationImageAssetId(unit.id, "avatar"),
			bannerAssetId: resolvedUnitLocalizationImageAssetId(unit.id, "banner"),
			coverAssetId: firstUnitLocalizationCoverAssetId(unit.id),
		})
		.from(unit)
		.leftJoin(
			unitLocalization,
			and(eq(unitLocalization.unitId, unit.id), isPrimaryUnitLocalization(unit.id)),
		)
		.where(
			and(
				eq(unit.kind, kind),
				eq(unit.status, "published"),
				eq(unit.visibility, "public"),
				eq(unit.moderationStatus, "approved"),
				isNull(unit.deletedAt),
				not(
					exists(
						database
							.select({ id: unitVariant.variantUnitId })
							.from(unitVariant)
							.where(eq(unitVariant.variantUnitId, unit.id)),
					),
				),
				cursor
					? or(
							lt(unit.createdAt, new Date(cursor[0])),
							and(eq(unit.createdAt, new Date(cursor[0])), lt(unit.id, cursor[1])),
						)
					: undefined,
			),
		)
		.orderBy(desc(unit.createdAt), desc(unit.id))
		.limit(limit + 1);
	const publishers = await getPublisherSummariesByUnitIds(rows.map(({ id }) => id));
	return Promise.all(
		rows.map(async ({ avatarAssetId, bannerAssetId, coverAssetId, ...row }) => ({
			...row,
			publishers: publishers.get(row.id) ?? [],
			avatar: presentImageAsset(avatarAssetId),
			banner: presentImageAsset(bannerAssetId),
			cover: presentImageAsset(coverAssetId),
		})),
	);
}

export async function updateUnit(
	kind: UnitKind,
	unitId: string,
	authorization: Authorization<string>,
	body: UpdateUnitInput,
): Promise<UnitDetail> {
	await authorization.unit.ensureCanUpdate(unitId, [["unit"], [kind]]);
	const publishDecision = body.status
		? await authorization.unit.decide(unitId, "unit.publish", ["unit"])
		: undefined;
	await database.transaction(async (tx) => {
		const [updated] = await tx
			.update(unit)
			.set({
				visibility: body.visibility,
				contentRating: body.contentRating,
				aiDisclosure: body.aiDisclosure,
				...(Object.hasOwn(body, "license") ? { license: body.license } : {}),
			})
			.where(
				and(
					eq(unit.id, unitId),
					eq(unit.kind, kind),
					eq(unit.updatedAt, new Date(body.updatedAt)),
				),
			)
			.returning({ id: unit.id, status: unit.status });
		if (!updated) {
			const [current] = await tx
				.select({ updatedAt: unit.updatedAt })
				.from(unit)
				.where(eq(unit.id, unitId))
				.limit(1);
			if (!current) throw new UnitNotFound(kind);
			throw new UnitChanged(current.updatedAt);
		}
		const details = body.details ?? {};
		const common = body.unit ?? {};
		const releasedOn =
			common.releasedOn === undefined
				? undefined
				: common.releasedOn === null
					? null
					: common.releasedOn;
		if (common.primaryLanguage) {
			const language = common.primaryLanguage;
			const [localization] = await tx
				.select({ language: unitLocalization.language })
				.from(unitLocalization)
				.where(
					and(
						eq(unitLocalization.unitId, unitId),
						eq(unitLocalization.language, language),
					),
				)
				.limit(1);
			if (!localization) throw new UnitPrimaryLanguageMissing();
			await makePrimaryUnitLocalization(tx, unitId, language);
		}
		if (kind === "book")
			await tx
				.update(book)
				.set({
					isbn13: details.isbn13,
					publicationDate:
						details.publicationDate === undefined
							? releasedOn
							: details.publicationDate,
					pageCount: details.pageCount,
					format: details.format,
					licensed: details.licensed,
				})
				.where(eq(book.id, unitId));
		if (kind === "software")
			await tx
				.update(software)
				.set({
					releaseDate: releasedOn,
					versionLabel: details.versionLabel,
					licensed: details.licensed,
				})
				.where(eq(software.id, unitId));
		if (kind === "media")
			await tx
				.update(media)
				.set({
					releaseDate: releasedOn,
					kind: details.kind,
					runtimeMinutes: details.runtimeMinutes,
					episodeCount: details.episodeCount,
					seasonCount: details.seasonCount,
					licensed: details.licensed,
				})
				.where(eq(media.id, unitId));
		const revision = await recordUnitRevision(tx, {
			unitId,
			actorProfileId: authorization.profileId,
			event: "update",
		});
		if (body.status) {
			await transitionUnitStatus(tx, {
				unitId,
				toStatus: body.status,
				actor: { kind: "profile", profileId: authorization.profileId },
				authorization: {
					kind: "interactive",
					publishAllowed: publishDecision?.allowed ?? false,
				},
				revisionId: revision.revisionId,
			});
		}
		await ensureUnitVariantLifecycle(tx, unitId);
	});
	return getUnit(kind, unitId, authorization);
}

export async function deleteUnit(
	kind: UnitKind,
	unitId: string,
	authorization: Authorization<string>,
): Promise<void> {
	await authorization.unit.ensure(unitId, "unit.delete");
	await database.transaction(async (tx) => {
		const [deleted] = await tx
			.update(unit)
			.set({ deletedAt: new Date() })
			.where(and(eq(unit.id, unitId), eq(unit.kind, kind)))
			.returning({ id: unit.id });
		if (!deleted) throw new UnitNotFound(kind);
		await ensureUnitVariantLifecycle(tx, unitId);
		await recordUnitRevision(tx, {
			unitId,
			actorProfileId: authorization.profileId,
			event: "delete",
		});
	});
}

export async function upsertLocalization(
	unitId: string,
	authorization: Authorization<string>,
	input: {
		language: ContentLanguage;
		title: string;
		summary?: string;
		description?: PortableTextDocumentValue;
		avatarAssetId?: string | null;
		bannerAssetId?: string | null;
		coverAssetId?: string | null;
	},
): Promise<void> {
	await authorization.unit.ensureCanUpdate(unitId, [["localizations", input.language]]);
	await database.transaction(async (tx) => {
		await ensureImageAssetsAttachable(
			tx,
			authorization.profileId,
			unitLocalizationImageAssetIds(input),
		);
		await tx
			.insert(unitLocalization)
			.values({ unitId, ...input })
			.onConflictDoUpdate({
				target: [unitLocalization.unitId, unitLocalization.language],
				set: {
					title: input.title,
					summary: input.summary,
					description: input.description,
					...(Object.hasOwn(input, "avatarAssetId")
						? { avatarAssetId: input.avatarAssetId }
						: {}),
					...(Object.hasOwn(input, "bannerAssetId")
						? { bannerAssetId: input.bannerAssetId }
						: {}),
					...(Object.hasOwn(input, "coverAssetId")
						? { coverAssetId: input.coverAssetId }
						: {}),
				},
			});
		await recordUnitRevision(tx, {
			unitId,
			actorProfileId: authorization.profileId,
			event: "update",
		});
	});
}
