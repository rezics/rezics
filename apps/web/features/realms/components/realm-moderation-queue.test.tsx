/** @vitest-environment jsdom */

import { resources } from "@rezics/i18n/resources";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { create } from "native-i18n";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TranslationProvider } from "@/i18n/client";
import type { RealmModerationUnit } from "../model/realm-moderation-cache";
import { RealmModerationQueue } from "./realm-moderation-queue";

vi.mock("@/i18n/client", async () => {
	const { create: createReactI18n } = await import("native-i18n/react/client");
	return createReactI18n(resources);
});

vi.mock("@tanstack/react-virtual", () => ({
	useVirtualizer: ({ count }: { count: number }) => ({
		getTotalSize: () => count * 78,
		getVirtualItems: () =>
			Array.from({ length: count }, (_, index) => ({
				index,
				key: index,
				size: 78,
				start: index * 78,
			})),
		measureElement: vi.fn(),
	}),
}));

const translation = await create(resources).getTranslation(
	["posts", "realms", "reports", "units"],
	["zh-Hant"],
);

const unit = {
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
} satisfies RealmModerationUnit;

afterEach(cleanup);

describe("RealmModerationQueue", () => {
	it("selects the item from the full row and loads the next virtual page", async () => {
		const onSelect = vi.fn();
		const onLoadNextPage = vi.fn();
		render(
			<TranslationProvider initial={translation.snapshot}>
				<RealmModerationQueue
					hasNextPage
					isFetchingNextPage={false}
					nextPageError={null}
					onLoadNextPage={onLoadNextPage}
					onSelect={onSelect}
					units={[unit]}
				/>
			</TranslationProvider>,
		);

		fireEvent.click(screen.getByRole("button", { name: "處理「測試內容」" }));

		expect(onSelect).toHaveBeenCalledWith(unit);
		await waitFor(() => expect(onLoadNextPage).toHaveBeenCalledOnce());
	});
});
