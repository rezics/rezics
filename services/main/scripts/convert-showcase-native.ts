// Canonical pack validators import shared service contracts. These loopback-only defaults
// satisfy configuration validation without supplying usable database or storage credentials.
const defaults: Record<string, string> = {
	DATABASE_URL: "postgresql://offline:offline@127.0.0.1:1/offline",
	BETTER_AUTH_SECRET: "offline-content-pack-validation-key-00000000000000",
	BETTER_AUTH_URL: "http://127.0.0.1:1",
	EMAIL_FROM: "offline@example.invalid",
	BETTER_AUTH_TRUSTED_ORIGINS: "http://127.0.0.1:1",
	S3_ENDPOINT: "http://127.0.0.1:1",
	S3_ACCESS_KEY_ID: "offline",
	S3_SECRET_ACCESS_KEY: "offline",
	S3_BUCKET: "offline",
};
for (const [key, value] of Object.entries(defaults)) process.env[key] ??= value;
const args = process.argv.slice(2);
if (args.length !== 4 || args[0] !== "--from" || args[2] !== "--to" || !args[1] || !args[3])
	throw new Error(
		"Usage: convert-showcase-native.ts --from SOURCE_CHECKOUT --to ISOLATED_OUTPUT_CHECKOUT",
	);
const { convertShowcase } = await import("./native-showcase/convert");
console.log(JSON.stringify(await convertShowcase(args[1], args[3]), null, 2));
export {};
