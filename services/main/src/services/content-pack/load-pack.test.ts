import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ContentPackSourceNotFound } from "./errors";
import { loadPack } from "./load-pack";
import { resolveShowcasePacksDir } from "./resolve-source";

describe("loadPack", () => {
	it("includes relation documents in the pack checksum", async () => {
		const root = await mkdtemp(join(tmpdir(), "rezics-content-pack-"));
		const packDir = join(root, "packs", "checksum-fixture");
		const contentDir = join(packDir, "content");
		await mkdir(contentDir, { recursive: true });
		await Promise.all([
			writeFile(
				join(packDir, "pack.json"),
				JSON.stringify({ id: "checksum-fixture", version: "1.0.0" }),
			),
			writeFile(
				join(packDir, "ids.json"),
				JSON.stringify({ units: { "fixture:entity": "019c0000-0000-7000-8000-000000000001" } }),
			),
			writeFile(join(packDir, "rights.json"), "[]"),
			writeFile(join(packDir, "sources.lock.json"), "{}"),
			writeFile(
				join(contentDir, "entities.json"),
				JSON.stringify([
					{
						sourceKey: "fixture:entity",
						unit: {},
						import: {},
						localizations: [],
					},
				]),
			),
			writeFile(
				join(contentDir, "software.json"),
				JSON.stringify([{ sourceKey: "fixture:software" }]),
			),
			writeFile(
				join(contentDir, "releases.json"),
				JSON.stringify([{ sourceKey: "fixture:release" }]),
			),
			writeFile(join(contentDir, "video.json"), JSON.stringify([{ sourceKey: "fixture:video" }])),
			writeFile(join(contentDir, "audio.json"), JSON.stringify([{ sourceKey: "fixture:audio" }])),
			writeFile(join(contentDir, "relations.json"), JSON.stringify({ subjects: [] })),
		]);
		try {
			const before = await loadPack(root, "checksum-fixture");
			expect(before.objects.map(({ sourceKey }) => sourceKey)).toEqual([
				"fixture:software",
				"fixture:release",
				"fixture:video",
				"fixture:audio",
				"fixture:entity",
			]);
			await writeFile(
				join(contentDir, "relations.json"),
				JSON.stringify({ subjects: [{ sourceKey: "fixture:subject" }] }),
			);
			const after = await loadPack(root, "checksum-fixture");
			expect(after.checksum).not.toBe(before.checksum);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	it("loads toaru-core from the sibling checkout when present", async () => {
		let sourceRoot: string;
		try {
			sourceRoot = resolveShowcasePacksDir({});
		} catch (error) {
			if (error instanceof ContentPackSourceNotFound) return;
			throw error;
		}
		const pack = await loadPack(sourceRoot, "toaru-core");
		expect(pack.manifest.id).toBe("toaru-core");
		expect(pack.checksum).toMatch(/^[0-9a-f]{64}$/);
		expect(
			pack.objects.some((object) => object.sourceKey === "toaru:entity:character:kamijou-touma"),
		).toBe(true);
		expect(pack.ids.units["toaru:entity:character:kamijou-touma"]).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
		);
	});
});
