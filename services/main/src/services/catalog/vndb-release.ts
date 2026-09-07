import { createHash } from "node:crypto";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { softwareContent, softwareVisualNovel } from "../database/schema/catalog-software";
import { bindCatalogSourceIdentity, acceptCatalogSourceInitialization } from "./source-bindings";
import { CatalogFactTables } from "../database/schema/catalog-facts";
import { CatalogPartialDateSchema } from "./contracts";
import { ensureCatalogDefinition } from "./storage";
import { type CatalogSourceReceipt, recordCatalogSourceDocument } from "./source-observations";
import { inspectExistingSourceBinding } from "./source-adoption";
import { bindReferencedSourceIdentity } from "./source-references";
import { VndbCatalogContractSha256, VndbReleaseSchema, vndbSourceKey, vndbLanguage } from "./vndb";
import { vndbPlatform, vndbMedium } from "./vndb-vocabulary";
import {
	createNativeSoftwareRelease,
	reviseSoftwareRelease,
	appendSoftwareReleaseComponents,
	SoftwareReleaseDetailsSchema,
	type SoftwareReleaseComponentSchema,
} from "./software";
import { appendVndbSemantics } from "./vndb-semantics";

/** Source date precision and TBA remain explicit, including dump sentinel dates. */
export function vndbReleaseDate(value: string | null | undefined) {
	if (value == null || value === "unknown" || value === "TBA")
		return { year: null, month: null, day: null, text: value ?? null };
	const match = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/u.exec(value);
	if (!match) throw new TypeError("Invalid VNDB release date");
	return {
		...CatalogPartialDateSchema.parse({
			year: Number(match[1]),
			month: match[2] ? Number(match[2]) : null,
			day: match[3] ? Number(match[3]) : null,
		}),
		text: null,
	};
}

export function planVndbRelease(input: unknown) {
	const record = VndbReleaseSchema.parse(input);
	const voiced = record.voiced;
	const details = SoftwareReleaseDetailsSchema.parse({
		isPatch: record.patch,
		freeware: record.freeware,
		uncensored: record.uncensored,
		hasEroticContent: record.has_ero,
		minimumAge: record.minage,
		resolution:
			record.resolution === "non-standard"
				? { kind: "non_standard" }
				: record.resolution
					? { kind: "pixels", width: record.resolution[0], height: record.resolution[1] }
					: null,
		engine: record.engine,
		voicing:
			voiced === 1
				? "none"
				: voiced === 2
					? "erotic_only"
					: voiced === 3
						? "partial"
						: voiced === 4
							? "full"
							: null,
		notes: record.notes,
		gtin: record.gtin,
		catalogNumber: record.catalog,
		date: vndbReleaseDate(record.released),
	});
	return { record, details };
}

/** @alpha Adopt distribution metadata without manufacturing an edition or content version. */
export async function adoptVndbRelease(
	tx: DatabaseTransaction,
	actor: string,
	receipt: CatalogSourceReceipt,
	bytes: Uint8Array,
) {
	if (
		bytes.byteLength > 8000000 ||
		createHash("sha256").update(bytes).digest("hex") !== receipt.contentSha256
	)
		throw new Error("VNDB release bytes differ from archived observation");
	if (receipt.contractSha256 !== VndbCatalogContractSha256)
		throw new Error("VNDB source contract is not reviewed for this mapper");
	const { record, details } = planVndbRelease(
		JSON.parse(new TextDecoder("utf8", { fatal: true }).decode(bytes)),
	);
	const source = vndbSourceKey(record.id);
	if (
		receipt.key.source !== source.source ||
		receipt.key.objectType !== source.objectType ||
		receipt.key.externalId !== source.externalId
	)
		throw new TypeError("VNDB release differs from source identity");
	const document = await recordCatalogSourceDocument(tx, receipt, bytes);
	return writeVndbReleaseProjection(tx, actor, record, details, document);
}

/** API and dump adapters share native writes while retaining their original reference paths. */
export async function writeVndbReleaseProjection(
	tx: DatabaseTransaction,
	actor: string,
	record: z.output<typeof VndbReleaseSchema>,
	details: z.output<typeof SoftwareReleaseDetailsSchema>,
	document: Awaited<ReturnType<typeof recordCatalogSourceDocument>>,
	vnPath: (position: number) => string = (position) => `/vns/${position}/id`,
) {
	const existing = await inspectExistingSourceBinding(tx, actor, document, "vndb.release.1");
	if (existing && existing.status !== "initialize_reference") return existing;
	const release = existing
		? {
				...existing.reference,
				revision: (
					await reviseSoftwareRelease(tx, existing.reference, actor, existing.revision, details)
				).revision,
			}
		: await createNativeSoftwareRelease(tx, actor, {
				name: { value: record.title, languageTag: null },
				details,
			});
	let revision = release.revision;
	const components: z.input<typeof SoftwareReleaseComponentSchema>[] = [];
	for (const [position, vn] of (record.vns ?? []).entries()) {
		const content = await bindReferencedSourceIdentity(tx, actor, {
			...vndbSourceKey(vn.id),
			owner: "software",
			shape: "content",
			name: typeof vn.title === "string" ? vn.title : undefined,
			evidence: document.referenceAt(vnPath(position)),
		});
		if (content.created) {
			await tx.insert(softwareContent).values({ id: content.id });
			await tx.insert(softwareVisualNovel).values({ id: content.id });
		}
		const type = vn.rtype
			? await ensureCatalogDefinition(tx, {
					namespace: "software.release_completeness",
					key: vn.rtype,
					kind: "vocabulary",
					valueKind: null,
				})
			: null;
		components.push({
			kind: "content",
			contentId: content.id,
			releaseTypeRevisionId: type?.revisionId,
		});
	}
	for (const platform of record.platforms ?? []) {
		const definition = await ensureCatalogDefinition(tx, {
			namespace: "software.platform",
			key: vndbPlatform(platform),
			kind: "vocabulary",
			valueKind: null,
		});
		components.push({ kind: "platform", platformRevisionId: definition.revisionId });
	}
	for (const medium of record.media ?? []) {
		const definition = await ensureCatalogDefinition(tx, {
			namespace: "software.medium",
			key: vndbMedium(medium.medium),
			kind: "vocabulary",
			valueKind: null,
		});
		components.push({
			kind: "medium",
			mediumTypeRevisionId: definition.revisionId,
			quantity: medium.qty === 0 ? null : medium.qty,
		});
	}
	for (const item of record.languages ?? [])
		components.push({
			kind: "language",
			languageTag: vndbLanguage(item.lang),
			machineTranslated: item.mtl,
			main: item.main,
			title: item.title ?? null,
			transliteratedTitle: item.latin ?? null,
		});
	for (let offset = 0; offset < components.length; offset += 128)
		revision = (
			await appendSoftwareReleaseComponents(
				tx,
				release,
				actor,
				revision,
				components.slice(offset, offset + 128),
			)
		).revision;
	if (!existing)
		await tx
			.insert(CatalogFactTables.software.identifier)
			.values({
				ownerId: release.id,
				namespace: "vndb.release",
				value: record.id,
				normalizedValue: record.id,
			});
	// API records retain their native semantic relations; dump paths are resolved by their dump adapter.
	if (document.snapshot.contractSha256 === VndbCatalogContractSha256)
		revision = await appendVndbSemantics(tx, release, actor, revision, record, document);
	const reference = { owner: "software" as const, id: release.id };
	if (existing)
		await acceptCatalogSourceInitialization(tx, actor, {
			sourceRecordId: document.record.id,
			path: "/",
			snapshotId: document.snapshot.id,
			reference,
			expectedBaselineRevision: existing.revision,
			finalRevision: revision,
		});
	else
		await bindCatalogSourceIdentity(tx, actor, {
			sourceRecordId: document.record.id,
			path: "/",
			snapshotId: document.snapshot.id,
			reference,
		});
	return {
		status: "created" as const,
		reference: { owner: "software" as const, id: release.id },
		revision,
		snapshotId: document.snapshot.id,
	};
}
