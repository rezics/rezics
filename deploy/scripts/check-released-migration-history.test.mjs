import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { checkReleasedMigrationHistory } from "./check-released-migration-history.mjs";

test("published native history is immutable at HEAD and across release branches", () => {
	const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
	const temporaryRoot = join(root, ".temp");
	mkdirSync(temporaryRoot, { recursive: true });
	const fixture = mkdtempSync(join(temporaryRoot, "migration-release-test-"));
	const migrationDirectory = "services/main/src/services/database/migrations";
	const baseline = `${migrationDirectory}/20260908000000_operational_target_baseline.sql`;
	const configuration = "services/main/src/services/database/baseline.json";
	const git = (...args) => execFileSync("git", args, { cwd: fixture, encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }).trim();
	const write = (path, content) => {
		mkdirSync(dirname(join(fixture, path)), { recursive: true });
		writeFileSync(join(fixture, path), content);
	};
	const commit = () => {
		git("add", "--", migrationDirectory, configuration);
		git("-c", "user.name=Migration fixture", "-c", "user.email=migration@example.invalid", "-c", "core.hooksPath=/dev/null", "commit", "--quiet", "-m", "Native release fixture");
		return git("rev-parse", "HEAD");
	};
	try {
		execFileSync("git", ["clone", "--shared", "--no-checkout", "--quiet", root, fixture], { windowsHide: true, stdio: "pipe" });
		git("read-tree", "HEAD");
		// Only this isolated clone's index changes. Existing release objects remain available.
		git("rm", "--quiet", "-r", "--cached", "--", migrationDirectory);
		const baselineBytes = "-- Native immutable baseline fixture\nselect 1;\n";
		const configurationBytes = readFileSync(join(root, configuration));
		write(baseline, baselineBytes);
		write(configuration, configurationBytes);
		assert.match(checkReleasedMigrationHistory(fixture, {}), /first native installation epoch/);
		const firstRelease = commit();
		git("tag", "v99000.0.0", firstRelease);
		assert.match(checkReleasedMigrationHistory(fixture, {}), /immutable native migrations/);
		write(baseline, `${baselineBytes}select 2;\n`);
		assert.throws(() => checkReleasedMigrationHistory(fixture, {}), /was modified/);
		write(baseline, baselineBytes);
		rmSync(join(fixture, baseline));
		assert.throws(() => checkReleasedMigrationHistory(fixture, {}), /baseline is missing/);
		write(baseline, baselineBytes);
		write(configuration, `${configurationBytes.toString()}\n`);
		assert.throws(() => checkReleasedMigrationHistory(fixture, {}), /installation epoch.*modified/);
		write(configuration, configurationBytes);
		const forward = `${migrationDirectory}/20260910000000_forward.sql`;
		write(forward, "select 3;\n");
		commit();
		git("tag", "v99000.1.0");
		const outOfOrder = `${migrationDirectory}/20260909000000_late.sql`;
		write(outOfOrder, "select 4;\n");
		assert.throws(() => checkReleasedMigrationHistory(fixture, {}), /sorts before the released boundary/);
		rmSync(join(fixture, outOfOrder));
		// HEAD points at the earlier release; the newer tag is now a non-ancestor.
		git("update-ref", "HEAD", firstRelease);
		assert.match(checkReleasedMigrationHistory(fixture, {}), /2 root releases/);
		write(forward, "select 5;\n");
		assert.throws(() => checkReleasedMigrationHistory(fixture, {}), /was modified/);
	} finally {
		const child = relative(temporaryRoot, fixture);
		assert.ok(child && !child.startsWith("..") && !child.includes("/") && !child.includes("\\"));
		rmSync(fixture, { recursive: true, force: true });
	}
});
