// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { GlobalHeader } from "./GlobalHeader";
import { ProductDemo } from "./ProductDemo";
import { getLocaleContent } from "../../content/locales";
import { getAlternatePaths } from "../../i18n/productPaths";
import { useReveal } from "../../hooks/useReveal";
import ComponentExample from "../../content/mdx/ComponentExample.mdx";
import { renderToStaticMarkup } from "react-dom/server";

beforeEach(() => {
	const values = new Map<string, string>();
	const storage = {
		length: 0,
		clear: () => values.clear(),
		getItem: (key: string) => values.get(key) ?? null,
		key: () => null,
		removeItem: (key: string) => values.delete(key),
		setItem: (key: string, value: string) => values.set(key, value),
	} as Storage;
	Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
	Object.defineProperty(window, "localStorage", { configurable: true, value: storage });
	document.documentElement.dataset.theme = "light";
	Object.defineProperty(window, "matchMedia", {
		configurable: true,
		value: vi.fn().mockReturnValue({
			matches: false,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
		}),
	});
});

describe("React interactions", () => {
	test("persists theme and closes the mobile drawer with Escape while restoring focus", () => {
		const copy = getLocaleContent("en").common;
		render(
			<GlobalHeader
				locale="en"
				copy={copy}
				active="home"
				alternatePathByLocale={getAlternatePaths("home")}
			/>,
		);
		const menu = screen.getByRole("button", { name: copy.nav.openMenu });
		fireEvent.click(menu);
		expect(menu.getAttribute("aria-expanded")).toBe("true");
		fireEvent.keyDown(window, { key: "Escape" });
		expect(document.activeElement).toBe(menu);

		const themeButtons = screen.getAllByRole("button", { name: copy.theme.light });
		fireEvent.click(themeButtons[0]!);
		expect(document.documentElement.dataset.theme).toBe("dark");
		expect(localStorage.getItem("rezics-theme")).toBe("dark");
	});

	test("supports keyboard tabs and the GameBook choice state", () => {
		const { rerender } = render(
			<ProductDemo
				kind="history"
				productName="History"
				locale="en"
				label="Preview"
				caption="Caption"
			/>,
		);
		const first = screen.getByRole("tab", { name: "Book.title" });
		first.focus();
		fireEvent.keyDown(first, { key: "ArrowRight" });
		expect(screen.getByRole("tab", { name: "Post.block" }).getAttribute("aria-selected")).toBe(
			"true",
		);

		rerender(
			<ProductDemo
				kind="gamebook"
				productName="GameBook"
				locale="en"
				label="Preview"
				caption="Caption"
			/>,
		);
		const choice = screen.getByRole("button", { name: "Choice B · Leave the archive" });
		fireEvent.click(choice);
		expect(choice.getAttribute("aria-pressed")).toBe("true");
		expect(screen.getByText("Ending: Return later")).toBeTruthy();
	});

	test("renders trusted imported MDX with an embedded React component", () => {
		const html = renderToStaticMarkup(<ComponentExample />);
		expect(html).toContain("Trusted MDX content");
		expect(html).toContain('aria-label="Continue"');
	});

	test("reveals immediately for reduced motion", () => {
		Object.defineProperty(window, "matchMedia", {
			configurable: true,
			value: vi.fn().mockReturnValue({ matches: true }),
		});
		function Fixture() {
			useReveal("/test/");
			return <div className="reveal">Content</div>;
		}
		render(<Fixture />);
		expect(screen.getByText("Content").classList.contains("is-visible")).toBe(true);
	});
});
