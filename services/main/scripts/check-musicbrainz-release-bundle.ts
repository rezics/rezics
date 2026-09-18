import { setTimeout as delay } from "node:timers/promises";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { SOURCE_DOCUMENT_BYTE_LIMIT, MUSIC_SOURCE_AUXILIARY_ROW_LIMIT } from "@rezics/schema/postgres/ingestion/source-limits";
import { musicBrainzReleaseAuxiliaryRows } from "../src/services/catalog/musicbrainz-release-plan";
import { boundedSourceJson, musicBrainzReleaseAcquisitionProfiles, normalizeMusicBrainzReleaseBundle } from "../src/services/catalog/musicbrainz-release-bundle";

const id = process.env.REZICS_MUSICBRAINZ_BUNDLE_RELEASE_ID ?? "d996abaa-ce14-45c7-944a-9c62adee19fe";
const parts: Partial<Record<"tracks" | "media" | "metadata", Uint8Array>> = {};
const sizes: { profile: string; bytes: number; sha256: string }[] = [];
const rssBefore = process.memoryUsage().rss;
const started = performance.now();
const captures: { key: string; profile: string; requestUrl: string; observedAt: string }[] = [];
for (const profile of musicBrainzReleaseAcquisitionProfiles(id)) {
	const response = await fetch(profile.url, { headers: { "User-Agent": "REZICS-source-check/1.0 (+https://www.rezics.com)" }, signal: AbortSignal.timeout(30000) });
	if (!response.ok || !response.body) throw new Error(`Profile ${profile.key} returned HTTP ${response.status}`);
	const chunks: Uint8Array[] = []; let bytes = 0;
	for await (const chunk of response.body) { bytes += chunk.byteLength; if (bytes > SOURCE_DOCUMENT_BYTE_LIMIT) throw new RangeError("Actual raw profile exceeds 8 MB"); chunks.push(chunk); }
	const value = Buffer.concat(chunks); parts[profile.key] = value;
	captures.push({ key: profile.key, profile: profile.profile, requestUrl: profile.url, observedAt: new Date().toISOString() });
	sizes.push({ profile: profile.key, bytes, sha256: createHash("sha256").update(value).digest("hex") });
	await delay(1100);
}
if (!parts.tracks || !parts.media || !parts.metadata) throw new Error("Missing raw profile");
const normalized = normalizeMusicBrainzReleaseBundle(id, { tracks: parts.tracks, media: parts.media, metadata: parts.metadata });
const normalizationMemory = process.memoryUsage();
function jsonNodes(bytes: Uint8Array) {
	const stack = [boundedSourceJson(bytes)]; let count = 0;
	while (stack.length) { const value = stack.pop(); count++; if (value !== null && typeof value === "object") for (const child of Object.values(value)) stack.push(child); }
	return count;
}
const profileNodes = (["tracks", "media", "metadata"] as const).map((key): { profile: string; nodes: number } => ({ profile: key, nodes: jsonNodes(parts[key]!) }));
profileNodes.push({ profile: "native_view", nodes: jsonNodes(normalized.bytes) });
const initialAuxiliaryRows = musicBrainzReleaseAuxiliaryRows(null, normalized.document);
if (initialAuxiliaryRows > MUSIC_SOURCE_AUXILIARY_ROW_LIMIT) throw new RangeError(`Initial auxiliary writes exceed the publication budget: ${initialAuxiliaryRows}`);
let captureDirectory: string | undefined;
if (process.env.REZICS_MUSICBRAINZ_BUNDLE_CAPTURE === "1") {
	captureDirectory = resolve(".temp", "musicbrainz-release-bundle", `${id}-${Date.now()}`);
	await mkdir(captureDirectory, { recursive: true });
	for (const key of ["tracks", "media", "metadata"] as const) await writeFile(resolve(captureDirectory, `${key}.json`), parts[key]!, { flag: "wx" });
	await writeFile(resolve(captureDirectory, "capture.json"), JSON.stringify({ id, profiles: captures, hashes: sizes }), { flag: "wx" });
}
console.info(JSON.stringify({ id, raw: sizes, normalizedBytes: normalized.bytes.byteLength, nativeSha256: createHash("sha256").update(normalized.bytes).digest("hex"),
	media: normalized.document.media.length, tracks: normalized.document.media.reduce((sum, medium) => sum + (medium.tracks?.length ?? 0), 0),
	rssBefore, rssAfterNormalization: normalizationMemory.rss, heapAfterNormalization: normalizationMemory.heapUsed, profileNodes,
	initialAuxiliaryRows, acquisitionAndNormalizationMs: performance.now() - started,
	captureDirectory,
	observationScope: "independent HTTP profiles with validated overlaps; not an upstream atomic snapshot" }));
