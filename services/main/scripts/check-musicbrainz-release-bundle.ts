import { setTimeout as delay } from "node:timers/promises";
import { createHash } from "node:crypto";
import { musicBrainzReleaseAcquisitionProfiles, normalizeMusicBrainzReleaseBundle } from "../src/services/catalog/musicbrainz-release-bundle";

const id = process.env.REZICS_MUSICBRAINZ_BUNDLE_RELEASE_ID ?? "d996abaa-ce14-45c7-944a-9c62adee19fe";
const parts: Partial<Record<"tracks" | "media" | "metadata", Uint8Array>> = {};
const sizes: { profile: string; bytes: number; sha256: string }[] = [];
const rssBefore = process.memoryUsage().rss;
for (const profile of musicBrainzReleaseAcquisitionProfiles(id)) {
	const response = await fetch(profile.url, { headers: { "User-Agent": "REZICS-source-check/1.0 (+https://www.rezics.com)" }, signal: AbortSignal.timeout(30000) });
	if (!response.ok || !response.body) throw new Error(`Profile ${profile.key} returned HTTP ${response.status}`);
	const chunks: Uint8Array[] = []; let bytes = 0;
	for await (const chunk of response.body) { bytes += chunk.byteLength; if (bytes > 8_000_000) throw new RangeError("Actual raw profile exceeds 8 MB"); chunks.push(chunk); }
	const value = Buffer.concat(chunks); parts[profile.key] = value;
	sizes.push({ profile: profile.key, bytes, sha256: createHash("sha256").update(value).digest("hex") });
	await delay(1100);
}
if (!parts.tracks || !parts.media || !parts.metadata) throw new Error("Missing raw profile");
const normalized = normalizeMusicBrainzReleaseBundle(id, { tracks: parts.tracks, media: parts.media, metadata: parts.metadata });
console.info(JSON.stringify({ id, raw: sizes, normalizedBytes: normalized.bytes.byteLength, nativeSha256: createHash("sha256").update(normalized.bytes).digest("hex"),
	media: normalized.document.media.length, tracks: normalized.document.media.reduce((sum, medium) => sum + (medium.tracks?.length ?? 0), 0),
	rssBefore, rssAfterNormalization: process.memoryUsage().rss, heapAfterNormalization: process.memoryUsage().heapUsed,
	observationScope: "independent HTTP profiles with validated overlaps; not an upstream atomic snapshot" }));
