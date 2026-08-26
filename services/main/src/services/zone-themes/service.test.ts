import { describe, expect, it } from "vitest";

import { ZoneThemeAutomatedReviewInvalid } from "../api/zone-themes/errors";
import type { StoredZoneThemeRenderReview } from "../database/schema";
import { validateZoneThemeRenderEvidence } from "./service";

const Breakpoints = [375, 768, 1280] as const;
const ColorSchemes = ["light", "dark"] as const;

function validReview(): StoredZoneThemeRenderReview {
	let index = 1;
	return {
		captures: Breakpoints.flatMap((breakpoint) =>
			ColorSchemes.map((colorScheme) => ({
				breakpoint,
				colorScheme,
				screenshotAssetId: `019b0000-0000-7000-8000-${(index++).toString().padStart(12, "0")}`,
				layoutShift: 0.05,
				contrastViolations: 0,
			})),
		),
	};
}

describe("Zone theme render evidence", () => {
	it("requires one clean capture for every breakpoint and color scheme", () => {
		expect(() => validateZoneThemeRenderEvidence(validReview())).not.toThrow();
	});

	it("rejects incomplete or duplicated evidence", () => {
		const missing = validReview();
		const duplicateSource = validReview();
		const duplicatedAsset = {
			captures: duplicateSource.captures.map((capture, index) =>
				index === 1
					? { ...capture, screenshotAssetId: duplicateSource.captures[0]!.screenshotAssetId }
					: capture,
			),
		};

		expect(() =>
			validateZoneThemeRenderEvidence({ captures: missing.captures.slice(0, -1) }),
		).toThrow(ZoneThemeAutomatedReviewInvalid);
		expect(() => validateZoneThemeRenderEvidence(duplicatedAsset)).toThrow(
			ZoneThemeAutomatedReviewInvalid,
		);
	});

	it("rejects accessibility failures and excessive layout shift", () => {
		const contrastFailure = {
			captures: validReview().captures.map((capture, index) =>
				index === 0 ? { ...capture, contrastViolations: 1 } : capture,
			),
		};
		const layoutFailure = {
			captures: validReview().captures.map((capture, index) =>
				index === 0 ? { ...capture, layoutShift: 0.100_001 } : capture,
			),
		};

		expect(() => validateZoneThemeRenderEvidence(contrastFailure)).toThrow(
			ZoneThemeAutomatedReviewInvalid,
		);
		expect(() => validateZoneThemeRenderEvidence(layoutFailure)).toThrow(
			ZoneThemeAutomatedReviewInvalid,
		);
	});
});
