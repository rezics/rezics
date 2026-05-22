import { unitQueries } from "@rezics/api/unit/unit.queries";
import type { UnitDTO } from "@rezics/contract";
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
import { ChevronDown, Link as LinkIcon, Search } from "lucide-react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";
import { useTranslation } from "@rezics/i18n/react";
import { useUnitCandidates } from "../hooks/useUnitCandidates";
import {
  resolveUnitWorkContext,
  type UnitWorkContext,
} from "../models/unitCardSummary";
import type { Candidate } from "../models/types";
import { UnitCandidateRow } from "./UnitPicker/UnitCandidateRow";

export interface UnitAddPickerProps {
  language?: string;
  initialSearchQuery?: string;
  initialUrlInput?: string;
  workContextUnitId?: string;
  workContextTitle?: string;
  actionLabel?: string;
  onSelectCandidate?: (candidate: Candidate) => void;
  renderItemAction?: (candidate: Candidate) => ReactNode;
}

export function UnitAddPicker({
  language,
  initialSearchQuery,
  initialUrlInput,
  workContextUnitId,
  workContextTitle,
  actionLabel,
  onSelectCandidate,
  renderItemAction,
}: UnitAddPickerProps) {
  const { t } = useTranslation();
  const explicitContext = useMemo(
    () =>
      workContextUnitId
        ? { unitId: workContextUnitId, title: workContextTitle }
        : undefined,
    [workContextUnitId, workContextTitle],
  );
  const [workContext, setWorkContext] = useState<UnitWorkContext | undefined>(
    explicitContext,
  );

  useEffect(() => {
    if (explicitContext) setWorkContext(explicitContext);
  }, [explicitContext]);

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
        {actionLabel ?? t("unit_picker.add", "Add")}
      </Button>
    );
  };

  const handlePreview = useCallback((candidate: Candidate, unit?: UnitDTO) => {
    const next = resolveUnitWorkContext(candidate, unit);
    if (!next) return;
    setWorkContext((current) =>
      current?.unitId === next.unitId && current.title === next.title
        ? current
        : next,
    );
  }, []);

  return (
    <section className="flex flex-col gap-3 border-b border-border-whisper pb-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-medium leading-ui text-text-primary">
          {t("unit_picker.add_item", "Add item")}
        </h3>
      </div>

      <Tabs defaultValue="search" className="w-full">
        <TabsList>
          <TabsTrigger value="search" className="gap-1.5">
            <Search className="h-4 w-4" />
            {t("unit_picker.search_tab", "Search")}
          </TabsTrigger>
          <TabsTrigger value="url" className="gap-1.5">
            <LinkIcon className="h-4 w-4" />
            {t("unit_picker.url_tab", "URL")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="search" className="pt-3">
          <UnitSearchSelect
            language={language}
            initialQuery={initialSearchQuery}
            actionForCandidate={renderAction}
            onPreview={handlePreview}
          />
        </TabsContent>
        <TabsContent value="url" className="pt-3">
          <UnitUrlImport
            language={language}
            initialInput={initialUrlInput}
            actionForCandidate={renderAction}
            onPreview={handlePreview}
          />
        </TabsContent>
      </Tabs>

      {workContext ? (
        <UnitBrowseRelated
          context={workContext}
          language={language}
          actionForCandidate={renderAction}
          onPreview={handlePreview}
        />
      ) : null}
    </section>
  );
}

interface SourceProps {
  language?: string;
  actionForCandidate: (candidate: Candidate) => ReactNode;
  onPreview: (candidate: Candidate, unit?: UnitDTO) => void;
}

interface UnitSearchSelectProps extends SourceProps {
  initialQuery?: string;
}

export function UnitSearchSelect({
  language,
  initialQuery,
  actionForCandidate,
  onPreview,
}: UnitSearchSelectProps) {
  const { t } = useTranslation();
  const inputId = useId();
  const [query, setQuery] = useState(initialQuery ?? "");
  const trimmedQuery = query.trim();
  const { data, isLoading, error } = useQuery(
    unitQueries.search(trimmedQuery, { limit: 8 }),
  );
  const units = (data?.units ?? []) as UnitDTO[];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1">
        <Label htmlFor={inputId}>
          {t("unit_picker.search_label", "Search content")}
        </Label>
        <Input
          id={inputId}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("unit_picker.search_placeholder", "Title or keyword")}
        />
      </div>

      {isLoading && trimmedQuery ? <Spinner size="sm" /> : null}
      {error ? (
        <p className="text-xs leading-dense text-error-text">{String(error)}</p>
      ) : null}
      {!isLoading && trimmedQuery && units.length === 0 ? (
        <p className="text-xs leading-dense text-text-secondary">
          {t("unit_picker.no_search_results", "No matching units.")}
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
                onPreview={onPreview}
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
  onPreview,
}: UnitUrlImportProps) {
  const { t } = useTranslation();
  const inputId = useId();
  const [input, setInput] = useState(initialInput ?? "");
  const { resolved, parseError } = useUnitCandidates(input);

  useEffect(() => {
    for (const item of resolved) {
      if (!item.unit) continue;
      const context = resolveUnitWorkContext(item.candidate, item.unit);
      if (context) {
        onPreview(item.candidate, item.unit);
        return;
      }
    }
  }, [onPreview, resolved]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1">
        <Label htmlFor={inputId}>
          {t("unit_picker.url_label", "Unit URL")}
        </Label>
        <Input
          id={inputId}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={t(
            "unit_picker.url_placeholder",
            "Paste a unit, chapter, or book URL",
          )}
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
              onPreview={onPreview}
            />
          ))}
        </ul>
      ) : null}

      {parseError ? (
        <p className="text-xs leading-dense text-text-secondary">
          {t(
            "unit_picker.parse_error",
            "Couldn't recognize that as a unit link.",
          )}
        </p>
      ) : null}
    </div>
  );
}

interface UnitBrowseRelatedProps extends SourceProps {
  context: UnitWorkContext;
}

export function UnitBrowseRelated({
  context,
  language,
  actionForCandidate,
  onPreview,
}: UnitBrowseRelatedProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);
  const { data, isLoading, error } = useQuery({
    ...unitQueries.list({ workUnitId: context.unitId, limit: 100 }),
    enabled: expanded,
  });
  const units = (data?.units ?? []) as UnitDTO[];

  return (
    <div className="border-t border-border-whisper pt-3">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center gap-2 text-left text-sm leading-ui text-text-primary hover:text-text-brand"
        aria-expanded={expanded}
      >
        <ChevronDown
          className={
            "h-4 w-4 transition-transform " +
            (expanded ? "rotate-180" : "rotate-0")
          }
        />
        <span className="min-w-0 truncate">
          {context.title
            ? t("unit_picker.browse_named_work", "Browse {{title}}", {
                title: context.title,
              })
            : t("unit_picker.browse_panel", "Browse this work")}
        </span>
      </button>

      {expanded ? (
        <div className="pt-2">
          {isLoading ? <Spinner size="sm" /> : null}
          {error ? (
            <p className="text-xs leading-dense text-error-text">
              {String(error)}
            </p>
          ) : null}
          {!isLoading && !error && units.length === 0 ? (
            <p className="text-xs leading-dense text-text-secondary">
              {t("unit_picker.no_sub_units", "No sub-units")}
            </p>
          ) : null}
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
                  onPreview={onPreview}
                />
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
