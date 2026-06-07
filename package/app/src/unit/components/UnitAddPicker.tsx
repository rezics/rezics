import { unitQueries } from "@rezics/api/unit/unit";
import type { UnitDTO } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import {
  Button,
  Input,
  Label,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { Link as LinkIcon, Search } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";
import { useUnitCandidates } from "../hooks/useUnitCandidates";
import type { Candidate } from "../models/types";
import { UnitCandidateRow } from "./UnitPicker/UnitCandidateRow";

export interface UnitAddPickerProps {
  language?: string;
  initialSearchQuery?: string;
  initialUrlInput?: string;
  actionLabel?: string;
  onSelectCandidate?: (candidate: Candidate) => void;
  renderItemAction?: (candidate: Candidate) => ReactNode;
}

export function UnitAddPicker({
  language,
  initialSearchQuery,
  initialUrlInput,
  actionLabel,
  onSelectCandidate,
  renderItemAction,
}: UnitAddPickerProps) {
  const { t } = useTranslation(["book"]);

  const renderAction = (candidate: Candidate) => {
    if (renderItemAction) return renderItemAction(candidate);
    if (!onSelectCandidate) return null;
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => onSelectCandidate(candidate)}
      >
        {actionLabel ?? t("book:unit_picker_add")}
      </Button>
    );
  };

  return (
    <section className="flex flex-col gap-3 border-b border-border-whisper pb-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-medium leading-ui text-text-primary">
          {t("book:unit_picker_add_item")}
        </h3>
      </div>

      <Tabs defaultValue="search" className="w-full">
        <TabsList>
          <TabsTrigger value="search" className="gap-1.5">
            <Search className="h-4 w-4" />
            {t("book:unit_picker_search_tab")}
          </TabsTrigger>
          <TabsTrigger value="url" className="gap-1.5">
            <LinkIcon className="h-4 w-4" />
            {t("book:unit_picker_url_tab")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="search" className="pt-3">
          <UnitSearchSelect
            language={language}
            initialQuery={initialSearchQuery}
            actionForCandidate={renderAction}
          />
        </TabsContent>
        <TabsContent value="url" className="pt-3">
          <UnitUrlImport
            language={language}
            initialInput={initialUrlInput}
            actionForCandidate={renderAction}
          />
        </TabsContent>
      </Tabs>
    </section>
  );
}

interface SourceProps {
  language?: string;
  actionForCandidate: (candidate: Candidate) => ReactNode;
}

interface UnitSearchSelectProps extends SourceProps {
  initialQuery?: string;
}

export function UnitSearchSelect({
  language,
  initialQuery,
  actionForCandidate,
}: UnitSearchSelectProps) {
  const { t } = useTranslation(["book"]);
  const inputId = useId();
  const [query, setQuery] = useState(initialQuery ?? "");
  const trimmedQuery = query.trim();
  const readContext = useReadLanguageContext();
  const { data, isLoading, error } = useQuery({
    ...unitQueries.search(trimmedQuery, {
      languages: readContext.languages,
      appLocale: readContext.appLocale,
      languageMode: readContext.languageMode,
      limit: 8,
    }),
    enabled: readContext.ready && Boolean(trimmedQuery),
  });
  const units = (data?.units ?? []) as UnitDTO[];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1">
        <Label htmlFor={inputId}>{t("book:unit_picker_search_label")}</Label>
        <Input
          id={inputId}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("book:unit_picker_search_placeholder")}
        />
      </div>

      {isLoading && trimmedQuery ? <Spinner size="sm" /> : null}
      {error ? (
        <p className="text-xs leading-dense text-error-text">{String(error)}</p>
      ) : null}
      {!isLoading && trimmedQuery && units.length === 0 ? (
        <p className="text-xs leading-dense text-text-secondary">
          {t("book:unit_picker_no_search_results")}
        </p>
      ) : null}
      {units.length > 0 ? (
        <ul className="flex flex-col">
          {units.map((unit) => {
            if (!unit.id) return null;
            const candidate: Candidate = {
              kind: unit.type?.toLowerCase() ?? "unit",
              identifier: unit.id,
              identifierType: "id",
              paramName: "unitId",
            };
            return (
              <UnitCandidateRow
                key={unit.id}
                candidate={candidate}
                unit={unit}
                language={language}
                action={actionForCandidate(candidate)}
              />
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

interface UnitUrlImportProps extends SourceProps {
  initialInput?: string;
}

export function UnitUrlImport({
  language,
  initialInput,
  actionForCandidate,
}: UnitUrlImportProps) {
  const { t } = useTranslation(["book"]);
  const inputId = useId();
  const [input, setInput] = useState(initialInput ?? "");
  const { resolved, parseError } = useUnitCandidates(input);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1">
        <Label htmlFor={inputId}>{t("book:unit_picker_url_label")}</Label>
        <Input
          id={inputId}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={t("book:unit_picker_url_placeholder")}
        />
      </div>

      {resolved.length > 0 ? (
        <ul className="flex flex-col">
          {resolved.map((item) => (
            <UnitCandidateRow
              key={`${item.candidate.paramName}:${item.candidate.identifier}`}
              candidate={item.candidate}
              unit={item.unit}
              isLoading={item.isLoading}
              language={language}
              action={actionForCandidate(item.candidate)}
            />
          ))}
        </ul>
      ) : null}

      {parseError ? (
        <p className="text-xs leading-dense text-text-secondary">
          {t("book:unit_picker_parse_error")}
        </p>
      ) : null}
    </div>
  );
}
