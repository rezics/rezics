import { beforeEach, describe, expect, it, vi } from "vitest";

const findProfileLimit = vi.hoisted(() => vi.fn());
const registrationLanguageLimit = vi.hoisted(() => vi.fn());
const insert = vi.hoisted(() => vi.fn());
const insertUnit = vi.hoisted(() => vi.fn());
const ensureFavorites = vi.hoisted(() => vi.fn());
const ensureFavoritesInTransaction = vi.hoisted(() => vi.fn());
const onConflictDoNothing = vi.hoisted(() => vi.fn());
const recordUnitRevision = vi.hoisted(() => vi.fn());
const valuesByTable = vi.hoisted(() => new Map<unknown, unknown>());

vi.mock("../database", () => ({
	database: {
		select: vi.fn((selection: Record<string, unknown>) =>
			"contentLanguage" in selection
				? {
						from: vi.fn(() => ({
							where: vi.fn(() => ({ limit: registrationLanguageLimit })),
						})),
					}
				: {
						from: vi.fn(() => ({
							innerJoin: vi.fn(() => ({
								innerJoin: vi.fn(() => ({
									leftJoin: vi.fn(() => ({
										leftJoin: vi.fn(() => ({
											where: vi.fn(() => ({ limit: findProfileLimit })),
										})),
									})),
								})),
							})),
						})),
					},
		),
		transaction: vi.fn(async (operation: (tx: { insert: typeof insert }) => unknown) =>
			operation({ insert }),
		),
	},
}));

vi.mock("../units/create", () => ({ insertUnit }));
vi.mock("../units/history", () => ({ recordUnitRevision }));
vi.mock("../collections/favorites", () => ({
	ensureFavorites,
	ensureFavoritesInTransaction,
}));

import { OfficialRealmManifest, OfficialZoneManifest } from "../bootstrap/manifest";
import {
	profilePreference,
	realmMember,
	unitFollow,
	unitLocalization,
	unitOwnership,
} from "../database/schema";
import { OfficialRealmUnitIds } from "@rezics/slug";
import { fractionalPositionBetween } from "../ordering/position";
import { ensureProfile } from "./profile";

const ProfileId = "019f82aa-db8f-7962-9924-7369b17f5502";

describe("Profile registration defaults", () => {
	beforeEach(() => {
		findProfileLimit.mockReset();
		findProfileLimit.mockResolvedValue([]);
		registrationLanguageLimit.mockReset();
		registrationLanguageLimit.mockResolvedValue([]);
		insert.mockReset();
		valuesByTable.clear();
		insert.mockImplementation((table) => ({
			values: vi.fn((values) => {
				valuesByTable.set(table, values);
				return { onConflictDoNothing };
			}),
		}));
		insertUnit.mockReset();
		insertUnit.mockResolvedValue({ id: ProfileId });
		onConflictDoNothing.mockReset();
		onConflictDoNothing.mockResolvedValue(undefined);
		recordUnitRevision.mockReset();
		recordUnitRevision.mockResolvedValue(undefined);
		ensureFavoritesInTransaction.mockReset();
		ensureFavoritesInTransaction.mockResolvedValue("favorites-id");
		ensureFavorites.mockReset();
		ensureFavorites.mockResolvedValue("favorites-id");
	});

	it("repairs Favorites for an existing Profile before returning it", async () => {
		const existing = {
			unitId: ProfileId,
			name: "Reader",
			email: "reader@example.com",
		};
		findProfileLimit.mockResolvedValue([
			{
				...existing,
				favoritesId: null,
			},
		]);

		await expect(
			ensureProfile({
				id: "019f82aa-db8f-7962-9924-7369b17f5501",
				email: "reader@example.com",
				name: "Reader",
				image: null,
			}),
		).resolves.toEqual(existing);
		expect(ensureFavorites).toHaveBeenCalledOnce();
		expect(ensureFavorites).toHaveBeenCalledWith(ProfileId);
		expect(ensureFavoritesInTransaction).not.toHaveBeenCalled();
	});

	it("does not query Favorites again when the existing Profile already has them", async () => {
		findProfileLimit.mockResolvedValue([
			{
				unitId: ProfileId,
				name: "Reader",
				email: "reader@example.com",
				favoritesId: "019f82aa-db8f-7962-9924-7369b17f5503",
			},
		]);

		await ensureProfile({
			id: "019f82aa-db8f-7962-9924-7369b17f5501",
			email: "reader@example.com",
			name: "Reader",
			image: null,
		});

		expect(ensureFavorites).not.toHaveBeenCalled();
		expect(ensureFavoritesInTransaction).not.toHaveBeenCalled();
	});

	it("idempotently follows only the official Zones in manifest order", async () => {
		await ensureProfile({
			id: "019f82aa-db8f-7962-9924-7369b17f5501",
			email: "reader@example.com",
			name: "Reader",
			image: null,
		});

		const followValues = valuesByTable.get(unitFollow);
		const positions = new Array<string>(OfficialZoneManifest.length);
		let right: string | null = null;
		for (let index = positions.length - 1; index >= 0; index -= 1) {
			positions[index] = fractionalPositionBetween(null, right);
			right = positions[index]!;
		}
		expect(followValues).toBeDefined();
		expect(followValues).toEqual(
			OfficialZoneManifest.map((officialZone, index) => ({
				followerProfileId: ProfileId,
				unitId: officialZone.id,
				position: positions[index],
			})),
		);
		expect(followValues).not.toEqual(
			expect.arrayContaining([expect.objectContaining({ unitId: OfficialRealmManifest.id })]),
		);
		expect(onConflictDoNothing).toHaveBeenCalledOnce();
	});

	it("owns the Profile Unit it creates", async () => {
		await ensureProfile({
			id: "019f82aa-db8f-7962-9924-7369b17f5501",
			email: "reader@example.com",
			name: "Reader",
			image: null,
		});

		expect(valuesByTable.get(unitOwnership)).toEqual({
			unitId: ProfileId,
			profileId: ProfileId,
			assignedByProfileId: ProfileId,
		});
	});

	it("creates the required Favorites Collection in the Profile transaction", async () => {
		await ensureProfile({
			id: "019f82aa-db8f-7962-9924-7369b17f5501",
			email: "reader@example.com",
			name: "Reader",
			image: null,
		});

		expect(ensureFavoritesInTransaction).toHaveBeenCalledOnce();
		expect(ensureFavoritesInTransaction).toHaveBeenCalledWith(
			expect.objectContaining({ insert }),
			ProfileId,
		);
	});

	it("joins the REZICS Score Realm and stores it as the default scoring Realm", async () => {
		await ensureProfile({
			id: "019f82aa-db8f-7962-9924-7369b17f5501",
			email: "reader@example.com",
			name: "Reader",
			image: null,
		});

		expect(valuesByTable.get(profilePreference)).toEqual({
			profileId: ProfileId,
			defaultScoreContextUnitId: OfficialRealmUnitIds.score,
			contentRatings: ["general", "r15"],
			preferredLanguages: ["en"],
		});
		expect(valuesByTable.get(realmMember)).toEqual({
			realmId: OfficialRealmUnitIds.score,
			profileId: ProfileId,
			state: "active",
		});
	});

	it("uses the registration language when the frontend supplies one", async () => {
		registrationLanguageLimit.mockResolvedValue([{ contentLanguage: "ja" }]);

		await ensureProfile({
			id: "019f82aa-db8f-7962-9924-7369b17f5501",
			email: "reader@example.com",
			name: "Reader",
			image: null,
		});

		expect(valuesByTable.get(profilePreference)).toEqual(
			expect.objectContaining({ preferredLanguages: ["ja"] }),
		);
		expect(valuesByTable.get(unitLocalization)).toEqual({
			unitId: ProfileId,
			language: "ja",
			title: "Reader",
		});
	});
});
