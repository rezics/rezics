import { createHash } from "node:crypto";

import { and, eq, gt, isNull, or } from "drizzle-orm";
import Elysia from "elysia";
import type { User } from "better-auth";

import { Authorization } from "../authorization";
import { database } from "../database";
import {
	apiToken,
	profile as profileTable,
	unit,
	unitLocalization,
	users,
} from "../database/schema";
import { auth } from "./index";
import { ApiTokenScopeRequired, AuthenticationRequired, EmailVerificationRequired } from "./errors";
import { ensureProfile, type SessionProfile } from "./profile";

type SessionContext = {
	user: User;
	session: unknown;
	profile: SessionProfile;
	authorization: Authorization<string>;
	tokenScopes: string[] | undefined;
};

async function resolveSession(headers: Headers): Promise<SessionContext | undefined> {
	const session = await auth.api.getSession({ headers });
	if (session) {
		const profile = await ensureProfile(session.user);
		return {
			user: session.user,
			session: session.session,
			profile,
			authorization: new Authorization(profile.unitId),
			tokenScopes: undefined,
		};
	}
	const authorization = headers.get("Authorization");
	if (!authorization?.startsWith("Bearer rz_")) return undefined;
	const raw = authorization.slice("Bearer ".length);
	const hash = createHash("sha256").update(raw).digest("hex");
	const now = new Date();
	const [token] = await database
		.select({
			tokenId: apiToken.id,
			scopes: apiToken.scopes,
			unitId: profileTable.id,
			slug: unit.slug,
			profileName: unitLocalization.title,
			authUserId: users.id,
			authName: users.name,
			email: users.email,
			emailVerified: users.emailVerified,
			image: users.image,
			createdAt: users.createdAt,
			updatedAt: users.updatedAt,
		})
		.from(apiToken)
		.innerJoin(profileTable, eq(profileTable.id, apiToken.profileId))
		.innerJoin(unit, eq(unit.id, profileTable.id))
		.innerJoin(users, eq(users.id, profileTable.authUserId))
		.leftJoin(
			unitLocalization,
			and(eq(unitLocalization.unitId, profileTable.id), eq(unitLocalization.isDefault, true)),
		)
		.where(
			and(
				eq(apiToken.tokenHash, hash),
				isNull(apiToken.revokedAt),
				or(isNull(apiToken.expiresAt), gt(apiToken.expiresAt, now)),
			),
		)
		.limit(1);
	if (!token?.slug || !token.scopes.includes("read")) return undefined;
	await database.update(apiToken).set({ lastUsedAt: now }).where(eq(apiToken.id, token.tokenId));
	const profile = {
		unitId: token.unitId,
		slug: token.slug,
		name: token.profileName,
		email: token.email,
	};
	return {
		user: {
			id: token.authUserId,
			name: token.authName,
			email: token.email,
			emailVerified: token.emailVerified,
			image: token.image,
			createdAt: token.createdAt,
			updatedAt: token.updatedAt,
		},
		session: undefined,
		profile,
		authorization: new Authorization(profile.unitId),
		tokenScopes: token.scopes,
	} satisfies SessionContext;
}

export async function resolveIdentity(headers: Headers) {
	const context = await resolveSession(headers);
	return context
		? { profile: context.profile, authorization: context.authorization }
		: { profile: undefined, authorization: new Authorization(undefined) };
}

async function requireSession(headers: Headers, requiredScope?: string): Promise<SessionContext> {
	const context = await resolveSession(headers);
	if (!context) throw new AuthenticationRequired();
	if (requiredScope && context.tokenScopes && !context.tokenScopes.includes(requiredScope))
		throw new ApiTokenScopeRequired(requiredScope);
	return context;
}

function writeScope(url: string) {
	const path = new URL(url).pathname;
	if (path.startsWith("/api/api-tokens") || path.startsWith("/api/users")) {
		if (path.endsWith("/follow")) return "interaction:write";
		return "profile:write";
	}
	if (path.startsWith("/api/notifications")) return "profile:write";
	if (path.startsWith("/api/messages")) return "interaction:write";
	if (path.startsWith("/api/recommendations")) return "interaction:write";
	if (
		path.startsWith("/api/reactions") ||
		path.startsWith("/api/scores") ||
		path.startsWith("/api/progress") ||
		path.includes("/votes") ||
		path.endsWith("/follow") ||
		path.endsWith("/membership") ||
		path.includes("/favorites")
	)
		return "interaction:write";
	if (path.startsWith("/api/realms")) return "realm:manage";
	return "content:write";
}

export default new Elysia({ name: "session-context" }).macro({
	auth: {
		async resolve({ request: { headers } }) {
			return requireSession(headers, "read");
		},
	},
	write: {
		async resolve({ request: { headers, url } }) {
			const context = await requireSession(headers, writeScope(url));
			if (!context.user.emailVerified) throw new EmailVerificationRequired();
			await context.authorization.account.ensureCanWrite();
			return context;
		},
	},
	contribute: {
		async resolve({ request: { headers, url } }) {
			const context = await requireSession(headers, writeScope(url));
			if (!context.user.emailVerified) throw new EmailVerificationRequired();
			await context.authorization.account.ensureCanContribute();
			return context;
		},
	},
});
