import { describe, expect, test } from "bun:test";
import { Readable } from "node:stream";
import { createHash } from "node:crypto";
import { storeCatalogSourceMultipartPayload, readCatalogSourceBytes, readCatalogSourceProfileBytes, readCatalogSourceNativeBytes, listCatalogSourceProfiles, type CatalogSourceArchive } from "./source-observations";

const key = { source: "musicbrainz", objectType: "release", externalId: "11111111-1111-4111-8111-111111111111" };
const body = new TextEncoder().encode(JSON.stringify({ id: key.externalId, title: "Evidence" }));
const hash = "1".repeat(64);
function archive() {
	const objects = new Map<string, Uint8Array>();
	const client: CatalogSourceArchive = { async put(input) { objects.set(input.Key, input.Body.slice()); }, async get(input) { const bytes = objects.get(input.Key); return { Body: bytes ? Readable.from([bytes]) : undefined }; } };
	return { objects, client };
}
function parts(observedAt: string) { return [
	{ key: "raw", profile: "fixture.raw.1", kind: "upstream_response" as const, bytes: body, requestUrl: `https://musicbrainz.org/ws/2/release/${key.externalId}`, observedAt },
	{ key: "native_view", profile: "fixture.1", kind: "derived_view" as const, bytes: new TextEncoder().encode(JSON.stringify({ id: key.externalId })), requestUrl: null, observedAt },
]; }
describe("immutable multipart source receipts", () => {
	test("new observation times keep stable manifest hashes and archive identity", async () => {
		const store = archive();
		const first = await storeCatalogSourceMultipartPayload(key, "fixture.1", hash, parts("2026-09-08T00:00:00.000Z"), hash, store.client);
		const second = await storeCatalogSourceMultipartPayload(key, "fixture.1", hash, parts("2026-09-08T01:00:00.000Z"), hash, store.client);
		expect(second.contentSha256).toBe(first.contentSha256);
		expect(second.payloadRef).toBe(first.payloadRef);
		const reordered = await storeCatalogSourceMultipartPayload(key, "fixture.1", hash, parts("2026-09-08T02:00:00.000Z").reverse(), hash, store.client);
		expect(reordered.contentSha256).toBe(first.contentSha256);
		expect(createHash("sha256").update(await readCatalogSourceBytes(first)).digest("hex")).toBe(first.contentSha256);
		expect(listCatalogSourceProfiles(first)[0]?.observedAt).not.toBe(listCatalogSourceProfiles(second)[0]?.observedAt);
		expect(await readCatalogSourceProfileBytes(first, "raw")).toEqual(body);
		expect(JSON.parse(new TextDecoder().decode(await readCatalogSourceNativeBytes(first)))).toEqual({ id: key.externalId });
		expect(Reflect.set(first.bundle!.manifest.parts[0]!, "profile", "unreviewed")).toBe(false);
	});
	test("part tampering cannot inherit the checksum of its manifest", async () => {
		const store = archive();
		const receipt = await storeCatalogSourceMultipartPayload(key, "fixture.1", hash, parts("2026-09-08T00:00:00.000Z"), hash, store.client);
		store.objects.set(receipt.bundle!.manifest.parts.find((part) => part.key === "raw")!.payloadRef, new TextEncoder().encode("{}"));
		await expect(readCatalogSourceProfileBytes(receipt, "raw")).rejects.toThrow("checksum");
	});
});
