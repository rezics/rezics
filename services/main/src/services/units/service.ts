import { and, desc, eq, isNull, lt, or } from "drizzle-orm";
import {
	PortableTextDocument,
	parseNullableDocument,
	type PortableTextDocument as PortableTextDocumentValue,
} from "@rezics/block";
import type { Static } from "elysia";

import type { Authorization } from "../authorization";
import { isPubliclyReadableUnit } from "../authorization/unit/policy";
import { database } from "../database";
import { toSafeInteger } from "../database/integer";
import {
	isPrimaryUnitLocalization,
	makePrimaryUnitLocalization,
	firstUnitLocalizationCoverAssetId,
} from "./localization";
import {
	book,
	entity,
	software,
	media,
	unit,
	unitAccessBinding,
	creditAttribution,
	unitLink,
	unitLocalization,
	unitTag,
	unitTagVoteStat,
	unitVariant,
} from "../database/schema";
import { ensureImageAssetAttachable, imageAssetContentUrl } from "../api/image-assets/service";
import { UnitDetailResponse } from "../api/schema/response";
import { UnitChanged, UnitNotFound, UnitPrimaryLanguageMissing } from "./errors";
import { recordUnitRevision } from "./history";
import { insertAddressedUnit } from "./slug-address";
import { generateSlugLabel } from "./slug";

export type UnitKind = "book" | "software" | "media";
export type UnitDetail = Static<typeof UnitDetailResponse>;

export interface CreateUnitInput {
	localization: {
		language: string;
		title: string;
		summary?: string;
		description?: PortableTextDocumentValue;
		coverAssetId?: string | null;
	};
	slug?: string;
	visibility?: "public" | "unlisted" | "private";
	contentRating?: "general" | "r15" | "r18" | "r18g";
	aiDisclosure?: "unknown" | "none" | "ai_assisted" | "ai_originated" | "machine_generated";
	license?: string | null;
}

export interface UpdateUnitInput {
	updatedAt: string;
	status?: "draft" | "published" | "archived";
	visibility?: "public" | "unlisted" | "private";
	contentRating?: "general" | "r15" | "r18" | "r18g";
	aiDisclosure?: "unknown" | "none" | "ai_assisted" | "ai_originated" | "machine_generated";
	license?: string | null;
	unit?: {
		primaryLanguage?: string;
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
		await ensureImageAssetAttachable(tx, ownerId, input.localization.coverAssetId);
		const created = await insertAddressedUnit(tx, {
			kind,
			slugScopeId: ownerId,
			slug: input.slug ?? generateSlugLabel(input.localization.title),
			visibility: input.visibility ?? "public",
			contentRating: input.contentRating ?? "general",
			aiDisclosure: input.aiDisclosure ?? "unknown",
			license: input.license,
		});
		if (kind === "book") await tx.insert(book).values({ id: created.id });
		if (kind === "software") await tx.insert(software).values({ id: created.id });
		if (kind === "media") await tx.insert(media).values({ id: created.id, kind: "other" });
		await tx.insert(unitLocalization).values({
			unitId: created.id,
			...input.localization,
		});
		await tx.insert(unitAccessBinding).values({
			unitId: created.id,
			subjectKind: "profile",
			profileId: ownerId,
			role: "owner",
			scope: [],
			grantedByProfileId: ownerId,
		});
		await recordUnitRevision(tx, {
			unitId: created.id,
			actorProfileId: ownerId,
			event: "create",
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
	if (!isPubliclyReadableUnit(base.status, base.visibility)) {
		await authorization.unit.ensureCanRead(base.id, () => new UnitNotFound(kind));
	}

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
				eq(unitLocalization.language, primaryLanguage ?? ""),
			),
		)
		.where(eq(creditAttribution.unitId, base.id))
		.orderBy(creditAttribution.position, creditAttribution.id);
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
				eq(unitLocalization.language, primaryLanguage ?? ""),
			),
		)
		.where(eq(unitTag.unitId, base.id))
		.orderBy(desc(unitTag.pinned), unitTag.position, unitTag.tagId);
	const variants = await database
		.select()
		.from(unitVariant)
		.where(or(eq(unitVariant.unitId, base.id), eq(unitVariant.canonicalUnitId, base.id)))
		.orderBy(unitVariant.createdAt);
	const canEdit = await authorization.unit.canUpdate(base.id);
	return {
		id: base.id,
		type: base.kind,
		slug: base.slug,
		status: base.status,
		visibility: base.visibility,
		language: primaryLanguage,
		contentRating: base.contentRating,
		aiDisclosure: base.aiDisclosure,
		license: base.license,
		publishedAt: base.publishedAt,
		createdAt: base.createdAt,
		updatedAt: base.updatedAt,
		primaryLanguage,
		releasedOn: await getReleaseDate(kind, base.id),
		cover: presentImageAsset(
			localizations.find(({ coverAssetId }) => coverAssetId)?.coverAssetId ?? null,
		),
		localizations: localizations.map(
			({ content: _content, contentStatus: _status, description, coverAssetId, ...row }) => ({
				...row,
				description: parseNullableDocument(PortableTextDocument, description),
				cover: presentImageAsset(coverAssetId),
			}),
		),
		credits: credits.map((credit) => ({ ...credit, evidenceUrl: null, note: null })),
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
		versions: [
			...(variants.some(({ unitId: id }) => id === base.id)
				? []
				: [{ id: base.id, kind: "primary", canonicalUnitId: null }]),
			...variants.map(({ unitId: id, canonicalUnitId }) => ({
				id,
				kind: "version",
				canonicalUnitId,
			})),
		],
		capabilities: { canEdit },
	};
}

export async function listUnits(kind: UnitKind, cursor?: [string, string], limit = 20) {
	const rows = await database
		.select({
			id: unit.id,
			slug: unit.slug,
			language: unitLocalization.language,
			contentRating: unit.contentRating,
			publishedAt: unit.publishedAt,
			createdAt: unit.createdAt,
			updatedAt: unit.updatedAt,
			title: unitLocalization.title,
			summary: unitLocalization.summary,
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
				isNull(unit.deletedAt),
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
	return Promise.all(
		rows.map(async ({ coverAssetId, ...row }) => ({
			...row,
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
	await database.transaction(async (tx) => {
		const [updated] = await tx
			.update(unit)
			.set({
				status: body.status,
				visibility: body.visibility,
				contentRating: body.contentRating,
				aiDisclosure: body.aiDisclosure,
				...(Object.hasOwn(body, "license") ? { license: body.license } : {}),
				...(body.status === "published" ? { publishedAt: new Date() } : {}),
			})
			.where(
				and(
					eq(unit.id, unitId),
					eq(unit.kind, kind),
					eq(unit.updatedAt, new Date(body.updatedAt)),
				),
			)
			.returning({ id: unit.id });
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
		await recordUnitRevision(tx, {
			unitId,
			actorProfileId: authorization.profileId,
			event: "update",
		});
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
		language: string;
		title: string;
		summary?: string;
		description?: PortableTextDocumentValue;
		coverAssetId?: string | null;
	},
): Promise<void> {
	await authorization.unit.ensureCanUpdate(unitId, [["localizations", input.language]]);
	await database.transaction(async (tx) => {
		await ensureImageAssetAttachable(tx, authorization.profileId, input.coverAssetId);
		await tx
			.insert(unitLocalization)
			.values({ unitId, ...input })
			.onConflictDoUpdate({
				target: [unitLocalization.unitId, unitLocalization.language],
				set: {
					title: input.title,
					summary: input.summary,
					description: input.description,
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
