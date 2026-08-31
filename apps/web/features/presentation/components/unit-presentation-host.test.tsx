/** @vitest-environment jsdom */

import type { MenuBlock } from "@rezics/block";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ResolvedUnitPresentation } from "../model/resolved-presentation";
import { UnitPresentationHost } from "./unit-presentation-host";

const HostUnitId = "019f9000-0000-7000-8000-000000000001";
const NavigationId = "019f9000-0000-7000-8000-000000000002";
const HeaderMenu = {
	_type: "menu",
	_key: "000000000001",
	appearance: "links",
	navigationId: NavigationId,
	orientation: "horizontal",
} satisfies MenuBlock;

const Presentation = {
	customTheme: null,
	document: {
		_type: "unit-presentation-document",
		_key: "000000000002",
		footer: { _type: "block-document", _key: "000000000003", blocks: [] },
		header: { _type: "block-document", _key: "000000000004", blocks: [HeaderMenu] },
	},
	documentRevisionId: null,
	fallbackReason: "none_installed",
	targetContract: "rezics.unit.presentation@0",
} satisfies ResolvedUnitPresentation;

afterEach(cleanup);

describe("Unit presentation host", () => {
	it("keeps platform chrome outside a non-empty replaceable Header region", () => {
		render(
			<UnitPresentationHost
				copy={{
					defaultThemeAction: "Use default theme",
					defaultThemeFailed: "Could not use default theme",
					defaultThemeScope: "Custom theme active",
					runtimeFailed: "Theme runtime failed",
				}}
				headerLabel="Presentation header"
				hostUnit={{ id: HostUnitId, kind: "zone" }}
				onUseDefaultTheme={vi.fn()}
				platformHeader={<div data-testid="platform-header">Zone chrome</div>}
				presentation={Presentation}
				renderRegion={(_document, region) => (
					<div data-testid={`presentation-${region}`}>{region}</div>
				)}
				useDefaultThemeFailed={false}
				useDefaultThemePending={false}
			>
				<div data-testid="main-content">Main</div>
			</UnitPresentationHost>,
		);

		const platformHeader = screen.getByTestId("platform-header");
		const presentationHeader = screen.getByTestId("presentation-header");

		expect(platformHeader.closest('[data-unit-presentation-region="header"]')).toBeNull();
		expect(platformHeader.parentElement?.getAttribute("data-unit-presentation-contract")).toBe(
			"rezics.unit.presentation@0",
		);
		expect(presentationHeader.closest('[data-unit-presentation-region="header"]')).not.toBeNull();
		expect(screen.getByTestId("main-content")).not.toBeNull();
	});
});
