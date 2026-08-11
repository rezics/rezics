import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const markdownWorkspace = fileURLToPath(new URL("..", import.meta.url));
const environment = { ...process.env };

// linuxdeploy currently bundles a strip implementation that cannot read the
// SHT_RELR sections emitted by newer Linux distributions (including Fedora 44).
// The application itself is still compiled with Cargo's release profile; this
// only disables linuxdeploy's second pass over the completed AppDir.
if (process.platform === "linux" && environment.NO_STRIP === undefined) {
	environment.NO_STRIP = "1";
}

const yarnExecutable = process.platform === "win32" ? "yarn.cmd" : "yarn";
const result = spawnSync(yarnExecutable, ["exec", "tauri", "build", ...process.argv.slice(2)], {
	cwd: markdownWorkspace,
	env: environment,
	stdio: "inherit",
});

if (result.error !== undefined) {
	throw result.error;
}

if (result.signal !== null) {
	console.error(`Tauri build terminated by signal ${result.signal}.`);
	process.exitCode = 1;
} else {
	process.exitCode = result.status ?? 1;
}
