import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { env } from "../config";
import { assertLocalDatabaseUrl } from "../seed/data";
import { database } from "../database";
import { runVoteTransaction } from "../database/vote-admission";
import {
	DefaultContentPackBundleId,
	parseContentPackRunOptions,
	type ContentPackPlan,
} from "./contracts";
import { loadPack, listPackIds } from "./load-pack";
import { planContentPack } from "./plan";
import { applyContentPack } from "./apply";
import { verifyContentPack } from "./verify";
import { listContentPackStatus } from "./status";
import { resolveShowcasePacksDir } from "./resolve-source";

export class ContentPackService {
	async run(arguments_: readonly string[]): Promise<void> {
		assertLocalDatabaseUrl(env.DATABASE_URL);
		const options = parseContentPackRunOptions(arguments_);
		const sourceRoot = resolveShowcasePacksDir({ from: options.from });
		const packIds = await resolvePackIds(sourceRoot, options.packId, options.bundleId);

		if (options.command === "status") {
			const packs = await Promise.all(packIds.map((packId) => loadPack(sourceRoot, packId)));
			const status = await database.transaction((tx) => listContentPackStatus(tx, packs));
			console.info("Content pack status", { sourceRoot, packs: status });
			return;
		}

		for (const packId of packIds) {
			const pack = await loadPack(sourceRoot, packId);
			if (options.command === "plan") {
				const plan = await database.transaction((tx) => planContentPack(tx, pack, sourceRoot));
				printPlan(plan);
				continue;
			}
			if (options.command === "verify") {
				const verified = await database.transaction((tx) => verifyContentPack(tx, pack));
				console.info("Content pack verified", { packId, ...verified });
				continue;
			}
			const result = await runVoteTransaction(
				{ family: "content_pack", authority: "global" },
				(tx) => applyContentPack(tx, pack, sourceRoot),
			);
			console.info("Content pack apply", { packId, version: pack.manifest.version, ...result });
		}
	}
}

async function resolvePackIds(
	sourceRoot: string,
	packId: string | undefined,
	bundleId: string | undefined,
): Promise<string[]> {
	if (packId) return [packId];
	const requestedBundle = bundleId ?? DefaultContentPackBundleId;
	try {
		const raw = await readFile(join(sourceRoot, "bundles", `${requestedBundle}.yaml`), "utf8");
		const packs = [...raw.matchAll(/^\s*-\s+id:\s+(\S+)/gm)].map((match) => match[1]!);
		if (!packs.length) throw new TypeError(`Bundle ${requestedBundle} lists no packs`);
		return packs;
	} catch (error) {
		if (bundleId || (error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
		return listPackIds(sourceRoot);
	}
}

function printPlan(plan: ContentPackPlan): void {
	console.info("Content pack plan", {
		packId: plan.packId,
		version: plan.version,
		checksum: plan.checksum,
		alreadyInstalled: plan.alreadyInstalled,
		create: plan.createCount,
		noop: plan.noopCount,
		conflicts: plan.conflicts.map((item) =>
			item.action === "conflict" ? `${item.sourceKey}: ${item.reason}` : item.sourceKey,
		),
	});
}

export const contentPackService = new ContentPackService();
