import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { getSchema } from "better-auth/db";
import { jwt } from "better-auth/plugins";
import { mcp } from "@better-auth/mcp";
import { cimd } from "@better-auth/cimd";

const require = createRequire(import.meta.url);
const serviceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const models = ["jwks", "oauthClient", "oauthResource", "oauthClientResource", "oauthRefreshToken", "oauthAccessToken", "oauthConsent", "oauthClientAssertion"] as const;
const coreModels: Record<string, string> = { user: "users", session: "sessions", account: "accounts", verification: "verifications" };
const symbol = (model: string) => model === "jwks" ? "oauthJwks" : `${model}s`;
const snake = (value: string) => value.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
const tableName = (model: string) => model === "jwks" ? "oauth_jwks" : snake(model);
const identifier = (value: string) => {
	if (!/^[A-Za-z][A-Za-z0-9]*$/.test(value)) throw new Error(`Unsupported provider identifier: ${value}`);
	return value;
};
function name(value: string) {
	const normalized = snake(value);
	return normalized.length <= 63 ? normalized : `${normalized.slice(0, 46)}_${createHash("sha256").update(normalized).digest("hex").slice(0, 16)}`;
}
async function version(packageName: string) {
	let directory = dirname(require.resolve(packageName));
	for (let depth = 0; depth < 8; depth++) {
		try {
			const manifest = JSON.parse(await readFile(resolve(directory, "package.json"), "utf8"));
			if (manifest.name === packageName && typeof manifest.version === "string") return manifest.version;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
		}
		directory = dirname(directory);
	}
	throw new Error(`Cannot locate the owning manifest for ${packageName}`);
}
const packages = ["better-auth", "@better-auth/oauth-provider", "@better-auth/mcp", "@better-auth/cimd"];
const versions = await Promise.all(packages.map(version));
if (versions.some(value => value !== "1.7.3")) throw new Error("Reconcile the OAuth schema producer with the newly selected provider release before generation");
// Metadata construction only: no auth server, database, credential, key generation or egress.
const metadata = getSchema({
	advanced: { database: { generateId: "uuid" } },
	plugins: [
		jwt({ jwks: { keyPairConfig: { alg: "RS256" } } }),
		mcp({ resource: "https://schema.invalid/mcp", loginPage: "/login", consentPage: "/consent",
			forceOpaqueAccessTokens: true, pairwiseSecret: "schema-metadata-only-not-a-runtime-secret",
			scopes: ["openid", "offline_access", "mcp:read"] }),
		cimd({ metadataProfile: "mcp-2026-07-28", fetchClientMetadataResource: async () => { throw new Error("Schema production cannot fetch external metadata"); } }),
	],
});
const selected = new Set<string>(models);
for (const model of Object.keys(metadata)) if (!(model in coreModels) && !selected.has(model))
	throw new Error(`Unreviewed protocol model ${model}`);
for (const model of models) if (!metadata[model] || metadata[model].disableMigrations)
	throw new Error(`Selected protocol model ${model} has no production schema`);
const coreImports = new Set<string>();
const imports = new Set<string>(["text", "uuid", "foreignKey", "index", "uniqueIndex", "type PgTableExtraConfigValue"]);
function type(model: string, fieldName: string): string {
	if (fieldName === "id") return model === "oauthClientAssertion" ? "text" : "uuid";
	const field = metadata[model]?.fields[fieldName];
	if (!field) throw new Error(`Missing reference target ${model}.${fieldName}`);
	if (field.references) return type(field.references.model, field.references.field);
	if (Array.isArray(field.type)) return "text";
	switch (field.type) {
		case "string": return "text";
		case "date": return "timestamp";
		case "boolean": return "boolean";
		case "number": return "integer";
		case "string[]": return "text-array";
		case "number[]": return "integer-array";
		case "json": return "jsonb";
		default: throw new Error(`Unsupported provider field type ${model}.${fieldName}`);
	}
}
const blocks: string[] = [];
for (const model of models) {
	identifier(model);
	const definition = metadata[model]!;
	const columns = [model === "oauthClientAssertion" ? "\t\tid: text().primaryKey()," : "\t\tid: uuid().default(sql`uuidv7()`).primaryKey(),"];
	const constraints: string[] = [];
	// Native control identity survives provider cleanup and fences configuration changes.
	if (model === "oauthClient") constraints.push('foreignKey({ name: "oauth_client_authority_fk", columns: [table.id], foreignColumns: [oauthClientAuthority.id] }).onDelete("restrict"),');
	for (const [fieldName, field] of Object.entries(definition.fields)) {
		identifier(fieldName);
		if (fieldName === "id" || field.bigint || field.onUpdate) throw new Error(`Provider field needs an explicit storage decision: ${model}.${fieldName}`);
		const fieldType = type(model, fieldName);
		const builder = fieldType.replace("-array", "");
		imports.add(builder);
		let expression = builder === "timestamp" ? 'timestamp({ withTimezone: true, precision: 3, mode: "date" })' : `${builder}()`;
		if (fieldType.endsWith("-array")) expression += ".array()";
		if (fieldType === "jsonb") expression += ".$type<unknown>()";
		if (Array.isArray(field.type)) {
			if (!field.type.length || !field.type.every(value => typeof value === "string")) throw new Error(`Invalid enum metadata ${model}.${fieldName}`);
			expression += `.$type<${field.type.map(value => JSON.stringify(value)).join(" | ")}>()`;
			imports.add("check");
			constraints.push(`check(${JSON.stringify(name(`${model}_${fieldName}_values_check`))}, inArray(table.${fieldName}, ${JSON.stringify(field.type)})),`);
		}
		if (field.required !== false) expression += ".notNull()";
		columns.push(`\t\t${fieldName}: ${expression},`);
		if (field.unique || field.index) constraints.push(`${field.unique ? "uniqueIndex" : "index"}(${JSON.stringify(name(`${model}_${fieldName}_${field.unique ? "key" : "idx"}`))}).on(table.${fieldName}),`);
		if (field.references) {
			const ref = field.references;
			identifier(ref.model); identifier(ref.field);
			if (!(ref.model in coreModels) && !selected.has(ref.model)) throw new Error(`Unmapped reference ${ref.model}`);
			const target = coreModels[ref.model] ?? symbol(ref.model);
			if (ref.model in coreModels) coreImports.add(target);
			const action = ref.onDelete;
			if (action && !["cascade", "restrict", "set null", "no action", "set default"].includes(action)) throw new Error(`Unsupported reference action ${action}`);
			constraints.push(`foreignKey({ name: ${JSON.stringify(name(`${model}_${fieldName}_${ref.model}_${ref.field}_fk`))}, columns: [table.${fieldName}], foreignColumns: [${target}.${ref.field}] })${action ? `.onDelete(${JSON.stringify(action)})` : ""},`);
		}
	}
	for (const [indexNumber, entry] of (definition.indexes ?? []).entries()) {
		if (!entry.columns.length || entry.columns.some(column => !definition.fields[column])) throw new Error(`Invalid protocol index ${model}`);
		constraints.push(`${entry.unique ? "uniqueIndex" : "index"}(${JSON.stringify(name(`${model}_compound_${indexNumber}_${entry.unique ? "key" : "idx"}`))}).on(${entry.columns.map(column => `table.${identifier(column)}`).join(", ")}),`);
	}
	if (definition.fields.expiresAt) constraints.push(`index(${JSON.stringify(name(`${model}_expiry_idx`))}).on(table.expiresAt, table.id),`);
	blocks.push(`/** Provider-owned ${model} protocol records; domain admission and disclosure are separate. @internal */\nexport const ${symbol(model)} = pgTable(${JSON.stringify(tableName(model))}, {\n${columns.join("\n")}\n\t}, (table): PgTableExtraConfigValue[] => [\n${constraints.map(line => `\t\t${line}`).join("\n")}\n\t],\n);`);
}
const output = `// Generated by scripts/generate-oauth-schema.ts from Better Auth/provider/MCP/CIMD 1.7.3. Do not edit.\n// Native UUID references reuse existing accounts/sessions; assertion replay IDs retain the provider's opaque digest.\nimport { sql${imports.has("check") ? ", inArray" : ""} } from "drizzle-orm";\nimport { ${[...imports].sort().join(", ")} } from "drizzle-orm/pg-core";\nimport { pgTable } from "../shared/base";\nimport { ${[...coreImports].sort().join(", ")} } from "./auth";\nimport { oauthClientAuthority } from "../integrations/oauth-client-authority";\n\n${blocks.join("\n\n")}\n\n/** Model aliases for the existing plural Better Auth adapter boundary. @internal */\nexport const OAuthProtocolSchema = {\n${models.map(model => `\t${model}s: ${symbol(model)},`).join("\n")}\n};\n`;
const target = resolve(serviceRoot, "../../libraries/schema/src/postgres/identity/auth-oauth.generated.ts");
const temporaryRoot = resolve(serviceRoot, "../../.temp");
await mkdir(temporaryRoot, { recursive: true });
const temporary = await mkdtemp(resolve(temporaryRoot, "oauth-schema-"));
try {
	const draft = resolve(temporary, "auth-oauth.generated.ts");
	await writeFile(draft, output);
	await rename(draft, target);
} finally {
	await rm(temporary, { recursive: true, force: true });
}
console.info(`Produced ${models.length} protocol table declarations at ${target}; adapter/schema qualification remains pending.`);
