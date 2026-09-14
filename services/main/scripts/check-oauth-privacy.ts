import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { toNodeHandler } from "better-auth/node";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import { mcp, createMcpProtectedRequestHandler } from "@better-auth/mcp";
import { getSchema } from "better-auth/db";
import { betterAuth } from "better-auth/minimal";
import { jwt } from "better-auth/plugins";
import { drizzle } from "drizzle-orm/node-postgres";
import {
	boolean,
	doublePrecision,
	jsonb,
	pgTable,
	text,
	timestamp,
	type AnyPgColumnBuilder,
} from "drizzle-orm/pg-core";
import { decodeJwt, jwtVerify, createLocalJWKSet } from "jose";
import pg from "pg";

const target = new URL(process.env.DATABASE_ADMIN_URL ?? "http://invalid");
assert.ok(
	process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE === "1" &&
		["localhost", "127.0.0.1"].includes(target.hostname) &&
		target.port !== "15432" &&
		target.pathname === "/rezics_oauth_qualification",
	"Requires a dedicated disposable rezics_oauth_qualification database",
);
const pool = new pg.Pool({ connectionString: target.href });

const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
const evidence: unknown[] = [];

try {
	for (const { disableJwtPlugin, forceOpaqueAccessTokens } of [
		{ disableJwtPlugin: false, forceOpaqueAccessTokens: false },
		{ disableJwtPlugin: true, forceOpaqueAccessTokens: false },
		{ disableJwtPlugin: false, forceOpaqueAccessTokens: true },
	]) {
		let handler: (request: Request) => Promise<Response> = async () =>
			new Response(null, { status: 503 });
		const server = createServer(toNodeHandler((request) => handler(request)));
		server.listen(0, "127.0.0.1");
		await once(server, "listening");
		const address = server.address();
		assert.ok(address && typeof address !== "string");
		const origin = `http://127.0.0.1:${address.port}`,
			issuer = `${origin}/api/auth`,
			resource = `${origin}/mcp`;
		const plugins = [
			jwt({ jwks: { keyPairConfig: { alg: "RS256" } } }),
			mcp({
				resource,
				loginPage: "/login",
				consentPage: "/consent",
				scopes: ["openid", "offline_access", "mcp:read"],
				pairwiseSecret: "fixture-pairwise-secret-with-at-least-32-characters",
				disableJwtPlugin,
				forceOpaqueAccessTokens,
				clientPrivileges: () => true,
				refreshTokenReuseInterval: 0,
			}),
		];
		const options = {
			baseURL: origin,
			basePath: "/api/auth",
			secret: "fixture-auth-secret-with-at-least-32-characters",
			plugins,
			emailAndPassword: { enabled: true },
			rateLimit: { enabled: false },
			disabledPaths: ["/token"],
			advanced: { database: { generateId: "uuid" as const } },
		};
		// Generate an isolated adapter schema from the pinned provider's owning metadata.
		// This qualifies protocol persistence; it is not the production IAM schema.
		const metadata = getSchema(options);
		const prefix = `oq_${crypto.randomUUID().replaceAll("-", "")}_`;
		const schema: Record<string, ReturnType<typeof pgTable>> = {};
		const created: string[] = [];
		try {
			for (const [model, definition] of Object.entries(metadata)) {
				const columns: Record<string, AnyPgColumnBuilder> = { id: text("id").primaryKey() };
				const ddl = ['"id" text primary key default gen_random_uuid()::text'];
				for (const [name, field] of Object.entries(definition.fields)) {
					let column: AnyPgColumnBuilder, type: string;
					switch (field.type) {
						case "string":
							column = text(name);
							type = "text";
							break;
						case "boolean":
							column = boolean(name);
							type = "boolean";
							break;
						case "number":
							column = doublePrecision(name);
							type = "double precision";
							break;
						case "date":
							column = timestamp(name, { withTimezone: true });
							type = "timestamptz";
							break;
						case "string[]":
							column = text(name).array();
							type = "text[]";
							break;
						case "json":
							column = jsonb(name);
							type = "jsonb";
							break;
						default:
							throw new Error(`Unqualified provider field type: ${String(field.type)}`);
					}
					columns[name] = column;
					ddl.push(
						`${quote(name)} ${type}${field.required ? " not null" : ""}${field.unique ? " unique" : ""}`,
					);
				}
				schema[model] = pgTable(prefix + model, columns);
				await pool.query(`create table ${quote(prefix + model)} (${ddl.join(",")})`);
				created.push(prefix + model);
				for (const [index, spec] of (definition.indexes ?? []).entries()) {
					await pool.query(
						`create ${spec.unique ? "unique " : ""}index ${quote(prefix + createHash("sha256").update(model).digest("hex").slice(0, 8) + index)} on ${quote(prefix + model)} (${spec.columns.map(quote).join(",")})`,
					);
				}
			}
			for (const [model, definition] of Object.entries(metadata)) {
				for (const [name, field] of Object.entries(definition.fields)) {
					if (field.references)
						await pool.query(
							`alter table ${quote(prefix + model)} add foreign key (${quote(name)}) references ${quote(prefix + field.references.model)} (${quote(field.references.field)})`,
						);
				}
			}
			let protocolStatements = 0;
			const protocolReadSamples: number[] = [];
			const auth = betterAuth({
				...options,
				database: drizzleAdapter(
					drizzle({
						client: pool,
						logger: {
							logQuery() {
								protocolStatements++;
							},
						},
					}),
					{ provider: "pg", schema },
				),
			});
			handler = auth.handler;
			async function request(
				path: string,
				body?: Record<string, string | boolean | string[]>,
				cookie?: string,
				form = false,
			) {
				return fetch(`${issuer}${path}`, {
					redirect: "manual",
					method: body ? "POST" : "GET",
					headers: {
						Origin: origin,
						...(cookie ? { Cookie: cookie } : {}),
						...(body
							? { "Content-Type": form ? "application/x-www-form-urlencoded" : "application/json" }
							: {}),
					},
					body: body
						? form
							? new URLSearchParams(Object.entries(body).map(([k, v]) => [k, String(v)]))
							: JSON.stringify(body)
						: undefined,
				});
			}
			async function json(response: Response, status = 200): Promise<Record<string, unknown>> {
				const value: unknown = await response.json();
				assert.equal(
					response.status,
					status,
					`Protocol response keys: ${Object.keys(value ?? {})}`,
				);
				assert.ok(value && typeof value === "object" && !Array.isArray(value));
				return value as Record<string, unknown>;
			}
			function str(value: unknown): string {
				assert.equal(typeof value, "string");
				return value as string;
			}
			const signup = await request("/sign-up/email", {
				email: "private@example.test",
				password: "fixture-only-long-password",
				name: "Private fixture",
			});
			const cookie = signup.headers
				.getSetCookie()
				.map((c) => c.split(";")[0])
				.join("; ");
			const signedUp = await json(signup);
			assert.ok(signedUp.user && typeof signedUp.user === "object" && "id" in signedUp.user);
			const principalId = str(signedUp.user.id);
			const resourceClient = await auth.api.adminCreateOAuthClient({
				headers: new Headers({ Cookie: cookie }),
				body: {
					redirect_uris: ["https://resource.example/callback"],
					token_endpoint_auth_method: "client_secret_post",
					scope: "mcp:read",
				},
			});
			const resourceCredentials = {
				client_id: str(resourceClient.client_id),
				client_secret: str(resourceClient.client_secret),
			};
			const subjects: string[] = [];
			const clients = [];
			for (const confidential of [false, true]) {
				const redirectUri = `https://${confidential ? "confidential" : "public"}.example/callback`;
				const client = await auth.api.adminCreateOAuthClient({
					headers: new Headers({ Cookie: cookie }),
					body: {
						redirect_uris: [redirectUri],
						token_endpoint_auth_method: confidential ? "client_secret_post" : "none",
						grant_types: ["authorization_code", "refresh_token"],
						scope: "openid offline_access mcp:read",
						subject_type: "pairwise",
					},
				});
				const clientId = str(client.client_id),
					verifier = "a".repeat(64);
				const query = new URLSearchParams({
					client_id: clientId,
					redirect_uri: redirectUri,
					response_type: "code",
					scope: "openid offline_access mcp:read",
					resource,
					state: crypto.randomUUID(),
					nonce: crypto.randomUUID(),
					code_challenge: createHash("sha256").update(verifier).digest("base64url"),
					code_challenge_method: "S256",
				});
				const authorize = await request(`/oauth2/authorize?${query}`, undefined, cookie);
				assert.equal(authorize.status, 302, await authorize.clone().text());
				const consentLocation = new URL(str(authorize.headers.get("location")), origin);
				const consent = await json(
					await request(
						"/oauth2/consent",
						{ accept: true, oauth_query: consentLocation.search.slice(1) },
						cookie,
					),
				);
				const redirect = new URL(str(consent.url));
				assert.equal(redirect.searchParams.get("state"), query.get("state"));
				const tokens = await json(
					await request(
						"/oauth2/token",
						{
							grant_type: "authorization_code",
							client_id: clientId,
							...(confidential ? { client_secret: str(client.client_secret) } : {}),
							code: str(redirect.searchParams.get("code")),
							redirect_uri: redirectUri,
							code_verifier: verifier,
							resource,
						},
						undefined,
						true,
					),
				);
				const accessToken = str(tokens.access_token);
				if (disableJwtPlugin || forceOpaqueAccessTokens) {
					assert.equal(accessToken.split(".").length, 1);
					assert.equal(
						typeof tokens.id_token,
						!disableJwtPlugin || confidential ? "string" : "undefined",
					);
				} else {
					assert.equal(decodeJwt(accessToken).sub, principalId);
					assert.notEqual(decodeJwt(str(tokens.id_token)).sub, principalId);
				}
				const userinfo = await json(
					await fetch(`${issuer}/oauth2/userinfo`, {
						headers: { Authorization: `Bearer ${accessToken}` },
					}),
				);
				assert.notEqual(userinfo.sub, principalId);
				assert.equal(JSON.stringify(userinfo).includes(principalId), false);
				subjects.push(str(userinfo.sub));
				if (forceOpaqueAccessTokens) {
					const discovery = await json(await request("/.well-known/openid-configuration"));
					assert.equal(discovery.issuer, issuer);
					const keys = await (await fetch(str(discovery.jwks_uri))).json();
					const verified = await jwtVerify(str(tokens.id_token), createLocalJWKSet(keys), {
						issuer,
						audience: clientId,
					});
					assert.equal(verified.payload.sub, userinfo.sub);
					assert.equal(verified.payload.nonce, query.get("nonce"));
					assert.equal(JSON.stringify(verified.payload).includes(principalId), false);
					assert.equal(
						verified.payload.at_hash,
						createHash("sha256").update(accessToken).digest().subarray(0, 16).toString("base64url"),
					);
					const introspected = await json(
						await request(
							"/oauth2/introspect",
							{ ...resourceCredentials, token: accessToken },
							undefined,
							true,
						),
					);
					assert.equal(introspected.active, true);
					assert.equal(introspected.sub, userinfo.sub);
					assert.equal(
						introspected.sid,
						undefined,
						"Pairwise introspection must not expose a cross-client session key",
					);
					assert.equal(JSON.stringify(introspected).includes(principalId), false);
					const protect = (audience = resource, requiredScopes = ["mcp:read"]) =>
						createMcpProtectedRequestHandler(
							{
								issuer,
								audience,
								requiredScopes,
								remoteVerify: {
									introspectUrl: `${issuer}/oauth2/introspect`,
									clientId: resourceCredentials.client_id,
									clientSecret: resourceCredentials.client_secret,
									force: true,
								},
							},
							async () => Response.json({ accepted: true }),
						);
					const protectedRequest = (token: string) =>
						new Request(resource, {
							headers: { Authorization: `Bearer ${token}`, Cookie: cookie },
						});
					const statementsBeforeVerification = protocolStatements;
					assert.equal((await protect()(protectedRequest(accessToken))).status, 200);
					protocolReadSamples.push(protocolStatements - statementsBeforeVerification);
					assert.equal(
						(await protect(`${origin}/other`)(protectedRequest(accessToken))).status,
						401,
					);
					assert.equal(
						(await protect(resource, ["mcp:write"])(protectedRequest(accessToken))).status,
						403,
					);
					assert.equal((await protect()(protectedRequest("invalid-bearer"))).status, 401);
					const credentials = {
						client_id: clientId,
						...(confidential ? { client_secret: str(client.client_secret) } : {}),
					};
					const refresh = str(tokens.refresh_token);
					if (confidential) {
						const refreshClaims = await json(
							await request(
								"/oauth2/introspect",
								{ ...credentials, token: refresh, token_type_hint: "refresh_token" },
								undefined,
								true,
							),
						);
						assert.equal(refreshClaims.active, true);
						assert.equal(refreshClaims.sub, userinfo.sub);
						assert.equal(refreshClaims.sid, undefined);
						assert.equal(JSON.stringify(refreshClaims).includes(principalId), false);
					}
					const wrongClient = await json(
						await request(
							"/oauth2/token",
							{
								...resourceCredentials,
								grant_type: "refresh_token",
								refresh_token: refresh,
								resource,
							},
							undefined,
							true,
						),
						400,
					);
					assert.equal(wrongClient.error, "invalid_grant");
					const widened = await json(
						await request(
							"/oauth2/token",
							{
								...credentials,
								grant_type: "refresh_token",
								refresh_token: refresh,
								resource,
								scope: "openid mcp:read mcp:write",
							},
							undefined,
							true,
						),
						400,
					);
					assert.equal(widened.error, "invalid_scope");
					const rotated = await json(
						await request(
							"/oauth2/token",
							{
								...credentials,
								grant_type: "refresh_token",
								refresh_token: refresh,
								resource,
								scope: "openid mcp:read",
							},
							undefined,
							true,
						),
					);
					assert.equal(str(rotated.access_token).split(".").length, 1);
					assert.notEqual(rotated.refresh_token, refresh);
					assert.equal(decodeJwt(str(rotated.id_token)).sub, userinfo.sub);
					assert.equal((await protect()(protectedRequest(str(rotated.access_token)))).status, 200);
					const replay = await json(
						await request(
							"/oauth2/token",
							{ ...credentials, grant_type: "refresh_token", refresh_token: refresh, resource },
							undefined,
							true,
						),
						400,
					);
					assert.equal(replay.error, "invalid_grant");
					assert.equal((await protect()(protectedRequest(str(rotated.access_token)))).status, 401);
				}
				clients.push({
					confidential,
					...(forceOpaqueAccessTokens
						? {
								signedOidcAndHashVerified: true,
								authenticatedIntrospectionPrivate: true,
								mcpAudienceAndScopeChecked: true,
								invalidBearerCannotUseCookie: true,
								refreshRotationAndReplayRevocation: true,
								wrongClientAndScopeWideningRejected: true,
							}
						: {}),
					rawPrincipalInAccessToken: !disableJwtPlugin && !forceOpaqueAccessTokens,
					idTokenIssued: typeof tokens.id_token === "string",
					pairwiseUserInfo: true,
				});
			}
			assert.notEqual(subjects[0], subjects[1]);
			if (forceOpaqueAccessTokens) {
				const metadataResponse = await json(
					await fetch(`${origin}/.well-known/oauth-protected-resource/mcp`),
				);
				assert.equal(metadataResponse.resource, resource);
				assert.deepEqual(metadataResponse.authorization_servers, [issuer]);
				assert.deepEqual(metadataResponse.scopes_supported, ["mcp:read"]);
				const machineIds: string[] = [];
				for (let installation = 0; installation < 2; installation++) {
					const machineClient = await auth.api.adminCreateOAuthClient({
						headers: new Headers({ Cookie: cookie }),
						body: {
							token_endpoint_auth_method: "client_secret_post",
							grant_types: ["client_credentials"],
							client_credentials_scopes: ["mcp:read"],
						},
					});
					const machineCredentials = {
						client_id: str(machineClient.client_id),
						client_secret: str(machineClient.client_secret),
					};
					const machine = await json(
						await request(
							"/oauth2/token",
							{ ...machineCredentials, grant_type: "client_credentials", resource },
							undefined,
							true,
						),
					);
					assert.equal(str(machine.access_token).split(".").length, 1);
					assert.equal(machine.id_token, undefined);
					assert.equal(machine.refresh_token, undefined);
					const inspected = await json(
						await request(
							"/oauth2/introspect",
							{ ...machineCredentials, token: str(machine.access_token) },
							undefined,
							true,
						),
					);
					assert.equal(inspected.active, true);
					assert.equal(inspected.client_id, machineCredentials.client_id);
					assert.equal(JSON.stringify(inspected).includes(principalId), false);
					machineIds.push(str(inspected.client_id));
					const revocation = await request(
						"/oauth2/revoke",
						{
							...machineCredentials,
							token: str(machine.access_token),
							token_type_hint: "access_token",
						},
						undefined,
						true,
					);
					assert.equal(revocation.status, 200);
					assert.equal(await revocation.json(), null);
					const revoked = await json(
						await request(
							"/oauth2/introspect",
							{ ...machineCredentials, token: str(machine.access_token) },
							undefined,
							true,
						),
					);
					assert.equal(revoked.active, false);
				}
				assert.notEqual(machineIds[0], machineIds[1]);
			}
			evidence.push({
				disableJwtPlugin,
				forceOpaqueAccessTokens,
				clients,
				...(forceOpaqueAccessTokens
					? {
							protocolReadSamples,
							protectedResourceDiscovery: true,
							distinctMachineClientsAndRevocation: true,
						}
					: {}),
			});
		} finally {
			await new Promise<void>((resolve, reject) =>
				server.close((error) => (error ? reject(error) : resolve())),
			);
			if (created.length) await pool.query(`drop table ${created.map(quote).join(",")}`);
		}
	}
	const repository = new URL("../../../", import.meta.url);
	const sourceDigests: Record<string, string> = {};
	for (const path of [
		"services/main/scripts/check-oauth-privacy.ts",
		"services/main/src/services/auth/oauth-resource-verification.test.ts",
		"services/main/package.json",
		"package.json",
		"yarn.lock",
		".yarn/patches/@better-auth-oauth-provider-npm-1.7.3-8fc63cd677.patch",
		".yarn/patches/@better-auth-core-npm-1.7.3-79aeed22f4.patch",
	])
		sourceDigests[path] = createHash("sha256")
			.update(await readFile(new URL(path, repository)))
			.digest("hex");
	console.info(
		JSON.stringify({
			baseCommit: execFileSync("git", ["rev-parse", "HEAD"], {
				cwd: fileURLToPath(repository),
				encoding: "utf8",
			}).trim(),
			sourceDigests,
			runtime: {
				node: process.versions.node,
				bun: process.versions.bun,
				platform: process.platform,
				architecture: process.arch,
			},
			postgres: (await pool.query("select version()")).rows[0],
			evidence,
		}),
	);
} finally {
	await pool.end();
}
