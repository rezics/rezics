import { useDrafts } from "@rezics/api/draft";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import type React from "react";
import { DraftList } from "../components/DraftList";

/**
 * `u/me/drafts` — the unified cross-type draft inbox. Drafts are not part of
 * the dashboard summary aggregate (they change as the user edits), so this
 * page reads them through the dedicated `useDrafts` hook.
 */
export const DraftsPage: React.FC = () => {
  const { t } = useTranslation(["page", "common"]);
  const { data, isLoading, isError } = useDrafts();
  const drafts = data?.drafts ?? [];

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">
          {t("page:drafts_title")}
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          {t("page:drafts_subtitle")}
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-text-secondary">
          <Spinner size="sm" /> {t("common:loading")}
        </div>
      ) : isError ? (
        <p className="text-sm text-error-text">{t("common:error")}</p>
      ) : drafts.length === 0 ? (
        <p className="text-sm text-text-secondary">{t("page:drafts_empty")}</p>
      ) : (
        <DraftList drafts={drafts} />
      )}
    </div>
  );
};
