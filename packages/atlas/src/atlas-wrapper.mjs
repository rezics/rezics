// @ts-check

import { spawn, spawnSync } from "node:child_process";
import { constants as osConstants } from "node:os";
import { createRequire } from "node:module";
import { readFileSync, statSync } from "node:fs";
import { dirname, join, win32 } from "node:path";
import { fileURLToPath } from "node:url";

export const ATLAS_BINARY_ENV = "REZICS_ATLAS_BINARY";
export const INTERNAL_WRAPPER_PROBE_ENV = "__REZICS_ATLAS_WRAPPER_PROBE";
export const INTERNAL_WRAPPER_PROBE_VALUE = "rezics-atlas-wrapper-v1";
export const INTERNAL_WRAPPER_PROBE_MARKER = "__REZICS_ATLAS_WRAPPER_EXECUTABLE__";
export const INTERNAL_WRAPPER_PROBE_EXIT_CODE = 78;

const ATLAS_PACKAGE_NAME = "@ariga/atlas";
const EXACT_VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u;
const COMPARABLE_VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/u;
const require = createRequire(import.meta.url);

/** @typedef {{ write(chunk: string): unknown }} TextWriter */

/**
 * @typedef AtlasProbeProcessResult
 * @property {number | null} status
 * @property {NodeJS.Signals | null} signal
 * @property {string} stdout
 * @property {string} stderr
 * @property {Error | undefined} error
 */

/**
 * @typedef AtlasProbe
 * @type {{ kind: "wrapper" } | { kind: "atlas", version: string, stdout: string, stderr: string }}
 */

/**
 * @typedef AtlasSelection
 * @property {string} executable
 * @property {string} stdout
 * @property {string} stderr
 */

export class AtlasWrapperError extends Error {
	/**
	 * @param {string} message
	 * @param {number} [exitCode]
	 */
	constructor(message, exitCode = 1) {
		super(message);
		this.name = "AtlasWrapperError";
		this.exitCode = exitCode;
	}
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * @param {unknown} manifest
 * @returns {string}
 */
export function readExpectedAtlasVersion(manifest) {
	if (!isRecord(manifest) || !isRecord(manifest.optionalDependencies)) {
		throw new AtlasWrapperError(
			`The ${ATLAS_PACKAGE_NAME} version is missing from @rezics/atlas optionalDependencies.`,
		);
	}

	const version = manifest.optionalDependencies[ATLAS_PACKAGE_NAME];
	if (typeof version !== "string" || !EXACT_VERSION_PATTERN.test(version)) {
		throw new AtlasWrapperError(
			`The ${ATLAS_PACKAGE_NAME} dependency must use one exact semantic version.`,
		);
	}

	return version;
}

/** @returns {string} */
export function loadExpectedAtlasVersion() {
	const manifestPath = fileURLToPath(new URL("../package.json", import.meta.url));
	const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
	return readExpectedAtlasVersion(manifest);
}

/**
 * @param {string} output
 * @returns {string | undefined}
 */
export function parseAtlasVersion(output) {
	const match = /(?:^|\r?\n)atlas(?: community)? version v?([^\s]+)/u.exec(output);
	return match?.[1];
}

/**
 * @param {string} version
 * @returns {{ major: number, minor: number, patch: number } | undefined}
 */
function parseComparableVersion(version) {
	const match = COMPARABLE_VERSION_PATTERN.exec(version);
	if (match === null) return undefined;
	return {
		major: Number(match[1]),
		minor: Number(match[2]),
		patch: Number(match[3]),
	};
}

/**
 * Windows follows the native Atlas installation on PATH. Accept upgrades within the reviewed
 * major version, but never silently cross a major-version boundary or move below the repository
 * baseline used by CI and production.
 *
 * @param {string} version
 * @param {string} baselineVersion
 * @returns {boolean}
 */
export function isCompatibleWindowsAtlasVersion(version, baselineVersion) {
	if (version === baselineVersion) return true;
	// PATH-based development may follow stable releases, but prerelease builds
	// would make local migration output depend on an unstable toolchain.
	if (version.includes("-")) return false;
	const actual = parseComparableVersion(version);
	const baseline = parseComparableVersion(baselineVersion);
	if (actual === undefined || baseline === undefined || actual.major !== baseline.major)
		return false;
	if (actual.minor !== baseline.minor) return actual.minor > baseline.minor;
	return actual.patch > baseline.patch;
}

/**
 * @param {string} path
 * @returns {boolean}
 */
function isFile(path) {
	try {
		return statSync(path).isFile();
	} catch {
		return false;
	}
}

/**
 * @param {string} entry
 * @returns {string}
 */
function unwrapQuotedPathEntry(entry) {
	const trimmed = entry.trim();
	if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
		return trimmed.slice(1, -1);
	}
	return trimmed;
}

/**
 * Enumerate only native Windows executables. Empty PATH entries are intentionally ignored
 * instead of treating the current directory as executable search space.
 *
 * @param {string | undefined} pathValue
 * @param {{ cwd: string, isFile?: (path: string) => boolean }} options
 * @returns {string[]}
 */
export function listWindowsAtlasCandidates(pathValue, options) {
	const candidateIsFile = options.isFile ?? isFile;
	const candidates = [];
	const seen = new Set();

	for (const rawEntry of (pathValue ?? "").split(";")) {
		const entry = unwrapQuotedPathEntry(rawEntry);
		if (entry === "") continue;

		const directory = win32.isAbsolute(entry)
			? win32.normalize(entry)
			: win32.resolve(options.cwd, entry);
		const candidate = win32.join(directory, "atlas.exe");
		const identity = candidate.toLocaleLowerCase("en-US");
		if (seen.has(identity) || !candidateIsFile(candidate)) continue;

		seen.add(identity);
		candidates.push(candidate);
	}

	return candidates;
}

/**
 * @param {NodeJS.ProcessEnv} env
 * @returns {string | undefined}
 */
export function readPathEnvironment(env) {
	const pathKey = Object.keys(env).find((key) => key.toLocaleLowerCase("en-US") === "path");
	return pathKey === undefined ? undefined : env[pathKey];
}

/**
 * @param {string} executable
 * @param {string[]} args
 * @param {{ cwd: string, env: NodeJS.ProcessEnv }} options
 * @returns {AtlasProbeProcessResult}
 */
function spawnVersion(executable, args, options) {
	const result = spawnSync(executable, args, {
		cwd: options.cwd,
		encoding: "utf8",
		env: options.env,
		stdio: ["ignore", "pipe", "pipe"],
		windowsHide: true,
	});

	return {
		error: result.error,
		signal: result.signal,
		status: result.status,
		stderr: result.stderr ?? "",
		stdout: result.stdout ?? "",
	};
}

/**
 * @param {string} executable
 * @param {string} expectedVersion
 * @param {{
 *   cwd: string,
 *   env: NodeJS.ProcessEnv,
 *   versionPolicy?: "exact" | "windows-compatible",
 *   spawnVersion?: (executable: string, args: string[], options: { cwd: string, env: NodeJS.ProcessEnv }) => AtlasProbeProcessResult
 * }} options
 * @returns {AtlasProbe}
 */
export function probeAtlasExecutable(executable, expectedVersion, options) {
	const probeEnv = {
		...options.env,
		[INTERNAL_WRAPPER_PROBE_ENV]: INTERNAL_WRAPPER_PROBE_VALUE,
	};
	const result = (options.spawnVersion ?? spawnVersion)(executable, ["version"], {
		cwd: options.cwd,
		env: probeEnv,
	});

	if (
		result.status === INTERNAL_WRAPPER_PROBE_EXIT_CODE &&
		result.stderr.includes(INTERNAL_WRAPPER_PROBE_MARKER)
	) {
		return { kind: "wrapper" };
	}

	if (result.error !== undefined) {
		throw new AtlasWrapperError(
			`Failed to start the Atlas executable at "${executable}": ${result.error.message}`,
		);
	}
	if (result.status !== 0) {
		const reason =
			result.signal === null ? `exit code ${result.status ?? "unknown"}` : result.signal;
		throw new AtlasWrapperError(
			`Atlas executable at "${executable}" failed its version check (${reason}).`,
		);
	}

	const version = parseAtlasVersion(`${result.stdout}\n${result.stderr}`);
	if (version === undefined) {
		throw new AtlasWrapperError(
			`Atlas executable at "${executable}" returned an unrecognized version response.`,
		);
	}
	const versionIsAccepted =
		options.versionPolicy === "windows-compatible"
			? isCompatibleWindowsAtlasVersion(version, expectedVersion)
			: version === expectedVersion;
	if (!versionIsAccepted) {
		const requirement =
			options.versionPolicy === "windows-compatible"
				? `at least ${expectedVersion}, without crossing its major version`
				: expectedVersion;
		throw new AtlasWrapperError(
			`Atlas executable at "${executable}" is version ${version}; REZICS requires ${requirement}.`,
		);
	}

	return {
		kind: "atlas",
		version,
		stderr: result.stderr,
		stdout: result.stdout,
	};
}

/**
 * @param {{
 *   cwd: string,
 *   expectedVersion: string,
 *   override: string | undefined,
 *   pathValue: string | undefined,
 *   isFile?: (path: string) => boolean,
 *   probe: (executable: string, expectedVersion: string) => AtlasProbe
 * }} options
 * @returns {AtlasSelection}
 */
export function selectWindowsAtlasExecutable(options) {
	const candidateIsFile = options.isFile ?? isFile;
	if (options.override !== undefined && options.override !== "") {
		if (
			!win32.isAbsolute(options.override) ||
			win32.extname(options.override).toLowerCase() !== ".exe"
		) {
			throw new AtlasWrapperError(`${ATLAS_BINARY_ENV} must be an absolute path to an .exe file.`);
		}
		const executable = win32.normalize(options.override);
		if (!candidateIsFile(executable)) {
			throw new AtlasWrapperError(`${ATLAS_BINARY_ENV} does not point to a file: "${executable}".`);
		}
		const result = options.probe(executable, options.expectedVersion);
		if (result.kind === "wrapper") {
			throw new AtlasWrapperError(
				`${ATLAS_BINARY_ENV} resolves back to the @rezics/atlas wrapper.`,
			);
		}
		return { executable, stderr: result.stderr, stdout: result.stdout };
	}

	for (const executable of listWindowsAtlasCandidates(options.pathValue, {
		cwd: options.cwd,
		isFile: candidateIsFile,
	})) {
		const result = options.probe(executable, options.expectedVersion);
		if (result.kind === "wrapper") continue;
		return { executable, stderr: result.stderr, stdout: result.stdout };
	}

	throw new AtlasWrapperError(
		`Unable to locate Atlas ${options.expectedVersion} on Windows. Install atlas.exe and add its directory to PATH, or set ${ATLAS_BINARY_ENV} to its absolute path.`,
		127,
	);
}

/**
 * @param {string} expectedVersion
 * @param {{ cwd: string, env: NodeJS.ProcessEnv }} options
 * @returns {AtlasSelection}
 */
function selectPackagedAtlasExecutable(expectedVersion, options) {
	let manifestPath;
	try {
		manifestPath = require.resolve(`${ATLAS_PACKAGE_NAME}/package.json`);
	} catch {
		throw new AtlasWrapperError(
			`The optional ${ATLAS_PACKAGE_NAME}@${expectedVersion} CLI package is not installed for this platform.`,
			127,
		);
	}

	const executable = join(dirname(manifestPath), "atlas");
	if (!isFile(executable)) {
		throw new AtlasWrapperError(
			`The optional ${ATLAS_PACKAGE_NAME}@${expectedVersion} package did not install its Atlas executable.`,
			127,
		);
	}
	const result = probeAtlasExecutable(executable, expectedVersion, options);
	if (result.kind === "wrapper") {
		throw new AtlasWrapperError(
			`The ${ATLAS_PACKAGE_NAME} executable resolves back to @rezics/atlas.`,
		);
	}
	return { executable, stderr: result.stderr, stdout: result.stdout };
}

/**
 * @param {{ platform: NodeJS.Platform, cwd: string, env: NodeJS.ProcessEnv }} options
 * @returns {AtlasSelection}
 */
export function resolveAtlasExecutable(options) {
	const expectedVersion = loadExpectedAtlasVersion();
	if (options.platform === "win32") {
		return selectWindowsAtlasExecutable({
			cwd: options.cwd,
			expectedVersion,
			override: options.env[ATLAS_BINARY_ENV],
			pathValue: readPathEnvironment(options.env),
			probe: (executable, version) =>
				probeAtlasExecutable(executable, version, {
					cwd: options.cwd,
					env: options.env,
					versionPolicy: "windows-compatible",
				}),
		});
	}
	if (options.platform === "linux" || options.platform === "darwin") {
		return selectPackagedAtlasExecutable(expectedVersion, options);
	}

	throw new AtlasWrapperError(
		`Atlas is not supported by @rezics/atlas on ${options.platform}.`,
		64,
	);
}

/**
 * @param {NodeJS.ProcessEnv} env
 * @returns {boolean}
 */
export function isInternalWrapperProbe(env) {
	return env[INTERNAL_WRAPPER_PROBE_ENV] === INTERNAL_WRAPPER_PROBE_VALUE;
}

/**
 * @param {NodeJS.Signals | null} signal
 * @returns {number}
 */
export function exitCodeForSignal(signal) {
	if (signal === null) return 1;
	return 128 + (osConstants.signals[signal] ?? 1);
}

/**
 * @param {string} executable
 * @param {string[]} args
 * @param {{ cwd: string, env: NodeJS.ProcessEnv }} options
 * @returns {Promise<number>}
 */
function runNativeAtlas(executable, args, options) {
	return new Promise((resolve, reject) => {
		const child = spawn(executable, args, {
			cwd: options.cwd,
			env: options.env,
			stdio: "inherit",
			windowsHide: true,
		});
		child.once("error", (error) => {
			reject(
				new AtlasWrapperError(
					`Failed to start the Atlas executable at "${executable}": ${error.message}`,
				),
			);
		});
		child.once("exit", (code, signal) => {
			resolve(code ?? exitCodeForSignal(signal));
		});
	});
}

/**
 * @param {string[]} args
 * @param {{
 *   cwd?: string,
 *   env?: NodeJS.ProcessEnv,
 *   platform?: NodeJS.Platform,
 *   stderr?: TextWriter,
 *   stdout?: TextWriter
 * }} [options]
 * @returns {Promise<number>}
 */
export async function runAtlas(args, options = {}) {
	const cwd = options.cwd ?? process.cwd();
	const env = options.env ?? process.env;
	const platform = options.platform ?? process.platform;
	const stderr = options.stderr ?? process.stderr;
	const stdout = options.stdout ?? process.stdout;
	const selection = resolveAtlasExecutable({ cwd, env, platform });

	if (args.length === 1 && args[0] === "version") {
		if (selection.stdout !== "") stdout.write(selection.stdout);
		if (selection.stderr !== "") stderr.write(selection.stderr);
		return 0;
	}

	return runNativeAtlas(selection.executable, args, { cwd, env });
}

/**
 * @param {unknown} error
 * @returns {{ exitCode: number, message: string }}
 */
export function describeWrapperError(error) {
	if (error instanceof AtlasWrapperError) {
		return { exitCode: error.exitCode, message: error.message };
	}
	if (error instanceof Error) {
		return { exitCode: 1, message: error.message };
	}
	return { exitCode: 1, message: String(error) };
}
