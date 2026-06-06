import { useDashboardSummary } from "@rezics/api/dashboard";
import { useTranslation } from "@rezics/i18n/react";
import { ArrowRight } from "lucide-react";
import type React from "react";
import {
  ContinueReadingSection,
  RealmsSection,
  ShelvesSection,
} from "@/dashboard";
import { Link } from "@/shared/ui/link";
import { useAuth } from "@/user/pages/useAuth";

/**
 * Signed-in continuation block on the home page. Signed-out (or not-yet-ready)
 * visitors see nothing here and fall through to the discovery sections below.
 *
 * Reuses the dashboard summary hook and the dashboard's `ContinueReadingSection`
 * so continuation logic lives in one place (the dashboard feature) rather than
 * being re-aggregated on home.
 */
export const HomeContinuationSection: React.FC = () => {
  const { t } = useTranslation(["page"]);
  const { readyForApp } = useAuth();
  const { data } = useDashboardSummary({ enabled: readyForApp });

  if (!readyForApp || !data) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold leading-snug">
          {t("page:home_continuation_title")}
        </h2>
        <Link
          to="/u/me/dashboard"
          className="flex items-center gap-1 text-sm text-link hover:underline"
        >
          {t("page:home_view_dashboard")}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <ContinueReadingSection result={data.continueReading} />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <ShelvesSection result={data.shelves} />
        <RealmsSection result={data.realms} />
      </div>
    </section>
  );
};
