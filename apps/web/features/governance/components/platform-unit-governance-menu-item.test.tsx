/** @vitest-environment jsdom */

import { resources } from "@rezics/i18n/resources";
import { cleanup, render, screen } from "@testing-library/react";
import { create } from "native-i18n";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TranslationProvider } from "@/i18n/client";
import { Menu, MenuContent } from "@rezics/ui";
import { PlatformUnitGovernanceMenuItem } from "./platform-unit-governance-menu-item";

const profile = vi.hoisted(() => ({ data: { platformCapabilities: [] as string[] } }));

vi.mock("@/i18n/client", async () => {
	const { create: createReactI18n } = await import("native-i18n/react/client");
	return createReactI18n(resources);
});

vi.mock("@rezics/openapi-tanstack-query", () => ({
	useGetApiUsersMe: () => profile,
}));

vi.stubGlobal("matchMedia", (query: string) => ({
	matches: false,
	media: query,
	onchange: null,
	addEventListener: vi.fn(),
	removeEventListener: vi.fn(),
	addListener: vi.fn(),
	removeListener: vi.fn(),
	dispatchEvent: vi.fn(),
}));

const translation = await create(resources).getTranslation(["governance"], ["zh-Hant"]);
const unitId = "019f9872-bd49-7bb4-a6b7-ec621fca2032";

function renderMenu() {
	return render(
		<TranslationProvider initial={translation.snapshot}>
			<Menu open>
				<MenuContent>
					<PlatformUnitGovernanceMenuItem unitId={unitId} />
				</MenuContent>
			</Menu>
		</TranslationProvider>,
	);
}

beforeEach(() => {
	profile.data.platformCapabilities = [];
});

afterEach(cleanup);

describe("PlatformUnitGovernanceMenuItem", () => {
	it("hides the entry without the platform governance capability", () => {
		renderMenu();

		expect(screen.queryByRole("menuitem", { name: "開啟平台治理" })).toBeNull();
	});

	it("links to the exact Unit governance route for authorized callers", () => {
		profile.data.platformCapabilities = ["unit.governance.read"];
		renderMenu();

		expect(screen.getByRole("menuitem", { name: "開啟平台治理" }).getAttribute("href")).toBe(
			`/console/units/${unitId}`,
		);
	});
});
