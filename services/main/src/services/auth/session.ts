import { eq } from "drizzle-orm";
import Elysia, { type DocumentDecoration } from "elysia";
import type { User } from "better-auth";

import { setAuditCredentialContext } from "../audit";
import { Authorization } from "../authorization";
import { database } from "../database";
import { users } from "../database/schema";
import type { ApiPermission } from "./api-permissions";
import type { ApiQuotaOperationId } from "./api-quota/operation";
import { ensureAccountAuthenticationAllowed } from "./account-state";
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
import { enforceApiQuota, type ApiQuotaLease } from "./api-quota/limit-store";
import {
	apiRouteOperationId,
	resolveApiQuotaOperation,
	resolveApiQuotaOperationById,
} from "./api-quota/operation";
import {
	getApiTokenQuotaOverride,
	resolveApiAccountQuotaPolicy,
	resolveApiTokenQuotaPolicy,
	type ApiTokenQuotaOverrideSummary,
	type ResolvedApiAccountQuotaPolicy,
	type ResolvedApiTokenQuotaPolicy,
} from "./api-quota/policy-service";

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
	credential: {
		kind: "apiKey";
		id: string;
		permissions: readonly ApiPermission[];
		operationId: string;
		accountQuotaPolicy: ResolvedApiAccountQuotaPolicy;
		tokenQuotaPolicy: ResolvedApiTokenQuotaPolicy;
		tokenQuotaOverride: ApiTokenQuotaOverrideSummary | undefined;
		quotaLease: ApiQuotaLease;
	};
	session: undefined;
};

export type AuthenticatedIdentity = BaseIdentity & {
	credential: SessionIdentity["credential"] | ApiKeyIdentity["credential"];
	session: SessionIdentity["session"] | undefined;
};

export type ResolvedIdentity =
	| {
			profile: SessionProfile;
			authorization: Authorization<string>;
	  }
	| {
			profile: undefined;
			authorization: Authorization<undefined>;
	  };

export type AccessPolicy =
	| { credential: "session-only" | "fresh-session-only" | "api-key-only" }
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
	| "fresh-session-only"
	| "api-key-only";

const requestQuotaLeases = new WeakMap<Request, ApiQuotaLease[]>();

type OpenApiSecurity = NonNullable<DocumentDecoration["security"]>;

const ApiTokenOrSessionSecurity: OpenApiSecurity = [{ ApiToken: [] }, { SessionCookie: [] }];
const ApiTokenOnlySecurity: OpenApiSecurity = [{ ApiToken: [] }];
const SessionOnlySecurity: OpenApiSecurity = [{ SessionCookie: [] }];

async function releaseRequestLimitLease(request: Request) {
	const leases = requestQuotaLeases.get(request);
	if (!leases) return;
	requestQuotaLeases.delete(request);
	await Promise.all(leases.map((lease) => lease.release()));
}

/** Attaches an admitted quota lease to the response lifecycle that owns it. @internal */
export function trackRequestLimitLease(request: Request, lease: ApiQuotaLease) {
	const leases = requestQuotaLeases.get(request);
	if (leases) leases.push(lease);
	else requestQuotaLeases.set(request, [lease]);
}

function accessPolicy(requirement: AccessRequirement): AccessPolicy {
	if (
		requirement === "session-only" ||
		requirement === "fresh-session-only" ||
		requirement === "api-key-only"
	)
		return { credential: requirement };
	if (isApiPermission(requirement)) return { permission: requirement };
	const separator = requirement.indexOf(":");
	const account = requirement.slice(0, separator);
	const permission = requirement.slice(separator + 1);
	if ((account !== "write" && account !== "contribute") || !isApiPermission(permission))
		throw new Error(`Invalid access requirement: ${requirement}`);
	return { permission, account };
}

function accessSecurity(requirement: AccessRequirement): OpenApiSecurity {
	if (requirement === "api-key-only") return ApiTokenOnlySecurity;
	if (requirement === "session-only" || requirement === "fresh-session-only")
		return SessionOnlySecurity;
	return ApiTokenOrSessionSecurity;
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
	await ensureAccountAuthenticationAllowed(session.user.id);
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
	requiredPermission: ApiPermission | undefined,
	operationId: string,
	operation = resolveApiQuotaOperation(operationId),
	accountAccess?: "authenticated" | "write" | "contribute",
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
	if (requiredPermission && !permissions.includes(requiredPermission))
		throw new ApiTokenPermissionRequired(requiredPermission);
	const [user] = await database
		.select()
		.from(users)
		.where(eq(users.id, verified.key.referenceId))
		.limit(1);
	if (!user) throw new AuthenticationRequired();
	await ensureAccountAuthenticationAllowed(user.id);
	const profile = await ensureProfile(user);
	const authorization = new Authorization(profile.unitId);
	if (accountAccess === "write" || accountAccess === "contribute") {
		if (!user.emailVerified) throw new EmailVerificationRequired();
		if (accountAccess === "write") await authorization.account.ensureCanWrite();
		else await authorization.account.ensureCanContribute();
	}
	const [accountQuotaPolicy, tokenQuotaPolicy, tokenQuotaRecord] = await Promise.all([
		resolveApiAccountQuotaPolicy(user.id),
		resolveApiTokenQuotaPolicy(verified.key.id),
		getApiTokenQuotaOverride(verified.key.id),
	]);
	const quotaLease = await enforceApiQuota({
		accountUserId: user.id,
		tokenId: verified.key.id,
		operation,
		accountPolicy: accountQuotaPolicy,
		tokenPolicy: tokenQuotaPolicy,
		tokenSafeguard: tokenQuotaRecord?.configurationOverride,
	});

	try {
		return {
			user,
			session: undefined,
			profile,
			authorization,
			credential: {
				kind: "apiKey",
				id: verified.key.id,
				permissions,
				operationId,
				accountQuotaPolicy,
				tokenQuotaPolicy,
				tokenQuotaOverride: tokenQuotaRecord,
				quotaLease,
			},
		};
	} catch (error) {
		await quotaLease.release();
		throw error;
	}
}

async function requireAccess(
	headers: Headers,
	policy: AccessPolicy,
	operationId: string,
): Promise<AuthenticatedIdentity> {
	const token = bearerToken(headers);
	if (!("permission" in policy)) {
		if (policy.credential === "api-key-only") {
			if (!token) throw new AuthenticationRequired();
			return resolveApiKey(token, undefined, operationId);
		}
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
		? await resolveApiKey(
				token,
				policy.permission,
				operationId,
				resolveApiQuotaOperation(operationId),
				policy.account,
			)
		: await resolveInteractiveSession(headers);
	if (!identity) throw new AuthenticationRequired();
	if (
		identity.credential.kind === "session" &&
		(policy.account === "write" || policy.account === "contribute")
	) {
		if (!identity.user.emailVerified) throw new EmailVerificationRequired();
		if (policy.account === "write") await identity.authorization.account.ensureCanWrite();
		else await identity.authorization.account.ensureCanContribute();
	}
	return identity;
}

export async function resolveIdentity(
	request: Request,
	permission?: ApiPermission,
	quotaOperationId?: ApiQuotaOperationId,
): Promise<ResolvedIdentity> {
	const token = bearerToken(request.headers);
	let identity: AuthenticatedIdentity | undefined;
	if (token) {
		if (!permission) throw new ApiTokenPermissionRequired("an explicit route permission");
		identity = await resolveApiKey(
			token,
			permission,
			quotaOperationId ?? "unscopedPublicRoute",
			quotaOperationId
				? resolveApiQuotaOperationById(quotaOperationId)
				: resolveApiQuotaOperation("unscopedPublicRoute"),
		);
	} else {
		identity = await resolveInteractiveSession(request.headers);
	}
	if (!identity) return { profile: undefined, authorization: new Authorization(undefined) };
	if (identity.credential.kind === "apiKey")
		trackRequestLimitLease(request, identity.credential.quotaLease);
	return { profile: identity.profile, authorization: identity.authorization };
}

export default new Elysia({ name: "session-context" })
	.onAfterResponse({ as: "scoped" }, ({ request }) => releaseRequestLimitLease(request))
	.macro({
		access: (requirement: AccessRequirement) => ({
			detail: { security: accessSecurity(requirement) },
			async resolve({ request, route }) {
				const identity = await requireAccess(
					request.headers,
					accessPolicy(requirement),
					apiRouteOperationId(request.method, route),
				);
				if (identity.credential.kind === "apiKey")
					trackRequestLimitLease(request, identity.credential.quotaLease);
				setAuditCredentialContext({
					credentialKind: identity.credential.kind === "apiKey" ? "api_token" : "session",
					credentialId:
						identity.credential.kind === "apiKey"
							? identity.credential.id
							: identity.credential.session.id,
				});
				return identity;
			},
		}),
	});
