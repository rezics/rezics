import { refExpr } from "./.aspire/modules/base.mjs";
import { createBuilder, EndpointProperty } from "./.aspire/modules/aspire.mjs";

type AppHostMode = "development" | "search" | "setup" | "smoke";

function resolveAppHostMode(value: string | undefined): AppHostMode {
	switch (value) {
		case undefined:
		case "development":
			return "development";
		case "search":
		case "setup":
		case "smoke":
			return value;
		default:
			throw new Error(
				`REZICS_ASPIRE_MODE must be development, search, setup, or smoke; received ${value}`,
			);
	}
}

const appHostMode = resolveAppHostMode(process.env.REZICS_ASPIRE_MODE);
const setupOnly = appHostMode === "setup";
const searchEnabled = appHostMode === "search";
const ephemeral = appHostMode === "smoke";

const builder = await createBuilder();

const postgresUser = await builder.addParameter("postgres-user", {
	value: "postgres",
});
const postgresPassword = await builder.addParameterWithGeneratedValue(
	"postgres-password",
	{
		minLength: 32,
		lower: true,
		upper: true,
		numeric: true,
		special: false,
	},
	{ secret: true, persist: true },
);

let postgres = builder
	.addPostgres("postgres", {
		userName: postgresUser,
		password: postgresPassword,
	})
	.withImage("groonga/pgroonga", { tag: "4.0.6-debian-18" })
	.withInitFiles("../services/main/docker/postgres/init");
if (!ephemeral)
	postgres = postgres.withVolume("/var/lib/postgresql", {
		name: "rezics-postgres-18-data",
	});

await postgres.addDatabase("rezics-database", {
	databaseName: "rezics",
});
const postgresEndpoint = await postgres.primaryEndpoint();
const postgresHostAndPort = await postgresEndpoint.property(EndpointProperty.HostAndPort);
const adminDatabaseUrl = refExpr`postgresql://${postgresUser}:${postgresPassword}@${postgresHostAndPort}/rezics?sslmode=disable`;
const applicationDatabaseUrl = refExpr`postgresql://rezics_app:rezics_app@${postgresHostAndPort}/rezics?sslmode=disable`;

const s3AccessKey = await builder.addParameterWithGeneratedValue(
	"rustfs-access-key",
	{
		minLength: 24,
		lower: true,
		upper: true,
		numeric: true,
		special: false,
	},
	{ secret: true, persist: true },
);
const s3SecretKey = await builder.addParameterWithGeneratedValue(
	"rustfs-secret-key",
	{
		minLength: 40,
		lower: true,
		upper: true,
		numeric: true,
		special: false,
	},
	{ secret: true, persist: true },
);
const s3Bucket = await builder.addParameter("rustfs-bucket", {
	value: "rezics",
});

let rustfs = builder
	.addContainer("rustfs", {
		image: "rustfs/rustfs",
		tag: "1.0.0-beta.10",
	})
	.withArgs(["/data"])
	.withEnvironment("RUSTFS_ACCESS_KEY", s3AccessKey)
	.withEnvironment("RUSTFS_SECRET_KEY", s3SecretKey)
	.withEnvironment("RUSTFS_CONSOLE_ENABLE", "false")
	.withHttpEndpoint({ name: "s3", targetPort: 9000 })
	.withHttpHealthCheck({ endpointName: "s3", path: "/health" });
if (!ephemeral) rustfs = rustfs.withVolume("/data", { name: "rezics-rustfs-data" });
const rustfsEndpoint = await rustfs.getEndpoint("s3");

const rustfsBucketInit = await builder
	.addContainer("rustfs-bucket-init", {
		image: "minio/mc",
		tag: "RELEASE.2025-08-13T08-35-41Z",
	})
	.withEntrypoint("/bin/sh")
	.withArgs([
		"-c",
		'until mc alias set local "$S3_ENDPOINT" "$S3_ACCESS_KEY_ID" "$S3_SECRET_ACCESS_KEY"; do sleep 1; done; mc mb --ignore-existing "local/$S3_BUCKET"',
	])
	.withEnvironment("S3_ENDPOINT", rustfsEndpoint)
	.withEnvironment("S3_ACCESS_KEY_ID", s3AccessKey)
	.withEnvironment("S3_SECRET_ACCESS_KEY", s3SecretKey)
	.withEnvironment("S3_BUCKET", s3Bucket)
	.waitFor(rustfs);

const databasePrepare = await builder
	.addExecutable("database-prepare", "yarn", "..", ["task", "services-main:db:prepare"])
	.withEnvironment("DATABASE_ADMIN_URL", adminDatabaseUrl)
	.withEnvironment("DATABASE_URL", applicationDatabaseUrl)
	.waitFor(postgres);

if (!setupOnly) {
	const betterAuthSecret = await builder.addParameterWithGeneratedValue(
		"better-auth-secret",
		{
			minLength: 48,
			lower: true,
			upper: true,
			numeric: true,
			special: false,
		},
		{ secret: true, persist: true },
	);

	let meilisearchEndpoint: Awaited<ReturnType<typeof rustfs.getEndpoint>> | undefined;
	let meilisearchMasterKey:
		Awaited<ReturnType<typeof builder.addParameterWithGeneratedValue>> | undefined;

	if (searchEnabled) {
		meilisearchMasterKey = await builder.addParameterWithGeneratedValue(
			"meilisearch-master-key",
			{
				minLength: 32,
				lower: true,
				upper: true,
				numeric: true,
				special: false,
			},
			{ secret: true, persist: true },
		);
		const meilisearch = await builder
			.addContainer("meilisearch", {
				image: "getmeili/meilisearch",
				tag: "v1.49.0",
			})
			.withEnvironment("MEILI_ENV", "development")
			.withEnvironment("MEILI_MASTER_KEY", meilisearchMasterKey)
			.withEnvironment("MEILI_NO_ANALYTICS", "true")
			.withHttpEndpoint({ name: "http", targetPort: 7700 })
			.withHttpHealthCheck({ endpointName: "http", path: "/health" });
		meilisearchEndpoint = await meilisearch.getEndpoint("http");
	}

	let api = builder
		.addBunApp("main-api", "../services/main", "src/index.ts")
		.withBun({ install: false })
		.withRunScript("dev:api")
		.withHttpEndpoint({ env: "PORT", name: "http" })
		.withHttpHealthCheck({ endpointName: "http", path: "/api/health" })
		.withEnvironment("HOST", "0.0.0.0")
		.withEnvironment("DATABASE_URL", applicationDatabaseUrl)
		.withEnvironment("BETTER_AUTH_SECRET", betterAuthSecret)
		.withEnvironment("EMAIL_MODE", "log")
		.withEnvironment("EMAIL_FROM", "no-reply@example.com")
		.withEnvironment("S3_ENDPOINT", rustfsEndpoint)
		.withEnvironment("S3_REGION", "auto")
		.withEnvironment("S3_ACCESS_KEY_ID", s3AccessKey)
		.withEnvironment("S3_SECRET_ACCESS_KEY", s3SecretKey)
		.withEnvironment("S3_BUCKET", s3Bucket)
		.withEnvironment("S3_FORCE_PATH_STYLE", "true")
		.withEnvironment("S3_PRESIGN_EXPIRES_IN", "900")
		.waitForCompletion(databasePrepare)
		.waitForCompletion(rustfsBucketInit);

	const worker = builder
		.addBunApp("recommendation-worker", "../services/main", "src/worker.ts")
		.withBun({ install: false })
		.withRunScript("dev:worker")
		.withEnvironment("DATABASE_URL", applicationDatabaseUrl)
		.withEnvironment("BETTER_AUTH_SECRET", betterAuthSecret)
		.withEnvironment("BETTER_AUTH_URL", "http://127.0.0.1")
		.withEnvironment("BETTER_AUTH_TRUSTED_ORIGINS", "http://127.0.0.1")
		.withEnvironment("EMAIL_MODE", "log")
		.withEnvironment("EMAIL_FROM", "no-reply@example.com")
		.withEnvironment("S3_ENDPOINT", rustfsEndpoint)
		.withEnvironment("S3_REGION", "auto")
		.withEnvironment("S3_ACCESS_KEY_ID", s3AccessKey)
		.withEnvironment("S3_SECRET_ACCESS_KEY", s3SecretKey)
		.withEnvironment("S3_BUCKET", s3Bucket)
		.withEnvironment("S3_FORCE_PATH_STYLE", "true")
		.withEnvironment("S3_PRESIGN_EXPIRES_IN", "900")
		.withEnvironment("RECOMMENDATION_REFRESH_INTERVAL_MS", "300000")
		.waitForCompletion(databasePrepare)
		.waitForCompletion(rustfsBucketInit);

	if (meilisearchEndpoint && meilisearchMasterKey) {
		api = api
			.withEnvironment("MEILISEARCH_URL", meilisearchEndpoint)
			.withEnvironment("MEILISEARCH_MASTER_KEY", meilisearchMasterKey);
		await worker
			.withEnvironment("MEILISEARCH_URL", meilisearchEndpoint)
			.withEnvironment("MEILISEARCH_MASTER_KEY", meilisearchMasterKey);
	}

	const apiEndpoint = await api.getEndpoint("http");
	api = api.withEnvironment("BETTER_AUTH_URL", apiEndpoint);

	const web = await builder
		.addViteApp("web", "../apps/web", { runScriptName: "dev" })
		.withYarn({ install: false })
		.withHttpEndpoint({ env: "PORT", name: "http" })
		.withEnvironment("REZICS_API_ORIGIN", apiEndpoint)
		.waitFor(api);
	const webEndpoint = await web.getEndpoint("http");

	await api.withEnvironment("BETTER_AUTH_TRUSTED_ORIGINS", webEndpoint);
}

await builder.build().run();
