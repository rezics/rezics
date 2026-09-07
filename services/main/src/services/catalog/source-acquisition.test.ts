import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import { acquireCatalogSourceCheck, catalogSourceAcquisitionRequest } from "./source-acquisition";
import { catalogSourceRecordId, readCatalogSourceBytes, type CatalogSourceArchive } from "./source-observations";
import type { CatalogSourceCheckLease } from "./source-scheduling";

const key = { source: "vndb", objectType: "vn", externalId: "v17" };
const lease: CatalogSourceCheckLease = { ...key, sourceRecordId: catalogSourceRecordId(key), generation: 2, planRevision: 1 };
function archive() {
	const objects = new Map<string, Uint8Array>();
	return { objects, store: { async put(input) { objects.set(input.Key, input.Body); }, async get(input) { const bytes = objects.get(input.Key); return { Body: bytes ? Readable.from([bytes]) : undefined }; } } satisfies CatalogSourceArchive };
}

describe("source acquisition boundary", () => {
	it("constructs only the reviewed exact official endpoint and rejects identifier URL injection", () => {
		expect(catalogSourceAcquisitionRequest(lease).url).toBe("https://api.vndb.org/kana/vn");
		expect(() => catalogSourceAcquisitionRequest({ ...lease, externalId: "v17/../../admin" })).toThrow();
		expect(() => catalogSourceAcquisitionRequest({ ...lease, source: "https://attacker.test" })).toThrow("No reviewed");
	});
	it("archives the exact query object with its pre-fetch generation without dropping unknown fields", async () => {
		const storage = archive();
		const document = { id: "v17", title: "Example", additional: { important: true } };
		const fetcher: typeof fetch = async () => new Response(JSON.stringify({ results: [document], more: false }));
		const result = await acquireCatalogSourceCheck(lease, new AbortController().signal, { fetch: fetcher, archive: storage.store });
		expect(result.status).toBe("changed");
		if (result.status !== "changed") throw new Error("Expected observation");
		expect(result.receipt.acquisition).toEqual({ sourceRecordId: lease.sourceRecordId, generation: 2 });
		expect(JSON.parse(Buffer.from(await readCatalogSourceBytes(result.receipt)).toString("utf8"))).toEqual(document);
	});
	it("distinguishes ordinary absence from authoritative endpoint withdrawal", async () => {
		const missing: typeof fetch = async () => new Response(null, { status: 404 });
		const gone: typeof fetch = async () => new Response(null, { status: 410 });
		expect((await acquireCatalogSourceCheck(lease, new AbortController().signal, { fetch: missing })).status).toBe("error");
		expect((await acquireCatalogSourceCheck(lease, new AbortController().signal, { fetch: gone })).status).toBe("tombstone");
	});
	it("rejects absent query rows, another identity and oversize responses before archive writes", async () => {
		const storage = archive();
		for (const response of [new Response('{"results":[]}'), new Response('{"results":[{"id":"v18","title":"Wrong"}]}'), new Response("{}", { headers: { "Content-Length": "8000001" } })]) {
			const fetcher: typeof fetch = async () => response;
			await expect(acquireCatalogSourceCheck(lease, new AbortController().signal, { fetch: fetcher, archive: storage.store })).rejects.toThrow();
		}
		expect(storage.objects.size).toBe(0);
	});
});
