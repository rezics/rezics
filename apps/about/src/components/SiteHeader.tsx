import {
	Button,
	Logo,
	NativeSelect,
	NativeSelectOption,
	SkipNavLink,
	buttonVariants,
} from "@rezics/ui";
import { Languages, Menu, Moon, Sun, X } from "lucide-react";
import { useEffect, useState, type ChangeEvent } from "react";

import type { PageId, SiteCopy } from "../content/locales";
import { ABOUT_LOCALE_META, type AboutLocale } from "../i18n/locales";
import type { AlternatePath } from "../i18n/productPaths";

type HeaderLink = {
	readonly id: PageId;
	readonly label: string;
	readonly href: string;
};

type Props = {
	readonly locale: AboutLocale;
	readonly active: PageId;
	readonly copy: Pick<SiteCopy, "nav" | "theme" | "a11y">;
	readonly links: readonly HeaderLink[];
	readonly alternatePaths: readonly AlternatePath[];
	readonly appUrl: string;
};

type Theme = "light" | "dark";

function getTheme(): Theme {
	return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function SiteHeader({ locale, active, copy, links, alternatePaths, appUrl }: Props) {
	const [menuOpen, setMenuOpen] = useState(false);
	const [theme, setTheme] = useState<Theme | null>(null);

	useEffect(() => setTheme(getTheme()), []);

	useEffect(() => {
		document.body.classList.toggle("menu-open", menuOpen);
		return () => document.body.classList.remove("menu-open");
	}, [menuOpen]);

	const changeLanguage = (event: ChangeEvent<HTMLSelectElement>) => {
		const selected = alternatePaths.find(
			({ locale: alternateLocale }) => alternateLocale === event.currentTarget.value,
		);
		if (selected) window.location.assign(selected.path);
	};

	const toggleTheme = () => {
		const nextTheme = getTheme() === "dark" ? "light" : "dark";
		document.documentElement.classList.toggle("dark", nextTheme === "dark");
		localStorage.setItem("rezics-theme", nextTheme);
		setTheme(nextTheme);
	};

	return (
		<>
			<SkipNavLink id="main-content">{copy.a11y.skipContent}</SkipNavLink>
			<header className="site-header">
				<div className="shell site-header__inner">
					<a className="site-logo" href={links[0]?.href} aria-label={copy.a11y.home}>
						<Logo alt="" aria-hidden="true" />
					</a>

					<nav className="desktop-nav" aria-label={copy.a11y.primaryNavigation}>
						{links.map((link) => (
							<a
								key={link.id}
								href={link.href}
								aria-current={active === link.id ? "page" : undefined}
							>
								{link.label}
							</a>
						))}
					</nav>

					<div className="header-actions" aria-label={copy.a11y.utilityNavigation}>
						<div className="desktop-tools">
							<label className="language-control">
								<Languages aria-hidden="true" />
								<span className="sr-only">{copy.nav.language}</span>
								<NativeSelect
									aria-label={copy.nav.language}
									value={locale}
									onChange={changeLanguage}
								>
									{alternatePaths.map(({ locale: alternateLocale }) => (
										<NativeSelectOption
											key={alternateLocale}
											value={alternateLocale}
										>
											{ABOUT_LOCALE_META[alternateLocale].nativeName}
										</NativeSelectOption>
									))}
								</NativeSelect>
							</label>
							<Button
								aria-label={copy.theme.toggle}
								aria-pressed={theme === "dark"}
								onClick={toggleTheme}
								size="icon-lg"
								title={theme === "dark" ? copy.theme.dark : copy.theme.light}
								variant="quiet"
							>
								{theme === "dark" ? (
									<Moon aria-hidden="true" />
								) : (
									<Sun aria-hidden="true" />
								)}
							</Button>
							<a
								className={buttonVariants({ variant: "brand", size: "lg" })}
								href={appUrl}
							>
								{copy.nav.enter}
							</a>
						</div>

						<Button
							aria-controls="mobile-navigation"
							aria-expanded={menuOpen}
							aria-label={menuOpen ? copy.nav.closeMenu : copy.nav.openMenu}
							className="mobile-menu-button"
							onClick={() => setMenuOpen((current) => !current)}
							size="icon-lg"
							variant="quiet"
						>
							{menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
						</Button>
					</div>
				</div>

				<div
					className="mobile-navigation"
					data-open={menuOpen ? "true" : "false"}
					id="mobile-navigation"
					hidden={!menuOpen}
				>
					<nav className="shell" aria-label={copy.a11y.primaryNavigation}>
						{links.map((link) => (
							<a
								key={link.id}
								href={link.href}
								aria-current={active === link.id ? "page" : undefined}
							>
								{link.label}
							</a>
						))}
						<div className="mobile-navigation__tools">
							<NativeSelect
								aria-label={copy.nav.language}
								value={locale}
								onChange={changeLanguage}
							>
								{alternatePaths.map(({ locale: alternateLocale }) => (
									<NativeSelectOption
										key={alternateLocale}
										value={alternateLocale}
									>
										{ABOUT_LOCALE_META[alternateLocale].nativeName}
									</NativeSelectOption>
								))}
							</NativeSelect>
							<Button onClick={toggleTheme} variant="outline">
								{theme === "dark" ? copy.theme.dark : copy.theme.light}
							</Button>
						</div>
						<a
							className={buttonVariants({ variant: "brand", size: "xl" })}
							href={appUrl}
						>
							{copy.nav.enter}
						</a>
					</nav>
				</div>
			</header>
		</>
	);
}
