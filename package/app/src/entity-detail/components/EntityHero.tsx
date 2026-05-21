import type { EntityDTO } from "@rezics/contract";
import { EntityAvatar, EntityKindBadge, EntityVerifiedIcon } from "@/entity";
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
import { Pencil } from "lucide-react";
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
        <EntityAvatar avatar={entity.avatar} title={title} size="lg" />
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold text-text-primary">{title}</h1>
          <EntityKindBadge kind={entity.kind} />
          <EntityVerifiedIcon verified={entity.verified} />
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
        <Select
          value={language}
          onValueChange={(value) => {
            if (value) onLanguageChange(value);
          }}
        >
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
