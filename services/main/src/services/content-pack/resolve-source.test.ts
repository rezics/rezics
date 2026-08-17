import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { ContentPackSourceNotFound } from "./errors";
import {
	defaultSiblingShowcasePacksDir,
	isShowcasePacksRoot,
	resolveShowcasePacksDir,
} from "./resolve-source";

describe("resolveShowcasePacksDir", () => {
	it("prefers --from over the environment and sibling default", () => {
		const root = mkdtempSync(join(tmpdir(), "showcase-from-"));
		const from = join(root, "explicit");
		mkdirSync(join(from, "packs"), { recursive: true });
		try {
			expect(
				resolveShowcasePacksDir({
					from,
					environment: { REZICS_SHOWCASE_PACKS_DIR: join(root, "missing") },
					repositoryRoot: root,
				}),
			).toBe(from);
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});

	it("uses REZICS_SHOWCASE_PACKS_DIR when --from is omitted", () => {
		const root = mkdtempSync(join(tmpdir(), "showcase-env-"));
		const envDir = join(root, "env-packs");
		mkdirSync(join(envDir, "packs"), { recursive: true });
		try {
			expect(
				resolveShowcasePacksDir({
					environment: { REZICS_SHOWCASE_PACKS_DIR: envDir },
					repositoryRoot: root,
				}),
			).toBe(envDir);
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});

	it("falls back to the sibling checkout when it exists", () => {
		const workspace = mkdtempSync(join(tmpdir(), "showcase-sibling-"));
		const repositoryRoot = join(workspace, "rezics");
		const sibling = join(workspace, "rezics-showcase-packs");
		mkdirSync(repositoryRoot);
		mkdirSync(join(sibling, "packs"), { recursive: true });
		try {
			expect(
				resolveShowcasePacksDir({
					environment: {},
					repositoryRoot,
				}),
			).toBe(sibling);
		} finally {
			rmSync(workspace, { recursive: true, force: true });
		}
	});

	it("fails without cloning or downloading when no directory exists", () => {
		const root = mkdtempSync(join(tmpdir(), "showcase-missing-"));
		try {
			expect(() =>
				resolveShowcasePacksDir({
					environment: {},
					repositoryRoot: root,
				}),
			).toThrow(ContentPackSourceNotFound);
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});

	it("recognizes a packs root and names the default sibling", () => {
		expect(defaultSiblingShowcasePacksDir(resolve("repo", "rezics"))).toBe(
			resolve("repo", "rezics-showcase-packs"),
		);
		expect(isShowcasePacksRoot("/no/such/packs/root")).toBe(false);
	});
});
