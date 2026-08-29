import { describe, expect, it } from "vitest";

import type {
	CustomThemeHumanReviewEvidenceV0,
	CustomThemeReferenceRenderEvidenceV0,
	SubmittedCustomThemeManifestV0,
} from "@rezics/block";

import {
	customThemeExternalResourceBlocksExecution,
	customThemeHumanReviewEvidenceIsComplete,
	customThemeObservedRuntimeOriginsAreCovered,
	customThemeReferenceRenderEvidenceIsComplete,
	customThemeSubmissionBackpressureReason,
	MaximumActiveCustomThemeRevisions,
	MaximumCustomThemeReviewQueueDepth,
	MaximumDatabasePoolWaitP95Milliseconds,
} from "./service";

const manifest: SubmittedCustomThemeManifestV0 = {
	schemaVersion: 0,
	targetContract: "rezics.unit.presentation@0",
	executionMode: "host_full_trust",
	resourceMode: "external_live",
	fragments: [],
	styles: [],
	scripts: [],
	declaredRuntimeOrigins: {
		connect: ["https://api.example.test"],
		image: [],
		font: [],
		frame: [],
		media: [],
	},
};

const humanEvidence: CustomThemeHumanReviewEvidenceV0 = {
	owner: "Theme owner",
	incidentContact: "security@example.test",
	licenseFindings: [],
	acknowledgedRisks: ["First-party execution"],
};

const referenceRenderEvidence: CustomThemeReferenceRenderEvidenceV0 = {
	rendererVersion: "1.10.0",
	observedRuntimeOrigins: {
		connect: ["https://api.example.test"],
		image: [],
		font: [],
		frame: [],
		media: [],
	},
	fixtures: [
		{
			viewport: "desktop",
			colorScheme: "light",
			screenshotAssetId: "019f9000-0000-7000-8000-000000000010",
			consoleErrorCount: 0,
			loadFailureCount: 0,
			layoutShift: 0,
			largestContentfulPaintMilliseconds: 1_000,
			interactionToNextPaintMilliseconds: 100,
			longTaskMilliseconds: 0,
			memoryBytes: 1_000_000,
			transferredBytes: 1_000,
			requestCount: 1,
		},
		{
			viewport: "desktop",
			colorScheme: "dark",
			screenshotAssetId: "019f9000-0000-7000-8000-000000000011",
			consoleErrorCount: 0,
			loadFailureCount: 0,
			layoutShift: 0,
			largestContentfulPaintMilliseconds: 1_000,
			interactionToNextPaintMilliseconds: 100,
			longTaskMilliseconds: 0,
			memoryBytes: 1_000_000,
			transferredBytes: 1_000,
			requestCount: 1,
		},
	],
	accessibilityFindings: [],
	cleanupPassed: true,
};

describe("Custom Theme submission admission", () => {
	it("admits work while every bounded queue is healthy", () => {
		expect(
			customThemeSubmissionBackpressureReason({
				activeRevisionCount: MaximumActiveCustomThemeRevisions - 1,
				databasePoolWaitP95Milliseconds: MaximumDatabasePoolWaitP95Milliseconds,
				reviewQueueDepth: MaximumCustomThemeReviewQueueDepth,
				hasStaleReview: false,
				hasStaleUnpinnedMonitor: false,
			}),
		).toBeNull();
	});

	it.each([
		[
			"database_pool_wait",
			{
				activeRevisionCount: 1,
				databasePoolWaitP95Milliseconds: MaximumDatabasePoolWaitP95Milliseconds + 0.1,
				reviewQueueDepth: 1,
				hasStaleReview: false,
				hasStaleUnpinnedMonitor: false,
			},
		],
		[
			"active_revision_bound",
			{
				activeRevisionCount: MaximumActiveCustomThemeRevisions,
				databasePoolWaitP95Milliseconds: 0,
				reviewQueueDepth: 1,
				hasStaleReview: false,
				hasStaleUnpinnedMonitor: false,
			},
		],
		[
			"review_queue_depth",
			{
				activeRevisionCount: 1,
				databasePoolWaitP95Milliseconds: 0,
				reviewQueueDepth: MaximumCustomThemeReviewQueueDepth + 1,
				hasStaleReview: false,
				hasStaleUnpinnedMonitor: false,
			},
		],
		[
			"review_queue_age",
			{
				activeRevisionCount: 1,
				databasePoolWaitP95Milliseconds: 0,
				reviewQueueDepth: 1,
				hasStaleReview: true,
				hasStaleUnpinnedMonitor: false,
			},
		],
		[
			"monitor_queue_age",
			{
				activeRevisionCount: 1,
				databasePoolWaitP95Milliseconds: 0,
				reviewQueueDepth: 1,
				hasStaleReview: false,
				hasStaleUnpinnedMonitor: true,
			},
		],
	] as const)("closes admission for %s", (reason, state) => {
		expect(customThemeSubmissionBackpressureReason(state)).toBe(reason);
	});
});

describe("Custom Theme reference-render origin evidence", () => {
	it("requires meaningful human ownership and risk evidence", () => {
		expect(customThemeHumanReviewEvidenceIsComplete(humanEvidence)).toBe(true);
		expect(customThemeHumanReviewEvidenceIsComplete({ ...humanEvidence, owner: "   " })).toBe(
			false,
		);
	});

	it("requires attested light and dark fixtures without load or cleanup failures", () => {
		expect(customThemeReferenceRenderEvidenceIsComplete(referenceRenderEvidence)).toBe(true);
		expect(
			customThemeReferenceRenderEvidenceIsComplete({
				...referenceRenderEvidence,
				cleanupPassed: false,
			}),
		).toBe(false);
		expect(
			customThemeReferenceRenderEvidenceIsComplete({
				...referenceRenderEvidence,
				fixtures: referenceRenderEvidence.fixtures.map((fixture, index) =>
					index === 0 ? { ...fixture, loadFailureCount: 1 } : fixture,
				),
			}),
		).toBe(false);
	});

	it("requires every observed runtime origin to be exact and declared", () => {
		expect(customThemeObservedRuntimeOriginsAreCovered(manifest, referenceRenderEvidence)).toBe(
			true,
		);
		expect(
			customThemeObservedRuntimeOriginsAreCovered(manifest, {
				...referenceRenderEvidence,
				observedRuntimeOrigins: {
					...referenceRenderEvidence.observedRuntimeOrigins,
					connect: ["https://undeclared.example.test"],
				},
			}),
		).toBe(false);
		expect(
			customThemeObservedRuntimeOriginsAreCovered(manifest, {
				...referenceRenderEvidence,
				observedRuntimeOrigins: {
					...referenceRenderEvidence.observedRuntimeOrigins,
					connect: ["https://api.example.test/path"],
				},
			}),
		).toBe(false);
	});
});

describe("Custom Theme resource availability", () => {
	it("blocks drift and required outages while tolerating optional outages", () => {
		expect(
			customThemeExternalResourceBlocksExecution({
				currentHealthState: "current",
				reviewEvidence: { required: true },
			}),
		).toBe(false);
		expect(
			customThemeExternalResourceBlocksExecution({
				currentHealthState: "unavailable",
				reviewEvidence: { required: false },
			}),
		).toBe(false);
		expect(
			customThemeExternalResourceBlocksExecution({
				currentHealthState: "unavailable",
				reviewEvidence: { required: true },
			}),
		).toBe(true);
		expect(
			customThemeExternalResourceBlocksExecution({
				currentHealthState: "drifted",
				reviewEvidence: { required: false },
			}),
		).toBe(true);
	});
});
