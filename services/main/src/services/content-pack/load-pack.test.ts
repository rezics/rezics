import { describe, expect, it } from "vitest";

import { ContentPackSourceNotFound } from "./errors";
import { loadPack } from "./load-pack";
import { resolveShowcasePacksDir } from "./resolve-source";

describe("loadPack", () => {
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
		expect(pack.objects.some((object) => object.sourceKey === "toaru:entity:character:kamijou-touma")).toBe(
			true,
		);
		expect(pack.ids.units["toaru:entity:character:kamijou-touma"]).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
		);
	});
});
