import Elysia from "elysia";
import { createHash } from "node:crypto";
import { z } from "zod";
import { CatalogOwnerValues } from "@rezics/schema/contracts/native/catalog";
import session from "../../auth/session";
import { catalogRead, catalogMutation as mutateCatalog } from "./transaction";
import type { DatabaseTransaction } from "../../database";
import type { ParticipationAuthority } from "../../participation/policy";
import { acquireCatalogSourceCheck, type CatalogSourceFetch } from "../../catalog/source-acquisition";
import { readCatalogSourceNativeBytes, readCatalogSourceProfileBytes, listCatalogSourceProfiles, recordCatalogSourceObservation, type CatalogSourceReceipt, type CatalogSourceArchive } from "../../catalog/source-observations";
import { adoptCatalogSourcePrincipal, catalogSourcePrincipalWriter } from "../../catalog/source-native-registry";
import { beginCatalogApiIntake, presentCatalogSourceProposal, readCatalogApiProposalEvidence,
	reopenCatalogApiSnapshot, requireCatalogSourceIntake, pageCatalogResourceSourceBindings, catalogPrincipalMappingKey } from "../../catalog/source-api";
import { listCatalogSourceProposals, proposeCatalogSourceAdoption, decideCatalogSourceProposal } from "../../catalog/source-proposals";
import { lockCatalogSourceBinding, reviseCatalogSourceBinding } from "../../catalog/source-bindings";
import { loadCatalogIdentity, CatalogReferenceNotFound } from "../../catalog/storage";
import {
	CatalogSourceRequestLimited,
	CatalogSourceUnavailable,
	isCatalogSourceAdmissionExhausted,
} from "../../catalog/source-api-errors";
import { CatalogSourcePreviewQuerySchema, CatalogSourcePreviewValueQuerySchema, CatalogSourcePreviewSchema, CatalogSourcePreviewValueSchema,
	previewCatalogSourceChanges, previewCatalogSourceValue } from "../../catalog/source-preview";
import { CatalogSourceRateLimited } from "../../catalog/source-rate";
import { enqueueMusicReleaseSourceIntakeJob, enqueueMusicReleaseSourceJob,
	readMusicReleaseSourceJob, controlMusicReleaseSourceJob } from "../../catalog/music-release-source-jobs";
import { AuthenticationRequired } from "../../auth/errors";
import { ValidationError } from "../errors";
import {
	CatalogSourceIntakeKeySchema, CatalogSourceIntakeResultSchema, CatalogSourceBindingKeySchema,
	CatalogSourceProposalKeySchema, CatalogSourcePageQuerySchema, CatalogSourceProposalPageSchema,
	CatalogSourceProposeSchema, CatalogSourceProposeResultSchema, CatalogSourceDecisionSchema,
	CatalogSourceDecisionResultSchema, CatalogSourceBindingEditSchema, CatalogSourceBindingMutationSchema,
	CatalogResourceBindingsQuerySchema, CatalogResourceBindingsPageSchema,
	CatalogSourceJobKeySchema, CatalogSourceJobControlSchema, CatalogSourceJobSchema,
} from "../../catalog/source-api-contracts";
const detail = (operationId: string, summary: string) => ({ operationId, summary, tags: ["Catalog sources"] });

async function catalogMutation<T>(authority:ParticipationAuthority,work:(tx:DatabaseTransaction,actor:string)=>Promise<T>):Promise<T> {
	try { return await mutateCatalog(authority,work); }
	catch(cause) { if(isCatalogSourceAdmissionExhausted(cause)) throw new CatalogSourceUnavailable(); throw cause; }
}

function previewProfiles(receipt: CatalogSourceReceipt | undefined) {
	return receipt ? listCatalogSourceProfiles(receipt).map(({ payloadRef: _payloadRef, ...profile }) => profile) : [];
}
async function previewBytes(receipt: CatalogSourceReceipt | undefined, profileKey: string | undefined, signal: AbortSignal) {
	if (!receipt) return null;
	if (!profileKey) return readCatalogSourceNativeBytes(receipt, signal);
	if (!listCatalogSourceProfiles(receipt).some(profile => profile.key === profileKey)) return null;
	return readCatalogSourceProfileBytes(receipt, profileKey, signal);
}
function previewValidation<T>(work: () => T): T {
	try { return work(); } catch (cause) {
		if (cause instanceof TypeError || cause instanceof RangeError)
			throw new ValidationError({ message: cause.message.slice(0, 512) });
		throw cause;
	}
}

/** @alpha @remarks Human intake creates private native records; changed snapshots require an exact reviewed decision. */
export function createCatalogSourceApi(dependencies: { archive?: CatalogSourceArchive; fetch?: CatalogSourceFetch } = {}) {
	return new Elysia({ prefix: "/sources", name: "catalog-sources-api" })
	.use(session)
	.post("/intake", { access: "contribute:unit:create", body: CatalogSourceIntakeKeySchema,
		query: z.strictObject({ refresh: z.enum(["true", "false"]).optional() }), response: CatalogSourceIntakeResultSchema,
		detail: detail("intakeCatalogSource", "Import a source record as a private native draft or propose its update") },
		async ({ body, query, participation, request }) => {
			const admission = await catalogMutation(participation, (tx, actor) => beginCatalogApiIntake(tx, actor, body, dependencies.archive, query.refresh === "true"));
			let archived: { receipt: CatalogSourceReceipt; snapshotId: string; sourceRecordId: string };
			if (admission.status === "cached") archived = admission;
			else {
				const outcome = await acquireCatalogSourceCheck(admission.acquisition, request.signal, dependencies).catch(cause => {
					if (cause instanceof CatalogSourceRateLimited) throw new CatalogSourceRequestLimited();
					throw cause;
				});
				if (outcome.status !== "changed") throw new CatalogSourceUnavailable();
				const observed = await catalogMutation(participation, async (tx, actor) => {
					await requireCatalogSourceIntake(tx, actor);
					return recordCatalogSourceObservation(tx, outcome.receipt);
				});
				const snapshotId = observed.snapshot.id;
				const sourceRecordId = observed.record.id;
				// Reopen committed evidence: a later mapper transaction does not publish a second observation.
				const reopened = await catalogMutation(participation, (tx, actor) => reopenCatalogApiSnapshot(tx, actor, sourceRecordId, snapshotId, dependencies.archive));
				archived = { ...reopened, sourceRecordId };
			}
			const { receipt, snapshotId, sourceRecordId } = archived;
			if (receipt.key.source === "musicbrainz" && receipt.key.objectType === "release")
				return catalogMutation(participation, async (tx, actor) => ({
					status: "queued" as const, job: await enqueueMusicReleaseSourceIntakeJob(tx, actor, { sourceRecordId, snapshotId }),
				}));
			const bytes = await readCatalogSourceNativeBytes(receipt, request.signal);
			const snapshot = { receipt, bytes, snapshotId };
			return catalogMutation(participation, async (tx, actor) => {
				await requireCatalogSourceIntake(tx, actor);
				const result = await adoptCatalogSourcePrincipal(tx, actor, snapshot);
				return CatalogSourceIntakeResultSchema.parse({ status: result.status, reference: result.reference,
					revision: result.revision, snapshotId: result.snapshotId, sourceRecordId,
					mappingKey: await catalogPrincipalMappingKey(tx, sourceRecordId) });
			});
		})
	.get("/:sourceRecordId/jobs/:jobId", { params: CatalogSourceJobKeySchema, response: CatalogSourceJobSchema,
		detail: detail("getCatalogSourceJob", "Read a source import or update job") },
		({ params, request }) => catalogRead(request, async (tx, actor) => {
			if (!actor) throw new AuthenticationRequired();
			return readMusicReleaseSourceJob(tx, actor, params);
		}))
	.patch("/:sourceRecordId/jobs/:jobId", { access: "contribute:unit:update", params: CatalogSourceJobKeySchema,
		body: CatalogSourceJobControlSchema, response: CatalogSourceJobSchema,
		detail: detail("controlCatalogSourceJob", "Pause or resume a source import or update job") },
		({ params, body, participation }) => catalogMutation(participation, (tx, actor) => controlMusicReleaseSourceJob(tx, actor, { ...params, ...body })))
	.get("/:sourceRecordId/bindings/:mappingKey/proposals", { params: CatalogSourceBindingKeySchema, query: CatalogSourcePageQuerySchema,
		response: CatalogSourceProposalPageSchema, detail: detail("listCatalogSourceProposals", "Review updates for one exact source binding") },
		({ params, query, request }) => catalogRead(request, async (tx, actor) => {
			const binding = await lockCatalogSourceBinding(tx, params);
			await loadCatalogIdentity(tx, binding.reference, actor, true);
			if (!actor) throw new CatalogSourceUnavailable();
			const rows = await listCatalogSourceProposals(tx, actor, params, query.afterId, query.limit);
			return { items: rows.map(presentCatalogSourceProposal), afterId: rows.length === query.limit ? (rows.at(-1)?.id ?? null) : null };
		}))
	.post("/:sourceRecordId/bindings/:mappingKey/proposals", { access: "contribute:unit:update", params: CatalogSourceBindingKeySchema,
		body: CatalogSourceProposeSchema, response: CatalogSourceProposeResultSchema, detail: detail("proposeCatalogSourceAdoption", "Propose the current observation for a bound native record") },
		({ params, body, participation }) => catalogMutation(participation, async (tx, actor) => {
			const result = await proposeCatalogSourceAdoption(tx, actor, { ...params, ...body });
			return { status: result.status, proposal: result.status === "proposed" ? presentCatalogSourceProposal(result.proposal) : null };
		}))
	.patch("/:sourceRecordId/bindings/:mappingKey", { access: "contribute:unit:update", params: CatalogSourceBindingKeySchema,
		body: CatalogSourceBindingEditSchema, response: CatalogSourceBindingMutationSchema, detail: detail("reviseCatalogSourceBinding", "Pause, resume or explicitly rebind one source correspondence") },
		({ params, body, participation }) => catalogMutation(participation, (tx, actor) => reviseCatalogSourceBinding(tx, actor, { ...params, ...body })))
	.get("/:sourceRecordId/proposals/:proposalId/preview", { params: CatalogSourceProposalKeySchema, query: CatalogSourcePreviewQuerySchema,
		response: CatalogSourcePreviewSchema, detail: detail("getCatalogSourceProposalPreview", "Inspect exact source changes before a reviewed decision") },
		async ({ params, query, request }) => {
			const evidence = await catalogRead(request, (tx, actor) => {
				if (!actor) throw new AuthenticationRequired();
				return readCatalogApiProposalEvidence(tx, actor, params.sourceRecordId, params.proposalId, query.action, dependencies.archive);
			});
			const [before, after] = await Promise.all([previewBytes(evidence.before?.receipt, query.profileKey, request.signal), previewBytes(evidence.after.receipt, query.profileKey, request.signal)]);
			if (!before && !after) throw new ValidationError({ message: "Source profile is absent from both reviewed snapshots" });
			return { proposal: evidence.proposal, reference: evidence.reference,
				beforeSnapshotId: evidence.before?.snapshotId ?? null, afterSnapshotId: evidence.after.snapshotId,
				beforeSha256: before ? createHash("sha256").update(before).digest("hex") : null,
				afterSha256: after ? createHash("sha256").update(after).digest("hex") : null,
				beforeArchiveSha256: evidence.before?.receipt.contentSha256 ?? null, afterArchiveSha256: evidence.after.receipt.contentSha256,
				profileKey: query.profileKey ?? null,
				profiles: { before: previewProfiles(evidence.before?.receipt), after: previewProfiles(evidence.after.receipt) },
				...previewValidation(() => previewCatalogSourceChanges(before, after, query)) };
		})
	.get("/:sourceRecordId/proposals/:proposalId/preview/value", { params: CatalogSourceProposalKeySchema, query: CatalogSourcePreviewValueQuerySchema,
		response: CatalogSourcePreviewValueSchema, detail: detail("getCatalogSourceProposalPreviewValue", "Expand a source value while preserving its exact snapshot") },
		async ({ params, query, request }) => {
			const evidence = await catalogRead(request, (tx, actor) => {
				if (!actor) throw new AuthenticationRequired();
				return readCatalogApiProposalEvidence(tx, actor, params.sourceRecordId, params.proposalId, query.action, dependencies.archive);
			});
			const selected = query.side === "before" ? evidence.before : evidence.after;
			if (!selected) throw new CatalogReferenceNotFound("This proposal has no previous source snapshot");
			const bytes = await previewBytes(selected.receipt, query.profileKey, request.signal);
			if (!bytes) throw new ValidationError({ message: "Source profile is absent from this reviewed snapshot" });
			return previewValidation(() => previewCatalogSourceValue(bytes, query));
		})
	.post("/:sourceRecordId/proposals/:proposalId/decision", { access: "contribute:unit:update", params: CatalogSourceProposalKeySchema,
		body: CatalogSourceDecisionSchema, response: CatalogSourceDecisionResultSchema, detail: detail("decideCatalogSourceProposal", "Apply, reject or withdraw an exact source proposal") },
		async ({ params, body, participation, request }) => {
			const action = body.action;
			if (action === "reject" || action === "supersede") return catalogMutation(participation, async (tx, actor) => {
				const result = await decideCatalogSourceProposal(tx, actor, { ...params, ...body });
				return { status: result.status };
			});
			if (body.mappingVersion === "musicbrainz.release.1")
				return catalogMutation(participation, async (tx, actor) => ({
					status: "queued" as const, job: await enqueueMusicReleaseSourceJob(tx, actor, { ...params, action, reason: body.reason }),
				}));
			const evidence = await catalogMutation(participation, (tx, actor) => readCatalogApiProposalEvidence(tx, actor, params.sourceRecordId, params.proposalId, body.action, dependencies.archive));
			// Immutable payload I/O is deliberately outside the source/target lock transaction.
			const [afterBytes, beforeBytes] = await Promise.all([
				readCatalogSourceNativeBytes(evidence.after.receipt, request.signal),
				evidence.before ? readCatalogSourceNativeBytes(evidence.before.receipt, request.signal) : null,
			]);
			const after = { ...evidence.after, bytes: afterBytes };
			const before = evidence.before && beforeBytes ? { ...evidence.before, bytes: beforeBytes } : null;
			const writer = catalogSourcePrincipalWriter(before, after, body.mappingVersion);
			return catalogMutation(participation, async (tx, actor) => {
				const result = await decideCatalogSourceProposal(tx, actor, { ...params, ...body }, writer);
				return { status: result.status };
			});
		});
}

export default createCatalogSourceApi();

export const resourceSourceBindings = new Elysia({ prefix: "/resources/:owner/:id/source-bindings", name: "catalog-resource-source-bindings-api" })
	.use(session)
	.get("", { params: z.strictObject({ owner: z.enum(CatalogOwnerValues), id: z.uuid() }), query: CatalogResourceBindingsQuerySchema,
		response: CatalogResourceBindingsPageSchema, detail: detail("listCatalogResourceSourceBindings", "Read source correspondences for a native record") },
		({ params, query, request }) => catalogRead(request, (tx, actor) => pageCatalogResourceSourceBindings(tx, params, actor, query)));
