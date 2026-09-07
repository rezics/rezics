import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { softwareRecordRevision, softwareVisualNovel } from "../database/schema/catalog-software";
import { VndbVnSchema, VndbCatalogContractSha256 } from "./vndb";
import { loadCatalogSourceDocument } from "./source-observations";
import type { CatalogSourceNativeWriter } from "./source-proposals";
import {
	CatalogSourceNativeChangesSchema,
	readCatalogSourceApplication,
	type CatalogSourceNativeChange,
} from "./source-applications";
import { CatalogRevisionConflict, loadCatalogIdentity, recordCatalogChange } from "./storage";
import { SoftwareContentDetailsSchema, reviseSoftwareContent } from "./software";
import { recordVndbSoftwareScalarOccurrence } from "./vndb-release";
import { vndbVnDetails } from "./vndb-adoption";
import { mergeVndbOwnedValues, type VndbPreparedSnapshot } from "./vndb-release-update";
import {
	planVndbNativeNames,
	reconcileVndbNativeNames,
	restoreVndbNameAuthority,
} from "./vndb-names-update";
import { planVndbSemantics } from "./vndb-semantics-contracts";
import { reconcileVndbSemanticPlan } from "./vndb-semantics-update";
import { reconcileVndbContexts } from "./vndb-contexts-update";
import { reconcileVndbParticipation } from "./vndb-participation-update";
import { compensateVndbSoftwareApplication } from "./vndb-software-compensation";

function prepare(input: VndbPreparedSnapshot) {
	const snapshotId = z.uuid().parse(input.snapshotId),
		bytes = new Uint8Array(input.bytes),
		receipt = input.receipt;
	if (
		bytes.byteLength > 8_000_000 ||
		createHash("sha256").update(bytes).digest("hex") !== receipt.contentSha256 ||
		receipt.contractSha256 !== VndbCatalogContractSha256 ||
		receipt.key.source !== "vndb" ||
		receipt.key.objectType !== "vn"
	)
		throw new TypeError("VNDB VN archive differs from its reviewed receipt");
	const record = VndbVnSchema.parse(
		JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)),
	);
	if (record.id !== receipt.key.externalId)
		throw new TypeError("VNDB VN archive identifies another source object");
	return { snapshotId, bytes, receipt, record };
}

/** @alpha @remarks Native VN updates preserve unrelated local edits and never treat snapshot-local eid as version identity. */
export function createVndbVnNativeWriter(input: {
	before: VndbPreparedSnapshot | null;
	after: VndbPreparedSnapshot;
}): CatalogSourceNativeWriter {
	const before = input.before ? prepare(input.before) : null,
		after = prepare(input.after);
	if (before && before.record.id !== after.record.id)
		throw new TypeError("VNDB VN delta crosses source identities");
	return async (tx, context) => {
		if (
			context.mappingVersion !== "vndb.vn.2" ||
			context.snapshotId !== after.snapshotId ||
			context.reference.owner !== "software"
		)
			throw new TypeError("VNDB VN writer context differs from its source preparation");
		const native = await loadCatalogIdentity(tx, context.reference, context.actor, true);
		if (native.shape !== "content") throw new TypeError("VNDB VN requires native content identity");
		const document = await loadCatalogSourceDocument(
			tx,
			context.sourceRecordId,
			after.snapshotId,
			after.receipt,
			after.bytes,
		);
		const previousDocument = before
			? await loadCatalogSourceDocument(
					tx,
					context.sourceRecordId,
					before.snapshotId,
					before.receipt,
					before.bytes,
				)
			: document;
		if (context.action === "withdraw") {
			const applied = await readCatalogSourceApplication(tx, context.actor, {
				sourceRecordId: context.sourceRecordId,
				proposalId: context.proposalId,
				action: "apply",
			});
			if (!applied || applied.application.previousSnapshotId !== (before?.snapshotId ?? null))
				throw new Error("VNDB compensation preparation lacks the exact original baseline");
			const result = await compensateVndbSoftwareApplication(tx, context, "content");
			if (before)
				result.changes.push(
					...(await restoreVndbNameAuthority(
						tx,
						context.reference,
						context.actor,
						planVndbNativeNames(before.record, "vn"),
						previousDocument,
					)),
				);
			return {
				revision: result.revision,
				changes: CatalogSourceNativeChangesSchema.parse(result.changes),
			};
		}
		if (context.previousSnapshotId !== (before?.snapshotId ?? null))
			throw new CatalogRevisionConflict("VNDB baseline changed after preparation");
		if (before)
			for (const field of [
				"title",
				"titles",
				"aliases",
				"olang",
				"description",
				"devstatus",
				"editions",
				"staff",
				"va",
				"image",
				"screenshots",
				"relations",
				"tags",
				"extlinks",
				"length",
				"length_minutes",
				"length_votes",
			] as const)
				if (before.record[field] !== undefined && after.record[field] === undefined)
					throw new TypeError(`VNDB update omitted observed ${field}`);
		const changes: CatalogSourceNativeChange[] = [];
		let revision = context.expectedRevision;
		const t = softwareRecordRevision;
		const [head] = await tx
			.select()
			.from(t)
			.where(eq(t.ownerId, context.reference.id))
			.orderBy(desc(t.revision))
			.limit(1);
		const row = head ? z.record(z.string(), z.unknown()).parse(head.value) : {};
		const current = SoftwareContentDetailsSchema.parse({
			originalLanguageTag: row.original_language_tag,
			developmentStatus: row.development_status,
			description: row.description,
		});
		const desired = SoftwareContentDetailsSchema.parse(
			mergeVndbOwnedValues(
				before ? vndbVnDetails(before.record) : SoftwareContentDetailsSchema.parse({}),
				vndbVnDetails(after.record),
				current,
			),
		);
		if (!head || !isDeepStrictEqual(current, desired)) {
			revision = (
				await reviseSoftwareContent(tx, context.reference, context.actor, revision, desired)
			).revision;
			changes.push({
				kind: "software-record",
				ownerId: context.reference.id,
				beforeRevision: head?.revision ?? null,
				afterRevision: revision,
			});
		}
		await tx.insert(softwareVisualNovel).values({ id: context.reference.id }).onConflictDoNothing();
		await recordVndbSoftwareScalarOccurrence(tx, document, context.reference.id, "/");
		const names = await reconcileVndbNativeNames(
			tx,
			context.reference,
			context.actor,
			revision,
			context.mappingKey,
			{ plan: before ? planVndbNativeNames(before.record, "vn") : [], document: previousDocument },
			{ plan: planVndbNativeNames(after.record, "vn"), document },
		);
		revision = names.revision;
		changes.push(...names.changes);
		const contexts = await reconcileVndbContexts(
			tx,
			context.reference,
			context.actor,
			context.mappingKey,
			{ record: before?.record ?? null, document: previousDocument },
			{ record: after.record, document },
		);
		changes.push(...contexts.changes);
		changes.push(
			...(await reconcileVndbParticipation(
				tx,
				context.reference,
				context.actor,
				context.mappingKey,
				{
					record: before?.record ?? null,
					document: previousDocument,
					contexts: contexts.oldContexts,
				},
				{ record: after.record, document, contexts: contexts.nextContexts },
			)),
		);
		const semantics = await reconcileVndbSemanticPlan(
			tx,
			context.reference,
			context.actor,
			revision,
			context.mappingKey,
			{
				plan: before ? planVndbSemantics(before.record) : { facts: [], relations: [] },
				document: previousDocument,
			},
			{ plan: planVndbSemantics(after.record), document },
		);
		revision = semantics.revision;
		changes.push(...semantics.changes);
		changes.push(...(await contexts.retire()));
		revision = await recordCatalogChange(
			tx,
			context.reference,
			context.actor,
			revision,
			"source.vndb.vn.apply",
		);
		return { revision, changes: CatalogSourceNativeChangesSchema.parse(changes) };
	};
}
