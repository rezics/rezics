import { contentDocMarkdownFallback, type EntityDTO } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { getEntityTranslation } from "../models/types";

interface OverviewTabProps {
  entity: EntityDTO;
  language: string;
}

export function OverviewTab({ entity, language }: OverviewTabProps) {
  const { t } = useTranslation(["entity"]);
  const tr = getEntityTranslation(entity, language);
  // Per entity detail page spec: do NOT silently fall back to another language;
  // explicit empty-state for the current language.
  const matched = tr?.language === language ? tr : undefined;
  const summary = matched?.summary?.trim() ?? "";
  const description = contentDocMarkdownFallback(matched?.description).trim();

  if (!summary && !description) {
    return (
      <p className="text-sm text-text-secondary">
        {t("entity:no_overview_available")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3 text-text-primary">
      {summary ? <p className="text-base leading-relaxed">{summary}</p> : null}
      {description ? (
        <p className="whitespace-pre-line text-sm leading-relaxed text-text-secondary">
          {description}
        </p>
      ) : null}
    </div>
  );
}

export function hasOverviewData(entity: EntityDTO, language: string): boolean {
  const tr = getEntityTranslation(entity, language);
  const matched = tr?.language === language ? tr : undefined;
  return Boolean(
    matched?.summary?.trim() ||
      contentDocMarkdownFallback(matched?.description).trim(),
  );
}
