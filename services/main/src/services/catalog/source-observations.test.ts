import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import {
	readCatalogSourceBytes,
	storeCatalogSourcePayload,
	type CatalogSourceArchive,
	sourceReferenceAt,
	requireCatalogSourceReferenceEvidence,
} from "./source-observations";

function memoryArchive() {
	const objects = new Map<string, Uint8Array>();
	const archive: CatalogSourceArchive = {
		async put(input) {
			objects.set(input.Key, new Uint8Array(input.Body));
		},
		async get(input) {
			const bytes = objects.get(input.Key);
			return { Body: bytes ? Readable.from([bytes]) : undefined };
		},
	};
	return { archive, objects };
}

describe("source observation archive receipts", () => {
	it("binds a bounded byte stream to an immutable scoped checksum receipt", async () => {
		const { archive } = memoryArchive();
		const bytes = Buffer.from('{"id":253,"name":"source"}');
		const receipt = await storeCatalogSourcePayload(
			{ source: "bangumi", objectType: "subject", externalId: "253" },
			bytes,
			"a".repeat(64),
			null,
			archive,
		);
		expect(Buffer.from(await readCatalogSourceBytes(receipt))).toEqual(bytes);
		expect(receipt.payloadRef).toMatch(
			/^catalog-sources\/bangumi\/[a-f0-9]{64}\/[a-f0-9]{64}\.json$/u,
		);
		expect(Object.isFrozen(receipt)).toBe(true);
		expect(Object.isFrozen(receipt.key)).toBe(true);
	});
	it("rejects altered archive bytes and copied/forged receipts", async () => {
		const { archive, objects } = memoryArchive();
		const receipt = await storeCatalogSourcePayload(
			{ source: "bangumi", objectType: "subject", externalId: "253" },
			Buffer.from("{}"),
			"a".repeat(64),
			null,
			archive,
		);
		objects.set(receipt.payloadRef, Buffer.from('{"changed":true}'));
		await expect(readCatalogSourceBytes(receipt)).rejects.toThrow("checksum differs");
		await expect(readCatalogSourceBytes({ ...receipt, payloadRef: "other" })).rejects.toThrow(
			"not produced",
		);
	});
	it("does not write oversized records or unsafe namespace paths", async () => {
		const { archive, objects } = memoryArchive();
		await expect(
			storeCatalogSourcePayload(
				{ source: "../outside", objectType: "subject", externalId: "1" },
				Buffer.from("{}"),
				"a".repeat(64),
				null,
				archive,
			),
		).rejects.toThrow();
		await expect(
			storeCatalogSourcePayload(
				{ source: "bangumi", objectType: "subject", externalId: "1" },
				new Uint8Array(8_000_001),
				"a".repeat(64),
				null,
				archive,
			),
		).rejects.toThrow("8 MB");
		expect(objects.size).toBe(0);
	});
	it("takes ownership of upload bytes before yielding to the archive", async () => {
		const { archive } = memoryArchive();
		const bytes = Buffer.from('{"id":253}');
		const original = Buffer.from(bytes);
		let uploadStarted: (() => void) | undefined;
		const started = new Promise<void>((resolve) => {
			uploadStarted = resolve;
		});
		let releaseUpload: (() => void) | undefined;
		const upload = new Promise<void>((resolve) => {
			releaseUpload = resolve;
		});
		const pending = storeCatalogSourcePayload(
			{ source: "bangumi", objectType: "subject", externalId: "253" },
			bytes,
			"a".repeat(64),
			null,
			{
				...archive,
				async put(input) {
					uploadStarted?.();
					await upload;
					return archive.put(input);
				},
			},
		);
		await started;
		bytes.fill(0);
		releaseUpload?.();
		expect(Buffer.from(await readCatalogSourceBytes(await pending))).toEqual(original);
	});
	it("resolves escaped object keys and exact array positions without inherited values", () => {
		const document = JSON.parse('{"a/b":{"~key":[{"id":253}]},"~1":"literal","__proto__":"own"}');
		expect(sourceReferenceAt(document, "/a~1b/~0key/0/id")).toBe("253");
		expect(sourceReferenceAt(document, "/~01")).toBe("literal");
		expect(sourceReferenceAt(document, "/__proto__")).toBe("own");
		for (const path of [
			"/a~1b/~0key/00/id",
			"/a~1b/~0key/-",
			"/a~1b/~0key/length",
			"/constructor",
			"/bad~2",
			"/missing",
		])
			expect(() => sourceReferenceAt(document, path)).toThrow();
		expect(() => sourceReferenceAt({ id: 9007199254740992 }, "/id")).toThrow("exact");
		expect(() => sourceReferenceAt({ id: {} }, "/id")).toThrow("exact");
	});
	it("rejects fabricated source-reference evidence", () => {
		expect(() =>
			requireCatalogSourceReferenceEvidence({
				source: "musicbrainz",
				sourceRecordId: crypto.randomUUID(),
				snapshotId: crypto.randomUUID(),
				path: "/artist-credit/0/artist/id",
				externalId: crypto.randomUUID(),
			}),
		).toThrow("not issued");
	});
});
