import type { ReactNode } from "react";
import type { AboutCommonCopy } from "@/lib/about/types";
import {
  ABOUT_LOCALE_META,
  ABOUT_LOCALES,
  type AboutLocale,
  type AboutPageId,
  getAppEntryUrl,
  getPagePath,
} from "@/lib/about/locales";

type AboutShellProps = {
  children: ReactNode;
  common: AboutCommonCopy;
  locale: AboutLocale;
  page: AboutPageId;
};

export function AboutShell({
  children,
  common,
  locale,
  page,
}: AboutShellProps) {
  const alternateLinks = ABOUT_LOCALES.map((alternateLocale) => ({
    locale: alternateLocale,
    href: getPagePath(alternateLocale, page),
    meta: ABOUT_LOCALE_META[alternateLocale],
  }));

  return (
    <div className="about-page">
      <header className="about-header">
        <div className="about-header-inner">
          <a className="about-brand" href={getPagePath(locale, "home")}>
            <img alt="" height="28" src="/logo.svg" width="40" />
            <span>REZICS</span>
          </a>
          <nav aria-label="Primary navigation" className="about-nav">
            <a
              aria-current={page === "home" ? "page" : undefined}
              className={page === "home" ? "active" : undefined}
              href={getPagePath(locale, "home")}
            >
              {common.nav.home}
            </a>
            <a
              aria-current={page === "product" ? "page" : undefined}
              className={page === "product" ? "active" : undefined}
              href={getPagePath(locale, "product")}
            >
              {common.nav.product}
            </a>
          </nav>
          <div className="about-actions">
            <a className="about-app-link" href={getAppEntryUrl(locale)}>
              {common.nav.app}
            </a>
            <details className="about-language">
              <summary>{common.nav.language}</summary>
              <div className="about-language-menu">
                {alternateLinks.map((link) => (
                  <a
                    aria-current={link.locale === locale ? "true" : undefined}
                    className={link.locale === locale ? "active" : undefined}
                    href={link.href}
                    key={link.locale}
                    lang={link.meta.htmlLang}
                  >
                    {link.meta.nativeName}
                  </a>
                ))}
              </div>
            </details>
          </div>
        </div>
      </header>
      <main className="about-main">{children}</main>
      <footer className="about-footer">
        <div className="about-footer-inner">
          <p>Rezics</p>
          <p>{common.footer.originNote}</p>
        </div>
      </footer>
    </div>
  );
}
