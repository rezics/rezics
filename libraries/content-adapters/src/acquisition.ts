import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { digest } from "@rezics/schema/identity";
import {
	CatalogSourceValues,
	inventoryVndb,
	normalizeProviderArtifact,
} from "./readers/provider-contracts";
import { readSchemaDocument } from "./readers/json-schema";

const root = fileURLToPath(new URL("../", import.meta.url));
const inputRoot = resolve(root, "contracts/catalog/inputs");
const sourceSchema = z.enum(["all", ...CatalogSourceValues]);
const artifactLimit = 8_000_000;
const runLimit = 32_000_000;
const artifactSchema = z.strictObject({
	file: z.string().regex(/^[a-z0-9][a-z0-9._-]+$/u),
	source: z.enum(CatalogSourceValues),
	format: z.enum([
		"openapi",
		"json_schema",
		"vndb",
		"musicbrainz_sql",
		"musicbrainz_foreign_keys",
		"musicbrainz_primary_keys",
		"openlibrary_type",
		"archive",
		"vocabulary",
	]),
	url: z.url().refine((value) => {
		const url = new URL(value);
		return (
			url.protocol === "https:" &&
			!url.username &&
			!url.password &&
			["raw.githubusercontent.com", "api.vndb.org"].includes(url.hostname)
		);
	}, "Provider contracts require an admitted public HTTPS origin"),
});
const artifactsSchema = z
	.array(artifactSchema)
	.min(1)
	.max(128)
	.superRefine((entries, ctx) => {
		const names = new Set<string>();
		for (const entry of entries) {
			if (names.has(entry.file))
				ctx.addIssue({ code: "custom", message: `Duplicate artifact: ${entry.file}` });
			names.add(entry.file);
		}
	});
const receiptSchema = z.strictObject({
	format: z.literal("rezics.provider-acquisition.v1"),
	runId: z.uuid(),
	scope: sourceSchema,
	startedAt: z.iso.datetime(),
	completedAt: z.iso.datetime(),
	artifacts: z
		.array(
			artifactSchema.extend({
				fetchedAt: z.iso.datetime(),
				status: z.literal(200),
				bytes: z.number().int().positive().max(artifactLimit),
				sha256: z.string().regex(/^[a-f0-9]{64}$/u),
			}),
		)
		.min(1)
		.max(128),
});

/** @internal Current acquisition definitions, not upstream content/version pins. */
export type ProviderArtifact = z.infer<typeof artifactSchema>;
/** @internal Exact observations of one completed acquisition; later runs fetch again. */
export type ProviderAcquisitionReceipt = z.infer<typeof receiptSchema>;
/** @internal Maintainer acquisition configuration; injectable transport/storage enables offline failure tests. */
export interface ProviderAcquisitionOptions {
	directory?: string;
	artifacts?: readonly ProviderArtifact[];
	fetcher?: typeof fetch;
}

/** @alpha Read bounded current provider URLs. @remarks For maintainer tooling; does not confer native schema ownership. */
export async function providerArtifacts(): Promise<ProviderArtifact[]> {
	return artifactsSchema.parse(
		JSON.parse(await readFile(resolve(root, "contracts/catalog/sources.json"), "utf8")),
	);
}

function selectedArtifacts(source: string, artifacts: readonly ProviderArtifact[]) {
	const scope = sourceSchema.parse(source);
	const selected = artifactsSchema
		.parse(artifacts)
		.filter((entry) => scope === "all" || scope === entry.source);
	if (!selected.length) throw new Error(`No acquisition definitions for ${scope}`);
	return selected;
}

function validatePayload(entry: ProviderArtifact, bytes: Buffer) {
	const normalized = normalizeProviderArtifact(entry.format, bytes);
	const text = new TextDecoder("utf-8", { fatal: true }).decode(normalized);
	if (!text.trim()) throw new TypeError(`Empty provider contract: ${entry.file}`);
	if (entry.format === "vndb") inventoryVndb(JSON.parse(text));
	else if (["openapi", "json_schema", "openlibrary_type", "vocabulary"].includes(entry.format))
		readSchemaDocument(text);
	return text;
}

/**
 * @alpha Fetch fresh current inputs and atomically publish a complete acquisition receipt.
 * @remarks Maintainer tooling only. No cache hit skips the network. Failed runs retain
 * diagnostics without replacing the prior completed receipt or executing downloaded content.
 */
export async function fetchProviderSchemas(
	source = "all",
	options: ProviderAcquisitionOptions = {},
): Promise<ProviderAcquisitionReceipt> {
	const artifacts = selectedArtifacts(source, options.artifacts ?? (await providerArtifacts()));
	const directory = options.directory ?? inputRoot;
	const runId = randomUUID();
	const runDirectory = resolve(directory, "runs", runId);
	const startedAt = new Date().toISOString();
	const observed: ProviderAcquisitionReceipt["artifacts"] = [];
	let totalBytes = 0;
	await mkdir(runDirectory, { recursive: true });
	try {
		for (const entry of artifacts) {
			const response = await (options.fetcher ?? fetch)(entry.url, {
				signal: AbortSignal.timeout(30_000),
				redirect: "error",
				headers: {
					"User-Agent": "REZICS-source-validation/1 (+https://rezics.com)",
					"Cache-Control": "no-cache",
				},
			});
			if (response.status !== 200 || !response.body)
				throw new Error(
					`Provider fetch failed: ${entry.source}/${entry.file}: HTTP ${response.status}`,
				);
			const chunks: Uint8Array[] = [];
			let size = 0;
			for await (const chunk of response.body) {
				size += chunk.byteLength;
				totalBytes += chunk.byteLength;
				if (size > artifactLimit || totalBytes > runLimit)
					throw new RangeError(`Provider acquisition exceeds byte budget: ${entry.file}`);
				chunks.push(chunk);
			}
			const bytes = Buffer.concat(chunks);
			validatePayload(entry, bytes);
			await writeFile(resolve(runDirectory, entry.file), bytes, { flag: "wx" });
			observed.push({
				...entry,
				fetchedAt: new Date().toISOString(),
				status: 200,
				bytes: bytes.length,
				sha256: digest(bytes),
			});
		}
		const receipt = receiptSchema.parse({
			format: "rezics.provider-acquisition.v1",
			runId,
			scope: source,
			startedAt,
			completedAt: new Date().toISOString(),
			artifacts: observed,
		});
		const serialized = JSON.stringify(receipt, null, "\t") + "\n";
		await writeFile(resolve(runDirectory, "receipt.json"), serialized, { flag: "wx" });
		const next = resolve(directory, `current-${runId}.json`);
		await writeFile(next, serialized, { flag: "wx" });
		await rename(next, resolve(directory, "current.json"));
		return receipt;
	} catch (error) {
		await writeFile(
			resolve(runDirectory, "failure.json"),
			JSON.stringify(
				{
					runId,
					source,
					startedAt,
					failedAt: new Date().toISOString(),
					completedArtifacts: observed,
					error: error instanceof Error ? error.message : String(error),
				},
				null,
				"\t",
			) + "\n",
		);
		throw error;
	}
}

/**
 * @alpha Read and verify one captured run for offline conversion.
 * @remarks Digests prove the integrity of that run, not compatibility with the current site.
 * A partial-provider run cannot qualify an all-provider conversion.
 */
export async function readProviderAcquisition(
	source = "all",
	options: ProviderAcquisitionOptions = {},
) {
	const artifacts = selectedArtifacts(source, options.artifacts ?? (await providerArtifacts()));
	const directory = options.directory ?? inputRoot;
	const current = resolve(directory, "current.json");
	if ((await stat(current)).size > 1_048_576)
		throw new RangeError("Provider receipt exceeds budget");
	const receipt = receiptSchema.parse(JSON.parse(await readFile(current, "utf8")));
	const expectedReceipt = await readFile(
		resolve(directory, "runs", receipt.runId, "receipt.json"),
		"utf8",
	);
	if (JSON.stringify(receipt) !== JSON.stringify(receiptSchema.parse(JSON.parse(expectedReceipt))))
		throw new Error("Provider acquisition receipt differs from its recorded run");
	const recorded = selectedArtifacts(
		receipt.scope,
		options.artifacts ?? (await providerArtifacts()),
	);
	if (
		recorded.length !== receipt.artifacts.length ||
		recorded.some(
			(entry) =>
				!receipt.artifacts.some(
					(item) =>
						item.file === entry.file &&
						item.source === entry.source &&
						item.format === entry.format &&
						item.url === entry.url,
				),
		)
	)
		throw new Error("Provider acquisition definitions changed; fetch a new complete run");
	const inputs: { artifact: ProviderArtifact; text: string }[] = [];
	let totalBytes = 0;
	for (const entry of artifacts) {
		const observation = receipt.artifacts.find(
			(item) => item.file === entry.file && item.source === entry.source,
		);
		if (!observation)
			throw new Error(`Provider acquisition does not cover ${entry.source}/${entry.file}`);
		const path = resolve(directory, "runs", receipt.runId, entry.file);
		const size = (await stat(path)).size;
		totalBytes += size;
		if (size !== observation.bytes || size > artifactLimit || totalBytes > runLimit)
			throw new Error(`Captured provider size mismatch: ${entry.file}`);
		const bytes = await readFile(path);
		if (digest(bytes) !== observation.sha256)
			throw new Error(`Captured provider bytes changed: ${entry.file}`);
		inputs.push({ artifact: entry, text: validatePayload(entry, bytes) });
	}
	return { receipt, inputs };
}
