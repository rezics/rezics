import assert from "node:assert/strict";
import { createServer } from "node:https";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createHash, createPublicKey } from "node:crypto";
import { betterAuth } from "better-auth/minimal";
import { memoryAdapter } from "better-auth/adapters/memory";
import { getSchema } from "better-auth/db";
import { jwt } from "better-auth/plugins";
import { mcp } from "@better-auth/mcp";
import { cimd } from "@better-auth/cimd";
import { importPKCS8, SignJWT } from "jose";
import { execFileSync, spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { createCimdResourceFetch } from "../src/services/auth/cimd-transport";

const directory = process.env.REZICS_CIMD_FIXTURE_DIRECTORY;
assert.ok(
	directory?.includes("/.temp/cimd-transport."),
	"Requires the isolated network Taskfile fixture",
);
const ca = await readFile(`${directory}/cert.pem`, "utf8");
const key = await readFile(`${directory}/key.pem`, "utf8");
let requests = 0;
const paths: string[] = [];
const bodyStarted = Promise.withResolvers<void>();
const tlsOptions = { key, cert: ca };
const publicKey = createPublicKey(ca).export({ format: "jwk" });
const respond = (req: IncomingMessage, res: ServerResponse) => {
	requests++;
	paths.push(req.url ?? "");
	if (req.url?.endsWith("client.json")) {
		res.setHeader("content-type", "application/json");
		res.end(
			JSON.stringify({
				client_id: `https://${req.headers.host}${req.url}`,
				client_name: "Isolated discovery fixture",
				redirect_uris: ["https://client.example.com/callback"],
				grant_types: ["client_credentials"],
				token_endpoint_auth_method: "private_key_jwt",
				jwks_uri: `https://${req.headers.host}${req.url.replace("client.json", "jwks.json")}`,
			}),
		);
		return;
	}
	if (req.url?.endsWith("jwks.json")) {
		res.setHeader("content-type", "application/json");
		res.end(JSON.stringify({ keys: [{ ...publicKey, kid: "fixture", alg: "RS256", use: "sig" }] }));
		return;
	}
	if (req.url === "/redirect") {
		res.writeHead(302, { location: "https://127.0.0.1/private" });
		res.end();
		return;
	}
	if (req.url === "/slow") return;
	if (req.url === "/stream") {
		res.write("partial");
		bodyStarted.resolve();
		return;
	}
	if (req.url === "/large") {
		res.write(Buffer.alloc(40 * 1024));
		res.end(Buffer.alloc(25 * 1024));
		return;
	}
	if (req.url === "/conditional" && req.headers["if-none-match"] === '"fixture"') {
		res.writeHead(304);
		res.end();
		return;
	}
	res.setHeader("content-type", "application/json");
	res.end(JSON.stringify({ host: req.headers.host, peer: req.socket.localAddress }));
};
const server = createServer(tlsOptions, respond);
const server6 = createServer(tlsOptions, respond);
server.listen(0, "8.8.8.8");
server6.listen(0, "2606:4700::1111");
await Promise.all([once(server, "listening"), once(server6, "listening")]);
const address = server.address();
assert.ok(address && typeof address !== "string");
const url = `https://cimd.example.com:${address.port}/metadata`;
let resolutions = 0;
const fetch = createCimdResourceFetch({
	ca,
	resolve: async () => {
		resolutions++;
		return [{ address: resolutions === 1 ? "8.8.8.8" : "127.0.0.1", family: 4 }];
	},
});
try {
	const response = await fetch(url);
	assert.equal(response.status, 200);
	assert.deepEqual(await response.json(), {
		host: `cimd.example.com:${address.port}`,
		peer: "8.8.8.8",
	});
	assert.equal(resolutions, 1);
	await assert.rejects(fetch(url), /public IP addresses/);
	assert.equal(requests, 1);
	for (const answers of [
		[],
		[
			{ address: "8.8.8.8", family: 4 },
			{ address: "10.0.0.1", family: 4 },
		],
		...[
			"127.0.0.1",
			"10.0.0.1",
			"169.254.169.254",
			"100.64.0.1",
			"192.0.2.1",
			"198.18.0.1",
			"224.0.0.1",
			"::1",
			"fc00::1",
			"fe80::1",
			"::ffff:127.0.0.1",
		].map((address) => [{ address, family: address.includes(":") ? 6 : 4 }]),
	]) {
		await assert.rejects(
			createCimdResourceFetch({ ca, resolve: async () => answers })(url),
			/public IP addresses/,
		);
	}
	const approved = () =>
		createCimdResourceFetch({ ca, resolve: async () => [{ address: "8.8.8.8", family: 4 }] });
	await assert.rejects(approved()(url.replace("cimd.example.com", "wrong.example.com")));
	await assert.rejects(
		createCimdResourceFetch({ resolve: async () => [{ address: "8.8.8.8", family: 4 }] })(url),
	);
	await assert.rejects(
		approved()(url.replace("/metadata", "/redirect")),
		/redirects are forbidden/,
	);
	await assert.rejects(approved()(url.replace("/metadata", "/large")), /64 KiB/);
	const bounded = createCimdResourceFetch({
		ca,
		timeoutMs: 100,
		maximumConcurrentRequests: 1,
		resolve: async () => [{ address: "8.8.8.8", family: 4 }],
	});
	const slow = bounded(url.replace("/metadata", "/slow"));
	await assert.rejects(bounded(url), /capacity unavailable/);
	await assert.rejects(slow);
	const head = await approved()(url, { method: "HEAD" });
	assert.equal(head.status, 200);
	assert.equal(await head.text(), "");
	const conditional = await approved()(url.replace("/metadata", "/conditional"), {
		headers: { "If-None-Match": '"fixture"' },
	});
	assert.equal(conditional.status, 304);
	assert.equal(await conditional.text(), "");
	const address6 = server6.address();
	assert.ok(address6 && typeof address6 !== "string");
	const response6 = await createCimdResourceFetch({
		ca,
		resolve: async () => [{ address: "2606:4700::1111", family: 6 }],
	})(`https://cimd.example.com:${address6.port}/metadata`);
	assert.deepEqual(await response6.json(), {
		host: `cimd.example.com:${address6.port}`,
		peer: "2606:4700::1111",
	});
	const bodyController = new AbortController();
	const bodyFetch = approved()(url.replace("/metadata", "/stream"), {
		signal: bodyController.signal,
	});
	await bodyStarted.promise;
	bodyController.abort();
	await assert.rejects(bodyFetch);
	const before = requests;
	await assert.rejects(approved()(url, { signal: AbortSignal.abort() }));
	assert.equal(requests, before);
	for (const rebindJwks of [false, true]) {
		let discoveryResolutions = 0;
		const secureFetch = createCimdResourceFetch({
			ca,
			resolve: async () => [
				{ address: rebindJwks && ++discoveryResolutions > 1 ? "127.0.0.1" : "8.8.8.8", family: 4 },
			],
		});
		const issuer = "https://issuer.example.com/api/auth";
		const clientId = `https://cimd.example.com:${address.port}/${rebindJwks ? "rebind-" : ""}client.json`;
		const options = {
			baseURL: "https://issuer.example.com",
			basePath: "/api/auth",
			secret: "fixture-auth-secret-with-at-least-32-characters",
			rateLimit: { enabled: false },
			plugins: [
				jwt(),
				mcp({
					resource: "https://issuer.example.com/mcp",
					loginPage: "/login",
					consentPage: "/consent",
					scopes: ["mcp:read"],
					forceOpaqueAccessTokens: true,
				}),
				cimd({ metadataProfile: "mcp-2026-07-28", fetchClientMetadataResource: secureFetch }),
			],
		};
		// This isolates discovery and egress; production persistence is qualified separately.
		const data = Object.fromEntries(Object.keys(getSchema(options)).map((model) => [model, []]));
		const auth = betterAuth({ ...options, database: memoryAdapter(data) });
		const assertion = await new SignJWT({})
			.setProtectedHeader({ alg: "RS256", kid: "fixture" })
			.setIssuer(clientId)
			.setSubject(clientId)
			.setAudience(`${issuer}/oauth2/token`)
			.setIssuedAt()
			.setExpirationTime("60s")
			.setJti(crypto.randomUUID())
			.sign(await importPKCS8(key, "RS256"));
		const beforePaths = paths.length;
		const response = await auth.handler(
			new Request(`${issuer}/oauth2/token`, {
				method: "POST",
				headers: { "content-type": "application/x-www-form-urlencoded" },
				body: new URLSearchParams({
					grant_type: "client_credentials",
					client_id: clientId,
					client_assertion: assertion,
					client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
					scope: "mcp:read",
					resource: "https://issuer.example.com/mcp",
				}),
			}),
		);
		const body = await response.json();
		assert.equal(body.access_token, undefined);
		if (rebindJwks) {
			assert.equal(body.error, "invalid_client");
			assert.deepEqual(paths.slice(beforePaths), ["/rebind-client.json"]);
		} else {
			assert.equal(body.error, "unauthorized_client");
			assert.deepEqual(paths.slice(beforePaths), ["/client.json", "/jwks.json"]);
		}
	}
	const peer = spawn(
		"node",
		["--import", "tsx", fileURLToPath(new URL("./cimd-tls-peer.ts", import.meta.url))],
		{ env: process.env, stdio: ["ignore", "pipe", "inherit"], timeout: 10_000 },
	);
	const lines = createInterface({ input: peer.stdout });
	let tlsPeerNodeVersion: string;
	try {
		const [line] = await Promise.race([
			once(lines, "line"),
			once(peer, "exit").then(() => {
				throw new Error("TLS peer exited before listening");
			}),
		]);
		const ready = JSON.parse(line);
		assert.ok(Number.isSafeInteger(ready.port) && ready.port > 0 && ready.port < 65536);
		const peerResponse = await approved()(`https://cimd.example.com:${ready.port}/`);
		const hello = await peerResponse.json();
		assert.equal(hello.servername, "cimd.example.com");
		assert.equal(typeof hello.node, "string");
		tlsPeerNodeVersion = hello.node;
	} finally {
		lines.close();
		if (peer.exitCode === null && peer.signalCode === null) {
			const exited = once(peer, "exit");
			peer.kill();
			await exited;
		}
	}
	const repository = new URL("../../../", import.meta.url);
	const sourceDigests: Record<string, string> = {};
	for (const path of [
		"services/main/src/services/auth/cimd-transport.ts",
		"services/main/src/services/auth/cimd-transport.test.ts",
		"services/main/scripts/check-cimd-transport.ts",
		"services/main/scripts/check-cimd-transport.sh",
		"services/main/scripts/cimd-tls-peer.ts",
		"services/main/package.json",
		"yarn.lock",
	])
		sourceDigests[path] = createHash("sha256")
			.update(await readFile(new URL(path, repository)))
			.digest("hex");
	console.info(
		JSON.stringify({
			baseCommit: execFileSync("git", ["rev-parse", "HEAD"], {
				cwd: fileURLToPath(repository),
				encoding: "utf8",
			}).trim(),
			sourceDigests,
			platform: process.platform,
			architecture: process.arch,
			bun: process.versions.bun,
			conditionalAndHeadResponses: true,
			bodyAbortRejected: true,
			originalSniVerified: true,
			tlsPeerNodeVersion,
			discoveryAndJwksUsePinnedTransport: true,
			discoveredClientCannotMintMachineToken: true,
			ipv6PinnedPeer: "2606:4700::1111",
			pinnedPeer: "8.8.8.8",
			originalTlsAndHostIdentity: true,
			mixedAndPrivateDnsRejected: true,
			rebindingRejected: true,
			redirectsAndOversizeRejected: true,
			timeoutAndCapacityRejected: true,
		}),
	);
} finally {
	server6.closeAllConnections();
	server.closeAllConnections();
	if (server6.listening)
		await new Promise<void>((resolve, reject) =>
			server6.close((error) => (error ? reject(error) : resolve())),
		);
	if (server.listening)
		await new Promise<void>((resolve, reject) =>
			server.close((error) => (error ? reject(error) : resolve())),
		);
}
