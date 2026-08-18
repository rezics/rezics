import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const markdownWorkspace = fileURLToPath(new URL("..", import.meta.url));
const sourceIcon = fileURLToPath(new URL("../app-icon.svg", import.meta.url));

if (!existsSync(sourceIcon)) {
	console.error("Missing app-icon.svg; cannot generate Tauri platform icons.");
	process.exit(1);
}

const yarnExecutable = process.platform === "win32" ? "yarn.cmd" : "yarn";
const result = spawnSync(yarnExecutable, ["exec", "tauri", "icon", "./app-icon.svg"], {
	cwd: markdownWorkspace,
	stdio: "inherit",
});

if (result.error !== undefined) {
	throw result.error;
}

if (result.signal !== null) {
	console.error(`Tauri icon generation terminated by signal ${result.signal}.`);
	process.exitCode = 1;
} else {
	process.exitCode = result.status ?? 1;
}
