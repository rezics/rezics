import { spawn, spawnSync, type ChildProcessByStdio } from "node:child_process";
import type { Readable } from "node:stream";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { apiSchedulerHealthContract } from "../../services/main/src/health-contract.ts";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));
const appHostPath = fileURLToPath(new URL("../apphost.mts", import.meta.url));
const appHostArgument = "aspire-apphost/apphost.mts";
const startupTimeoutMs = 5 * 60 * 1000;

type ManagedChildProcess = ChildProcessByStdio<null, Readable, Readable>;

interface RunningAppHost {
	appHostPath: string;
	appHostPid: number;
	status: string;
}

interface ResourceUrl {
	name: string;
	url: string;
}

interface ResourceDescription {
	displayName: string;
	state: string;
	healthStatus?: string;
	source?: string;
	exitCode?: number;
	urls: ResourceUrl[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function requireString(record: Record<string, unknown>, key: string): string {
	const value = record[key];
	if (typeof value !== "string") throw new Error(`Aspire JSON field ${key} must be a string`);
	return value;
}

function parseRunningAppHosts(value: unknown): RunningAppHost[] {
	if (!Array.isArray(value)) throw new Error("Aspire ps output must be an array");
	return value.map((item) => {
		if (!isRecord(item)) throw new Error("Aspire ps entries must be objects");
		const appHostPid = item.appHostPid;
		if (typeof appHostPid !== "number")
			throw new Error("Aspire ps field appHostPid must be a number");
		return {
			appHostPath: requireString(item, "appHostPath"),
			appHostPid,
			status: requireString(item, "status"),
		};
	});
}

function parseResourceUrl(value: unknown): ResourceUrl {
	if (!isRecord(value)) throw new Error("Aspire resource URLs must be objects");
	return { name: requireString(value, "name"), url: requireString(value, "url") };
}

function parseResources(value: unknown): ResourceDescription[] {
	if (!isRecord(value) || !Array.isArray(value.resources))
		throw new Error("Aspire describe output must contain a resources array");
	return value.resources.map((item) => {
		if (!isRecord(item)) throw new Error("Aspire resources must be objects");
		const urls = item.urls;
		if (!Array.isArray(urls)) throw new Error("Aspire resource URLs must be an array");
		const resource: ResourceDescription = {
			displayName: requireString(item, "displayName"),
			state: requireString(item, "state"),
			urls: urls.map(parseResourceUrl),
		};
		if (typeof item.healthStatus === "string") resource.healthStatus = item.healthStatus;
		if (typeof item.source === "string") resource.source = item.source;
		if (typeof item.exitCode === "number") resource.exitCode = item.exitCode;
		return resource;
	});
}

function runAspire(args: string[]) {
	return spawnSync("yarn", ["exec", "aspire", ...args], {
		cwd: repositoryRoot,
		encoding: "utf8",
		shell: process.platform === "win32",
		timeout: 30_000,
		maxBuffer: 4 * 1024 * 1024,
	});
}

function runAspireJson(args: string[]): unknown {
	const result = runAspire([...args, "--non-interactive", "--nologo"]);
	if (result.error || result.status !== 0)
		throw new Error(
			result.error?.message ??
				result.stderr.trim() ??
				result.stdout.trim() ??
				"Aspire failed",
		);
	return JSON.parse(result.stdout) as unknown;
}

function listMatchingAppHosts() {
	return parseRunningAppHosts(runAspireJson(["ps", "--format", "Json"])).filter(
		(appHost) => appHost.appHostPath === appHostPath && appHost.status === "running",
	);
}

function describeResources() {
	return parseResources(
		runAspireJson(["describe", "--apphost", appHostArgument, "--format", "Json"]),
	);
}

function findResource(resources: ResourceDescription[], displayName: string) {
	const matches = resources.filter((resource) => resource.displayName === displayName);
	if (matches.length !== 1)
		throw new Error(`Expected exactly one ${displayName} resource, found ${matches.length}`);
	return matches[0];
}

function requireRunningHealthy(resources: ResourceDescription[], displayName: string) {
	const resource = findResource(resources, displayName);
	return resource.state === "Running" && resource.healthStatus === "Healthy";
}

function failOnTerminalResourceError(resources: ResourceDescription[]) {
	const failed = resources.find(
		(resource) =>
			resource.state === "FailedToStart" ||
			(resource.exitCode !== undefined && resource.exitCode !== 0),
	);
	if (failed)
		throw new Error(
			`${failed.displayName} failed: state=${failed.state}, exitCode=${failed.exitCode ?? "none"}`,
		);
}

function summarize(resources: ResourceDescription[]) {
	return resources
		.filter((resource) => !resource.displayName.endsWith("-installer"))
		.map((resource) => ({
			name: resource.displayName,
			state: resource.state,
			health: resource.healthStatus ?? "n/a",
			exitCode: resource.exitCode ?? "n/a",
		}));
}

async function waitForReady(child: ManagedChildProcess) {
	const deadline = Date.now() + startupTimeoutMs;
	let lastResources: ResourceDescription[] = [];
	const expectedResources = ["main-api", "recommendation-worker", "web"];
	while (Date.now() < deadline) {
		if (child.exitCode !== null)
			throw new Error(`Aspire exited before resources became ready (code ${child.exitCode})`);
		const running = listMatchingAppHosts();
		if (running.length > 1) throw new Error("Multiple matching AppHosts started unexpectedly");
		if (running.length === 0) {
			await delay(2_000);
			continue;
		}
		lastResources = describeResources();
		const missing = expectedResources.filter(
			(name) => !lastResources.some((resource) => resource.displayName === name),
		);
		if (missing.length > 0) {
			await delay(2_000);
			continue;
		}
		failOnTerminalResourceError(lastResources);
		if (
			requireRunningHealthy(lastResources, "main-api") &&
			requireRunningHealthy(lastResources, "recommendation-worker") &&
			requireRunningHealthy(lastResources, "web")
		)
			return lastResources;
		await delay(2_000);
	}
	throw new Error(
		`Timed out waiting for Aspire resources:\n${JSON.stringify(summarize(lastResources), null, 2)}`,
	);
}

async function requestOk(label: string, url: URL) {
	const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(15_000) });
	if (!response.ok) throw new Error(`${label} returned HTTP ${response.status}`);
	console.info(`${label}: ${response.status}`);
}

async function verifySmoke(resources: ResourceDescription[]) {
	const api = findResource(resources, "main-api");
	const worker = findResource(resources, "recommendation-worker");
	const web = findResource(resources, "web");
	if (api.source !== "bun" || worker.source !== "bun")
		throw new Error(
			`API and worker must run under Bun; got ${api.source} and ${worker.source}`,
		);
	for (const excluded of ["about", "auth", "meilisearch"])
		if (resources.some((resource) => resource.displayName === excluded))
			throw new Error(`${excluded} must not be part of the default Aspire topology`);
	const apiOrigin = api.urls.find((url) => url.name === "http")?.url;
	const webOrigin = web.urls.find((url) => url.name === "http")?.url;
	if (!apiOrigin || !webOrigin)
		throw new Error("Aspire did not discover API and web HTTP endpoints");
	await requestOk("API readiness", new URL(apiSchedulerHealthContract.readiness.path, apiOrigin));
	await requestOk("Web root", new URL("/", webOrigin));
	await requestOk(
		"Web proxy readiness",
		new URL(apiSchedulerHealthContract.readiness.path, webOrigin),
	);
}

function captureOutput(child: ManagedChildProcess) {
	let output = "";
	const append = (chunk: Buffer) => {
		output = (output + chunk.toString()).slice(-64 * 1024);
	};
	child.stdout.on("data", append);
	child.stderr.on("data", append);
	return () => output;
}

async function waitForExit(child: ManagedChildProcess, timeoutMs: number) {
	if (child.exitCode !== null) return true;
	return Promise.race([
		new Promise<true>((resolve) => child.once("exit", () => resolve(true))),
		delay(timeoutMs).then(() => false),
	]);
}

async function stopAppHost(child: ManagedChildProcess) {
	if (child.exitCode !== null) return;
	const stop = runAspire(["stop", "--apphost", appHostArgument, "--non-interactive", "--nologo"]);
	if (stop.status === 0 && (await waitForExit(child, 30_000))) return;
	if (child.pid && process.platform !== "win32") process.kill(-child.pid, "SIGTERM");
	else child.kill("SIGTERM");
	if (await waitForExit(child, 10_000)) return;
	if (child.pid && process.platform !== "win32") process.kill(-child.pid, "SIGKILL");
	else child.kill("SIGKILL");
	await waitForExit(child, 5_000);
}

async function waitForStopped() {
	for (let attempt = 0; attempt < 10; attempt++) {
		if (listMatchingAppHosts().length === 0) return;
		await delay(1_000);
	}
	throw new Error("Aspire AppHost did not stop cleanly");
}

async function main() {
	const mode = process.argv[2];
	if (mode !== "smoke") throw new Error("Usage: manage-apphost.mts smoke");
	const existing = listMatchingAppHosts();
	if (existing.length > 0)
		throw new Error(
			`Refusing to run ${mode} while this AppHost is already running (PID ${existing[0].appHostPid})`,
		);

	const child = spawn(
		"yarn",
		[
			"exec",
			"aspire",
			"run",
			"--apphost",
			appHostArgument,
			"--isolated",
			"--non-interactive",
			"--nologo",
		],
		{
			cwd: repositoryRoot,
			detached: process.platform !== "win32",
			env: { ...process.env, NO_COLOR: "1", REZICS_ASPIRE_MODE: mode },
			stdio: ["ignore", "pipe", "pipe"],
		},
	);
	const getOutput = captureOutput(child);
	try {
		const resources = await waitForReady(child);
		await verifySmoke(resources);
		console.table(summarize(resources));
	} catch (error) {
		const output = getOutput();
		if (output) console.error(`Aspire output:\n${output}`);
		throw error;
	} finally {
		await stopAppHost(child);
	}
	await waitForStopped();
}

await main();
