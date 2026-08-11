import { describe, expect, it } from "vitest";

import type { DatabaseExecutor } from "../database";
import {
	ParticipationResourceFanoutExceeded,
	ParticipationResourceFanoutLimit,
	resolveParticipationResourceUnitIds,
} from "./participation";

const ContentUnitId = "019b76da-a800-7300-8000-000000000001";

function ownerRows(count: number) {
	return Array.from({ length: count }, (_, index) => ({
		unitId: `019b76da-a800-7300-8000-${String(index + 2).padStart(12, "0")}`,
	}));
}

function ownerExecutor(rows: readonly { readonly unitId: string }[]): DatabaseExecutor {
	return {
		select() {
			const builder = {
				from() {
					return builder;
				},
				innerJoin() {
					return builder;
				},
				where() {
					return builder;
				},
				groupBy() {
					return builder;
				},
				orderBy() {
					return builder;
				},
				limit(limit: number) {
					return Promise.resolve(rows.slice(0, limit));
				},
			};
			return builder;
		},
	} as unknown as DatabaseExecutor;
}

describe("participation resource resolution", () => {
	it("attributes a standalone Unit to itself", async () => {
		await expect(
			resolveParticipationResourceUnitIds(ownerExecutor([]), ContentUnitId),
		).resolves.toEqual([ContentUnitId]);
	});

	it("attributes contained content to each distinct current resource", async () => {
		const owners = ownerRows(3);
		await expect(
			resolveParticipationResourceUnitIds(ownerExecutor(owners), ContentUnitId),
		).resolves.toEqual(owners.map(({ unitId }) => unitId));
	});

	it("fails explicitly instead of creating unbounded write fan-out", async () => {
		await expect(
			resolveParticipationResourceUnitIds(
				ownerExecutor(ownerRows(ParticipationResourceFanoutLimit + 1)),
				ContentUnitId,
			),
		).rejects.toMatchObject({
			name: ParticipationResourceFanoutExceeded.name,
			unitId: ContentUnitId,
			limit: ParticipationResourceFanoutLimit,
		});
	});
});
