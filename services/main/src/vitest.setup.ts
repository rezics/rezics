const environment: Readonly<Record<string, string>> = {
	DATABASE_URL: "postgresql://test:test@localhost:5432/rezics",
	BETTER_AUTH_SECRET: "test-secret-that-is-longer-than-thirty-two-characters",
	BETTER_AUTH_URL: "http://localhost:3001",
	BETTER_AUTH_TRUSTED_ORIGINS: "http://localhost:3000",
	EMAIL_MODE: "log",
	EMAIL_FROM: "test@example.com",
	S3_ENDPOINT: "http://localhost:9000",
	S3_ACCESS_KEY_ID: "test-access-key",
	S3_SECRET_ACCESS_KEY: "test-secret-key",
	S3_BUCKET: "rezics-test",
};

for (const [name, value] of Object.entries(environment)) process.env[name] = value;
