import { useTranslation } from "@rezics/i18n/react";
import { createFileRoute } from "@tanstack/react-router";

function ZoneListRoute() {
  const { t } = useTranslation(["page"]);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 px-4 py-8">
      <h1 className="text-2xl font-semibold leading-ui text-text-primary">
        Zones
      </h1>
      <p className="text-sm leading-body text-text-secondary">
        {t("page:home_sections_library_cards_coming_soon")}
      </p>
    </div>
  );
}

export const Route = createFileRoute("/_mainLayout/z/")({
  component: ZoneListRoute,
});
