import { and, desc, eq } from "drizzle-orm";
import { softwareRecordRevision } from "../database/schema/catalog-software";
import {
	softwareComponentSourceOccurrence,
	softwareRecordSourceOccurrence,
} from "../database/schema/catalog-software-source";
import { appendVndbDisplayName } from "./vndb-names";
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
	SoftwareReleaseDetailsSchema,
	type SoftwareReleaseComponentSchema,
} from "./software";
import { appendVndbSemantics } from "./vndb-semantics";
import { putSoftwareComponent } from "./software-components";

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
	sourcePath: (path: string) => string = (path) => path,
) {
	const existing = await inspectExistingSourceBinding(tx, actor, document, "vndb.release.2");
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
	let revision = await appendVndbDisplayName(
		tx,
		release,
		actor,
		release.revision,
		record.title,
		document,
		"vndb.release.name",
		sourcePath("/title"),
		"nameId" in release ? { id: release.nameId, revision: release.nameRevision } : undefined,
	);
	await recordVndbSoftwareScalarOccurrence(tx, document, release.id, sourcePath("/"));
	const components = await planVndbReleaseComponents(
		tx,
		actor,
		record,
		document,
		vnPath,
		sourcePath,
	);
	for (const component of components) {
		const put = await putSoftwareComponent(
			tx,
			release,
			actor,
			revision,
			component.componentId,
			null,
			component.value,
		);
		revision = put.revision;
		await tx.insert(softwareComponentSourceOccurrence).values({
			sourceRecordId: document.record.id,
			snapshotId: document.snapshot.id,
			ownerId: release.id,
			component: component.value.kind,
			componentKey: component.componentId,
			revision: put.componentRevision,
			sourcePath: component.path,
		});
	}
	if (!existing)
		await tx.insert(CatalogFactTables.software.identifier).values({
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
			mappingVersion: "vndb.release.2",
			path: "/",
			snapshotId: document.snapshot.id,
			reference,
			expectedBaselineRevision: existing.revision,
			finalRevision: revision,
		});
	else
		await bindCatalogSourceIdentity(tx, actor, {
			sourceRecordId: document.record.id,
			mappingVersion: "vndb.release.2",
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

/** @internal Native source occurrence keys remain stable when unrelated source arrays reorder. */
export function vndbReleaseComponentId(
	sourceRecordId: string,
	key: string,
	value: z.input<typeof SoftwareReleaseComponentSchema>,
) {
	if (value.kind === "platform") return value.platformRevisionId;
	if (value.kind === "patch_target") return value.baseReleaseId;
	const bytes = createHash("sha256")
		.update(`vndb-release-component\n${sourceRecordId}\n${key}`)
		.digest();
	bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x80;
	bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
	const hex = bytes.subarray(0, 16).toString("hex");
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** @internal Materializes only one admitted source record, never a native owner's entire graph. */
export async function planVndbReleaseComponents(
	tx: DatabaseTransaction,
	actor: string,
	record: z.output<typeof VndbReleaseSchema>,
	document: Awaited<ReturnType<typeof recordCatalogSourceDocument>>,
	vnPath: (position: number) => string = (position) => `/vns/${position}/id`,
	sourcePath: (path: string) => string = (path) => path,
) {
	const components: {
		key: string;
		path: string;
		value: z.input<typeof SoftwareReleaseComponentSchema>;
	}[] = [];
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
			key: `content/${vn.id}`,
			path: vnPath(position),
			value: {
				kind: "content",
				contentId: content.id,
				releaseTypeRevisionId: type?.revisionId,
			},
		});
	}
	for (const [index, platform] of (record.platforms ?? []).entries()) {
		const definition = await ensureCatalogDefinition(tx, {
			namespace: "software.platform",
			key: vndbPlatform(platform),
			kind: "vocabulary",
			valueKind: null,
		});
		components.push({
			key: `platform/${platform}`,
			path: sourcePath(`/platforms/${index}`),
			value: { kind: "platform", platformRevisionId: definition.revisionId },
		});
	}
	const mediaCounts = new Map<string, number>();
	for (const [index, medium] of (record.media ?? []).entries()) {
		const position = mediaCounts.get(medium.medium) ?? 0;
		mediaCounts.set(medium.medium, position + 1);
		const definition = await ensureCatalogDefinition(tx, {
			namespace: "software.medium",
			key: vndbMedium(medium.medium),
			kind: "vocabulary",
			valueKind: null,
		});
		components.push({
			key: `medium/${medium.medium}/${position}`,
			path: sourcePath(`/media/${index}`),
			value: {
				kind: "medium",
				mediumTypeRevisionId: definition.revisionId,
				quantity: medium.qty === 0 ? null : medium.qty,
			},
		});
	}
	for (const [index, item] of (record.languages ?? []).entries())
		components.push({
			key: `language/${vndbLanguage(item.lang)}`,
			path: sourcePath(`/languages/${index}`),
			value: {
				kind: "language",
				languageTag: vndbLanguage(item.lang),
				machineTranslated: item.mtl,
				main: item.main,
				title: item.title ?? null,
				transliteratedTitle: item.latin ?? null,
			},
		});
	if (new Set(components.map((item) => item.key)).size !== components.length)
		throw new TypeError("Duplicate VNDB release occurrence key");
	return components.map((item) => ({
		...item,
		componentId: vndbReleaseComponentId(document.record.id, item.key, item.value),
	}));
}

/** @internal Captures the actual native scalar history initialized from this source snapshot. */
export async function recordVndbSoftwareScalarOccurrence(
	tx: DatabaseTransaction,
	document: Awaited<ReturnType<typeof recordCatalogSourceDocument>>,
	ownerId: string,
	sourcePath: string,
) {
	const t = softwareRecordRevision;
	const [current] = await tx
		.select({ revision: t.revision })
		.from(t)
		.where(eq(t.ownerId, ownerId))
		.orderBy(desc(t.revision))
		.limit(1);
	if (!current) throw new Error("Native software scalar history is missing");
	await tx
		.insert(softwareRecordSourceOccurrence)
		.values({
			sourceRecordId: document.record.id,
			snapshotId: document.snapshot.id,
			ownerId,
			revision: current.revision,
			sourcePath,
		})
		.onConflictDoNothing();
	const o = softwareRecordSourceOccurrence;
	const [original] = await tx
		.select()
		.from(o)
		.where(
			and(
				eq(o.sourceRecordId, document.record.id),
				eq(o.snapshotId, document.snapshot.id),
				eq(o.ownerId, ownerId),
			),
		)
		.limit(1);
	if (!original || original.sourcePath !== sourcePath)
		throw new Error("Immutable software source occurrence differs");
	return original.revision;
}
