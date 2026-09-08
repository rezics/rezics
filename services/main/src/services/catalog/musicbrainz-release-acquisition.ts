import { SOURCE_DOCUMENT_BYTE_LIMIT, SOURCE_ACQUISITION_IO_TIMEOUT_MS } from "../database/schema/catalog-source-limits";
import { setTimeout as delay } from "node:timers/promises";
import { CatalogSourceRateLimited } from "./source-rate";
import { MusicBrainzCatalogContractSha256 } from "./musicbrainz";
import { musicBrainzReleaseAcquisitionProfiles, normalizeMusicBrainzReleaseBundle, MusicBrainzReleaseBundleProfile, MusicBrainzReleaseBundleDerivationSha256 } from "./musicbrainz-release-bundle";
import { storeCatalogSourceMultipartPayload, type CatalogSourceAcquisition, type CatalogSourceKey, type CatalogSourceArchive } from "./source-observations";
import type { CatalogSourceFetch } from "./source-acquisition";
import type { CatalogSourceCheckOutcome } from "./source-scheduling";

/** @internal Independent HTTP profiles retain exact capture receipts; only verified overlapping fields are assembled. */
export async function acquireMusicBrainzReleaseBundle(lease: CatalogSourceAcquisition & CatalogSourceKey, signal: AbortSignal,
	dependencies: { fetch: CatalogSourceFetch; archive?: CatalogSourceArchive; admit: () => Promise<void> },
): Promise<CatalogSourceCheckOutcome> {
	const ioSignal = AbortSignal.any([signal, AbortSignal.timeout(SOURCE_ACQUISITION_IO_TIMEOUT_MS)]);
	const parts: { key: string; profile: string; kind: "upstream_response" | "derived_view"; bytes: Uint8Array; requestUrl: string | null; observedAt: string }[] = [];
	const raw: Partial<Record<"tracks" | "media" | "metadata", Uint8Array>> = {};
	for (const profile of musicBrainzReleaseAcquisitionProfiles(lease.externalId)) {
		for (let attempt = 0; ; attempt++) {
			try { await dependencies.admit(); break; }
			catch (error) { if (!(error instanceof CatalogSourceRateLimited) || attempt >= 19) throw error; await delay(1100, undefined, { signal: ioSignal }); }
		}
		const response = await dependencies.fetch(profile.url, { method: "GET", headers: { "User-Agent": "REZICS-source-check/1.0 (+https://www.rezics.com)", Accept: "application/json" }, redirect: "error", signal: AbortSignal.any([ioSignal, AbortSignal.timeout(20_000)]) });
		if (response.status === 410) return { status: "tombstone", authoritative: true, reason: "The exact upstream endpoint returned HTTP 410" };
		if (!response.ok || !response.body) return { status: "error", reason: `Source profile ${profile.key} returned HTTP ${response.status}` };
		const declared = response.headers.get("content-length");
		if (declared !== null && Number(declared) > SOURCE_DOCUMENT_BYTE_LIMIT) throw new RangeError("Source profile exceeds its archive budget");
		const chunks: Uint8Array[] = []; let length = 0;
		for await (const chunk of response.body) { length += chunk.byteLength; if (length > SOURCE_DOCUMENT_BYTE_LIMIT) throw new RangeError("Source profile exceeds its archive budget"); chunks.push(chunk); }
		const bytes = Buffer.concat(chunks);
		raw[profile.key] = bytes;
		parts.push({ ...profile, kind: "upstream_response", bytes, requestUrl: profile.url, observedAt: new Date().toISOString() });
	}
	if (!raw.tracks || !raw.media || !raw.metadata) throw new Error("Release acquisition did not produce its exact raw profiles");
	const normalized = normalizeMusicBrainzReleaseBundle(lease.externalId, { tracks: raw.tracks, media: raw.media, metadata: raw.metadata });
	parts.push({ key: "native_view", profile: MusicBrainzReleaseBundleProfile, kind: "derived_view", bytes: normalized.bytes, requestUrl: null, observedAt: new Date().toISOString() });
	const receipt = await storeCatalogSourceMultipartPayload({ source: lease.source, objectType: lease.objectType, externalId: lease.externalId },
		MusicBrainzReleaseBundleProfile, MusicBrainzReleaseBundleDerivationSha256, parts, MusicBrainzCatalogContractSha256, dependencies.archive,
		{ sourceRecordId: lease.sourceRecordId, generation: lease.generation }, ioSignal);
	return { status: "changed", receipt };
}
