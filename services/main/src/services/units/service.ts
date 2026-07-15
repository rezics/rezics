import { and, desc, eq, isNull, lt, or, sql } from "drizzle-orm";
import { fileTypeFromBuffer } from "file-type";
import type { JsonValue, PortableText } from "@rezics/portable-text";
import type { Static } from "elysia";

import type { Authorization } from "../authorization";
import type { UploadAuthorization } from "../authorization/upload/authorization";
import { isPubliclyReadableUnit } from "../authorization/unit/policy";
import { database } from "../database";
import {
	book,
	entity,
	game,
	media,
	unit,
	unitAlias,
	unitAliasVote,
	unitCollaborator,
	unitCredit,
	unitLink,
	unitLocalization,
	unitTag,
	unitTagVote,
	unitVariant,
} from "../database/schema";
import { isStorageNotFound, storage } from "../storage";
import { UnitDetailResponse } from "../api/schema/response";
import {
	UnitChanged,
	UnitCoverContentMismatch,
	UnitCoverIncomplete,
	UnitCoverKeyForbidden,
	UnitCoverUnsupported,
	UnitNotFound,
	UnitOriginalLanguageMissing,
} from "./errors";
import { recordUnitRevision } from "./history";

export type UnitKind = "book" | "game" | "media";
export type UnitDetail = Static<typeof UnitDetailResponse>;

export interface CreateUnitInput {
	localization: {
		language: string;
		title: string;
		summary?: string;
		description?: PortableText;
	};
	slug?: string;
	visibility?: "public" | "unlisted" | "private";
	contentRating?: "general" | "r15" | "r18" | "r18g";
	aiDisclosure?: "unknown" | "none" | "ai_assisted" | "ai_originated" | "machine_generated";
	license?: string | null;
	metadata?: Record<string, unknown>;
	cover?: CoverAssetInput | null;
}

interface CoverAssetInput {
	key: string;
	focalPoint: { x: number; y: number };
}

export interface UpdateUnitInput {
	updatedAt: string;
	status?: "draft" | "published" | "archived";
	visibility?: "public" | "unlisted" | "private";
	contentRating?: "general" | "r15" | "r18" | "r18g";
	aiDisclosure?: "unknown" | "none" | "ai_assisted" | "ai_originated" | "machine_generated";
	license?: string | null;
	metadata?: Record<string, JsonValue>;
	cover?: CoverAssetInput | null;
	unit?: {
		originalLanguage?: string;
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

async function ensureAttachableCover(
	authorization: UploadAuthorization<string>,
	cover?: CoverAssetInput | null,
): Promise<void> {
	if (!cover) return;
	if (!authorization.owns(cover.key)) throw new UnitCoverKeyForbidden();
	try {
		const object = await storage.head({ Key: cover.key });
		if (
			!object.ContentLength ||
			object.ContentLength > 10_485_760 ||
			!object.ContentType ||
			!["image/avif", "image/jpeg", "image/png", "image/webp"].includes(object.ContentType)
		)
			throw new UnitCoverUnsupported();
		const stored = await storage.get({ Key: cover.key, Range: "bytes=0-4095" });
		const bytes = await stored.Body?.transformToByteArray();
		const detected = bytes ? await fileTypeFromBuffer(bytes) : undefined;
		if (!detected || detected.mime !== object.ContentType) throw new UnitCoverContentMismatch();
	} catch (error) {
		if (isStorageNotFound(error)) throw new UnitCoverIncomplete();
		throw error;
	}
}

export async function presentUnitCover(
	cover: { key: string | null; x: number | null; y: number | null },
	includeKey = false,
) {
	if (!cover.key || cover.x === null || cover.y === null) return null;
	return {
		url: await storage.presignGet({ Key: cover.key }),
		focalPoint: { x: cover.x, y: cover.y },
		...(includeKey ? { key: cover.key } : {}),
	};
}

export async function resolveUnitSlug(kind: UnitKind, slug: string) {
	const [resolved] = await database
		.select({ id: unit.id, kind: unit.kind })
		.from(unit)
		.where(and(eq(unit.kind, kind), eq(unit.slug, slug), isNull(unit.deletedAt)))
		.limit(1);
	if (!resolved) throw new UnitNotFound();
	return resolved;
}

export async function createUnit(
	kind: UnitKind,
	authorization: Authorization<string>,
	input: CreateUnitInput,
): Promise<UnitDetail> {
	await ensureAttachableCover(authorization.upload, input.cover);
	const ownerId = authorization.profileId;
	const unitId = await database.transaction(async (tx) => {
		const stem = input.localization.title
			.normalize("NFKD")
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-|-$/g, "")
			.slice(0, 64);
		const slug = input.slug ?? `${stem || "unit"}-${crypto.randomUUID().slice(0, 8)}`;
		const [created] = await tx
			.insert(unit)
			.values({
				kind,
				slug,
				visibility: input.visibility ?? "public",
				contentRating: input.contentRating ?? "general",
				aiDisclosure: input.aiDisclosure ?? "unknown",
				license: input.license,
				metadata: input.metadata,
				coverKey: input.cover?.key,
				coverFocalX: input.cover?.focalPoint.x,
				coverFocalY: input.cover?.focalPoint.y,
			})
			.returning({ id: unit.id });
		if (!created) throw new Error("Unit insertion did not return an id");
		if (kind === "book") await tx.insert(book).values({ id: created.id });
		if (kind === "game") await tx.insert(game).values({ id: created.id });
		if (kind === "media") await tx.insert(media).values({ id: created.id, kind: "other" });
		await tx.insert(unitLocalization).values({
			unitId: created.id,
			...input.localization,
			isDefault: true,
		});
		await tx.insert(unitCollaborator).values({
			unitId: created.id,
			profileId: ownerId,
			role: "owner",
			addedByProfileId: ownerId,
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
	if (kind === "game")
		return (
			(
				await database
					.select({ value: game.releaseDate })
					.from(game)
					.where(eq(game.id, unitId))
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
		.orderBy(desc(unitLocalization.isDefault), unitLocalization.language);
	const aliases = await database
		.select({
			id: unitAlias.id,
			unitId: unitAlias.unitId,
			value: unitAlias.value,
			normalizedValue: unitAlias.normalizedValue,
			language: unitAlias.language,
			kind: unitAlias.kind,
			score: sql<number>`coalesce((select sum(${unitAliasVote.value}) from ${unitAliasVote} where ${unitAliasVote.aliasId} = ${unitAlias.id}), 0)::int`,
			voteCount: sql<number>`(select count(*) from ${unitAliasVote} where ${unitAliasVote.aliasId} = ${unitAlias.id})::int`,
			pinned: unitAlias.pinned,
			position: unitAlias.position,
			createdById: unitAlias.createdByProfileId,
			createdAt: unitAlias.createdAt,
			updatedAt: unitAlias.updatedAt,
		})
		.from(unitAlias)
		.where(and(eq(unitAlias.unitId, base.id), isNull(unitAlias.deletedAt)))
		.orderBy(desc(unitAlias.pinned), unitAlias.position, unitAlias.value);
	const defaultLanguage = localizations.find(({ isDefault }) => isDefault)?.language ?? null;
	const credits = await database
		.select({
			id: unitCredit.id,
			entityEntryId: unitCredit.entityId,
			role: unitCredit.role,
			position: unitCredit.position,
			title: unitLocalization.title,
		})
		.from(unitCredit)
		.innerJoin(entity, eq(entity.id, unitCredit.entityId))
		.leftJoin(
			unitLocalization,
			and(
				eq(unitLocalization.unitId, entity.id),
				eq(unitLocalization.language, defaultLanguage ?? ""),
			),
		)
		.where(eq(unitCredit.unitId, base.id))
		.orderBy(unitCredit.position, unitCredit.id);
	const links = await database
		.select()
		.from(unitLink)
		.where(eq(unitLink.unitId, base.id))
		.orderBy(unitLink.position, unitLink.id);
	const tags = await database
		.select({
			tagId: unitTag.tagId,
			score: sql<number>`coalesce((select sum(${unitTagVote.value}) from ${unitTagVote} where ${unitTagVote.unitId} = ${unitTag.unitId} and ${unitTagVote.tagId} = ${unitTag.tagId}), 0)::int`,
			voteCount: sql<number>`(select count(*) from ${unitTagVote} where ${unitTagVote.unitId} = ${unitTag.unitId} and ${unitTagVote.tagId} = ${unitTag.tagId})::int`,
			pinned: unitTag.pinned,
			position: unitTag.position,
			title: unitLocalization.title,
		})
		.from(unitTag)
		.leftJoin(
			unitLocalization,
			and(
				eq(unitLocalization.unitId, unitTag.tagId),
				eq(unitLocalization.language, defaultLanguage ?? ""),
			),
		)
		.where(eq(unitTag.unitId, base.id))
		.orderBy(desc(unitTag.pinned), unitTag.position, unitTag.tagId);
	const variants = await database
		.select()
		.from(unitVariant)
		.where(or(eq(unitVariant.unitId, base.id), eq(unitVariant.canonicalUnitId, base.id)))
		.orderBy(unitVariant.createdAt);
	const canEdit = await authorization.unit.canEdit(base.id);
	return {
		id: base.id,
		type: base.kind,
		slug: base.slug,
		status: base.status,
		visibility: base.visibility,
		language: defaultLanguage,
		contentRating: base.contentRating,
		aiDisclosure: base.aiDisclosure,
		license: base.license,
		publishedAt: base.publishedAt,
		createdAt: base.createdAt,
		updatedAt: base.updatedAt,
		originalLanguage: defaultLanguage,
		releasedOn: await getReleaseDate(kind, base.id),
		cover: await presentUnitCover(
			{ key: base.coverKey, x: base.coverFocalX, y: base.coverFocalY },
			canEdit,
		),
		localizations: localizations.map(
			({ isDefault: _default, content: _content, contentStatus: _status, ...row }) => row,
		),
		aliases: aliases.map((alias) => ({ ...alias, status: "active" })),
		credits: credits.map((credit) => ({ ...credit, evidenceUrl: null, note: null })),
		links: links.map((link) => ({
			...link,
			kind: link.role,
			sourceEntityEntryId: link.sourceEntityId,
		})),
		tags: tags.map((tag) => ({ ...tag, id: tag.tagId, realmId: null })),
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
			coverKey: unit.coverKey,
			coverFocalX: unit.coverFocalX,
			coverFocalY: unit.coverFocalY,
		})
		.from(unit)
		.leftJoin(
			unitLocalization,
			and(eq(unitLocalization.unitId, unit.id), eq(unitLocalization.isDefault, true)),
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
		rows.map(async ({ coverKey, coverFocalX, coverFocalY, ...row }) => ({
			...row,
			cover: await presentUnitCover({ key: coverKey, x: coverFocalX, y: coverFocalY }),
		})),
	);
}

export async function updateUnit(
	kind: UnitKind,
	unitId: string,
	authorization: Authorization<string>,
	body: UpdateUnitInput,
): Promise<UnitDetail> {
	await authorization.unit.ensureCanEdit(unitId);
	await authorization.unit.ensureFieldsUnlocked(unitId, ["/unit", `/${kind}`]);
	await ensureAttachableCover(authorization.upload, body.cover);
	await database.transaction(async (tx) => {
		const cover = body.cover;
		const [updated] = await tx
			.update(unit)
			.set({
				status: body.status,
				visibility: body.visibility,
				contentRating: body.contentRating,
				aiDisclosure: body.aiDisclosure,
				...(Object.hasOwn(body, "license") ? { license: body.license } : {}),
				...(Object.hasOwn(body, "metadata") ? { metadata: body.metadata ?? null } : {}),
				...(Object.hasOwn(body, "cover")
					? {
							coverKey: cover?.key ?? null,
							coverFocalX: cover?.focalPoint.x ?? null,
							coverFocalY: cover?.focalPoint.y ?? null,
						}
					: {}),
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
		if (common.originalLanguage) {
			const language = common.originalLanguage;
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
			if (!localization) throw new UnitOriginalLanguageMissing();
			await tx
				.update(unitLocalization)
				.set({ isDefault: false })
				.where(eq(unitLocalization.unitId, unitId));
			await tx
				.update(unitLocalization)
				.set({ isDefault: true })
				.where(
					and(
						eq(unitLocalization.unitId, unitId),
						eq(unitLocalization.language, language),
					),
				);
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
		if (kind === "game")
			await tx
				.update(game)
				.set({
					releaseDate: releasedOn,
					versionLabel: details.versionLabel,
					licensed: details.licensed,
				})
				.where(eq(game.id, unitId));
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
	await authorization.unit.ensureCanEdit(unitId);
	await authorization.unit.ensureFieldsUnlocked(unitId, ["/unit/status"]);
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
	input: { language: string; title: string; summary?: string; description?: PortableText },
): Promise<void> {
	await authorization.unit.ensureCanEdit(unitId);
	await authorization.unit.ensureFieldsUnlocked(unitId, [`/localizations/${input.language}`]);
	await database.transaction(async (tx) => {
		await tx
			.insert(unitLocalization)
			.values({ unitId, ...input })
			.onConflictDoUpdate({
				target: [unitLocalization.unitId, unitLocalization.language],
				set: { title: input.title, summary: input.summary, description: input.description },
			});
		await recordUnitRevision(tx, {
			unitId,
			actorProfileId: authorization.profileId,
			event: "update",
		});
	});
}
