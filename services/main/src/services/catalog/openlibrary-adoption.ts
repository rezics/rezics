import { createHash } from "node:crypto";
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { DatabaseTransaction } from "../database";
import { catalogSourceRecord, catalogSourceMappingClaim } from "../database/schema/catalog-source";
import {
	publishingPublication,
	publishingPublicationWork,
	publishingReleaseEvent,
	publishingWork,
} from "../database/schema/catalog-publishing";
import { CatalogFactTables } from "../database/schema/catalog-facts";
import { publishingIdentity } from "../database/schema/catalog-identity";
import { type CatalogSourceReceipt, recordCatalogSourceDocument } from "./source-observations";
import { inspectExistingSourceBinding } from "./source-adoption";
import {
	OpenLibraryEditionSchema,
	OpenLibraryWorkSchema,
	openLibraryDate,
	openLibrarySourceKey,
} from "./openlibrary";
import { addCatalogName, createCatalogIdentity } from "./storage";
import { bindCatalogSourceIdentity } from "./source-bindings";

/** Pinned Open Library type-contract commit; its field artifacts remain in the source inventory. */
export const OpenLibraryContractSha256 =
	"837ebff80ad04e255691c649c9058f86f23eb76bb139e87c05f01e09a53a17d7";
export const OpenLibraryMappingVersion = "openlibrary.dc153f22c728ad4e2e414867363805a032c64a6b.1";

async function sourceWorkReferences(
	tx: DatabaseTransaction,
	actor: string,
	keys: readonly string[],
) {
	const ordered = [...new Set(keys)];
	for (const key of ordered)
		if (openLibrarySourceKey(key).objectType !== "work")
			throw new TypeError("Edition Work reference has another object type");
	const found = new Map<string, { owner: "publishing"; id: string }>();
	const binding = CatalogFactTables.publishing.sourceBinding;
	for (let offset = 0; offset < ordered.length; offset += 128) {
		const batch = ordered.slice(offset, offset + 128);
		const rows = await tx
			.select({
				externalId: catalogSourceRecord.externalId,
				id: publishingIdentity.id,
				shape: publishingIdentity.shape,
				creator: publishingIdentity.createdByAuthUserId,
				visibility: publishingIdentity.visibility,
				status: publishingIdentity.status,
				moderation: publishingIdentity.moderationStatus,
			})
			.from(catalogSourceRecord)
			.innerJoin(
				catalogSourceMappingClaim,
				and(
					eq(catalogSourceMappingClaim.sourceRecordId, catalogSourceRecord.id),
					eq(catalogSourceMappingClaim.path, "/"),
					eq(catalogSourceMappingClaim.owner, "publishing"),
				),
			)
			.innerJoin(
				binding,
				and(
					eq(binding.sourceRecordId, catalogSourceMappingClaim.sourceRecordId),
					eq(binding.mappingKey, catalogSourceMappingClaim.mappingKey),
				),
			)
			.innerJoin(publishingIdentity, eq(publishingIdentity.id, binding.ownerId))
			.where(
				and(
					eq(catalogSourceRecord.source, "openlibrary"),
					eq(catalogSourceRecord.objectType, "work"),
					inArray(catalogSourceRecord.externalId, batch),
					isNull(publishingIdentity.deletedAt),
				),
			)
			.limit(batch.length);
		for (const row of rows) {
			if (
				row.shape !== "work" ||
				(row.creator !== actor &&
					(row.visibility === "private" ||
						row.status !== "published" ||
						row.moderation !== "approved"))
			)
				throw new Error("Source Work dependency is not available to this actor");
			found.set(row.externalId, { owner: "publishing", id: row.id });
		}
	}
	return ordered.map((key) => {
		const reference = found.get(key);
		if (!reference) throw new Error(`Unresolved source Work dependency: ${key}`);
		return reference;
	});
}

/** Dependency-aware Work/Edition projection; it does not invent authors or intermediate text versions. */
export async function adoptOpenLibraryRecord(
	tx: DatabaseTransaction,
	actor: string,
	receipt: CatalogSourceReceipt,
	bytes: Uint8Array,
) {
	if (
		bytes.byteLength > 8_000_000 ||
		createHash("sha256").update(bytes).digest("hex") !== receipt.contentSha256
	)
		throw new Error("Open Library projection bytes differ from the archived observation");
	if (receipt.contractSha256 !== OpenLibraryContractSha256)
		throw new Error("Open Library source contract has not been reviewed for this mapper");
	const raw: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
	const isWork = receipt.key.objectType === "work";
	const record = isWork ? OpenLibraryWorkSchema.parse(raw) : OpenLibraryEditionSchema.parse(raw);
	const source = openLibrarySourceKey(record.key);
	if (
		source.source !== receipt.key.source ||
		source.objectType !== receipt.key.objectType ||
		source.externalId !== receipt.key.externalId
	)
		throw new TypeError("Open Library payload identity differs from its source key");
	const observation = await recordCatalogSourceDocument(tx, receipt, bytes);
	const existing = await inspectExistingSourceBinding(
		tx,
		actor,
		observation,
		OpenLibraryMappingVersion,
	);
	if (existing) return existing;
	const edition = isWork ? null : OpenLibraryEditionSchema.parse(raw);
	const works = await sourceWorkReferences(
		tx,
		actor,
		(edition?.works ?? []).map(({ key }) => key),
	);
	const identity = await createCatalogIdentity(
		tx,
		{ owner: "publishing", shape: isWork ? "work" : "publication" },
		actor,
	);
	if (isWork) await tx.insert(publishingWork).values({ id: identity.id });
	else
		await tx.insert(publishingPublication).values({
			id: identity.id,
			pageCount: edition?.number_of_pages ?? null,
			paginationText: edition?.pagination ?? null,
		});
	let revision = identity.revision;
	if (record.title)
		revision = (
			await addCatalogName(tx, identity, actor, revision, {
				kind: "source-primary",
				languageTag: null,
				value: record.title,
			})
		).revision;
	for (let offset = 0; offset < works.length; offset += 128)
		await tx.insert(publishingPublicationWork).values(
			works.slice(offset, offset + 128).map((work, position) => ({
				publicationId: identity.id,
				workId: work.id,
				position: offset + position,
			})),
		);
	const date = openLibraryDate(edition?.publish_date);
	if (edition && (edition.publish_date || edition.publishers?.length)) {
		const publishers = edition.publishers?.length ? edition.publishers : [null];
		for (let offset = 0; offset < publishers.length; offset += 128)
			await tx.insert(publishingReleaseEvent).values(
				publishers.slice(offset, offset + 128).map((publisherCredit) => ({
					publicationId: identity.id,
					publisherCredit,
					dateYear: date?.year ?? null,
					dateMonth: date?.month ?? null,
					dateDay: date?.day ?? null,
					dateText: edition.publish_date,
				})),
			);
	}
	const identifiers = [
		{ namespace: `openlibrary.${source.objectType}`, value: source.externalId },
		...(edition?.isbn_10 ?? []).map((value) => ({ namespace: "isbn10", value })),
		...(edition?.isbn_13 ?? []).map((value) => ({ namespace: "isbn13", value })),
		...Object.entries(edition?.identifiers ?? {}).flatMap(([namespace, values]) =>
			values.map((value) => ({ namespace: `openlibrary.identifier.${namespace}`, value })),
		),
	];
	for (let offset = 0; offset < identifiers.length; offset += 128)
		await tx.insert(CatalogFactTables.publishing.identifier).values(
			identifiers.slice(offset, offset + 128).map((identifier) => ({
				ownerId: identity.id,
				...identifier,
				normalizedValue: identifier.value,
			})),
		);
	await bindCatalogSourceIdentity(tx, actor, {
		mappingVersion: OpenLibraryMappingVersion,
		sourceRecordId: observation.record.id,
		snapshotId: observation.snapshot.id,
		path: "/",
		reference: { owner: "publishing", id: identity.id },
	});
	return {
		status: "created" as const,
		reference: { owner: "publishing" as const, id: identity.id },
		revision,
		snapshotId: observation.snapshot.id,
	};
}
