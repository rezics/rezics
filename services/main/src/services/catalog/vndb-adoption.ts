import {
	prepareCatalogSourceChildCorrespondence,
	sealCatalogSourceChildCorrespondence,
} from "./source-child-correspondence";
import { createHash } from "node:crypto";
import type { DatabaseTransaction } from "../database";
import {
	softwareParticipationSourceOccurrence,
	softwareVisualNovel,
} from "../database/schema/catalog-software";
import { CatalogFactTables } from "../database/schema/catalog-facts";
import { acceptCatalogSourceInitialization } from "./source-bindings";
import { type CatalogSourceReceipt, recordCatalogSourceDocument } from "./source-observations";
import { inspectExistingSourceBinding } from "./source-adoption";
import { VndbCatalogContractSha256, VndbVnSchema, vndbLanguage, vndbSourceKey } from "./vndb";
import type { z } from "zod";
import { recordVndbSoftwareScalarOccurrence } from "./vndb-release";
import { appendVndbVnNames, appendVndbDisplayName } from "./vndb-names";
import { createSoftwareParticipationContext } from "./software-contexts";
import {
	SoftwareContentDetailsSchema,
	createNativeSoftwareContent,
	reviseSoftwareContent,
} from "./software";
import { appendVndbSemantics } from "./vndb-semantics";
import { appendVndbParticipation } from "./vndb-participation";

/** VN identity and snapshot-local participation observations; staff adoption remains separate. */
export async function adoptVndbVn(
	tx: DatabaseTransaction,
	actor: string,
	receipt: CatalogSourceReceipt,
	bytes: Uint8Array,
) {
	if (
		bytes.byteLength > 8_000_000 ||
		createHash("sha256").update(bytes).digest("hex") !== receipt.contentSha256
	)
		throw new Error("VNDB projection bytes differ from the archived observation");
	if (receipt.contractSha256 !== VndbCatalogContractSha256)
		throw new Error("VNDB source contract has not been reviewed for this mapper");
	const record = VndbVnSchema.parse(
		JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)),
	);
	const source = vndbSourceKey(record.id);
	if (
		receipt.key.source !== source.source ||
		receipt.key.objectType !== source.objectType ||
		receipt.key.externalId !== source.externalId
	)
		throw new TypeError("VNDB payload identity differs from its source key");
	const observation = await recordCatalogSourceDocument(tx, receipt, bytes);
	return writeVndbVnProjection(tx, actor, record, observation);
}

/** @internal API and dump projections share canonical native writers and preserve exact evidence paths. */
export async function writeVndbVnProjection(
	tx: DatabaseTransaction,
	actor: string,
	record: z.output<typeof VndbVnSchema>,
	observation: Awaited<ReturnType<typeof recordCatalogSourceDocument>>,
	sourcePath: (path: string) => string = (path) => path,
) {
	const existing = await inspectExistingSourceBinding(tx, actor, observation, "vndb.vn.2");
	if (existing && existing.status !== "initialize_reference") return existing;
	const details = vndbVnDetails(record);
	const identity = existing
		? {
				...existing.reference,
				revision: (
					await reviseSoftwareContent(tx, existing.reference, actor, existing.revision, details)
				).revision,
			}
		: await createNativeSoftwareContent(tx, actor, {
				name: { value: record.title, languageTag: null },
				details,
			});
	const childScope = await prepareCatalogSourceChildCorrespondence(tx, actor, {
		sourceRecordId: observation.record.id,
		snapshotId: observation.snapshot.id,
		reference: identity,
		mappingVersion: "vndb.vn.2",
	});
	await tx.insert(softwareVisualNovel).values({ id: identity.id }).onConflictDoNothing();
	const displayRevision = await appendVndbDisplayName(
		tx,
		identity,
		actor,
		identity.revision,
		record.title,
		observation,
		"vndb.vn.name",
		sourcePath("/title"),
		"nameId" in identity ? { id: identity.nameId, revision: identity.nameRevision } : undefined,
	);
	await recordVndbSoftwareScalarOccurrence(tx, observation, identity.id, sourcePath("/"));
	let revision = await appendVndbVnNames(
		tx,
		identity,
		actor,
		displayRevision,
		record,
		observation,
		sourcePath,
	);
	for (const [position, edition] of (record.editions ?? []).entries()) {
		const languageTag = edition.lang === null ? null : vndbLanguage(edition.lang);
		const context = await createSoftwareParticipationContext(tx, identity, actor, {
			label: edition.name || null,
			languageTag,
			state: "active",
		});
		await tx.insert(softwareParticipationSourceOccurrence).values({
			...childScope,
			sourceRecordId: observation.record.id,
			snapshotId: observation.snapshot.id,
			namespace: "editions",
			localKey: String(edition.eid),
			contentId: identity.id,
			contextId: context.contextId,
			contextRevision: context.revision,
			sourcePointer: sourcePath(`/editions/${position}`),
			sourceLabel: edition.name,
			sourceLanguage: edition.lang,
			sourceLanguageTag: languageTag,
			sourceClaimedOfficial: edition.official,
		});
	}
	await appendVndbParticipation(tx, identity, actor, record, observation, sourcePath);
	if (!existing)
		await tx.insert(CatalogFactTables.software.identifier).values({
			ownerId: identity.id,
			namespace: "vndb.vn",
			value: record.id,
			normalizedValue: record.id,
		});
	revision = await appendVndbSemantics(
		tx,
		identity,
		actor,
		revision,
		record,
		observation,
		sourcePath,
	);
	const reference = { owner: "software" as const, id: identity.id };
	if (existing)
		await acceptCatalogSourceInitialization(tx, actor, {
			sourceRecordId: observation.record.id,
			mappingVersion: "vndb.vn.2",
			path: "/",
			snapshotId: observation.snapshot.id,
			reference,
			expectedBaselineRevision: existing.revision,
			finalRevision: revision,
		});
	else
		await sealCatalogSourceChildCorrespondence(tx, actor, {
			sourceRecordId: observation.record.id,
			mappingVersion: "vndb.vn.2",
			path: "/",
			snapshotId: observation.snapshot.id,
			reference,
		});
	return {
		status: "created" as const,
		reference: { owner: "software" as const, id: identity.id },
		revision,
		snapshotId: observation.snapshot.id,
	};
}

/** @internal VNDB content fields use the canonical native scalar contract. */
export function vndbVnDetails(record: z.output<typeof VndbVnSchema>) {
	return SoftwareContentDetailsSchema.parse({
		originalLanguageTag: record.olang ? vndbLanguage(record.olang) : null,
		developmentStatus:
			record.devstatus === 0
				? ("finished" as const)
				: record.devstatus === 1
					? ("in_development" as const)
					: record.devstatus === 2
						? ("cancelled" as const)
						: null,
		description: record.description ?? null,
	});
}
