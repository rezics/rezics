import type { EntityDTO } from "@rezics/contract";
import { BadgeCheck } from "lucide-react";
import {
  getEntityLanguages,
  getEntityPrimaryTitle,
  getEntityTranslation,
} from "../models/types";

interface EntityHeroProps {
  entity: EntityDTO;
  language: string;
  onLanguageChange: (language: string) => void;
}

export function EntityHero({
  entity,
  language,
  onLanguageChange,
}: EntityHeroProps) {
  const title = getEntityPrimaryTitle(entity, language);
  const tr = getEntityTranslation(entity, language);
  const languages = getEntityLanguages(entity);

  return (
    <header className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-semibold text-text-primary">{title}</h1>
        {entity.kind ? (
          <span className="rounded-full border border-border-whisper bg-surface-subtle px-2 py-0.5 text-xs uppercase tracking-wide text-text-secondary">
            {entity.kind}
          </span>
        ) : null}
        {entity.verified ? (
          <BadgeCheck
            className="h-5 w-5 text-text-brand"
            aria-label="Verified entity"
          />
        ) : null}
      </div>
      {tr?.subtitle ? (
        <p className="text-base text-text-secondary">{tr.subtitle}</p>
      ) : null}
      {languages.length >= 2 ? (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {languages.map((lang) => {
            const active = lang === language;
            return (
              <button
                key={lang}
                type="button"
                onClick={() => onLanguageChange(lang)}
                className={
                  active
                    ? "rounded-full bg-brand-fill px-2.5 py-0.5 text-xs font-medium text-text-on-brand"
                    : "rounded-full border border-border-whisper px-2.5 py-0.5 text-xs text-text-secondary hover:text-text-primary"
                }
              >
                {lang}
              </button>
            );
          })}
        </div>
      ) : null}
    </header>
  );
}
