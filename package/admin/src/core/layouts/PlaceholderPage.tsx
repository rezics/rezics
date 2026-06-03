import { getI18nRuntime } from "@rezics/i18n/runtime";
import { Construction } from "lucide-react";
import { Page } from "./Page";

/**
 * Shared coming-soon stub for routed-but-unbuilt admin surfaces (the nav entries
 * flagged `placeholder: true`). The route exists and is deep-linkable so the
 * navigation spine is stable; this renders the only copy until the real feature
 * lands. Pass a feature-specific `title`/`description` (already translated) to
 * override the generic coming-soon copy.
 */
export function PlaceholderPage({
  title,
  description,
}: {
  title?: string;
  description?: string;
}) {
  const { t } = getI18nRuntime().i18n;
  return (
    <Page
      title={title ?? t("admin:placeholder_coming_soon_title")}
      description={
        description ?? t("admin:placeholder_coming_soon_description")
      }
    >
      <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border-defined bg-surface-base px-6 py-16 text-center">
        <span className="inline-flex size-10 items-center justify-center rounded-full bg-surface-subtle text-text-tertiary">
          <Construction className="size-5" aria-hidden="true" />
        </span>
        <p className="text-sm font-medium leading-[1.4]">
          {t("admin:placeholder_coming_soon_title")}
        </p>
        <p className="max-w-sm text-sm leading-[1.4] text-text-secondary">
          {t("admin:placeholder_coming_soon_description")}
        </p>
      </div>
    </Page>
  );
}
