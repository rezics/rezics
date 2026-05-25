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
import { useUnitCandidates } from "../hooks/useUnitCandidates";
import type { Candidate } from "../models/types";
import {
  resolveUnitWorkContext,
  type UnitWorkContext,
} from "../models/unitCardSummary";
import { UnitCandidateRow } from "./UnitPicker/UnitCandidateRow";
import { useMessage } from "@rezics/i18n/react";
import {
  unit_picker_add,
  unit_picker_add_item,
  unit_picker_browse_named_work,
  unit_picker_browse_panel,
  unit_picker_no_search_results,
  unit_picker_no_sub_units,
  unit_picker_parse_error,
  unit_picker_search_label,
  unit_picker_search_placeholder,
  unit_picker_search_tab,
  unit_picker_url_label,
  unit_picker_url_placeholder,
  unit_picker_url_tab,
} from "@rezics/i18n/messages";
const m = {
  unit_picker_add,
  unit_picker_add_item,
  unit_picker_browse_named_work,
  unit_picker_browse_panel,
  unit_picker_no_search_results,
  unit_picker_no_sub_units,
  unit_picker_parse_error,
  unit_picker_search_label,
  unit_picker_search_placeholder,
  unit_picker_search_tab,
  unit_picker_url_label,
  unit_picker_url_placeholder,
  unit_picker_url_tab,
};

const i18nMessages = {
  unit_picker_add,
  unit_picker_add_item,
  unit_picker_browse_named_work,
  unit_picker_browse_panel,
  unit_picker_no_search_results,
  unit_picker_no_sub_units,
  unit_picker_parse_error,
  unit_picker_search_label,
  unit_picker_search_placeholder,
  unit_picker_search_tab,
  unit_picker_url_label,
  unit_picker_url_placeholder,
  unit_picker_url_tab,
};

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
  const m = useMessage(i18nMessages);
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
        {actionLabel ?? m.unit_picker_add()}
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
          {m.unit_picker_add_item()}
        </h3>
      </div>

      <Tabs defaultValue="search" className="w-full">
        <TabsList>
          <TabsTrigger value="search" className="gap-1.5">
            <Search className="h-4 w-4" />
            {m.unit_picker_search_tab()}
          </TabsTrigger>
          <TabsTrigger value="url" className="gap-1.5">
            <LinkIcon className="h-4 w-4" />
            {m.unit_picker_url_tab()}
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
  const m = useMessage(i18nMessages);
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
        <Label htmlFor={inputId}>{m.unit_picker_search_label()}</Label>
        <Input
          id={inputId}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={m.unit_picker_search_placeholder()}
        />
      </div>

      {isLoading && trimmedQuery ? <Spinner size="sm" /> : null}
      {error ? (
        <p className="text-xs leading-dense text-error-text">{String(error)}</p>
      ) : null}
      {!isLoading && trimmedQuery && units.length === 0 ? (
        <p className="text-xs leading-dense text-text-secondary">
          {m.unit_picker_no_search_results()}
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
  const m = useMessage(i18nMessages);
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
        <Label htmlFor={inputId}>{m.unit_picker_url_label()}</Label>
        <Input
          id={inputId}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={m.unit_picker_url_placeholder()}
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
          {m.unit_picker_parse_error()}
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
  const m = useMessage(i18nMessages);
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
            ? m.unit_picker_browse_named_work({ title: context.title })
            : m.unit_picker_browse_panel()}
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
              {m.unit_picker_no_sub_units()}
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
