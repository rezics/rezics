import { eq } from "drizzle-orm";
import Elysia from "elysia";
import type { User } from "better-auth";

import { Authorization } from "../authorization";
import { database } from "../database";
import { users } from "../database/schema";
import type { ApiPermission } from "./api-permissions";
import { fromApiKeyPermissions, isApiPermission } from "./api-permissions";
import {
	ApiTokenPermissionRequired,
	ApiTokenRateLimitExceeded,
	AuthenticationRequired,
	EmailVerificationRequired,
	FreshSessionRequired,
	InteractiveSessionRequired,
} from "./errors";
import { auth, CredentialControlFreshAgeSeconds } from "./index";
import { ensureProfile, type SessionProfile } from "./profile";

type BaseIdentity = {
	user: User;
	profile: SessionProfile;
	authorization: Authorization<string>;
};

export type SessionIdentity = BaseIdentity & {
	credential: {
		kind: "session";
		session: NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>["session"];
	};
	session: NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>["session"];
};

export type ApiKeyIdentity = BaseIdentity & {
	credential: { kind: "apiKey"; id: string; permissions: readonly ApiPermission[] };
	session: undefined;
};

export type AuthenticatedIdentity = BaseIdentity & {
	credential: SessionIdentity["credential"] | ApiKeyIdentity["credential"];
	session: SessionIdentity["session"] | undefined;
};

export type AccessPolicy =
	| { credential: "session-only" | "fresh-session-only" }
	| {
			credential?: "session-or-api-key";
			permission: ApiPermission;
			account?: "authenticated" | "write" | "contribute";
	  };

export type AccessRequirement =
	| ApiPermission
	| `write:${ApiPermission}`
	| `contribute:${ApiPermission}`
	| "session-only"
	| "fresh-session-only";

function accessPolicy(requirement: AccessRequirement): AccessPolicy {
	if (requirement === "session-only" || requirement === "fresh-session-only")
		return { credential: requirement };
	if (isApiPermission(requirement)) return { permission: requirement };
	const separator = requirement.indexOf(":");
	const account = requirement.slice(0, separator);
	const permission = requirement.slice(separator + 1);
	if ((account !== "write" && account !== "contribute") || !isApiPermission(permission))
		throw new Error(`Invalid access requirement: ${requirement}`);
	return { permission, account };
}

function bearerToken(headers: Headers) {
	const authorization = headers.get("Authorization");
	if (authorization === null) return undefined;
	const match = /^Bearer (rz_api_[A-Za-z0-9_-]+)$/.exec(authorization);
	if (!match?.[1]) throw new AuthenticationRequired();
	return match[1];
}

async function resolveInteractiveSession(headers: Headers): Promise<SessionIdentity | undefined> {
	const session = await auth.api.getSession({ headers });
	if (!session) return undefined;
	const profile = await ensureProfile(session.user);
	return {
		user: session.user,
		session: session.session,
		profile,
		authorization: new Authorization(profile.unitId),
		credential: { kind: "session", session: session.session },
	};
}

function rateLimitRetryAfter(error: unknown) {
	if (typeof error !== "object" || error === null || !("details" in error)) return 60;
	const { details } = error;
	if (typeof details !== "object" || details === null || !("tryAgainIn" in details)) return 60;
	const milliseconds = details.tryAgainIn;
	return typeof milliseconds === "number" && Number.isFinite(milliseconds)
		? Math.max(1, Math.ceil(milliseconds / 1_000))
		: 60;
}

async function resolveApiKey(
	key: string,
	requiredPermission: ApiPermission,
): Promise<ApiKeyIdentity> {
	const verified = await auth.api.verifyApiKey({
		body: { key },
	});
	if (!verified.valid || !verified.key) {
		if (verified.error?.code === "RATE_LIMITED")
			throw new ApiTokenRateLimitExceeded(rateLimitRetryAfter(verified.error));
		throw new AuthenticationRequired();
	}
	const permissions = fromApiKeyPermissions(verified.key.permissions);
	if (!permissions.includes(requiredPermission))
		throw new ApiTokenPermissionRequired(requiredPermission);

	const [user] = await database
		.select()
		.from(users)
		.where(eq(users.id, verified.key.referenceId))
		.limit(1);
	if (!user) throw new AuthenticationRequired();
	const profile = await ensureProfile(user);
	return {
		user,
		session: undefined,
		profile,
		authorization: new Authorization(profile.unitId),
		credential: {
			kind: "apiKey",
			id: verified.key.id,
			permissions,
		},
	};
}

async function requireAccess(
	headers: Headers,
	policy: AccessPolicy,
): Promise<AuthenticatedIdentity> {
	const token = bearerToken(headers);
	if (!("permission" in policy)) {
		if (token) throw new InteractiveSessionRequired();
		const identity = await resolveInteractiveSession(headers);
		if (!identity) throw new InteractiveSessionRequired();
		if (
			policy.credential === "fresh-session-only" &&
			Date.now() - new Date(identity.session.createdAt).getTime() >=
				CredentialControlFreshAgeSeconds * 1_000
		)
			throw new FreshSessionRequired();
		return identity;
	}

	const identity = token
		? await resolveApiKey(token, policy.permission)
		: await resolveInteractiveSession(headers);
	if (!identity) throw new AuthenticationRequired();
	if (policy.account === "write" || policy.account === "contribute") {
		if (!identity.user.emailVerified) throw new EmailVerificationRequired();
		if (policy.account === "write") await identity.authorization.account.ensureCanWrite();
		else await identity.authorization.account.ensureCanContribute();
	}
	return identity;
}

export async function resolveIdentity(headers: Headers, permission?: ApiPermission) {
	const token = bearerToken(headers);
	let identity: AuthenticatedIdentity | undefined;
	if (token) {
		if (!permission) throw new ApiTokenPermissionRequired("an explicit route permission");
		identity = await resolveApiKey(token, permission);
	} else {
		identity = await resolveInteractiveSession(headers);
	}
	return identity
		? { profile: identity.profile, authorization: identity.authorization }
		: { profile: undefined, authorization: new Authorization(undefined) };
}

export default new Elysia({ name: "session-context" }).macro({
	access: (requirement: AccessRequirement) => ({
		async resolve({ request: { headers } }: { request: Request }) {
			return requireAccess(headers, accessPolicy(requirement));
		},
	}),
});
