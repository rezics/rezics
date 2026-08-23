import { beforeEach, describe, expect, it, vi } from "vitest";

const select = vi.hoisted(() => vi.fn());

vi.mock("../database", () => ({ database: { select } }));

import { fractionalPositionAt } from "../ordering/position";
import {
	BootstrapUnitIds,
	ContentLabelRegistryIds,
	ContentLabelRegistryManifest,
	ContentLabelRegistryMaximumSize,
	ContentSpoilerLabelManifest,
	NsfwContentLabelId,
	OfficialProfileIds,
} from "./data";
import { isContentLabelRegistryReady } from "./readiness-content-labels";

type RegistryTagRow = {
	id: string;
	kind: string;
	status: string;
	visibility: string;
	moderationStatus: string;
	deletedAt: Date | null;
	directlyApplicable: boolean;
	defaultSpoilerLevel: number | null;
};

const ReadyTagRows: readonly RegistryTagRow[] = ContentLabelRegistryManifest.map((label) => ({
	id: label.id,
	kind: "tag",
	status: "published",
	visibility: "public",
	moderationStatus: "approved",
	deletedAt: null,
	directlyApplicable: false,
	defaultSpoilerLevel: null,
}));

const ReadyOwnerRows = ContentLabelRegistryManifest.map((label) => ({
	unitId: label.id,
	profileId: label.ownerProfileId,
}));

const ReadyLocalizationRows = ContentLabelRegistryManifest.flatMap((label) =>
	label.localizations.map((localization, index) => ({
		unitId: label.id,
		language: localization.language,
		position: fractionalPositionAt(index),
		title: localization.title,
	})),
);

function registryTagsWithFirstDrift(drift: Partial<RegistryTagRow>): readonly RegistryTagRow[] {
	const first = ReadyTagRows[0];
	if (!first) throw new Error("Content-label registry manifest is empty");
	return [{ ...first, ...drift }, ...ReadyTagRows.slice(1)];
}

function arrangeRegistryRows(tagRows: readonly RegistryTagRow[]): void {
	const queryResults: readonly (readonly unknown[])[] = [
		tagRows,
		ReadyOwnerRows,
		ReadyLocalizationRows,
	];
	let queryIndex = 0;
	select.mockImplementation(() => {
		const rows = queryResults[queryIndex++];
		const query = {
			from: vi.fn(),
			innerJoin: vi.fn(),
			where: vi.fn(async () => rows),
		};
		query.from.mockReturnValue(query);
		query.innerJoin.mockReturnValue(query);
		return query;
	});
}

describe("content-label bootstrap registry", () => {
	beforeEach(() => {
		select.mockReset();
	});

	it("contains exactly the three spoiler levels and one NSFW label within the fixed bound", () => {
		expect(ContentLabelRegistryManifest).toHaveLength(4);
		expect(ContentLabelRegistryManifest.length).toBeLessThanOrEqual(
			ContentLabelRegistryMaximumSize,
		);
		expect(ContentSpoilerLabelManifest.map((label) => label.spoilerLevel)).toEqual([0, 1, 2]);
		expect(ContentLabelRegistryManifest.map((label) => label.kind)).toEqual([
			"content_spoiler",
			"content_spoiler",
			"content_spoiler",
			"nsfw",
		]);
		expect(ContentLabelRegistryIds[3]).toBe(NsfwContentLabelId);
	});

	it("reserves unique permanent Tag identities owned by the moderation Profile", () => {
		expect(new Set(ContentLabelRegistryIds).size).toBe(ContentLabelRegistryIds.length);
		for (const label of ContentLabelRegistryManifest) {
			expect(BootstrapUnitIds).toContain(label.id);
			expect(label.ownerProfileId).toBe(OfficialProfileIds.moderation);
			expect(label.localizations.map(({ language }) => language)).toEqual(["zh", "en"]);
		}
	});

	it("accepts the exact published registry state", async () => {
		arrangeRegistryRows(ReadyTagRows);

		await expect(isContentLabelRegistryReady()).resolves.toBe(true);
		expect(select).toHaveBeenCalledTimes(3);
	});

	it.each([
		["Unit kind", { kind: "entity" }],
		["publication status", { status: "draft" }],
		["visibility", { visibility: "private" }],
		["moderation status", { moderationStatus: "pending" }],
		["deletion state", { deletedAt: new Date(0) }],
	] satisfies [string, Partial<RegistryTagRow>][])("rejects %s drift", async (_name, drift) => {
		arrangeRegistryRows(registryTagsWithFirstDrift(drift));

		await expect(isContentLabelRegistryReady()).resolves.toBe(false);
	});

	it.each([
		["direct applicability", { directlyApplicable: true }],
		["default spoiler level", { defaultSpoilerLevel: 1 }],
	] satisfies [string, Partial<RegistryTagRow>][])(
		"rejects %s policy drift",
		async (_name, drift) => {
			arrangeRegistryRows(registryTagsWithFirstDrift(drift));

			await expect(isContentLabelRegistryReady()).resolves.toBe(false);
		},
	);
});
