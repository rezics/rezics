import { eq } from "drizzle-orm";
import { z } from "zod";
import { database } from "../database";
import { users } from "@rezics/schema/postgres/identity/auth";
import { auth } from "./index";
import { ensureAccountAuthenticationAllowed } from "./account-state";
import { ApiPermissionValues, fromApiKeyPermissions, type ApiPermission } from "@rezics/schema/contracts/native/api-permissions";
import { captureSessionCredentialProof, captureApiKeyCredentialProof } from "./credential-authority";
import { AuthenticationRequired, ApiTokenPermissionRequired, ApiTokenRateLimitExceeded } from "./errors";

/** Recognize an explicit personal bearer; malformed credentials never fall through to cookies. @internal */
export function personalApiKeyBearer(headers: Headers): string | undefined {
	const value = headers.get("Authorization");
	if (value === null) return undefined;
	if (value.length > 1024) throw new AuthenticationRequired();
	const token = /^Bearer (rz_api_[A-Za-z0-9_-]+)$/.exec(value)?.[1];
	if (!token) throw new AuthenticationRequired();
	return token;
}
/** Authenticate the private principal without creating or selecting a public Entity. @internal */
export async function verifyInteractivePrincipal(headers: Headers) {
	const record = await auth.api.getSession({ headers });
	if (!record) return undefined;
	if (record.user.id !== record.session.userId) throw new AuthenticationRequired();
	await ensureAccountAuthenticationAllowed(record.user.id);
	return { record, proof: captureSessionCredentialProof(record.session) };
}
/** Authenticate a personal key once, including provider rate admission and typed API scopes. @internal */
export async function verifyPersonalApiKey(key: string, permission?: ApiPermission) {
	const verified = await auth.api.verifyApiKey({ body: { key } });
	if (!verified.valid || !verified.key) {
		if (verified.error?.code === "RATE_LIMITED") {
			const error: unknown = verified.error;
			const details = error && typeof error === "object" && "details" in error ? error.details : null;
			const retry = details && typeof details === "object" && "tryAgainIn" in details ? details.tryAgainIn : null;
			throw new ApiTokenRateLimitExceeded(typeof retry === "number" && Number.isFinite(retry) ? Math.max(1, Math.ceil(retry / 1000)) : 60);
		}
		throw new AuthenticationRequired();
	}
	let permissions: ApiPermission[];
	try {
		const encoded = JSON.stringify(verified.key.permissions ?? {});
		if (Buffer.byteLength(encoded, "utf8") > 8192) throw new AuthenticationRequired();
		const parsed = z.record(z.string().max(64), z.array(z.string().max(64)).max(ApiPermissionValues.length)).parse(verified.key.permissions ?? {});
		if (Object.keys(parsed).length > ApiPermissionValues.length) throw new AuthenticationRequired();
		permissions = fromApiKeyPermissions(parsed);
	} catch { throw new AuthenticationRequired(); }
	if (permission && !permissions.includes(permission)) throw new ApiTokenPermissionRequired(permission);
	const [user] = await database.select().from(users).where(eq(users.id, verified.key.referenceId)).limit(1);
	if (!user || user.principalKind !== "human") throw new AuthenticationRequired();
	await ensureAccountAuthenticationAllowed(user.id);
	return { user, key: verified.key, permissions, proof: await captureApiKeyCredentialProof(verified.key.id, user.id, key) };
}
