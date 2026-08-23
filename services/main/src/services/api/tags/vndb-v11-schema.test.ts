import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
	CreateTagStructureBody,
	TagStructureResponse,
	UnitStructureCorrectionJobResponse,
	UnitStructureCorrectionNoChangeResponse,
} from "./schema";

const uuid = (suffix: number) => `00000000-0000-7000-8000-${suffix.toString().padStart(12, "0")}`;

const correction = {
	structureId: uuid(1),
	sourceProjectionVersion: 1,
	targetProjectionVersion: 2,
	sourceMemberTagIds: [uuid(2), uuid(3)],
	targetMemberTagIds: [uuid(2), uuid(4)],
	requestedAt: "2026-08-24T00:00:00.000Z",
	updatedAt: "2026-08-24T00:00:01.000Z",
	lastErrorCode: null,
	lastErrorMessage: null,
} as const;

describe("VNDB v11 Tag API schemas", () => {
	it("carries the canonical maximum Path length through requests and responses", () => {
		expect(CreateTagStructureBody.properties.memberTagIds.maxItems).toBe(16);
		expect(TagStructureResponse.properties.members.maxItems).toBe(16);
		expect(
			Value.Check(CreateTagStructureBody, {
				memberTagIds: Array.from({ length: 17 }, (_, index) => uuid(index + 1)),
			}),
		).toBe(false);
	});

	it("keeps accepted correction jobs distinct from synchronous no-change responses", () => {
		const job = {
			...correction,
			correctionId: uuid(5),
			changed: true,
			status: "pending",
			writeRoute: "source",
			activatedAt: null,
			completedAt: null,
			failedAt: null,
			cancelledAt: null,
		};
		const noChange = {
			...correction,
			correctionId: null,
			changed: false,
			status: "completed",
			writeRoute: "target",
			activatedAt: null,
			completedAt: correction.updatedAt,
			failedAt: null,
			cancelledAt: null,
		};

		expect(Value.Check(UnitStructureCorrectionJobResponse, job)).toBe(true);
		expect(Value.Check(UnitStructureCorrectionJobResponse, noChange)).toBe(false);
		expect(Value.Check(UnitStructureCorrectionNoChangeResponse, noChange)).toBe(true);
		expect(Value.Check(UnitStructureCorrectionNoChangeResponse, job)).toBe(false);
	});
});
