import { beforeEach, describe, expect, it, vi } from "vitest";

const inspectPlatformCore = vi.hoisted(() => vi.fn());
const assertPlatformCoreReady = vi.hoisted(() => vi.fn());
const ensureSlugNamespaces = vi.hoisted(() => vi.fn());
const ensureBootstrapProfiles = vi.hoisted(() => vi.fn());
const ensureBootstrapProfileFavorites = vi.hoisted(() => vi.fn());
const ensureContentLabelRegistry = vi.hoisted(() => vi.fn());
const ensureCuratedCreationTagCollections = vi.hoisted(() => vi.fn());
const ensureBootstrapPlatformAccess = vi.hoisted(() => vi.fn());
const ensureDefaultApiQuotaPolicies = vi.hoisted(() => vi.fn());
const ensureOfficialRealmAvatar = vi.hoisted(() => vi.fn());
const ensureBootstrapRealm = vi.hoisted(() => vi.fn());
const ensureScoreRealmProfileDefaults = vi.hoisted(() => vi.fn());
const ensureOfficialZones = vi.hoisted(() => vi.fn());
const ensureOfficialZoneExperiences = vi.hoisted(() => vi.fn());
const ensureOfficialZoneFollows = vi.hoisted(() => vi.fn());
const transaction = vi.hoisted(() => vi.fn());

vi.mock("../database", () => ({ database: { transaction } }));
vi.mock("./core", async (importOriginal) => {
	const actual = await importOriginal<typeof import("./core")>();
	return {
		...actual,
		inspectPlatformCore,
		assertPlatformCoreReady,
	};
});
vi.mock("./manifest-validation", () => ({ assertBootstrapManifest: vi.fn() }));
vi.mock("./installation/foundation", () => ({ ensureSlugNamespaces }));
vi.mock("./installation/profiles", () => ({
	ensureBootstrapProfiles,
	ensureBootstrapProfileFavorites,
}));
vi.mock("./installation/content-labels", () => ({ ensureContentLabelRegistry }));
vi.mock("./installation/collections", () => ({ ensureCuratedCreationTagCollections }));
vi.mock("./installation/platform-access", () => ({ ensureBootstrapPlatformAccess }));
vi.mock("./installation/api-quotas", () => ({ ensureDefaultApiQuotaPolicies }));
vi.mock("./installation/realms", () => ({
	ensureBootstrapRealm,
	ensureOfficialRealmAvatar,
	ensureScoreRealmProfileDefaults,
}));
vi.mock("./installation/zones", () => ({
	ensureOfficialZones,
	ensureOfficialZoneExperiences,
}));
vi.mock("./official-zone-follows", () => ({ ensureOfficialZoneFollows }));
vi.mock("./readiness", () => ({ isInitialInstallationBundleReady: vi.fn() }));

import type { DatabaseTransaction } from "../database";
import { platformInstallationService } from "./service";

const Transaction = { execute: vi.fn() } as unknown as DatabaseTransaction;

describe("platform identity ensure", () => {
	beforeEach(() => {
		transaction.mockReset();
		transaction.mockImplementation(async (work: (tx: DatabaseTransaction) => Promise<unknown>) =>
			work(Transaction),
		);
		inspectPlatformCore.mockReset();
		assertPlatformCoreReady.mockReset();
		ensureSlugNamespaces.mockReset();
		ensureBootstrapProfiles.mockReset();
		ensureBootstrapProfiles.mockResolvedValue([]);
		ensureBootstrapProfileFavorites.mockReset();
		ensureContentLabelRegistry.mockReset();
		ensureCuratedCreationTagCollections.mockReset();
		ensureBootstrapPlatformAccess.mockReset();
		ensureDefaultApiQuotaPolicies.mockReset();
		ensureOfficialRealmAvatar.mockReset();
		ensureBootstrapRealm.mockReset();
		ensureScoreRealmProfileDefaults.mockReset();
		ensureOfficialZones.mockReset();
		ensureOfficialZones.mockResolvedValue([]);
		ensureOfficialZoneExperiences.mockReset();
		ensureOfficialZoneFollows.mockReset();
	});

	it("refuses an occupied database without writing", async () => {
		inspectPlatformCore.mockResolvedValue({ status: "occupied" });

		await expect(platformInstallationService.install()).rejects.toThrow(/occupied database/);
		expect(ensureSlugNamespaces).not.toHaveBeenCalled();
	});

	it("treats an empty database as a first install with an empty follow sequence", async () => {
		inspectPlatformCore
			.mockResolvedValueOnce({ status: "uninstalled" })
			.mockResolvedValueOnce({ status: "ready" });

		await expect(platformInstallationService.install()).resolves.toEqual({
			status: "installed",
			issuedCredentials: [],
		});
		expect(ensureOfficialZoneFollows).toHaveBeenCalledWith(Transaction, expect.any(Array), {
			sequenceIsEmpty: true,
		});
		expect(ensureContentLabelRegistry).toHaveBeenCalledOnce();
		expect(ensureContentLabelRegistry).toHaveBeenCalledWith(Transaction);
		expect(ensureOfficialZoneExperiences).toHaveBeenCalledWith(Transaction, []);
	});

	it("fills a missing identity graph and reports installed", async () => {
		inspectPlatformCore
			.mockResolvedValueOnce({ status: "incomplete", missingIdentities: [] })
			.mockResolvedValueOnce({ status: "ready" });
		ensureBootstrapProfiles.mockResolvedValue([
			{ action: "created", name: "Admin", email: "admin@example.com", password: "secret" },
		]);

		await expect(platformInstallationService.install()).resolves.toEqual({
			status: "installed",
			issuedCredentials: [
				{ action: "created", name: "Admin", email: "admin@example.com", password: "secret" },
			],
		});
		expect(ensureSlugNamespaces).toHaveBeenCalledWith(Transaction);
		expect(ensureOfficialZoneFollows).toHaveBeenCalledWith(Transaction, expect.any(Array), {
			sequenceIsEmpty: false,
		});
	});

	it("reruns ensure on a ready database without treating it as a first install", async () => {
		inspectPlatformCore.mockResolvedValue({ status: "ready" });

		await expect(platformInstallationService.install()).resolves.toEqual({
			status: "already_installed",
			issuedCredentials: [],
		});
		expect(ensureSlugNamespaces).toHaveBeenCalledWith(Transaction);
		expect(ensureOfficialZoneFollows).toHaveBeenCalledWith(Transaction, expect.any(Array), {
			sequenceIsEmpty: false,
		});
	});
});
