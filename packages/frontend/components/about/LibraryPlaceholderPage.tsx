import { AboutShell } from "@/components/about/AboutShell";
import type { LibraryPageCopy } from "@/lib/about/library";
import type { AboutCommonCopy } from "@/lib/about/types";
import type { AboutLibraryPageId, AboutLocale } from "@/lib/about/locales";

export function LibraryPlaceholderPage({
  common,
  copy,
  locale,
  page,
}: {
  common: AboutCommonCopy;
  copy: LibraryPageCopy;
  locale: AboutLocale;
  page: AboutLibraryPageId;
}) {
  return (
    <AboutShell common={common} locale={locale} page={page}>
      <section className="about-hero">
        <div className="about-hero-copy">
          <div>
            <p className="about-eyebrow">{copy.hero.eyebrow}</p>
            <h1>{copy.hero.heading}</h1>
          </div>
        </div>
      </section>
    </AboutShell>
  );
}
