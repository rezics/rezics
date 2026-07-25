import { beforeEach, describe, expect, it, vi } from "vitest";

const findProfileLimit = vi.hoisted(() => vi.fn());
const insert = vi.hoisted(() => vi.fn());
const insertUnit = vi.hoisted(() => vi.fn());
const onConflictDoNothing = vi.hoisted(() => vi.fn());
const recordUnitRevision = vi.hoisted(() => vi.fn());
const valuesByTable = vi.hoisted(() => new Map<unknown, unknown>());

vi.mock("../database", () => ({
	database: {
		select: vi.fn(() => ({
			from: vi.fn(() => ({
				innerJoin: vi.fn(() => ({
					innerJoin: vi.fn(() => ({
						leftJoin: vi.fn(() => ({
							where: vi.fn(() => ({ limit: findProfileLimit })),
						})),
					})),
				})),
			})),
		})),
		transaction: vi.fn(async (operation: (tx: { insert: typeof insert }) => unknown) =>
			operation({ insert }),
		),
	},
}));

vi.mock("../units/create", () => ({ insertUnit }));
vi.mock("../units/history", () => ({ recordUnitRevision }));

import { OfficialRealmManifest, OfficialZoneManifest } from "../bootstrap/manifest";
import { profilePreference, realmMember, unitAccessBinding, unitFollow } from "../database/schema";
import { OfficialRealmUnitIds } from "@rezics/slug";
import { fractionalPositionBetween } from "../ordering/position";
import { ensureProfile } from "./profile";

const ProfileId = "019f82aa-db8f-7962-9924-7369b17f5502";

describe("Profile registration defaults", () => {
	beforeEach(() => {
		findProfileLimit.mockReset();
		findProfileLimit.mockResolvedValue([]);
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

		expect(valuesByTable.get(unitAccessBinding)).toEqual({
			unitId: ProfileId,
			subjectKind: "profile",
			profileId: ProfileId,
			role: "owner",
			scope: [],
			grantedByProfileId: ProfileId,
		});
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
		});
		expect(valuesByTable.get(realmMember)).toEqual({
			realmId: OfficialRealmUnitIds.score,
			profileId: ProfileId,
			role: "member",
			state: "active",
		});
	});
});
