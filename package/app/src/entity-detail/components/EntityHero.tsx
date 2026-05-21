import type { EntityDTO } from "@rezics/contract";
import { Link } from "@rezics/ui/primitive/link/Link.tsx";
import {
  Button,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@rezics/ui/shadcn";
import { BadgeCheck, Pencil } from "lucide-react";
import {
  getEntityLanguages,
  getEntityPrimaryTitle,
  getEntityTranslation,
} from "../models/types";

interface EntityHeroProps {
  entity: EntityDTO;
  language: string;
  onLanguageChange: (language: string) => void;
  canEdit?: boolean;
}

export function EntityHero({
  entity,
  language,
  onLanguageChange,
  canEdit = false,
}: EntityHeroProps) {
  const title = getEntityPrimaryTitle(entity, language);
  const tr = getEntityTranslation(entity, language);
  const languages = getEntityLanguages(entity);

  return (
    <header className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4">
        <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-subtle text-lg font-medium text-text-secondary">
          {entity.avatar ? (
            <img
              src={entity.avatar}
              alt=""
              className="size-full object-cover"
              loading="lazy"
            />
          ) : (
            title.slice(0, 1).toUpperCase()
          )}
        </span>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
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
          {canEdit ? (
            <Link to="/entity/$unitId/edit" params={{ unitId: entity.unitId }}>
              <Button variant="ghost" size="icon" aria-label="Edit entity">
                <Pencil data-icon="icon" />
              </Button>
            </Link>
          ) : null}
        </div>
      </div>
      {tr?.subtitle ? (
        <p className="text-base text-text-secondary">{tr.subtitle}</p>
      ) : null}
      {languages.length >= 2 ? (
        <Select value={language} onValueChange={onLanguageChange}>
          <SelectTrigger className="w-fit min-w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {languages.map((lang) => (
                <SelectItem key={lang} value={lang}>
                  {lang}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      ) : null}
    </header>
  );
}
