import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const migrationDirectory = "services/main/src/services/database/migrations";
const configurationPath = "services/main/src/services/database/baseline.json";
const nativeMigration = "20260908000000_operational_target_baseline.sql";
const recoveryCommit = "338e950b814148d16649c7817ac04fc826c51f8c";

/** Each installation epoch is immutable after its first release. */
export function checkReleasedMigrationHistory(repositoryRoot, environment = process.env) {
	const git = (...args) => execFileSync("git", args, { cwd: repositoryRoot, encoding: "utf8", windowsHide: true }).trim();
	const succeeds = (...args) => spawnSync("git", args, { cwd: repositoryRoot, stdio: "ignore", windowsHide: true }).status === 0;
	const releasePattern = /^v\d+\.\d+\.\d+$/u;
	if (environment.GITHUB_REF_TYPE === "tag" && !releasePattern.test(environment.GITHUB_REF_NAME ?? ""))
		throw new Error("Server release tags must use vPROJECT.MAJOR.MINOR");
	const head = git("rev-parse", "--verify", "HEAD^{commit}");
	const tags = git("tag", "--list", "v*", "--sort=-version:refname").split(/\r?\n/u).filter(tag => releasePattern.test(tag));
	if (!tags.length) throw new Error("Fetch root release tags before checking migration history");
	const configuration = JSON.parse(readFileSync(join(repositoryRoot, configurationPath), "utf8"));
	if (configuration.epoch !== "operational-native-20260908" || configuration.migration !== nativeMigration ||
		configuration.replacedHistoryCommit !== recoveryCommit || configuration.installation !== "fresh-database")
		throw new Error("The native installation epoch must match its reviewed baseline contract");
	if (!succeeds("merge-base", "--is-ancestor", recoveryCommit, head))
		throw new Error("The explicitly replaced migration history recovery commit is unavailable");
	const currentFiles = readdirSync(join(repositoryRoot, migrationDirectory)).filter(name => name.endsWith(".sql")).sort();
	if (!currentFiles.includes(nativeMigration)) throw new Error("The fresh native baseline is missing");
	if (currentFiles.some(name => name < nativeMigration)) throw new Error("The native epoch cannot retain the replaced migration chain");
	const nativeReleases = tags.filter(tag => succeeds("cat-file", "-e", `${tag}:${migrationDirectory}/${nativeMigration}`));
	if (!nativeReleases.length) {
		const previous = tags.find(tag => succeeds("merge-base", "--is-ancestor", tag, head));
		if (!previous) throw new Error("No prior root release is an ancestor of the first native installation epoch");
		// The sole authorized replacement. Subsequent releases follow the same
		// immutable-history checks as ordinary forward migrations.
		return `Validated the first native installation epoch against ${previous}; installation requires a fresh database`;
	}
	const releasedSet = new Set();
	for (const releasedTag of nativeReleases) {
		if (!succeeds("cat-file", "-e", `${releasedTag}:${configurationPath}`) ||
			git("rev-parse", `${releasedTag}:${configurationPath}`) !== git("hash-object", "--", configurationPath))
			throw new Error(`The released installation epoch from ${releasedTag} was modified`);
		const released = git("ls-tree", "-r", "--name-only", releasedTag, "--", migrationDirectory)
			.split(/\r?\n/u).filter(path => path.endsWith(".sql"));
		for (const path of released) {
			if (!existsSync(join(repositoryRoot, path))) throw new Error(`Released migration from ${releasedTag} was deleted: ${path}`);
			if (git("rev-parse", `${releasedTag}:${path}`) !== git("hash-object", "--", path))
				throw new Error(`Released migration from ${releasedTag} was modified: ${path}; add a forward migration`);
			releasedSet.add(path);
		}
	}
	const latest = [...releasedSet].sort().at(-1);
	for (const name of currentFiles) {
		const path = `${migrationDirectory}/${name}`;
		if (!releasedSet.has(path) && latest && path < latest)
			throw new Error(`New migration sorts before the released boundary: ${path}`);
	}
	return `Validated ${releasedSet.size} immutable native migrations across ${nativeReleases.length} root releases`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	try {
		console.log(checkReleasedMigrationHistory(resolve(dirname(fileURLToPath(import.meta.url)), "../..")));
	} catch (error) {
		console.error(error instanceof Error ? error.message : error);
		process.exitCode = 1;
	}
}
