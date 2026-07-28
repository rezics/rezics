import GithubIcon from "@rezics/icons/components/brand/GithubIcon";
import { Logo } from "@rezics/ui/custom/logo";
import { Languages, Moon, Sun, SunMoon } from "lucide-react";
import { useEffect, useState } from "react";

import type { LocaleContent } from "../../content/locales";
import { ABOUT_LOCALES, ABOUT_LOCALE_META, type AboutLocale } from "../../i18n/locales";
import { getHomePath, getProductsPath } from "../../i18n/productPaths";

type ColorTheme = "light" | "dark";

type GlobalHeaderProps = {
	readonly locale: AboutLocale;
	readonly copy: LocaleContent["common"];
	readonly active?: "home" | "products";
	readonly alternatePathByLocale: Record<AboutLocale, string>;
};

const githubUrl = "https://github.com/rezics";

function readTheme(): ColorTheme {
	if (typeof document === "undefined") return "light";
	return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function GlobalHeader({ locale, copy, active, alternatePathByLocale }: GlobalHeaderProps) {
	const [theme, setTheme] = useState<ColorTheme | null>(null);
	const links = [
		{
			label: copy.nav.home,
			href: getHomePath(locale),
			active: active === "home",
		},
		{
			label: copy.nav.products,
			href: getProductsPath(locale),
			active: active === "products",
		},
	] as const;

	useEffect(() => setTheme(readTheme()), []);

	useEffect(() => {
		if (!theme) return;
		document.documentElement.classList.toggle("dark", theme === "dark");
		localStorage.setItem("rezics-theme", theme);
	}, [theme]);

	const toggleTheme = () =>
		setTheme((current) => ((current ?? readTheme()) === "dark" ? "light" : "dark"));

	return (
		<>
			<a className="skip-link" href="#main-content">
				{copy.a11y.skipContent}
			</a>
			<header className="global-header">
				<div className="wide-shell global-header__inner">
					<a
						className="global-logo"
						href={getHomePath(locale)}
						aria-label={copy.a11y.home}
					>
						<Logo alt="" aria-hidden="true" />
					</a>

					<nav className="global-nav" aria-label={copy.a11y.primaryNavigation}>
						{links.map((link) => (
							<a
								key={link.href}
								href={link.href}
								aria-current={link.active ? "page" : undefined}
							>
								{link.label}
							</a>
						))}
					</nav>

					<nav className="header-tools" aria-label={copy.a11y.utilityNavigation}>
						<a
							className="header-icon-button"
							href={githubUrl}
							target="_blank"
							rel="noreferrer"
							aria-label={copy.nav.github}
						>
							<GithubIcon aria-hidden />
						</a>
						<details className="language-switcher">
							<summary className="header-icon-button" aria-label={copy.nav.language}>
								<Languages aria-hidden size={18} />
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
										{item === locale ? <span aria-hidden>✓</span> : null}
									</a>
								))}
							</div>
						</details>
						<button
							className="header-icon-button"
							type="button"
							onClick={toggleTheme}
							aria-label={copy.theme.toggle}
							aria-pressed={theme === "dark"}
							title={theme === "dark" ? copy.theme.dark : copy.theme.light}
						>
							{theme === null ? (
								<SunMoon aria-hidden size={18} />
							) : theme === "dark" ? (
								<Moon aria-hidden size={18} />
							) : (
								<Sun aria-hidden size={18} />
							)}
						</button>
					</nav>
				</div>
			</header>
		</>
	);
}
