import { refExpr } from "./.aspire/modules/base.mjs";
import { createBuilder, ProbeType } from "./.aspire/modules/aspire.mjs";
import {
	apiSchedulerHealthContract,
	workerSchedulerHealthContract,
} from "../services/main/src/health-contract.ts";

type AppHostMode = "development" | "search" | "smoke";

function resolveAppHostMode(value: string | undefined): AppHostMode {
	switch (value) {
		case undefined:
		case "development":
			return "development";
		case "search":
		case "smoke":
			return value;
		default:
			throw new Error(
				`REZICS_ASPIRE_MODE must be development, search, or smoke; received ${value}`,
			);
	}
}

function requireEnvironmentVariable(name: string): string {
	const value = process.env[name]?.trim();
	if (!value)
		throw new Error(
			`${name} is required. Start development through the root Taskfile so .env is loaded.`,
		);
	return value;
}

function requirePort(name: string): number {
	const value = requireEnvironmentVariable(name);
	if (!/^\d+$/.test(value)) throw new Error(`${name} must be an integer port; received ${value}`);
	const port = Number(value);
	if (!Number.isSafeInteger(port) || port < 1 || port > 65_535)
		throw new Error(`${name} must be between 1 and 65535; received ${value}`);
	return port;
}

function requireDatabaseUrl(name: string): string {
	const value = requireEnvironmentVariable(name);
	const url = new URL(value);
	if (url.protocol !== "postgres:" && url.protocol !== "postgresql:")
		throw new Error(`${name} must use the postgres or postgresql protocol`);
	return value;
}

function requireHttpOrigin(name: string): string {
	const url = new URL(requireEnvironmentVariable(name));
	if (url.protocol !== "http:" && url.protocol !== "https:")
		throw new Error(`${name} must use HTTP or HTTPS`);
	if (url.pathname !== "/" || url.search || url.hash)
		throw new Error(`${name} must be an origin without a path, query, or fragment`);
	return url.origin;
}

function seconds(milliseconds: number): number {
	if (!Number.isSafeInteger(milliseconds) || milliseconds <= 0 || milliseconds % 1_000 !== 0)
		throw new Error(
			`Probe duration must be a positive whole number of seconds: ${milliseconds}`,
		);
	return milliseconds / 1_000;
}

const appHostMode = resolveAppHostMode(process.env.REZICS_ASPIRE_MODE);
const searchEnabled = appHostMode === "search";
const isolatedSmoke = appHostMode === "smoke";

const builder = await createBuilder();

const databaseUrlParameter = await builder.addParameter("database-url", {
	value: requireDatabaseUrl("DATABASE_URL"),
	secret: true,
});
const database = await builder.addConnectionString("rezics-database", {
	environmentVariableNameOrExpression: refExpr`${databaseUrlParameter}`,
});

const s3EndpointParameter = await builder.addParameter("rustfs-endpoint", {
	value: requireHttpOrigin("S3_ENDPOINT"),
});
const rustfs = await builder.addExternalService("rustfs", s3EndpointParameter);
const s3AccessKey = await builder.addParameter("rustfs-access-key", {
	value: requireEnvironmentVariable("S3_ACCESS_KEY_ID"),
	secret: true,
});
const s3SecretKey = await builder.addParameter("rustfs-secret-key", {
	value: requireEnvironmentVariable("S3_SECRET_ACCESS_KEY"),
	secret: true,
});
const s3Bucket = await builder.addParameter("rustfs-bucket", {
	value: requireEnvironmentVariable("S3_BUCKET"),
});
const betterAuthSecret = await builder.addParameter("better-auth-secret", {
	value: requireEnvironmentVariable("BETTER_AUTH_SECRET"),
	secret: true,
});

let meilisearch: Awaited<ReturnType<typeof builder.addExternalService>> | undefined;
let meilisearchMasterKey: Awaited<ReturnType<typeof builder.addParameter>> | undefined;

if (searchEnabled) {
	const meilisearchUrl = await builder.addParameter("meilisearch-url", {
		value: requireHttpOrigin("MEILISEARCH_URL"),
	});
	meilisearch = await builder.addExternalService("meilisearch", meilisearchUrl);
	meilisearchMasterKey = await builder.addParameter("meilisearch-master-key", {
		value: requireEnvironmentVariable("MEILISEARCH_MASTER_KEY"),
		secret: true,
	});
}

let api = builder
	.addBunApp("main-api", "../services/main", "src/index.ts")
	.withBun({ install: false })
	.withRunScript("dev:api")
	.withHttpEndpoint(
		isolatedSmoke
			? { env: "PORT", name: "http" }
			: { env: "PORT", name: "http", port: requirePort("PORT") },
	)
	.withHttpProbe(ProbeType.Startup, {
		endpointName: "http",
		path: apiSchedulerHealthContract.startup.path,
		initialDelaySeconds: seconds(apiSchedulerHealthContract.startup.initialGraceMs),
		periodSeconds: seconds(apiSchedulerHealthContract.startup.intervalMs),
		timeoutSeconds: seconds(apiSchedulerHealthContract.startup.timeoutMs),
		failureThreshold: apiSchedulerHealthContract.startup.failureThreshold,
		successThreshold: 1,
	})
	.withHttpProbe(ProbeType.Liveness, {
		endpointName: "http",
		path: apiSchedulerHealthContract.liveness.path,
		initialDelaySeconds: seconds(apiSchedulerHealthContract.liveness.initialGraceMs),
		periodSeconds: seconds(apiSchedulerHealthContract.liveness.intervalMs),
		timeoutSeconds: seconds(apiSchedulerHealthContract.liveness.timeoutMs),
		failureThreshold: apiSchedulerHealthContract.liveness.failureThreshold,
		successThreshold: 1,
	})
	.withHttpProbe(ProbeType.Readiness, {
		endpointName: "http",
		path: apiSchedulerHealthContract.readiness.path,
		initialDelaySeconds: seconds(apiSchedulerHealthContract.readiness.initialGraceMs),
		periodSeconds: seconds(apiSchedulerHealthContract.readiness.intervalMs),
		timeoutSeconds: seconds(apiSchedulerHealthContract.readiness.timeoutMs),
		failureThreshold: apiSchedulerHealthContract.readiness.failureThreshold,
		successThreshold: 1,
	})
	.withEnvironment("HOST", "0.0.0.0")
	.withEnvironment("OTEL_EXPORTER_OTLP_PROTOCOL", "http/protobuf")
	.withEnvironment("OTEL_METRIC_EXPORT_TIMEOUT", "1000")
	.withEnvironment("DATABASE_URL", database)
	.withEnvironment("BETTER_AUTH_SECRET", betterAuthSecret)
	.withEnvironment("EMAIL_MODE", requireEnvironmentVariable("EMAIL_MODE"))
	.withEnvironment("EMAIL_FROM", requireEnvironmentVariable("EMAIL_FROM"))
	.withEnvironment("S3_ENDPOINT", rustfs)
	.withEnvironment("S3_REGION", requireEnvironmentVariable("S3_REGION"))
	.withEnvironment("S3_ACCESS_KEY_ID", s3AccessKey)
	.withEnvironment("S3_SECRET_ACCESS_KEY", s3SecretKey)
	.withEnvironment("S3_BUCKET", s3Bucket)
	.withEnvironment("S3_FORCE_PATH_STYLE", requireEnvironmentVariable("S3_FORCE_PATH_STYLE"))
	.withEnvironment("S3_PRESIGN_EXPIRES_IN", requireEnvironmentVariable("S3_PRESIGN_EXPIRES_IN"))
	.withReference(database)
	.withReference(rustfs);

if (meilisearch && meilisearchMasterKey) {
	api = api
		.withEnvironment("MEILISEARCH_URL", meilisearch)
		.withEnvironment("MEILISEARCH_MASTER_KEY", meilisearchMasterKey)
		.withReference(meilisearch);
}

const apiEndpoint = await api.getEndpoint("http");
api = api.withEnvironment("BETTER_AUTH_URL", apiEndpoint);

let worker = builder
	.addBunApp("recommendation-worker", "../services/main", "src/worker.ts")
	.withBun({ install: false })
	.withRunScript("dev:worker")
	.withHttpEndpoint({ env: "WORKER_HEALTH_PORT", name: "health" })
	.withHttpProbe(ProbeType.Startup, {
		endpointName: "health",
		path: workerSchedulerHealthContract.startup.path,
		initialDelaySeconds: seconds(workerSchedulerHealthContract.startup.initialGraceMs),
		periodSeconds: seconds(workerSchedulerHealthContract.startup.intervalMs),
		timeoutSeconds: seconds(workerSchedulerHealthContract.startup.timeoutMs),
		failureThreshold: workerSchedulerHealthContract.startup.failureThreshold,
		successThreshold: 1,
	})
	.withHttpProbe(ProbeType.Liveness, {
		endpointName: "health",
		path: workerSchedulerHealthContract.liveness.path,
		initialDelaySeconds: seconds(workerSchedulerHealthContract.liveness.initialGraceMs),
		periodSeconds: seconds(workerSchedulerHealthContract.liveness.intervalMs),
		timeoutSeconds: seconds(workerSchedulerHealthContract.liveness.timeoutMs),
		failureThreshold: workerSchedulerHealthContract.liveness.failureThreshold,
		successThreshold: 1,
	})
	.withHttpProbe(ProbeType.Readiness, {
		endpointName: "health",
		path: workerSchedulerHealthContract.readiness.path,
		initialDelaySeconds: seconds(workerSchedulerHealthContract.readiness.initialGraceMs),
		periodSeconds: seconds(workerSchedulerHealthContract.readiness.intervalMs),
		timeoutSeconds: seconds(workerSchedulerHealthContract.readiness.timeoutMs),
		failureThreshold: workerSchedulerHealthContract.readiness.failureThreshold,
		successThreshold: 1,
	})
	.withEnvironment("WORKER_HEALTH_HOST", "0.0.0.0")
	.withEnvironment("OTEL_EXPORTER_OTLP_PROTOCOL", "http/protobuf")
	.withEnvironment("OTEL_METRIC_EXPORT_TIMEOUT", "1000")
	.withEnvironment("DATABASE_URL", database)
	.withEnvironment("BETTER_AUTH_SECRET", betterAuthSecret)
	.withEnvironment("BETTER_AUTH_URL", apiEndpoint)
	.withEnvironment("BETTER_AUTH_TRUSTED_ORIGINS", apiEndpoint)
	.withEnvironment("EMAIL_MODE", requireEnvironmentVariable("EMAIL_MODE"))
	.withEnvironment("EMAIL_FROM", requireEnvironmentVariable("EMAIL_FROM"))
	.withEnvironment("S3_ENDPOINT", rustfs)
	.withEnvironment("S3_REGION", requireEnvironmentVariable("S3_REGION"))
	.withEnvironment("S3_ACCESS_KEY_ID", s3AccessKey)
	.withEnvironment("S3_SECRET_ACCESS_KEY", s3SecretKey)
	.withEnvironment("S3_BUCKET", s3Bucket)
	.withEnvironment("S3_FORCE_PATH_STYLE", requireEnvironmentVariable("S3_FORCE_PATH_STYLE"))
	.withEnvironment("S3_PRESIGN_EXPIRES_IN", requireEnvironmentVariable("S3_PRESIGN_EXPIRES_IN"))
	.withEnvironment(
		"RECOMMENDATION_REFRESH_INTERVAL_MS",
		requireEnvironmentVariable("RECOMMENDATION_REFRESH_INTERVAL_MS"),
	)
	.withReference(database)
	.withReference(rustfs);

if (meilisearch && meilisearchMasterKey) {
	worker = worker
		.withEnvironment("MEILISEARCH_URL", meilisearch)
		.withEnvironment("MEILISEARCH_MASTER_KEY", meilisearchMasterKey)
		.withReference(meilisearch);
}
await worker;

const web = await builder
	.addViteApp("web", "../apps/web", { runScriptName: "dev" })
	.withYarn({ install: false })
	.withHttpEndpoint(
		isolatedSmoke
			? { env: "PORT", name: "http" }
			: { env: "PORT", name: "http", port: requirePort("FRONTEND_PORT") },
	)
	.withEnvironment("BROWSER", "none")
	.withEnvironment("REZICS_API_ORIGIN", apiEndpoint)
	.withReference(api)
	.waitFor(api);
const webEndpoint = await web.getEndpoint("http");

await api.withEnvironment("BETTER_AUTH_TRUSTED_ORIGINS", webEndpoint);

await builder.build().run();
