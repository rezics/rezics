// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { getLocaleContent } from "../../content/locales";
import { ProductDemo } from "./ProductDemo";

describe("focused product demonstrations", () => {
	test("updates the GameBook path from a reader choice", () => {
		const copy = getLocaleContent("zh-hant").products.demos.gamebook;
		render(<ProductDemo kind="gamebook" locale="zh-hant" />);

		const secondChoice = screen.getByRole("button", {
			name: copy.choices[1].label,
		});
		fireEvent.click(secondChoice);

		expect(secondChoice.getAttribute("aria-pressed")).toBe("true");
		expect(screen.getByText(copy.choices[1].result)).toBeTruthy();
	});

	test("shows the selected published-history difference", () => {
		const copy = getLocaleContent("zh-hant").products.demos.history;
		render(<ProductDemo kind="history" locale="zh-hant" />);

		const secondVersion = screen.getByRole("button", {
			name: `${copy.versions[1].label} ${copy.versions[1].meta}`,
		});
		fireEvent.click(secondVersion);

		expect(secondVersion.getAttribute("aria-pressed")).toBe("true");
		expect(screen.getByText(copy.versions[1].detail)).toBeTruthy();
	});
});
