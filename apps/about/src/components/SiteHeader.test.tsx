import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { getSiteCopy } from "../content/locales";
import { ABOUT_LOCALE_META } from "../i18n/locales";
import { SiteHeader } from "./SiteHeader";

const copy = getSiteCopy("en");
const links = [
	{ id: "home" as const, label: copy.nav.home, href: "/en/" },
	{ id: "how" as const, label: copy.nav.how, href: "/en/how-it-works/" },
	{ id: "uses" as const, label: copy.nav.uses, href: "/en/uses/" },
	{ id: "products" as const, label: copy.nav.products, href: "/en/products/" },
];
const alternatePaths = [
	{ locale: "zh-hant" as const, path: "/zh-hant/" },
	{ locale: "zh-hans" as const, path: "/zh-hans/" },
	{ locale: "en" as const, path: "/en/" },
	{ locale: "ja" as const, path: "/ja/" },
	{ locale: "de" as const, path: "/de/" },
	{ locale: "ko" as const, path: "/ko/" },
];

afterEach(() => {
	document.documentElement.classList.remove("dark");
	document.body.className = "";
	window.localStorage.clear();
});

describe("SiteHeader", () => {
	test("exposes the four navigation destinations and the app entry", () => {
		render(
			<SiteHeader
				active="home"
				alternatePaths={alternatePaths}
				appUrl="https://www.rezics.com/"
				copy={{ nav: copy.nav, theme: copy.theme, a11y: copy.a11y }}
				links={links}
				locale="en"
			/>,
		);

		expect(screen.getByRole("link", { name: copy.a11y.home })).toHaveAttribute("href", "/en/");
		const appEntry = screen.getByRole("link", { name: copy.nav.enter });
		expect(appEntry).toHaveAttribute("href", "https://www.rezics.com/");
		expect(appEntry).toHaveClass("text-white!");
		expect(screen.getByRole("link", { name: copy.nav.home })).toHaveAttribute(
			"aria-current",
			"page",
		);
	});

	test("uses custom language selects with an icon-only desktop trigger", () => {
		const { container } = render(
			<SiteHeader
				active="home"
				alternatePaths={alternatePaths}
				appUrl="https://www.rezics.com/"
				copy={{ nav: copy.nav, theme: copy.theme, a11y: copy.a11y }}
				links={links}
				locale="en"
			/>,
		);

		const languageTriggers = container.querySelectorAll('[data-slot="select-trigger"]');
		expect(languageTriggers).toHaveLength(2);
		expect(languageTriggers[0]).toHaveAccessibleName(copy.nav.language);
		expect(languageTriggers[0]).toHaveClass("justify-center", "gap-0!");
		expect(languageTriggers[0]).toHaveTextContent(/^$/);
		expect(languageTriggers[1]).toHaveTextContent(ABOUT_LOCALE_META.en.nativeName);
		expect(
			container.querySelector('[data-slot="native-select-wrapper"]'),
		).not.toBeInTheDocument();
	});

	test("opens the mobile navigation and changes the visible label", () => {
		render(
			<SiteHeader
				active="uses"
				alternatePaths={alternatePaths}
				appUrl="https://www.rezics.com/"
				copy={{ nav: copy.nav, theme: copy.theme, a11y: copy.a11y }}
				links={links}
				locale="en"
			/>,
		);

		const button = screen.getByRole("button", { name: copy.nav.openMenu });
		fireEvent.click(button);

		expect(screen.getByRole("button", { name: copy.nav.closeMenu })).toHaveAttribute(
			"aria-expanded",
			"true",
		);
		expect(document.body).toHaveClass("menu-open");
	});

	test("persists a deliberate theme change", () => {
		render(
			<SiteHeader
				active="home"
				alternatePaths={alternatePaths}
				appUrl="https://www.rezics.com/"
				copy={{ nav: copy.nav, theme: copy.theme, a11y: copy.a11y }}
				links={links}
				locale="en"
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: copy.theme.toggle }));

		expect(document.documentElement).toHaveClass("dark");
		expect(window.localStorage.getItem("rezics-theme")).toBe("dark");
	});
});
