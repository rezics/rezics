import { initializeObservability } from "@rezics/observability";

const observability = initializeObservability({
	service: {
		name: "rezics-main-api",
		version: "0.1.0",
		environment: process.env.DEPLOYMENT_ENVIRONMENT ?? process.env.NODE_ENV ?? "development",
	},
});

const [{ serve }, { default: api }, { env }, { database }] = await Promise.all([
	import("srvx"),
	import("./services/api"),
	import("./services/config"),
	import("./services/database"),
]);

const server = serve({
	fetch: api.fetch,
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
