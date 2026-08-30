import { initializeObservability } from "@rezics/observability";

import { RezicsVersion } from "./version";

const observability = initializeObservability({
	service: {
		name: "rezics-main-api",
		version: RezicsVersion,
		environment: process.env.DEPLOYMENT_ENVIRONMENT ?? process.env.NODE_ENV ?? "development",
	},
});

// Match Bun's native ceiling explicitly so every srvx runtime has the same bounded input cost.
const MaximumRequestBodyBytes = 128 * 1024 * 1024;

const [{ serve }, { default: api }, { env }, { database }] = await Promise.all([
	import("srvx"),
	import("./services/api"),
	import("./services/config"),
	import("./services/database"),
]);

const smokeProbeToken = process.env.REZICS_SMOKE_PROBE_TOKEN?.trim();
if (smokeProbeToken && env.REZICS_RELEASE !== "development")
	throw new Error("REZICS_SMOKE_PROBE_TOKEN is only allowed in a development release");
if (smokeProbeToken)
	api.get("/.internal/smoke/internal-error", ({ request }) => {
		if (request.headers.get("Authorization") !== `Bearer ${smokeProbeToken}`)
			return new Response(null, { status: 404 });
		throw new Error("Intentional AppHost smoke-probe failure");
	});

const server = serve({
	maxRequestBodySize: MaximumRequestBodyBytes,
	async fetch(request) {
		const response = await api.fetch(request);
		const headers = new Headers(response.headers);
		headers.set("X-Rezics-Release", env.REZICS_RELEASE);
		return new Response(response.body, {
			headers,
			status: response.status,
			statusText: response.statusText,
		});
	},
	gracefulShutdown: false,
	hostname: env.HOST,
	port: env.PORT,
});

let shutdownPromise: Promise<void> | undefined;

function shutdown(): Promise<void> {
	if (shutdownPromise) return shutdownPromise;
	shutdownPromise = (async () => {
		let timer: ReturnType<typeof setTimeout> | undefined;
		const graceful = server.close().then(() => true);
		const timedOut = new Promise<false>((resolve) => {
			timer = setTimeout(() => resolve(false), 10_000);
			timer.unref?.();
		});
		if (!(await Promise.race([graceful, timedOut]))) await server.close(true);
		if (timer) clearTimeout(timer);
		await database.$client.end();
		await observability.shutdown();
	})();
	return shutdownPromise;
}

for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => void shutdown());
