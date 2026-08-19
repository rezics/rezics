import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const biomeCli = createRequire(import.meta.url).resolve("@biomejs/biome/bin/biome");

/** Formats generated content through the repository-pinned Biome executable. */
export function formatWithBiome(source: string, filePath: string): Promise<string> {
	return new Promise((resolve, reject) => {
		// Spawn the current Node with the package CLI. PATH `biome` is a Yarn `.cmd`
		// shim on Windows, and child_process.spawn will not run it without a shell.
		const formatter = spawn(process.execPath, [biomeCli, "format", "--stdin-file-path", filePath], {
			stdio: ["pipe", "pipe", "inherit"],
			windowsHide: true,
		});
		const output: Buffer[] = [];
		let settled = false;

		const rejectOnce = (error: Error) => {
			if (settled) return;
			settled = true;
			reject(error);
		};

		formatter.once("error", rejectOnce);
		formatter.stdin.once("error", rejectOnce);
		formatter.stdout.on("data", (chunk: Buffer) => output.push(chunk));
		formatter.once("close", (code, signal) => {
			if (settled) return;
			settled = true;
			if (code === 0) {
				resolve(Buffer.concat(output).toString("utf8"));
				return;
			}
			reject(
				new Error(
					`Biome exited while formatting ${filePath}: ${signal ? `signal ${signal}` : `code ${code ?? "unknown"}`}`,
				),
			);
		});
		formatter.stdin.end(source, "utf8");
	});
}
