import { and, eq, inArray, isNull, sql, type SQLWrapper } from "drizzle-orm";
import { z } from "zod";
import { Value } from "typebox/value";
import { PortableTextDocument } from "@rezics/block";
import { parseContentLanguageTag } from "@rezics/content-language";
import type { AvatarReference, PresentedAvatar } from "@rezics/avatar";
import { database, type DatabaseTransaction } from "../database";
import { entityIdentity } from "../database/schema/catalog-identity";
import {
	entityPresentation,
	entityPresentationRevision,
} from "../database/schema/entity-presentation";
import { CatalogNameTables } from "../database/schema/catalog-names";
import { CatalogNameValuesSchema } from "../catalog/name-contracts";
import { CatalogReferenceNotFound, CatalogRevisionConflict } from "../catalog/storage";
import { avatarReferenceFromColumns, avatarReferenceToColumns } from "../units/localization";
import { presentAvatar } from "../units/avatar";
import { presentImageAsset } from "../units/service";
import { requireParticipation, type ParticipationAuthority } from "./policy";
import { ensureImageAssetsAttachable } from "../api/image-assets/service";

const names = CatalogNameTables.entity.name;
const nameVersions = CatalogNameTables.entity.nameRevision;

/** Indexed public identity name projection; no private Auth information is selected. @internal */
export function publicEntityName(entityId: string | SQLWrapper) {
	return sql<string | null>`coalesce((select ${nameVersions.value} from ${entityPresentation}
		join ${nameVersions} on ${nameVersions.ownerId} = ${entityPresentation.entityId} and ${nameVersions.id} = ${entityPresentation.nameId} and ${nameVersions.revision} = ${entityPresentation.nameRevision}
		where ${entityPresentation.entityId} = ${entityId} order by ${entityPresentation.language} limit 1), (select ${names.value} from ${names}
		where ${names.ownerId} = ${entityId} and ${names.state} = 'active'
		order by ${names.id} limit 1))`;
}

export interface PublicEntitySummary {
	id: string;
	kind: "entity";
	language: string;
	title: string | null;
	summary: string | null;
	avatar: PresentedAvatar | null;
	slugAddress: null;
}

/** Bounded author-card projection; full biographies and private account data are excluded. @internal */
export async function getPublicEntitySummariesByIds(
	entityIds: readonly string[],
	languages: readonly string[] = [],
): Promise<Map<string, PublicEntitySummary>> {
	const ids = [...new Set(entityIds)];
	if (ids.length > 512 || languages.length > 32)
		throw new RangeError("Entity summary batch exceeds its bound");
	if (!ids.length) return new Map();
	const order = languages.length
		? sql`coalesce(array_position(array[${sql.join(
				languages.map((language) => sql`${parseContentLanguageTag(language).tag}`),
				sql`, `,
			)}]::text[], ${entityPresentation.language}), 2147483647)`
		: sql`0`;
	const presentation = database
		.select({
			language: entityPresentation.language,
			summary: entityPresentation.summary,
			avatarType: entityPresentation.avatarType,
			avatarAssetId: entityPresentation.avatarAssetId,
			avatarEmoji: entityPresentation.avatarEmoji,
			avatarIconPrefix: entityPresentation.avatarIconPrefix,
			avatarIconName: entityPresentation.avatarIconName,
			nameId: entityPresentation.nameId,
			nameRevision: entityPresentation.nameRevision,
		})
		.from(entityPresentation)
		.where(eq(entityPresentation.entityId, entityIdentity.id))
		.orderBy(order, entityPresentation.language)
		.limit(1)
		.as("chosen_entity_presentation");
	const rows = await database
		.select({
			id: entityIdentity.id,
			language: sql<string>`coalesce(${presentation.language}, 'und')`,
			title: sql<
				string | null
			>`coalesce(${nameVersions.value}, ${publicEntityName(entityIdentity.id)})`,
			summary: presentation.summary,
			avatarType: presentation.avatarType,
			avatarAssetId: presentation.avatarAssetId,
			avatarEmoji: presentation.avatarEmoji,
			avatarIconPrefix: presentation.avatarIconPrefix,
			avatarIconName: presentation.avatarIconName,
		})
		.from(entityIdentity)
		.leftJoinLateral(presentation, sql`true`)
		.leftJoin(
			nameVersions,
			and(
				eq(nameVersions.ownerId, entityIdentity.id),
				eq(nameVersions.id, presentation.nameId),
				eq(nameVersions.revision, presentation.nameRevision),
			),
		)
		.where(
			and(
				inArray(entityIdentity.id, ids),
				eq(entityIdentity.status, "published"),
				eq(entityIdentity.visibility, "public"),
				isNull(entityIdentity.deletedAt),
			),
		);
	return new Map(
		rows.map((row) => [
			row.id,
			{
				id: row.id,
				kind: "entity" as const,
				language: row.language,
				title: row.title,
				summary: row.summary,
				avatar: presentAvatar(avatarReferenceFromColumns(row)),
				slugAddress: null,
			},
		]),
	);
}

/** @alpha Public native Entity presentation, independent of account existence or login state. */
export async function readPublicEntityProfile(
	entityId: string,
	requestedLanguages: readonly string[] = [],
) {
	z.uuid().parse(entityId);
	if (requestedLanguages.length > 32)
		throw new Error("At most 32 language preferences are supported");
	const languages = requestedLanguages.map((language) => parseContentLanguageTag(language).tag);
	const [identity] = await database
		.select({
			id: entityIdentity.id,
			status: entityIdentity.status,
			visibility: entityIdentity.visibility,
			createdAt: entityIdentity.createdAt,
			updatedAt: entityIdentity.updatedAt,
		})
		.from(entityIdentity)
		.where(
			and(
				eq(entityIdentity.id, entityId),
				eq(entityIdentity.status, "published"),
				eq(entityIdentity.visibility, "public"),
				isNull(entityIdentity.deletedAt),
			),
		)
		.limit(1);
	if (!identity) throw new CatalogReferenceNotFound("Public Entity is unavailable");
	const languageOrder = languages.length
		? sql`coalesce(array_position(array[${sql.join(
				languages.map((language) => sql`${language}`),
				sql`, `,
			)}]::text[], ${entityPresentation.language}), 2147483647)`
		: sql`0`;
	const [presentation] = await database
		.select()
		.from(entityPresentation)
		.where(eq(entityPresentation.entityId, entityId))
		.orderBy(languageOrder, entityPresentation.language)
		.limit(1);
	const [name] =
		presentation?.nameId && presentation.nameRevision
			? await database
					.select({ value: nameVersions.value, language: nameVersions.languageTag })
					.from(nameVersions)
					.where(
						and(
							eq(nameVersions.ownerId, entityId),
							eq(nameVersions.id, presentation.nameId),
							eq(nameVersions.revision, presentation.nameRevision),
						),
					)
					.limit(1)
			: await database
					.select({ value: names.value, language: names.languageTag })
					.from(names)
					.where(
						and(
							eq(names.ownerId, entityId),
							eq(names.state, "active"),
							presentation?.nameId ? eq(names.id, presentation.nameId) : undefined,
						),
					)
					.orderBy(names.id)
					.limit(1);
	return {
		...identity,
		language: presentation?.language ?? name?.language ?? null,
		name: name?.value ?? null,
		avatar: presentAvatar(presentation ? avatarReferenceFromColumns(presentation) : null),
		banner: await presentImageAsset(presentation?.bannerAssetId ?? null),
		summary: presentation?.summary ?? null,
		description:
			presentation?.description == null
				? null
				: Value.Decode(PortableTextDocument, presentation.description),
		revision: presentation?.revision ?? 0,
		updatedAt: presentation?.updatedAt ?? identity.updatedAt,
	};
}

/** @alpha Authenticated Entity presentation edit. Catalog metadata editing never grants this capability. */
export async function updateEntityPresentation(
	tx: DatabaseTransaction,
	authority: ParticipationAuthority,
	input: {
		language: string;
		expectedRevision: number;
		name?: string;
		avatar?: AvatarReference | null;
		bannerAssetId?: string | null;
		summary?: string | null;
		description?: unknown;
	},
) {
	const language = parseContentLanguageTag(input.language).tag;
	z.number()
		.int()
		.nonnegative()
		.max(Number.MAX_SAFE_INTEGER - 1)
		.parse(input.expectedRevision);
	const entityId = authority.actingEntityId;
	await requireParticipation(tx, authority, "entity.publish", { owner: "entity", id: entityId });
	const [identity] = await tx
		.select({ id: entityIdentity.id })
		.from(entityIdentity)
		.where(and(eq(entityIdentity.id, entityId), isNull(entityIdentity.deletedAt)))
		.limit(1)
		.for("update");
	if (!identity) throw new CatalogReferenceNotFound("Entity is unavailable");
	const [current] = await tx
		.select()
		.from(entityPresentation)
		.where(
			and(eq(entityPresentation.entityId, entityId), eq(entityPresentation.language, language)),
		)
		.limit(1);
	if ((current?.revision ?? 0) !== input.expectedRevision)
		throw new CatalogRevisionConflict("Entity presentation changed");
	if (!current) {
		const variants = await tx
			.select({ language: entityPresentation.language })
			.from(entityPresentation)
			.where(eq(entityPresentation.entityId, entityId))
			.limit(32);
		if (variants.length >= 32) throw new Error("Entity presentation language limit reached");
	}
	await ensureImageAssetsAttachable(tx, entityId, [
		{
			assetId: input.avatar?.type === "image" ? input.avatar.image.assetId : undefined,
			role: "avatar",
		},
		{ assetId: input.bannerAssetId, role: "banner" },
	]);
	let nameId = current?.nameId;
	let nameRevision = current?.nameRevision;
	if (input.name !== undefined) {
		const name = z.string().trim().min(1).max(120).parse(input.name);
		const values = CatalogNameValuesSchema.parse({
			value: name,
			languageTag: language,
			kind: "display",
			primaryForLanguage: true,
		});
		if (nameId) {
			const [previous] = await tx
				.select({ revision: names.revision })
				.from(names)
				.where(and(eq(names.ownerId, entityId), eq(names.id, nameId)))
				.limit(1)
				.for("update");
			if (!previous) throw new CatalogReferenceNotFound("Display name is unavailable");
			if (previous.revision !== nameRevision)
				throw new CatalogRevisionConflict("The selected display name changed independently");
			await tx
				.update(names)
				.set({
					...values,
					revision: previous.revision + 1,
					recordedByAuthUserId: authority.principal.authUserId,
					recordedAt: new Date(),
				})
				.where(and(eq(names.ownerId, entityId), eq(names.id, nameId)));
			nameRevision = previous.revision + 1;
		} else {
			const [created] = await tx
				.insert(names)
				.values({
					...values,
					ownerId: entityId,
					recordedByAuthUserId: authority.principal.authUserId,
				})
				.returning({ id: names.id });
			if (!created) throw new Error("Display name insertion failed");
			nameId = created.id;
			nameRevision = 1;
		}
	}
	const description =
		input.description === undefined
			? (current?.description ?? null)
			: input.description === null
				? null
				: Value.Decode(PortableTextDocument, input.description);
	if (description !== null && Buffer.byteLength(JSON.stringify(description), "utf8") > 1_048_576)
		throw new Error("Entity presentation description is too large");
	const values = {
		entityId,
		language,
		nameId: nameId ?? null,
		nameRevision: nameRevision ?? null,
		...(input.avatar === undefined
			? current
				? avatarReferenceToColumns(avatarReferenceFromColumns(current))
				: avatarReferenceToColumns(null)
			: avatarReferenceToColumns(input.avatar)),
		bannerAssetId:
			input.bannerAssetId === undefined ? (current?.bannerAssetId ?? null) : input.bannerAssetId,
		summary:
			input.summary === undefined
				? (current?.summary ?? null)
				: input.summary === null
					? null
					: z.string().max(500).parse(input.summary),
		description,
		revision: input.expectedRevision + 1,
		updatedAt: new Date(),
	};
	await tx
		.insert(entityPresentation)
		.values(values)
		.onConflictDoUpdate({
			target: [entityPresentation.entityId, entityPresentation.language],
			set: values,
		});
	await tx
		.insert(entityPresentationRevision)
		.values({
			entityId,
			language,
			revision: values.revision,
			snapshot: { ...values, updatedAt: values.updatedAt.toISOString() },
			operatorAuthUserId: authority.principal.authUserId,
		});
	return { entityId, language, revision: values.revision };
}
