import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createEnv } from "@t3-oss/env-core";
import { config as loadEnv } from "dotenv";
import { z } from "zod";

import { WorkPolicy } from "../performance/policy";

loadEnv({
	path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../../.env"),
	quiet: true,
});

const origin = z.url().refine((value) => new URL(value).origin === value, {
	message: "must not include a path, query, or fragment",
});

const release = z.union([
	z.literal("development"),
	z.string().regex(/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/),
]);

const hostname = z
	.string()
	.trim()
	.min(1)
	.refine((value) => {
		try {
			const url = new URL(`http://${value}`);
			return url.hostname === value && url.port === "" && url.pathname === "/";
		} catch {
			return false;
		}
	}, "must be a hostname without a scheme, port, path, query, or fragment");

export const env = createEnv({
	server: {
		HOST: z.string().min(1).default("0.0.0.0"),
		PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
		REZICS_RELEASE: release.default("development"),
		DATABASE_URL: z.url(),
		DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),
		DATABASE_POOL_CONNECTION_TIMEOUT_MS: z.coerce
			.number()
			.int()
			.min(100)
			.max(30_000)
			.default(2_000),
		DATABASE_POOL_IDLE_TIMEOUT_MS: z.coerce
			.number()
			.int()
			.min(1_000)
			.max(300_000)
			.default(30_000),
		DATABASE_POOL_MAX_LIFETIME_SECONDS: z.coerce
			.number()
			.int()
			.min(60)
			.max(86_400)
			.default(1_800),
		DATABASE_STATEMENT_TIMEOUT_MS: z.coerce.number().int().min(100).max(60_000).default(10_000),
		BETTER_AUTH_SECRET: z.string().min(32),
		BETTER_AUTH_URL: origin,
		TURNSTILE_SECRET_KEY: z.string().min(1).optional(),
		TURNSTILE_ALLOWED_HOSTNAMES: z
			.string()
			.transform((value) =>
				value
					.split(",")
					.map((entry) => entry.trim())
					.filter(Boolean),
			)
			.pipe(z.array(hostname).min(1, "must include at least one hostname"))
			.optional(),
		EMAIL_MODE: z.enum(["log", "cloudflare"]).default("log"),
		EMAIL_FROM: z.string().min(1),
		EMAIL_FROM_NAME: z.string().trim().min(1).default("Rezics"),
		CLOUDFLARE_ACCOUNT_ID: z.string().min(1).optional(),
		CLOUDFLARE_EMAIL_API_TOKEN: z.string().min(1).optional(),
		EMAIL_DISPATCH_POLL_INTERVAL_MS: z.coerce
			.number()
			.int()
			.min(250)
			.max(60_000)
			.default(1_000),
		EMAIL_DISPATCH_BATCH_SIZE: z.coerce.number().int().min(1).max(100).default(20),
		EMAIL_DISPATCH_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(20).default(5),
		BETTER_AUTH_TRUSTED_ORIGINS: z
			.string()
			.transform((value) =>
				value
					.split(",")
					.map((origin) => origin.trim())
					.filter(Boolean),
			)
			.pipe(z.array(z.string()).min(1, "must include at least one origin")),
		S3_ENDPOINT: z.url(),
		S3_REGION: z.string().min(1).default("auto"),
		S3_ACCESS_KEY_ID: z.string().min(1),
		S3_SECRET_ACCESS_KEY: z.string().min(1),
		S3_BUCKET: z.string().min(1),
		S3_FORCE_PATH_STYLE: z
			.enum(["true", "false"])
			.transform((value) => value === "true")
			.default(true),
		S3_PRESIGN_EXPIRES_IN: z.coerce.number().int().min(1).max(604_800).default(900),
		IMAGE_ASSET_CLEANUP_INTERVAL_MS: z.coerce.number().int().min(60_000).default(300_000),
		IMAGE_ASSET_CLEANUP_GRACE_MS: z.coerce
			.number()
			.int()
			.min(0)
			.max(86_400_000)
			.default(300_000),
		IMAGE_ASSET_CLEANUP_BATCH_SIZE: z.coerce.number().int().min(1).max(500).default(100),
		API_QUOTA_CLEANUP_INTERVAL_MS: z.coerce.number().int().min(60_000).default(3_600_000),
		SEARCH_STATEMENT_TIMEOUT_MS: z.coerce
			.number()
			.int()
			.min(100)
			.max(WorkPolicy.search.statementTimeoutCeilingMs)
			.default(WorkPolicy.search.statementTimeoutMs),
		SEARCH_FACET_SCAN_LIMIT: z.coerce
			.number()
			.int()
			.min(100)
			.max(WorkPolicy.search.maxFacetScanCeiling)
			.default(WorkPolicy.search.maxFacetScan),
		RECOMMENDATION_REFRESH_INTERVAL_MS: z.coerce
			.number()
			.int()
			.min(WorkPolicy.recommendation.minimumRefreshIntervalMs)
			.default(WorkPolicy.recommendation.minimumRefreshIntervalMs),
		WORKER_HEALTH_HOST: z.string().min(1).default("127.0.0.1"),
		WORKER_HEALTH_PORT: z.coerce.number().int().min(1).max(65_535).default(3002),
	},
	runtimeEnv: process.env,
	emptyStringAsUndefined: true,
});

if (
	env.EMAIL_MODE === "cloudflare" &&
	(!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_EMAIL_API_TOKEN)
)
	throw new Error(
		"CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_EMAIL_API_TOKEN are required when EMAIL_MODE=cloudflare",
	);

if (
	env.TURNSTILE_ALLOWED_HOSTNAMES?.some((value) => !["localhost", "127.0.0.1"].includes(value)) &&
	env.TURNSTILE_SECRET_KEY === "1x0000000000000000000000000000000AA"
)
	throw new Error("The Cloudflare Turnstile test secret key cannot be used in production");
