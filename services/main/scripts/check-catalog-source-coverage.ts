import { readFile, realpath, stat, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { z } from "zod";
import { digest } from "@rezics/schema/identity";
import { readProviderAcquisition } from "@rezics/content-adapters/acquisition";
import {
	evaluateSourceCoverage,
	parseCoverageInventory,
	SourceCoverageManifestSchema,
} from "./catalog-source-coverage";

const repository = fileURLToPath(new URL("../../../", import.meta.url));
const contracts = "services/main/src/services/catalog/source-contracts";

/** @internal Offline maintainer gate; bounded metadata only, no corpus or runtime access. */
export async function checkCatalogSourceCoverage(root: string = repository) {
	const canonicalRoot = await realpath(root);
	let totalBytes = 0;
	const read = async (path: string) => {
		const absolute = await realpath(resolve(canonicalRoot, path));
		const within = relative(canonicalRoot, absolute);
		if (
			isAbsolute(within) ||
			within === ".." ||
			within.startsWith("../") ||
			within.startsWith("..\\")
		)
			throw new Error(`Evidence escapes repository: ${path}`);
		const metadata = await stat(absolute);
		if (!metadata.isFile() || metadata.size > 8_000_000 || totalBytes + metadata.size > 64_000_000)
			throw new Error(`Coverage file budget exceeded: ${path}`);
		totalBytes += metadata.size;
		return readFile(absolute, "utf8");
	};
	const inventoryText = await read(`${contracts}/fields.jsonl`);
	const fields = parseCoverageInventory(
		inventoryText
			.trim()
			.split(/\r?\n/u)
			.map((line) => JSON.parse(line)),
	);
	const inventory = z
		.strictObject({
			format: z.literal("rezics.source-inventory.v1"),
			acquisition: z.unknown(),
			fieldsSha256: z.string().regex(/^[a-f0-9]{64}$/u),
		})
		.parse(JSON.parse(await read(`${contracts}/inventory.json`)));
	if (digest(Buffer.from(inventoryText)) !== inventory.fieldsSha256)
		throw new Error("Generated source inventory differs from its captured run receipt");
	const { receipt } = await readProviderAcquisition("all", {
		directory: resolve(canonicalRoot, "libraries/content-adapters/contracts/catalog/inputs"),
	});
	if (JSON.stringify(inventory.acquisition) !== JSON.stringify(receipt))
		throw new Error("Generated inventory is not from the current captured run; regenerate it");
	const manifest = SourceCoverageManifestSchema.parse(
		JSON.parse(await read(`${contracts}/coverage.json`)),
	);
	const references = new Set<string>();
	for (const entry of manifest.entries)
		if (entry.disposition === "native" && entry.mapping.status === "evidenced")
			for (const reference of Object.values(entry.mapping.evidence)) references.add(reference.file);
	const evidence = new Map<string, string>();
	for (const file of references) {
		try {
			evidence.set(file, await read(file));
		} catch (error: unknown) {
			if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
			// The evaluator reports a missing reference for each affected field/role.
		}
	}
	return {
		...evaluateSourceCoverage(fields, receipt, manifest, evidence),
		acquisition: receipt,
		freshness: "Captured run only; live qualification requires a preceding fresh acquisition.",
	};
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
	try {
		const arguments_ = process.argv.slice(2);
		if (arguments_.some((argument) => !["--inspect", "--json"].includes(argument)))
			throw new Error(
				"Usage: bun services/main/scripts/check-catalog-source-coverage.ts [--inspect] [--json]",
			);
		const report = await checkCatalogSourceCoverage();
		await writeFile(
			resolve(repository, contracts, "report.json"),
			JSON.stringify(report, null, "\t") + "\n",
		);
		console.log(
			JSON.stringify(
				arguments_.includes("--json")
					? report
					: {
							...report,
							acquisition: {
								runId: report.acquisition.runId,
								completedAt: report.acquisition.completedAt,
								artifacts: report.acquisition.artifacts.length,
							},
							missing: { count: report.missing.length, first: report.missing.slice(0, 10) },
							nativeGaps: {
								count: report.nativeGaps.length,
								first: report.nativeGaps.slice(0, 10),
							},
						},
				null,
				2,
			),
		);
		process.exitCode = arguments_.includes("--inspect")
			? Number(report.issues.length > 0)
			: Number(!report.qualified);
	} catch (error: unknown) {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	}
}
