import { expect, waitFor, within } from "storybook/test";
import { useGlobals } from "storybook/preview-api";
import type { ComponentProps } from "react";
import preview from "../../.storybook/preview";
import { getSiteCopy } from "../content/locales";
import { ABOUT_LOCALES, isAboutLocale } from "../i18n/locales";
import { SiteHeader } from "./SiteHeader";

const headerArgs = {
	locale: "en",
	active: "home",
	copy: getSiteCopy("en"),
	links: [],
	alternatePaths: [],
	appUrl: "https://www.rezics.com/",
} satisfies ComponentProps<typeof SiteHeader>;
const meta = preview.meta({
	component: SiteHeader,
	tags: ["ai-generated"],
	render: function Render() {
		const [globals] = useGlobals();
		const locale =
			typeof globals.locale === "string" && isAboutLocale(globals.locale) ? globals.locale : "en";
		const copy = getSiteCopy(locale);
		return (
			<>
				<SiteHeader
					locale={locale}
					active="home"
					copy={copy}
					links={[
						{ id: "home", label: copy.nav.home, href: `/${locale}/` },
						{ id: "products", label: copy.nav.products, href: `/${locale}/products/` },
						{ id: "uses", label: copy.nav.uses, href: `/${locale}/uses/` },
					]}
					alternatePaths={ABOUT_LOCALES.map((value) => ({ locale: value, path: `/${value}/` }))}
					appUrl="https://www.rezics.com/"
				/>
				<main id="main-content" className="shell" tabIndex={-1}>
					<h1>{copy.home.title}</h1>
					<p>{copy.home.lead}</p>
				</main>
			</>
		);
	},
});
export default meta;
const base = meta.story({ args: headerArgs });

export const Desktop = base.extend({
	play: async ({ canvas }) => {
		await expect(canvas.getByRole("link", { name: getSiteCopy("en").nav.home })).toHaveAttribute(
			"aria-current",
			"page",
		);
		await expect(canvas.getByRole("link", { name: getSiteCopy("en").nav.enter })).toHaveAttribute(
			"href",
			"https://www.rezics.com/",
		);
	},
});
export const ThemeToggle = base.extend({
	play: async ({ canvas, userEvent }) => {
		const toggle = canvas.getByRole("button", { name: getSiteCopy("en").theme.toggle });
		await userEvent.click(toggle);
		await expect(toggle).toHaveAttribute("aria-pressed", "true");
		await expect(document.documentElement).toHaveClass("dark");
		await expect(localStorage.getItem("rezics-theme")).toBe("dark");
	},
});
export const LanguageMenu = base.extend({
	play: async ({ canvas, canvasElement, userEvent }) => {
		await userEvent.click(canvas.getByRole("combobox", { name: getSiteCopy("en").nav.language }));
		await expect(
			await within(canvasElement.ownerDocument.body).findAllByRole("option"),
		).toHaveLength(6);
		await userEvent.keyboard("{Escape}");
		await waitFor(() =>
			expect(canvas.getByRole("combobox")).toHaveAttribute("aria-expanded", "false"),
		);
	},
});
export const MobileNavigation = base.extend({
	globals: { viewport: { value: "mobile", isRotated: false } },
	play: async ({ canvas, userEvent }) => {
		const copy = getSiteCopy("en");
		await userEvent.click(canvas.getByRole("button", { name: copy.nav.openMenu }));
		await expect(canvas.getByRole("button", { name: copy.nav.closeMenu })).toHaveAttribute(
			"aria-expanded",
			"true",
		);
		await expect(
			canvas.getByRole("navigation", { name: copy.a11y.primaryNavigation }),
		).toBeVisible();
		await expect(document.body).toHaveClass("menu-open");
	},
});
MobileNavigation.test("Close restores scrolling", async ({ canvas, userEvent }) => {
	await userEvent.click(canvas.getByRole("button", { name: getSiteCopy("en").nav.closeMenu }));
	await expect(document.body).not.toHaveClass("menu-open");
});
export const TraditionalChinese = base.extend({ globals: { locale: "zh-hant" } });
export const GermanMobile = base.extend({
	globals: { locale: "de", viewport: { value: "mobile", isRotated: false } },
});
