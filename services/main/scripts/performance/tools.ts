import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { k6Version, repositoryRoot } from "./config";

export const exec = promisify(execFile);

/** Bootstrap definition-scale invariants through their owning service, in an isolated process. */
export async function prepareDefinitions(databaseUrl: string): Promise<void> {
	await exec(
		process.env.REZICS_BUN_BINARY ?? "bun",
		[resolve(repositoryRoot, "services/main/scripts/performance/prepare-definitions.ts")],
		{
			cwd: repositoryRoot,
			windowsHide: true,
			timeout: 120_000,
			env: {
				...process.env,
				DATABASE_URL: databaseUrl,
				DATABASE_ADMIN_URL: databaseUrl,
				BETTER_AUTH_SECRET: "performance-only-secret-that-is-longer-than-thirty-two-characters",
				BETTER_AUTH_URL: "http://localhost:3001",
				EMAIL_MODE: "log",
				EMAIL_FROM: "performance@example.invalid",
				S3_ENDPOINT: "http://127.0.0.1:1",
				S3_ACCESS_KEY_ID: "performance",
				S3_SECRET_ACCESS_KEY: "performance",
				S3_BUCKET: "performance",
				REZICS_RELEASE: "development",
				OTEL_SDK_DISABLED: "true",
				OTEL_EXPORTER_OTLP_ENDPOINT: "",
				OTEL_EXPORTER_OTLP_HEADERS: "",
			},
		},
	);
}
const artifacts: Record<string, { suffix: string; sha256: string }> = {
	"win32-x64": {
		suffix: "windows-amd64.zip",
		sha256: "ceb2b1e1cf9dbe1303c6c33ec83ffda86dda5c610b4def92064d3c7ebae8d9f4",
	},
	"linux-x64": {
		suffix: "linux-amd64.tar.gz",
		sha256: "b5a8003c86f35f5cd5ceef1490312c48e587696c94d998cefc6d7b3b4cb1597d",
	},
	"linux-arm64": {
		suffix: "linux-arm64.tar.gz",
		sha256: "4ecd64cadcc792402d16293836115480419c4447c032858f564852d98f1bf54c",
	},
	"darwin-x64": {
		suffix: "macos-amd64.zip",
		sha256: "45a08590511c8a6a9c6331645e60c41624924e848e29472e87c60ac956d50372",
	},
	"darwin-arm64": {
		suffix: "macos-arm64.zip",
		sha256: "37a028506bf13578de66c906296803775df28cc2504b1a8c5d786b2803e757c7",
	},
};

/** Install the pinned upstream k6 artifact only into the repository's temporary tool cache. */
export async function ensureK6(): Promise<string> {
	const artifact = artifacts[`${process.platform}-${process.arch}`];
	if (!artifact) throw new Error("No pinned k6 artifact for this platform");
	const directory = resolve(repositoryRoot, ".temp/performance-tools", `k6-${k6Version}`);
	const basename = `k6-v${k6Version}-${artifact.suffix}`;
	const executable = resolve(
		directory,
		basename.replace(/\.zip$|\.tar\.gz$/, ""),
		process.platform === "win32" ? "k6.exe" : "k6",
	);
	try {
		const version = await exec(executable, ["version"], { windowsHide: true });
		if (version.stdout.includes(`v${k6Version}`)) return executable;
	} catch {
		/* First install. */
	}
	await mkdir(directory, { recursive: true });
	const archive = resolve(directory, basename);
	let bytes: Buffer;
	try {
		bytes = await readFile(archive);
	} catch {
		const response = await fetch(
			`https://github.com/grafana/k6/releases/download/v${k6Version}/${basename}`,
			{ signal: AbortSignal.timeout(180_000) },
		);
		if (!response.ok) throw new Error(`k6 download failed: ${response.status}`);
		bytes = Buffer.from(await response.arrayBuffer());
		await writeFile(archive, bytes);
	}
	if (createHash("sha256").update(bytes).digest("hex") !== artifact.sha256)
		throw new Error("k6 archive checksum mismatch");
	if (process.platform === "darwin") await exec("unzip", ["-o", archive, "-d", directory]);
	else await exec("tar", ["-xf", archive, "-C", directory], { windowsHide: true });
	if (process.platform !== "win32") await chmod(executable, 0o755);
	const version = await exec(executable, ["version"], { windowsHide: true });
	if (!version.stdout.includes(`v${k6Version}`))
		throw new Error("Unexpected k6 executable version");
	return executable;
}
