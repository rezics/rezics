import Elysia from "elysia";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.hoisted(() => vi.fn());
const verifyApiKey = vi.hoisted(() => vi.fn());
const selectUser = vi.hoisted(() => vi.fn());
const ensureAccountAuthenticationAllowed = vi.hoisted(() => vi.fn());
const ensureProfile = vi.hoisted(() => vi.fn());
const ensureCanWrite = vi.hoisted(() => vi.fn());
const ensureCanContribute = vi.hoisted(() => vi.fn());
const enforceApiQuota = vi.hoisted(() => vi.fn());
const resolveApiAccountQuotaPolicy = vi.hoisted(() => vi.fn());
const resolveApiTokenQuotaPolicy = vi.hoisted(() => vi.fn());
const getApiTokenQuotaOverride = vi.hoisted(() => vi.fn());
const setAuditCredentialContext = vi.hoisted(() => vi.fn());

vi.mock("./index", () => ({
	auth: { api: { getSession, verifyApiKey } },
	CredentialControlFreshAgeSeconds: 600,
}));
vi.mock("../database", () => ({
	database: {
		select: vi.fn(() => ({
			from: vi.fn(() => ({
				where: vi.fn(() => ({ limit: selectUser })),
			})),
		})),
	},
}));
vi.mock("./account-state", () => ({ ensureAccountAuthenticationAllowed }));
vi.mock("./profile", () => ({ ensureProfile }));
vi.mock("../authorization", () => ({
	Authorization: class {
		readonly account = { ensureCanWrite, ensureCanContribute };
		constructor(readonly profileId: string | undefined) {}
	},
}));
vi.mock("./api-quota/limit-store", () => ({ enforceApiQuota }));
vi.mock("./api-quota/policy-service", () => ({
	resolveApiAccountQuotaPolicy,
	resolveApiTokenQuotaPolicy,
	getApiTokenQuotaOverride,
}));
vi.mock("../audit", () => ({ setAuditCredentialContext }));
vi.mock("./request-interface-locale", () => ({ resolveRequestUiLocale: () => "en" }));

import session, { resolveIdentity } from "./session";

const user = {
	id: "019f9ea5-5188-7f3a-8819-380ec28c0b11",
	name: "Reader",
	email: "reader@example.com",
	emailVerified: true,
	image: null,
	createdAt: new Date("2026-08-30T00:00:00.000Z"),
	updatedAt: new Date("2026-08-30T00:00:00.000Z"),
};
const sessionRecord = {
	id: "019f9ea5-5188-7f3a-8819-380ec28c0b12",
	userId: user.id,
	token: "session-token",
	createdAt: new Date(),
	updatedAt: new Date(),
	expiresAt: new Date(Date.now() + 60_000),
	ipAddress: null,
	userAgent: null,
};

async function afterResponse(): Promise<void> {
	await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
	getSession.mockReset();
	verifyApiKey.mockReset();
	selectUser.mockReset();
	ensureAccountAuthenticationAllowed.mockReset();
	ensureAccountAuthenticationAllowed.mockResolvedValue(undefined);
	ensureProfile.mockReset();
	ensureProfile.mockResolvedValue({ unitId: "019f9ea5-5188-7f3a-8819-380ec28c0b13" });
	ensureCanWrite.mockReset();
	ensureCanWrite.mockResolvedValue(undefined);
	ensureCanContribute.mockReset();
	ensureCanContribute.mockResolvedValue(undefined);
	enforceApiQuota.mockReset();
	resolveApiAccountQuotaPolicy.mockReset();
	resolveApiAccountQuotaPolicy.mockResolvedValue({ configuration: {} });
	resolveApiTokenQuotaPolicy.mockReset();
	resolveApiTokenQuotaPolicy.mockResolvedValue({ configuration: {} });
	getApiTokenQuotaOverride.mockReset();
	getApiTokenQuotaOverride.mockResolvedValue(undefined);
	setAuditCredentialContext.mockReset();
});

describe("session access macro", () => {
	it("resolves an anonymous optional identity without creating audit credentials", async () => {
		getSession.mockResolvedValue(null);

		const identity = await resolveIdentity(new Request("http://localhost/public"));

		expect(identity.profile).toBeUndefined();
		expect(getSession).toHaveBeenCalledOnce();
		expect(setAuditCredentialContext).not.toHaveBeenCalled();
	});

	it("admits an interactive session and records its audit credential", async () => {
		getSession.mockResolvedValue({ user, session: sessionRecord });
		const app = new Elysia().use(session).get(
			"/session",
			{
				access: "session-only",
			},
			({ credential }) => credential.kind,
		);

		const response = await app.handle(new Request("http://localhost/session"));

		expect(response.status).toBe(200);
		expect(await response.text()).toBe("session");
		expect(ensureAccountAuthenticationAllowed).toHaveBeenCalledWith(user.id);
		expect(setAuditCredentialContext).toHaveBeenCalledWith({
			credentialKind: "session",
			credentialId: sessionRecord.id,
		});
	});

	it("rejects anonymous and stale sessions at the macro boundary", async () => {
		getSession.mockResolvedValueOnce(null).mockResolvedValueOnce({
			user,
			session: {
				...sessionRecord,
				createdAt: new Date(Date.now() - 601_000),
			},
		});
		const sessionOnly = new Elysia().use(session).get(
			"/",
			{
				access: "session-only",
			},
			() => "unreachable",
		);
		const freshSessionOnly = new Elysia().use(session).get(
			"/",
			{
				access: "fresh-session-only",
			},
			() => "unreachable",
		);

		expect((await sessionOnly.handle(new Request("http://localhost/"))).status).toBe(401);
		expect((await freshSessionOnly.handle(new Request("http://localhost/"))).status).toBe(403);
	});

	it("rejects malformed, invalid, and under-permissioned API tokens", async () => {
		verifyApiKey
			.mockResolvedValueOnce({
				valid: false,
				key: null,
				error: { code: "INVALID_API_KEY", message: "Invalid API key" },
			})
			.mockResolvedValueOnce({
				valid: true,
				error: null,
				key: {
					id: "api-key-id",
					referenceId: user.id,
					permissions: { unit: ["read"] },
				},
			});
		const app = new Elysia().use(session).get(
			"/",
			{
				access: "unit:update",
			},
			() => "unreachable",
		);

		expect(
			(
				await app.handle(
					new Request("http://localhost/", {
						headers: { Authorization: "Bearer malformed" },
					}),
				)
			).status,
		).toBe(401);
		expect(
			(
				await app.handle(
					new Request("http://localhost/", {
						headers: { Authorization: "Bearer rz_api_invalid" },
					}),
				)
			).status,
		).toBe(401);
		expect(
			(
				await app.handle(
					new Request("http://localhost/", {
						headers: { Authorization: "Bearer rz_api_underpermissioned" },
					}),
				)
			).status,
		).toBe(403);
		expect(selectUser).not.toHaveBeenCalled();
		expect(enforceApiQuota).not.toHaveBeenCalled();
	});

	it("admits a permitted API token, records audit context, and releases quota once", async () => {
		const release = vi.fn();
		verifyApiKey.mockResolvedValue({
			valid: true,
			error: null,
			key: {
				id: "api-key-id",
				referenceId: user.id,
				permissions: { unit: ["update"] },
			},
		});
		selectUser.mockResolvedValue([user]);
		enforceApiQuota.mockResolvedValue({ release });
		const app = new Elysia().use(session).get(
			"/",
			{
				access: "unit:update",
			},
			({ credential }) => credential.kind,
		);

		const response = await app.handle(
			new Request("http://localhost/", {
				headers: { Authorization: "Bearer rz_api_permitted" },
			}),
		);
		await afterResponse();

		expect(response.status).toBe(200);
		expect(await response.text()).toBe("apiKey");
		expect(enforceApiQuota).toHaveBeenCalledOnce();
		expect(release).toHaveBeenCalledOnce();
		expect(setAuditCredentialContext).toHaveBeenCalledWith({
			credentialKind: "api_token",
			credentialId: "api-key-id",
		});
	});
});
