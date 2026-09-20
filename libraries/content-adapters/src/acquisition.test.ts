import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	fetchProviderSchemas,
	readProviderAcquisition,
	type ProviderArtifact,
} from "./acquisition";

const roots: string[] = [];
const artifact: ProviderArtifact = {
	source: "bangumi",
	file: "subject.json",
	format: "json_schema",
	url: "https://raw.githubusercontent.com/bangumi/server/HEAD/subject.json",
};
const artifacts = [artifact];
const text = '{"type":"object","properties":{"name":{"type":"string"}}}';
async function directory() {
	const root = fileURLToPath(new URL("../../../.temp/", import.meta.url));
	await mkdir(root, { recursive: true });
	const path = await mkdtemp(resolve(root, "provider-acquisition-"));
	roots.push(path);
	return path;
}
afterEach(async () => {
	for (const path of roots.splice(0)) await rm(path, { recursive: true, force: true });
});

describe("current provider acquisition", () => {
	it("fetches again with a warm cache and observes changed bytes without a source pin", async () => {
		const path = await directory();
		const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => new Response(text));
		const options = { directory: path, artifacts, fetcher };
		const first = await fetchProviderSchemas("all", options);
		fetcher.mockImplementation(async () => new Response(text.replace("string", "integer")));
		const second = await fetchProviderSchemas("all", options);
		expect(fetcher).toHaveBeenCalledTimes(2);
		expect(second.runId).not.toBe(first.runId);
		expect(second.artifacts[0]?.sha256).not.toBe(first.artifacts[0]?.sha256);
		expect((await readProviderAcquisition("all", options)).inputs[0]?.text).toContain("integer");
		expect(await readFile(resolve(path, "runs", first.runId, artifact.file), "utf8")).toBe(text);
	});

	it("keeps the previous complete run after a later artifact fails, with explicit failed-run evidence", async () => {
		const path = await directory();
		const pair = [
			artifact,
			{ ...artifact, file: "second.json", url: artifact.url.replace("subject", "second") },
		];
		const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => new Response(text));
		const options = { directory: path, artifacts: pair, fetcher };
		const first = await fetchProviderSchemas("all", options);
		fetcher
			.mockReset()
			.mockResolvedValueOnce(new Response(text.replace("string", "boolean")))
			.mockResolvedValueOnce(new Response("unavailable", { status: 503 }));
		await expect(fetchProviderSchemas("all", options)).rejects.toThrow("HTTP 503");
		const captured = await readProviderAcquisition("all", options);
		expect(captured.receipt.runId).toBe(first.runId);
		expect(captured.inputs.every((input) => input.text === text)).toBe(true);
		const failed = (await readdir(resolve(path, "runs"))).find((id) => id !== first.runId);
		expect(failed).toBeDefined();
		expect(
			JSON.parse(await readFile(resolve(path, "runs", failed!, "failure.json"), "utf8"))
				.completedArtifacts,
		).toHaveLength(1);
	});

	it.each(["malformed", "empty", "oversized", "timeout"])(
		"rejects %s input without publishing a current receipt",
		async (failure) => {
			const path = await directory();
			const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => {
				if (failure === "timeout") throw new DOMException("Timed out", "TimeoutError");
				return new Response(
					failure === "malformed" ? "{broken" : failure === "empty" ? "" : "x".repeat(8_000_001),
				);
			});
			await expect(
				fetchProviderSchemas("all", { directory: path, artifacts, fetcher }),
			).rejects.toThrow();
			await expect(readFile(resolve(path, "current.json"))).rejects.toMatchObject({
				code: "ENOENT",
			});
		},
	);

	it("verifies observed bytes during offline replay and performs no network request", async () => {
		const path = await directory();
		const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => new Response(text));
		const options = { directory: path, artifacts, fetcher };
		const receipt = await fetchProviderSchemas("all", options);
		await readProviderAcquisition("all", options);
		expect(fetcher).toHaveBeenCalledTimes(1);
		await writeFile(
			resolve(path, "runs", receipt.runId, artifact.file),
			text.replace("string", "number"),
		);
		await expect(readProviderAcquisition("all", options)).rejects.toThrow(
			"Captured provider bytes changed",
		);
	});

	it("cannot use a subset capture for an uncovered provider or a changed acquisition definition", async () => {
		const path = await directory();
		const both = [artifact, { ...artifact, source: "openlibrary" as const, file: "other.json" }];
		const options = {
			directory: path,
			artifacts: both,
			fetcher: vi.fn<typeof fetch>().mockImplementation(async () => new Response(text)),
		};
		await fetchProviderSchemas("bangumi", options);
		await expect(readProviderAcquisition("all", options)).rejects.toThrow("does not cover");
		await expect(
			readProviderAcquisition("bangumi", {
				...options,
				artifacts: [{ ...artifact, url: artifact.url + "?changed=1" }],
			}),
		).rejects.toThrow("definitions changed");
	});

	it("rejects a forged current receipt even when its run exists", async () => {
		const path = await directory();
		const options = {
			directory: path,
			artifacts,
			fetcher: vi.fn<typeof fetch>().mockImplementation(async () => new Response(text)),
		};
		const receipt = await fetchProviderSchemas("all", options);
		await writeFile(
			resolve(path, "current.json"),
			JSON.stringify({ ...receipt, startedAt: "2020-01-01T00:00:00.000Z" }),
		);
		await expect(readProviderAcquisition("all", options)).rejects.toThrow("receipt differs");
	});

	it("rejects unknown sources, duplicate artifact paths and unadmitted origins before fetching", async () => {
		const path = await directory();
		const fetcher = vi.fn<typeof fetch>();
		await expect(
			fetchProviderSchemas("unknown", { directory: path, artifacts, fetcher }),
		).rejects.toThrow();
		await expect(
			fetchProviderSchemas("all", { directory: path, artifacts: [artifact, artifact], fetcher }),
		).rejects.toThrow("Duplicate artifact");
		await expect(
			fetchProviderSchemas("all", {
				directory: path,
				artifacts: [{ ...artifact, url: "http://localhost/private" }],
				fetcher,
			}),
		).rejects.toThrow();
		expect(fetcher).not.toHaveBeenCalled();
	});
});
