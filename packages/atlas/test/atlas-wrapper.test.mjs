import assert from "node:assert/strict";
import test from "node:test";

import {
	AtlasWrapperError,
	exitCodeForSignal,
	INTERNAL_WRAPPER_PROBE_EXIT_CODE,
	INTERNAL_WRAPPER_PROBE_MARKER,
	isCompatibleWindowsAtlasVersion,
	listWindowsAtlasCandidates,
	parseAtlasVersion,
	probeAtlasExecutable,
	readExpectedAtlasVersion,
	readPathEnvironment,
	selectWindowsAtlasExecutable,
} from "../src/atlas-wrapper.mjs";

const expectedVersion = "1.2.3";

test("reads one exact Atlas version from the package contract", () => {
	assert.equal(
		readExpectedAtlasVersion({ optionalDependencies: { "@ariga/atlas": expectedVersion } }),
		expectedVersion,
	);
	assert.throws(
		() => readExpectedAtlasVersion({ optionalDependencies: { "@ariga/atlas": "^1.2.3" } }),
		AtlasWrapperError,
	);
});

test("parses standard and community Atlas version output", () => {
	assert.equal(parseAtlasVersion("atlas version v1.2.3\nhttps://example.test\n"), expectedVersion);
	assert.equal(parseAtlasVersion("atlas community version v1.2.3-canary\n"), "1.2.3-canary");
	assert.equal(parseAtlasVersion("not Atlas"), undefined);
});

test("accepts Windows upgrades only within the reviewed Atlas major version", () => {
	assert.equal(isCompatibleWindowsAtlasVersion("1.2.3", expectedVersion), true);
	assert.equal(isCompatibleWindowsAtlasVersion("1.2.4", expectedVersion), true);
	assert.equal(isCompatibleWindowsAtlasVersion("1.3.0", expectedVersion), true);
	assert.equal(isCompatibleWindowsAtlasVersion("1.3.0-canary", expectedVersion), false);
	assert.equal(isCompatibleWindowsAtlasVersion("1.1.9", expectedVersion), false);
	assert.equal(isCompatibleWindowsAtlasVersion("2.0.0", expectedVersion), false);
});

test("enumerates only existing atlas.exe files in Windows PATH order", () => {
	const existing = new Set(["c:\\tools\\atlas.exe", "d:\\atlas\\atlas.exe"]);
	const candidates = listWindowsAtlasCandidates('"C:\\Tools";;D:\\Atlas;C:\\TOOLS', {
		cwd: "E:\\repository",
		isFile: (path) => existing.has(path.toLowerCase()),
	});

	assert.deepEqual(candidates, ["C:\\Tools\\atlas.exe", "D:\\Atlas\\atlas.exe"]);
});

test("reads PATH without depending on its environment-key casing", () => {
	assert.equal(readPathEnvironment({ Path: "C:\\Atlas" }), "C:\\Atlas");
	assert.equal(readPathEnvironment({}), undefined);
});

test("skips a Yarn wrapper executable and selects the next native Atlas executable", () => {
	const calls = [];
	const selection = selectWindowsAtlasExecutable({
		cwd: "C:\\repository",
		expectedVersion,
		override: undefined,
		pathValue: "C:\\YarnBin;C:\\Atlas",
		isFile: () => true,
		probe: (executable) => {
			calls.push(executable);
			return executable.includes("YarnBin")
				? { kind: "wrapper" }
				: {
						kind: "atlas",
						version: expectedVersion,
						stderr: "",
						stdout: `atlas version v${expectedVersion}\n`,
					};
		},
	});

	assert.deepEqual(calls, ["C:\\YarnBin\\atlas.exe", "C:\\Atlas\\atlas.exe"]);
	assert.equal(selection.executable, "C:\\Atlas\\atlas.exe");
});

test("requires an absolute executable override", () => {
	assert.throws(
		() =>
			selectWindowsAtlasExecutable({
				cwd: "C:\\repository",
				expectedVersion,
				override: "atlas.exe",
				pathValue: "",
				probe: () => ({
					kind: "atlas",
					version: expectedVersion,
					stderr: "",
					stdout: "",
				}),
			}),
		/absolute path/u,
	);
});

test("recognizes a recursive wrapper probe without accepting it as Atlas", () => {
	const result = probeAtlasExecutable("C:\\YarnBin\\atlas.exe", expectedVersion, {
		cwd: "C:\\repository",
		env: {},
		spawnVersion: () => ({
			error: undefined,
			signal: null,
			status: INTERNAL_WRAPPER_PROBE_EXIT_CODE,
			stderr: `${INTERNAL_WRAPPER_PROBE_MARKER}\n`,
			stdout: "",
		}),
	});

	assert.deepEqual(result, { kind: "wrapper" });
});

test("rejects a native Atlas version mismatch", () => {
	assert.throws(
		() =>
			probeAtlasExecutable("C:\\Atlas\\atlas.exe", expectedVersion, {
				cwd: "C:\\repository",
				env: {},
				spawnVersion: () => ({
					error: undefined,
					signal: null,
					status: 0,
					stderr: "",
					stdout: "atlas version v1.2.4\n",
				}),
			}),
		/requires 1\.2\.3/u,
	);
});

test("accepts a newer Windows Atlas version", () => {
	const result = probeAtlasExecutable("C:\\Atlas\\atlas.exe", expectedVersion, {
		cwd: "C:\\repository",
		env: {},
		versionPolicy: "windows-compatible",
		spawnVersion: () => ({
			error: undefined,
			signal: null,
			status: 0,
			stderr: "",
			stdout: "atlas version v1.3.0\n",
		}),
	});

	assert.equal(result.kind, "atlas");
});

test("uses conventional exit codes for terminating signals", () => {
	assert.equal(exitCodeForSignal("SIGINT"), 130);
	assert.equal(exitCodeForSignal("SIGTERM"), 143);
});
