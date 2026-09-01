/** @vitest-environment jsdom */

import type { Block } from "@rezics/block";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	cn: vi.fn(() => "internal-merged"),
}));

vi.mock("@rezics/ui", () => ({ cn: mocks.cn }));

import { BlockContractRoot } from "./block-contract-root";

describe("BlockContractRoot", () => {
	afterEach(cleanup);

	it("emits author class hooks unchanged after internal class merging", () => {
		const block = {
			_type: "unit-ref",
			_key: "000000000001",
			unitId: "019b0000-0000-7000-8000-000000000001",
			appearance: "card",
			classNames: ["rezics-theme-flex", "rezics-theme-card--hero"],
		} satisfies Block;

		const { container } = render(
			<BlockContractRoot block={block} className="flex hidden">
				Content
			</BlockContractRoot>,
		);
		const root = container.firstElementChild;

		expect(mocks.cn).toHaveBeenCalledWith("min-w-0", "flex hidden");
		expect(root?.getAttribute("class")).toBe(
			"internal-merged rezics-theme-flex rezics-theme-card--hero",
		);
		expect(root?.getAttribute("data-block-type")).toBe("unit-ref");
		expect(root?.hasAttribute("data-style-role")).toBe(false);
	});

	it("emits the Unit List appearance, wrap layout, and default appearance states", () => {
		const identityBlock = {
			_type: "unit-list",
			_key: "000000000002",
			layout: "wrap",
			limit: 8,
			presentation: { itemAppearance: "identity-badge" },
			source: {
				kind: "collection",
				collectionId: "019b0000-0000-7000-8000-000000000002",
			},
		} satisfies Block;
		const { container, rerender } = render(
			<BlockContractRoot block={identityBlock}>Content</BlockContractRoot>,
		);
		let root = container.firstElementChild;
		expect(root?.getAttribute("data-appearance")).toBe("identity-badge");
		expect(root?.getAttribute("data-layout")).toBe("wrap");

		rerender(
			<BlockContractRoot block={{ ...identityBlock, layout: "carousel", presentation: undefined }}>
				Content
			</BlockContractRoot>,
		);
		root = container.firstElementChild;
		expect(root?.getAttribute("data-appearance")).toBe("default");
	});
});
