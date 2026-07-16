import { ChevronRight, Languages, Menu, Moon, Settings, Sun, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getInterfaceCopy } from "../../content/interfaceCopy";
import type { SiteCopy } from "../../content/productTypes";
import { ABOUT_LOCALE_META, ABOUT_LOCALES, type AboutLocale } from "../../i18n/locales";
import { getHomePath, getProductPath, getProductsPath } from "../../i18n/productPaths";

type Props = {
	locale: AboutLocale;
	copy: SiteCopy;
	active: "home" | "products" | "platform" | "history";
	alternatePathByLocale: Record<AboutLocale, string>;
};

const outlineUrl = "https://outline.rezics.com/collection/rezics-ud1QiRBQYV/recent";
const githubUrl = "https://github.com/rezics";

function readTheme(): "light" | "dark" {
	if (typeof document === "undefined") return "light";
	return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function GlobalHeader({ locale, copy, active, alternatePathByLocale }: Props) {
	const interfaceCopy = getInterfaceCopy(locale);
	const [theme, setTheme] = useState<"light" | "dark" | null>(null);
	const [drawerOpen, setDrawerOpen] = useState(false);
	const toggleRef = useRef<HTMLButtonElement>(null);
	const firstDrawerLinkRef = useRef<HTMLAnchorElement>(null);
	const headerRef = useRef<HTMLElement>(null);
	const links = [
		{ label: copy.nav.products, href: getProductsPath(locale), active: active === "products" },
		{
			label: copy.nav.platform,
			href: getProductsPath(locale) + "#platform",
			active: active === "platform",
		},
		{
			label: copy.nav.history,
			href: getProductPath(locale, "history"),
			active: active === "history",
		},
	];

	useEffect(() => setTheme(readTheme()), []);

	useEffect(() => {
		if (!theme) return;
		document.documentElement.dataset.theme = theme;
		localStorage.setItem("rezics-theme", theme);
	}, [theme]);

	useEffect(() => {
		if (!drawerOpen) return;
		firstDrawerLinkRef.current?.focus();
		const close = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			setDrawerOpen(false);
			toggleRef.current?.focus();
		};
		window.addEventListener("keydown", close);
		return () => window.removeEventListener("keydown", close);
	}, [drawerOpen]);

	useEffect(() => {
		const closeDetails = (event: PointerEvent) => {
			if (headerRef.current?.contains(event.target as Node)) return;
			headerRef.current
				?.querySelectorAll("details[open]")
				.forEach((details) => details.removeAttribute("open"));
		};
		window.addEventListener("pointerdown", closeDetails);
		return () => window.removeEventListener("pointerdown", closeDetails);
	}, []);

	const currentTheme = theme ?? "light";
	const toggleTheme = () =>
		setTheme((value) => ((value ?? readTheme()) === "light" ? "dark" : "light"));
	const ThemeControl = () => (
		<button type="button" onClick={toggleTheme} aria-pressed={currentTheme === "dark"}>
			<span>{currentTheme === "dark" ? copy.theme.dark : copy.theme.light}</span>
			<span>
				{currentTheme === "dark" ? (
					<Moon width={17} height={17} aria-hidden />
				) : (
					<Sun width={17} height={17} aria-hidden />
				)}
			</span>
		</button>
	);

	return (
		<>
			<a className="skip-link" href="#main-content">
				{interfaceCopy.a11y.skipContent}
			</a>
			<header className="global-header" ref={headerRef}>
				<div className="site-container global-header__inner">
					<a className="global-logo" href={getHomePath(locale)} aria-label="Rezics">
						<img src="/logo.svg" width="34" height="24" alt="" />
					</a>
					<nav className="global-nav" aria-label={interfaceCopy.a11y.primaryNavigation}>
						{links.map((link) => (
							<a
								key={link.href}
								href={link.href}
								aria-current={link.active ? "page" : undefined}
							>
								{link.label}
							</a>
						))}
						<a href={outlineUrl} target="_blank" rel="noreferrer">
							{copy.nav.docs}
						</a>
						<a href={githubUrl} target="_blank" rel="noreferrer">
							{copy.nav.github}
						</a>
					</nav>
					<div className="header-tools header-tools--desktop">
						<details className="relative">
							<summary className="header-icon-button" aria-label={copy.nav.language}>
								<Languages width={18} height={18} aria-hidden />
							</summary>
							<div className="header-popover">
								{ABOUT_LOCALES.map((item) => (
									<a
										key={item}
										href={alternatePathByLocale[item]}
										lang={ABOUT_LOCALE_META[item].htmlLang}
										aria-current={item === locale ? "true" : undefined}
									>
										<span>{ABOUT_LOCALE_META[item].nativeName}</span>
										{item === locale && <span aria-hidden>✓</span>}
									</a>
								))}
							</div>
						</details>
						<details className="relative">
							<summary className="header-icon-button" aria-label={copy.nav.theme}>
								<Settings width={18} height={18} aria-hidden />
							</summary>
							<div className="header-popover">
								<ThemeControl />
							</div>
						</details>
					</div>
					<div className="header-tools header-tools--mobile">
						<button
							ref={toggleRef}
							className="header-icon-button"
							type="button"
							aria-expanded={drawerOpen}
							aria-controls="product-mobile-drawer"
							aria-label={drawerOpen ? copy.nav.closeMenu : copy.nav.openMenu}
							onClick={() => setDrawerOpen((value) => !value)}
						>
							{drawerOpen ? (
								<X width={20} height={20} aria-hidden />
							) : (
								<Menu width={20} height={20} aria-hidden />
							)}
						</button>
					</div>
				</div>
				<div id="product-mobile-drawer" className="mobile-drawer" hidden={!drawerOpen}>
					<nav
						className="site-container"
						aria-label={interfaceCopy.a11y.mobileNavigation}
					>
						{links.map((link, index) => (
							<a
								ref={index === 0 ? firstDrawerLinkRef : undefined}
								key={link.href}
								href={link.href}
								aria-current={link.active ? "page" : undefined}
								onClick={() => setDrawerOpen(false)}
							>
								<span>{link.label}</span>
								<ChevronRight width={17} height={17} aria-hidden />
							</a>
						))}
						<a href={outlineUrl} target="_blank" rel="noreferrer">
							<span>{copy.nav.docs}</span>
							<ChevronRight width={17} height={17} aria-hidden />
						</a>
						<a href={githubUrl} target="_blank" rel="noreferrer">
							<span>{copy.nav.github}</span>
							<ChevronRight width={17} height={17} aria-hidden />
						</a>
						<ThemeControl />
						<details>
							<summary>
								<span>{copy.nav.language}</span>
								<Languages width={17} height={17} aria-hidden />
							</summary>
							<div>
								{ABOUT_LOCALES.map((item) => (
									<a
										key={item}
										href={alternatePathByLocale[item]}
										lang={ABOUT_LOCALE_META[item].htmlLang}
										aria-current={item === locale ? "true" : undefined}
									>
										<span>{ABOUT_LOCALE_META[item].nativeName}</span>
									</a>
								))}
							</div>
						</details>
					</nav>
				</div>
			</header>
		</>
	);
}
