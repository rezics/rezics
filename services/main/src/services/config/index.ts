import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createEnv } from "@t3-oss/env-core";
import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv({
	path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../../.env"),
	quiet: true,
});

const origin = z.url().refine((value) => new URL(value).origin === value, {
	message: "must not include a path, query, or fragment",
});

export const env = createEnv({
	skipValidation: process.env.SKIP_VALIDATION === "true",
	server: {
		HOST: z.string().min(1).default("0.0.0.0"),
		PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
		DATABASE_URL: z.url(),
		BETTER_AUTH_SECRET: z.string().min(32),
		BETTER_AUTH_URL: origin,
		EMAIL_MODE: z.enum(["log", "cloudflare"]).default("log"),
		EMAIL_FROM: z.string().min(1),
		CLOUDFLARE_ACCOUNT_ID: z.string().min(1).optional(),
		CLOUDFLARE_EMAIL_API_TOKEN: z.string().min(1).optional(),
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
		RECOMMENDATION_REFRESH_INTERVAL_MS: z.coerce.number().int().min(60_000).default(300_000),
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
