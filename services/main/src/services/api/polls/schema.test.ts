import { Check } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import { CreatePollBody, PollDetailQuery, PollOptionInput } from "./schema";
import { PollDetailResponse } from "../schema/response";

const targetUnitId = "019b0000-0000-7000-8000-000000000001";

describe("Poll API contract", () => {
	it("accepts ordered fallback priorities only", () => {
		expect(Check(PollDetailQuery, {})).toBe(true);
		expect(Check(PollDetailQuery, { localizationLanguages: ["zh", "en"] })).toBe(true);
		expect(Check(PollDetailQuery, { localizationLanguages: [] })).toBe(false);
		expect(Check(PollDetailQuery, { unknown: true })).toBe(false);
	});

	it("represents literal and Unit-backed options as disjoint inputs", () => {
		expect(Check(PollOptionInput, { sourceKind: "literal", label: "First" })).toBe(true);
		expect(Check(PollOptionInput, { sourceKind: "unit", targetUnitId, label: "First" })).toBe(true);
		expect(Check(PollOptionInput, { sourceKind: "literal", targetUnitId, label: "First" })).toBe(
			false,
		);
		expect(Check(PollOptionInput, { sourceKind: "unit", label: "First" })).toBe(false);
	});

	it("keeps Poll option labels plain text", () => {
		expect(
			Check(CreatePollBody, {
				question: "Question",
				language: "en",
				options: [
					{ sourceKind: "literal", label: "First" },
					{ sourceKind: "unit", targetUnitId, label: "Second" },
				],
				voteMode: "single",
				resultsVisibility: "live",
			}),
		).toBe(true);
		expect(
			Check(PollOptionInput, {
				sourceKind: "literal",
				label: {
					_type: "portable-text",
					_key: "0123456789ab",
					content: [],
				},
			}),
		).toBe(false);
	});

	it("preserves the source and target invariant in Poll responses", () => {
		const poll = {
			id: "019b0000-0000-7000-8000-000000000002",
			language: "en",
			question: "Question",
			voteMode: "single",
			anonymous: false,
			resultsVisibility: "live",
			closesAt: null,
			createdAt: new Date().toISOString(),
			closed: false,
			viewerOptionIds: [],
		};
		const option = {
			id: "019b0000-0000-7000-8000-000000000003",
			label: "First",
			position: 0,
			voteCount: null,
		};

		expect(
			Check(PollDetailResponse, {
				...poll,
				options: [{ ...option, sourceKind: "literal", targetUnitId: null }],
			}),
		).toBe(true);
		expect(
			Check(PollDetailResponse, {
				...poll,
				options: [{ ...option, sourceKind: "unit", targetUnitId }],
			}),
		).toBe(true);
		expect(
			Check(PollDetailResponse, {
				...poll,
				options: [{ ...option, sourceKind: "unit", targetUnitId: null }],
			}),
		).toBe(false);
	});
});
