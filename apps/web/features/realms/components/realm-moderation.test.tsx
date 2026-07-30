/** @vitest-environment jsdom */

import { resources } from "@rezics/i18n/resources";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { create } from "native-i18n";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TranslationProvider } from "@/i18n/client";
import type { RealmModerationUnit } from "../model/realm-moderation-cache";
import { RealmModeration } from "./realm-moderation";

const queue = vi.hoisted(() => ({
	fetchNextPage: vi.fn(),
	refetch: vi.fn(),
}));

vi.mock("@/i18n/client", async () => {
	const { create: createReactI18n } = await import("native-i18n/react/client");
	return createReactI18n(resources);
});

vi.mock("nuqs", () => ({
	useQueryState: () => ["all", vi.fn()],
}));

vi.mock("../data/realm-moderation-query", () => ({
	useRealmModerationQueue: () => ({
		data: {
			pages: [
				{
					items: [
						{
							realmId: "019fa3ab-72a9-7792-b2e3-43aa8a9c755d",
							unitId: "019fa3ab-72a9-7792-b2e3-43aa8a9c755e",
							unitKind: "post",
							language: "zh",
							title: "測試內容",
							status: "pending",
							publicationState: "active",
							postTargetingLocked: false,
							openReportCount: 0,
							allowedCommands: ["approve", "remove", "lock_post_targeting", "note"],
							moderationStatus: "pending",
							createdAt: "2026-07-27T12:00:00.000Z",
							updatedAt: "2026-07-27T12:30:00.000Z",
						},
					],
					nextCursor: null,
				},
			],
			pageParams: [""],
		},
		error: null,
		fetchNextPage: queue.fetchNextPage,
		hasNextPage: false,
		isError: false,
		isFetchNextPageError: false,
		isFetchingNextPage: false,
		isPending: false,
		refetch: queue.refetch,
	}),
	realmModerationUnits: (data: { pages: Array<{ items: RealmModerationUnit[] }> }) =>
		data.pages.flatMap((page) => page.items),
}));

vi.mock("./realm-moderation-queue", () => ({
	RealmModerationQueue: ({
		units,
		onSelect,
	}: {
		units: RealmModerationUnit[];
		onSelect: (unit: RealmModerationUnit) => void;
	}) => (
		<button onClick={() => onSelect(units[0]!)} type="button">
			處理測試內容
		</button>
	),
}));

vi.mock("./realm-moderation-sheet", () => ({
	RealmModerationSheet: ({ unit }: { unit: RealmModerationUnit }) => (
		<section aria-label={`處理${unit.title}`} role="dialog" />
	),
}));

const translation = await create(resources).getTranslation(
	["posts", "realms", "reports", "state", "units"],
	["zh-Hant"],
);

afterEach(cleanup);

describe("RealmModeration", () => {
	it("opens the management sheet immediately when a queue item is selected", () => {
		render(
			<TranslationProvider initial={translation.snapshot}>
				<RealmModeration embedded realmId="019fa3ab-72a9-7792-b2e3-43aa8a9c755d" />
			</TranslationProvider>,
		);

		fireEvent.click(screen.getByRole("button", { name: "處理測試內容" }));

		expect(screen.getByRole("dialog", { name: "處理測試內容" })).toBeTruthy();
	});
});
