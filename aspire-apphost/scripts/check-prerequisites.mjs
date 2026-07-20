import { spawnSync } from "node:child_process";

const expectedAspireVersion = "13.4.6";
const minimumBunVersion = "1.3.11";
const expectedYarnVersion = "4.17.1";

function parseVersion(value, tool) {
	const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value);
	if (!match) throw new Error(`${tool} returned an unsupported version string: ${value}`);
	return match.slice(1).map(Number);
}

function isAtLeast(actual, minimum) {
	for (let index = 0; index < minimum.length; index++) {
		if (actual[index] > minimum[index]) return true;
		if (actual[index] < minimum[index]) return false;
	}
	return true;
}

function run(command, args, remediation) {
	const result = spawnSync(command, args, {
		cwd: new URL("../..", import.meta.url),
		encoding: "utf8",
		shell: process.platform === "win32",
	});
	if (result.error || result.status !== 0) {
		const detail = result.error?.message ?? result.stderr.trim() ?? result.stdout.trim();
		throw new Error(`${command} ${args.join(" ")} failed: ${detail}\n${remediation}`);
	}
	return result.stdout.trim();
}

const aspireVersion = run(
	"yarn",
	["exec", "aspire", "--version"],
	"Run `yarn install --immutable` to install the repository-pinned Aspire CLI.",
).split("+")[0];
if (aspireVersion !== expectedAspireVersion)
	throw new Error(
		`Aspire CLI ${expectedAspireVersion} is required, but ${aspireVersion} was resolved. Run \`yarn install --immutable\`.`,
	);

const bunVersion = run(
	"bun",
	["--version"],
	"Install a supported Bun release or enter the repository devenv shell.",
);
if (!isAtLeast(parseVersion(bunVersion, "Bun"), parseVersion(minimumBunVersion, "Bun policy")))
	throw new Error(
		`Bun ${minimumBunVersion} or newer is required, but ${bunVersion} was resolved. Upgrade Bun or enter the repository devenv shell.`,
	);

const yarnVersion = run(
	"yarn",
	["--version"],
	"Use Corepack and the Yarn release committed under .yarn/releases.",
);
if (yarnVersion !== expectedYarnVersion)
	throw new Error(
		`Yarn ${expectedYarnVersion} is required, but ${yarnVersion} was resolved. Run \`corepack enable\` and retry.`,
	);

run(
	"docker",
	["info", "--format", "{{.ServerVersion}}"],
	"Start Docker or provide an Aspire-compatible OCI container runtime before running the AppHost.",
);

console.info(
	`Prerequisites ready: Aspire ${aspireVersion}, Bun ${bunVersion}, Yarn ${yarnVersion}, and Docker.`,
);
