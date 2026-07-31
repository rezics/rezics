import { afterAll } from "vitest";
import { initializeObservability } from "@rezics/observability";

import { RezicsVersion } from "./version";

const environment: Readonly<Record<string, string>> = {
	DATABASE_URL: "postgresql://test:test@localhost:5432/rezics",
	BETTER_AUTH_SECRET: "test-secret-that-is-longer-than-thirty-two-characters",
	BETTER_AUTH_URL: "http://localhost:3001",
	BETTER_AUTH_TRUSTED_ORIGINS: "http://localhost:3000",
	TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
	TURNSTILE_ALLOWED_HOSTNAMES: "localhost,127.0.0.1",
	EMAIL_MODE: "log",
	EMAIL_FROM: "test@example.com",
	EMAIL_FROM_NAME: "Rezics",
	S3_ENDPOINT: "http://localhost:9000",
	S3_ACCESS_KEY_ID: "test-access-key",
	S3_SECRET_ACCESS_KEY: "test-secret-key",
	S3_BUCKET: "rezics-test",
};

for (const [name, value] of Object.entries(environment)) process.env[name] = value;

const observability = initializeObservability({
	service: {
		name: "rezics-main-test",
		version: RezicsVersion,
		environment: "test",
	},
});

afterAll(() => observability.shutdown());
