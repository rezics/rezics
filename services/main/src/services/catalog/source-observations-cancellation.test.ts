import { describe, expect, test } from "vitest";
import { Readable } from "node:stream";
import { createHash } from "node:crypto";
type CatalogSourceArchive = import("./source-observations").CatalogSourceArchive;

const dummyEnv: Readonly<Record<string, string>> = {
	DATABASE_URL: "postgresql://test:test@localhost:5432/rezics",
	BETTER_AUTH_SECRET: "test-secret-that-is-longer-than-thirty-two-characters",
	BETTER_AUTH_URL: "http://localhost:3001",
	BETTER_AUTH_TRUSTED_ORIGINS: "http://localhost:3000",
	TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
	TURNSTILE_ALLOWED_HOSTNAMES: "localhost,127.0.0.1",
	EMAIL_MODE: "log",
	EMAIL_FROM: "test@example.com",
	EMAIL_FROM_NAME: "Rezics",
	S3_ENDPOINT: "http://localhost:9000",
	S3_ACCESS_KEY_ID: "test-access-key",
	S3_SECRET_ACCESS_KEY: "test-secret-key",
	S3_BUCKET: "rezics-test",
};
for (const [name, value] of Object.entries(dummyEnv)) process.env[name] = value;

const {
	storeCatalogSourcePayload,
	storeCatalogSourceMultipartPayload,
	readCatalogSourceBytes,
	readCatalogSourceNativeBytes,
	readCatalogSourceProfileBytes,
} = await import("./source-observations");

const key = { source: "musicbrainz", objectType: "release", externalId: "11111111-1111-4111-8111-111111111111" };
const body = new TextEncoder().encode(JSON.stringify({ id: key.externalId, title: "Evidence" }));
const hash = "1".repeat(64);
const reason = () => new Error("source-read-cancelled");

function barrier<T = void>() {
	let release!: (value: T | PromiseLike<T>) => void;
	const wait = new Promise<T>((resolve) => {
		release = resolve;
	});
	return { wait, release };
}

function memoryArchive(get?: CatalogSourceArchive["get"]) {
	const objects = new Map<string, Uint8Array>();
	const client: CatalogSourceArchive = {
		async put(input) {
			objects.set(input.Key, input.Body.slice());
		},
		async get(input, options) {
			if (get) return get(input, options);
			const bytes = objects.get(input.Key);
			return { Body: bytes ? Readable.from([bytes]) : undefined };
		},
	};
	return { objects, client };
}

function parts(observedAt: string) {
	return [
		{
			key: "raw",
			profile: "fixture.raw.1",
			kind: "upstream_response" as const,
			bytes: body,
			requestUrl: `https://musicbrainz.org/ws/2/release/${key.externalId}`,
			observedAt,
		},
		{
			key: "native_view",
			profile: "fixture.1",
			kind: "derived_view" as const,
			bytes: new TextEncoder().encode(JSON.stringify({ id: key.externalId })),
			requestUrl: null,
			observedAt,
		},
	];
}

describe("source archive read cancellation", () => {
	test("a pre-aborted signal never calls archive.get", async () => {
		let getCalls = 0;
		const store = memoryArchive(async () => {
			getCalls++;
			return { Body: Readable.from([body]) };
		});
		const receipt = await storeCatalogSourcePayload(key, body, hash, null, store.client);
		const controller = new AbortController();
		controller.abort(reason());
		await expect(readCatalogSourceBytes(receipt, controller.signal)).rejects.toThrow("source-read-cancelled");
		await expect(readCatalogSourceNativeBytes(receipt, controller.signal)).rejects.toThrow("source-read-cancelled");
		await expect(readCatalogSourceProfileBytes(receipt, "document", controller.signal)).rejects.toThrow(
			"source-read-cancelled",
		);
		expect(getCalls).toBe(0);
	});

	test("a delayed get is rejected promptly and the late Node readable is closed", async () => {
		const started = barrier();
		const hold = barrier();
		const closed = barrier();
		let getCalls = 0;
		let lateBody: Readable | undefined;
		const store = memoryArchive(async () => {
			getCalls++;
			started.release();
			await hold.wait;
			lateBody = Readable.from([body]);
			lateBody.on("close", () => closed.release());
			return { Body: lateBody };
		});
		const receipt = await storeCatalogSourcePayload(key, body, hash, null, store.client);
		const controller = new AbortController();
		const pending = readCatalogSourceBytes(receipt, controller.signal);
		await started.wait;
		expect(getCalls).toBe(1);
		const cancelled = reason();
		controller.abort(cancelled);
		await expect(pending).rejects.toBe(cancelled);
		hold.release();
		await closed.wait;
		expect(lateBody?.destroyed).toBe(true);
	});

	test("a stalled Node readable is destroyed on abort", async () => {
		const reading = barrier();
		const closed = barrier();
		const stalled = new Readable({
			read() {
				reading.release();
			},
		});
		stalled.on("close", () => closed.release());
		const store = memoryArchive(async () => ({ Body: stalled }));
		const receipt = await storeCatalogSourcePayload(key, body, hash, null, store.client);
		const controller = new AbortController();
		const pending = readCatalogSourceBytes(receipt, controller.signal);
		await reading.wait;
		controller.abort(reason());
		await expect(pending).rejects.toThrow();
		await closed.wait;
		expect(stalled.destroyed).toBe(true);
	});

	test("a stalled WHATWG readable stream is cancelled on abort", async () => {
		const pulled = barrier();
		const cancelled = barrier();
		let cancelCalled = false;
		const stream = new ReadableStream<Uint8Array>({
			pull() {
				pulled.release();
			},
			cancel() {
				cancelCalled = true;
				cancelled.release();
			},
		});
		const store = memoryArchive(async () => ({ Body: stream }));
		const receipt = await storeCatalogSourcePayload(key, body, hash, null, store.client);
		const controller = new AbortController();
		const pending = readCatalogSourceBytes(receipt, controller.signal);
		await pulled.wait;
		controller.abort(reason());
		await expect(pending).rejects.toThrow();
		await cancelled.wait;
		expect(cancelCalled).toBe(true);
	});

	test("happy-path checksum validation is retained for single and multipart receipts", async () => {
		const store = memoryArchive();
		const receipt = await storeCatalogSourcePayload(key, body, hash, null, store.client);
		const bytes = await readCatalogSourceBytes(receipt);
		expect(Buffer.from(bytes)).toEqual(Buffer.from(body));
		expect(createHash("sha256").update(bytes).digest("hex")).toBe(receipt.contentSha256);
		expect(createHash("sha256").update(await readCatalogSourceNativeBytes(receipt)).digest("hex")).toBe(
			receipt.contentSha256,
		);
		expect(createHash("sha256").update(await readCatalogSourceProfileBytes(receipt, "document")).digest("hex")).toBe(
			receipt.contentSha256,
		);
		const multipart = await storeCatalogSourceMultipartPayload(
			key,
			"fixture.1",
			hash,
			parts("2026-09-08T00:00:00.000Z"),
			hash,
			store.client,
		);
		expect(createHash("sha256").update(await readCatalogSourceBytes(multipart)).digest("hex")).toBe(
			multipart.contentSha256,
		);
		expect(Uint8Array.from(await readCatalogSourceProfileBytes(multipart, "raw"))).toEqual(body);
		expect(JSON.parse(new TextDecoder().decode(await readCatalogSourceNativeBytes(multipart)))).toEqual({
			id: key.externalId,
		});
	});
});
