import { historyQueries } from "@rezics/contract/api";
import type {
  HistoryActorResolution,
  StructureEventDTO,
  UnitRevisionDTO,
} from "@rezics/contract";
import { getI18nRuntime } from "@rezics/i18n/runtime";
import { useQuery } from "@tanstack/react-query";
import {
  Link,
  useNavigate,
  useParams,
  useSearch,
} from "@tanstack/react-router";
import {
  ArrowLeftRight,
  CheckCircle2,
  ChevronDown,
  History,
  RotateCcw,
} from "lucide-react";
import { useMemo, useState } from "react";
import { QueryErrorDisplay } from "@/core";
import { editorialPathLabel, slotLabel } from "@/unit";
import {
  compareRevisionPathSnapshots,
  type DiffPart,
  type HistoryFieldChange,
  resolveRevisionComparePair,
} from "../models/historyCompare";

type HistoryTab = "editorial" | "structure";

type MarkdownDiffRow = {
  content: string;
  newLineNumber?: number;
  oldLineNumber?: number;
  type: DiffPart["type"];
};

/**
 * Book History Page - Editorial and structure revision timeline.
 * 图书历史页面——编辑和结构修订时间线。
 *
 * Displays tabbed view of editorial revisions and structure events,
 * with diff compare and restore functionality.
 *
 * Mobile <640px:
 * +------------------+
 * | Header + Tabs    |
 * +------------------+
 * | Timeline entries |
 * | (stacked, full)  |
 * +------------------+
 *
 * Tablet 640-1023px:
 * +------------------+
 * | Header + Tabs    |
 * +------------------+
 * | Timeline entries |
 * | (stacked, wider) |
 * +------------------+
 *
 * Desktop 1024-1535px:
 * +------------------+
 * | Header + Tabs    |
 * +------------------+
 * | Timeline entries |
 * | (columns: auto)  |
 * +------------------+
 *
 * Ultra-wide >=1536px:
 * +------------------+
 * | Header + Tabs    |
 * +------------------+
 * | Timeline entries |
 * | (columns: auto)  |
 * +------------------+
 */
export function BookHistoryPage() {
  const { bookId } = useParams({ strict: false }) as { bookId: string };
  const [tab, setTab] = useState<HistoryTab>("editorial");
  const [restoreSequence, setRestoreSequence] = useState<number | null>(null);
  const revisionsQuery = useQuery({
    ...historyQueries.unitRevisionTimeline(bookId, { limit: 30 }),
    enabled: Boolean(bookId),
  });
  const structureQuery = useQuery({
    ...historyQueries.structureEventTimeline(bookId, {
      eventType: "contentStructure.content.batch",
      includePayload: true,
      limit: 30,
    }),
    enabled: Boolean(bookId),
  });
  const actorIds = useMemo(
    () =>
      unique([
        ...(revisionsQuery.data?.revisions ?? []).map(
          (revision) => revision.actorUserId,
        ),
        ...(structureQuery.data?.events ?? []).map(
          (event) => event.actorUserId,
        ),
      ]),
    [revisionsQuery.data?.revisions, structureQuery.data?.events],
  );
  const actorsQuery = useQuery(historyQueries.actorResolution(actorIds));
  const actors = actorsQuery.data?.actors ?? {};

  if (revisionsQuery.isLoading) {
    return (
      <p className="text-sm leading-ui text-text-secondary">
        {getI18nRuntime().i18n.t("common:loading")}
      </p>
    );
  }

  if (revisionsQuery.error) {
    return <QueryErrorDisplay error={revisionsQuery.error} />;
  }

  const revisions = revisionsQuery.data?.revisions ?? [];
  const structureEvents = structureQuery.data?.events ?? [];

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-text-secondary">
          <History className="h-4 w-4" aria-hidden="true" />
          <h2 className="text-sm font-medium leading-ui">
            {getI18nRuntime().i18n.t("search:history_title")}
          </h2>
        </div>
        <div className="flex flex-wrap gap-2" role="tablist">
          <HistoryTabButton
            active={tab === "editorial"}
            onClick={() => setTab("editorial")}
          >
            {getI18nRuntime().i18n.t("search:history_tabs_editorial")}
          </HistoryTabButton>
          <HistoryTabButton
            active={tab === "structure"}
            onClick={() => setTab("structure")}
          >
            {getI18nRuntime().i18n.t("search:history_tabs_structure")}
          </HistoryTabButton>
        </div>
      </header>

      {tab === "editorial" ? (
        <RevisionTimeline
          bookId={bookId}
          revisions={revisions}
          actors={actors}
          onRestore={setRestoreSequence}
        />
      ) : null}
      {tab === "structure" && structureQuery.isLoading ? (
        <p className="text-sm leading-ui text-text-secondary">
          {getI18nRuntime().i18n.t("common:loading")}
        </p>
      ) : null}
      {tab === "structure" && structureQuery.error ? (
        <QueryErrorDisplay error={structureQuery.error} />
      ) : null}
      {tab === "structure" &&
      !structureQuery.isLoading &&
      !structureQuery.error ? (
        <StructureTimeline events={structureEvents} actors={actors} />
      ) : null}

      {restoreSequence !== null ? (
        <section className="grid gap-3 rounded-md bg-surface-subtle p-4">
          <div className="flex items-center gap-2 text-sm font-medium leading-ui text-text-primary">
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            {getI18nRuntime().i18n.t("search:history_restore_title", {
              sequence: restoreSequence,
            })}
          </div>
          <p className="text-sm leading-ui text-text-secondary">
            {getI18nRuntime().i18n.t("search:history_restore_description")}
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/book/$bookId/edit"
              params={{ bookId }}
              search={{ restoreRevision: String(restoreSequence) }}
              className="rounded-md bg-brand-fill px-3 py-2 text-sm leading-ui text-text-on-brand"
            >
              {getI18nRuntime().i18n.t("search:history_restore_open_draft")}
            </Link>
            <button
              type="button"
              className="rounded-md px-3 py-2 text-sm leading-ui text-text-secondary hover:bg-surface-base"
              onClick={() => setRestoreSequence(null)}
            >
              {getI18nRuntime().i18n.t("common:cancel")}
            </button>
          </div>
        </section>
      ) : null}
    </section>
  );
}

export function BookEditHistoryPage() {
  return (
    <main className="w-full mx-auto mt-16 max-w-5xl px-4 pb-16">
      <BookHistoryPage />
    </main>
  );
}

export function BookEditHistoryTimelinePage() {
  return <BookHistoryPage />;
}

function HistoryTabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={
        active
          ? "rounded-md bg-brand-fill px-3 py-2 text-sm leading-ui text-text-on-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          : "rounded-md px-3 py-2 text-sm leading-ui text-text-secondary hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      }
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function RevisionTimeline({
  actors,
  bookId,
  onRestore,
  revisions,
}: {
  actors: Record<string, HistoryActorResolution>;
  bookId: string;
  onRestore: (sequence: number) => void;
  revisions: UnitRevisionDTO[];
}) {
  if (revisions.length === 0) {
    return <EmptyHistoryState />;
  }
  const revisionSequences = [
    ...new Set(revisions.map((revision) => revision.sequence)),
  ]
    .filter(Number.isFinite)
    .sort((a, b) => b - a);

  return (
    <ol className="flex flex-col divide-y divide-border-whisper">
      {revisions.map((revision) => {
        const comparePair = resolveRevisionComparePair(
          revisionSequences,
          revision.sequence,
        );
        return (
          <li key={revision.id} className="grid gap-3 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <Link
                  to="/book/$bookId/edit/history/$sequence"
                  params={{ bookId, sequence: String(revision.sequence) }}
                  className="text-sm font-medium leading-ui text-text-primary hover:text-link"
                >
                  {getI18nRuntime().i18n.t("search:history_revision_title", {
                    sequence: revision.sequence,
                  })}
                </Link>
                <p className="mt-1 text-sm leading-ui text-text-secondary">
                  {revision.message ??
                    getI18nRuntime().i18n.t(
                      "search:history_revision_default_message",
                    )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {comparePair ? (
                  <Link
                    to="/book/$bookId/edit/history/compare/$targetSequence"
                    params={{
                      bookId,
                      targetSequence: String(comparePair.targetSequence),
                    }}
                    search={
                      {
                        base: String(comparePair.baseSequence),
                        mode: "unified",
                      } as never
                    }
                    aria-label={getI18nRuntime().i18n.t(
                      "search:history_revision_compare_label",
                      {
                        base: comparePair.baseSequence,
                        target: comparePair.targetSequence,
                      },
                    )}
                    className="rounded-md p-2 text-text-secondary hover:bg-surface-subtle hover:text-text-primary"
                  >
                    <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                ) : (
                  <button
                    type="button"
                    aria-label={getI18nRuntime().i18n.t(
                      "search:history_revision_compare_unavailable",
                    )}
                    className="rounded-md p-2 text-text-disabled"
                    disabled
                  >
                    <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
                <button
                  type="button"
                  aria-label={getI18nRuntime().i18n.t(
                    "search:history_revision_restore_label",
                    {
                      sequence: revision.sequence,
                    },
                  )}
                  className="rounded-md p-2 text-text-secondary hover:bg-surface-subtle hover:text-text-primary"
                  onClick={() => onRestore(revision.sequence)}
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
            <FieldChips keys={revision.changedFieldKeys} />
            <p className="text-xs leading-dense text-text-tertiary">
              {formatDate(revision.createdAt)} ·{" "}
              {actorLabel(actors[revision.actorUserId], revision.actorUserId)}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

export function StructureTimeline({
  actors,
  events,
}: {
  actors: Record<string, HistoryActorResolution>;
  events: StructureEventDTO[];
}) {
  if (events.length === 0) {
    return (
      <EmptyHistoryState
        label={getI18nRuntime().i18n.t("search:history_empty_structure")}
      />
    );
  }
  return (
    <ol className="flex flex-col divide-y divide-border-whisper">
      {events.map((event) => {
        const operations = Array.isArray(event.payload?.operations)
          ? event.payload.operations
          : [];
        return (
          <li key={event.id} className="grid gap-3 py-4">
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                <span className="text-sm font-medium leading-ui text-text-primary">
                  {getI18nRuntime().i18n.t("search:history_structure_title", {
                    sequence: event.sequence,
                  })}
                </span>
                <span className="flex items-center gap-2 text-xs leading-dense text-text-secondary">
                  {getI18nRuntime().i18n.t(
                    "search:history_structure_operation_count",
                    {
                      count: operations.length,
                    },
                  )}
                  <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
                </span>
              </summary>
              <ol className="mt-3 grid gap-2">
                {operations.map((operation) => (
                  <li
                    key={`${event.id}-${stableHistoryKey(operation)}`}
                    className="rounded-md bg-surface-subtle p-3 text-sm leading-ui text-text-primary"
                  >
                    <span className="font-mono text-xs leading-dense text-text-tertiary">
                      {String(operation.op)}
                    </span>
                    <RevisionPayloadValue value={operation} />
                  </li>
                ))}
              </ol>
            </details>
            <p className="text-xs leading-dense text-text-tertiary">
              {formatDate(event.createdAt)} ·{" "}
              {actorLabel(actors[event.actorUserId], event.actorUserId)}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

export function BookRevisionPage() {
  const { bookId, sequence } = useParams({ strict: false }) as {
    bookId: string;
    sequence: string;
  };
  const parsedSequence = Number(sequence);
  const { data, isLoading, error } = useQuery({
    ...historyQueries.unitRevision(bookId, parsedSequence, {
      includeContent: true,
    }),
    enabled: Boolean(bookId) && Number.isFinite(parsedSequence),
  });
  const revision = data?.revision;
  const payload = revision?.content?.payload ?? {};
  const actorIds = useMemo(
    () => (revision?.actorUserId ? [revision.actorUserId] : []),
    [revision?.actorUserId],
  );
  const actorsQuery = useQuery(historyQueries.actorResolution(actorIds));
  const actors = actorsQuery.data?.actors ?? {};
  const referencedUnitIds = useMemo(
    () => extractUuidStrings(payload).slice(0, 40),
    [payload],
  );
  const referencesQuery = useQuery(
    historyQueries.unitReferenceResolution(referencedUnitIds),
  );
  const references = referencesQuery.data?.units ?? {};

  if (isLoading) {
    return (
      <p className="text-sm leading-ui text-text-secondary">
        {getI18nRuntime().i18n.t("common:loading")}
      </p>
    );
  }
  if (error) return <QueryErrorDisplay error={error} />;
  if (!revision) {
    return (
      <p className="text-sm leading-ui text-text-secondary">
        {getI18nRuntime().i18n.t("search:history_revision_not_found")}
      </p>
    );
  }

  return (
    <section className="grid gap-6">
      <Link
        to="/book/$bookId/edit/history"
        params={{ bookId }}
        className="inline-flex w-fit items-center text-sm leading-ui text-text-secondary hover:text-text-primary"
      >
        {getI18nRuntime().i18n.t("search:history_back_to_edit_history")}
      </Link>
      <header className="grid gap-2">
        <h2 className="text-lg font-medium leading-ui text-text-primary">
          {getI18nRuntime().i18n.t("search:history_revision_title", {
            sequence: revision.sequence,
          })}
        </h2>
        <p className="text-sm leading-ui text-text-secondary">
          {formatDate(revision.createdAt)} ·{" "}
          {actorLabel(actors[revision.actorUserId], revision.actorUserId)}
        </p>
        <FieldChips keys={revision.changedFieldKeys} />
      </header>
      <RevisionSections payload={payload} references={references} />
    </section>
  );
}

export function BookRevisionComparePage() {
  const { bookId, targetSequence } = useParams({ strict: false }) as {
    bookId: string;
    targetSequence: string;
  };
  const search = useSearch({ strict: false }) as {
    base?: string;
    mode?: "split" | "unified";
  };
  const navigate = useNavigate();
  const target = Number(targetSequence);
  const baseFromSearch = Number(search.base);
  const base = Number.isFinite(baseFromSearch)
    ? baseFromSearch
    : Math.max(1, target - 1);
  const mode = search.mode === "split" ? "split" : "unified";
  const revisionsQuery = useQuery({
    ...historyQueries.unitRevisionTimeline(bookId, { limit: 100 }),
    enabled: Boolean(bookId),
  });
  const { data, isLoading, error } = useQuery({
    ...historyQueries.revisionCompareInput(bookId, base, target),
    enabled:
      Boolean(bookId) && Number.isFinite(base) && Number.isFinite(target),
  });
  const comparison = useMemo(() => {
    const values = (data?.changes ?? []).flatMap((change) => [
      change.base.value,
      change.target.value,
    ]);
    return {
      changes: data
        ? compareRevisionPathSnapshots(data, { allowRaw: false }).changes
        : [],
      referencedValues: values,
      fromSequence: base,
      toSequence: target,
    };
  }, [base, data, target]);
  const referencedUnitIds = useMemo(
    () =>
      unique(comparison.referencedValues.flatMap(extractUuidStrings)).slice(
        0,
        80,
      ),
    [comparison.referencedValues],
  );
  const referencesQuery = useQuery(
    historyQueries.unitReferenceResolution(referencedUnitIds),
  );
  const references = referencesQuery.data?.units ?? {};
  const revisionOptions = (revisionsQuery.data?.revisions ?? [])
    .map((revision) => revision.sequence)
    .filter((sequence, index, values) => values.indexOf(sequence) === index)
    .sort((a, b) => b - a);

  const updateCompare = (next: {
    base?: number;
    mode?: "split" | "unified";
    target?: number;
  }) => {
    const nextTarget = next.target ?? target;
    navigate({
      to: "/book/$bookId/edit/history/compare/$targetSequence",
      params: { bookId, targetSequence: String(nextTarget) },
      search: {
        base: String(next.base ?? base),
        mode: next.mode ?? mode,
      } as never,
    });
  };

  if (isLoading) {
    return (
      <p className="text-sm leading-ui text-text-secondary">
        {getI18nRuntime().i18n.t("common:loading")}
      </p>
    );
  }
  if (error) return <QueryErrorDisplay error={error} />;

  return (
    <section className="grid gap-6">
      <Link
        to="/book/$bookId/edit/history"
        params={{ bookId }}
        className="inline-flex w-fit items-center text-sm leading-ui text-text-secondary hover:text-text-primary"
      >
        {getI18nRuntime().i18n.t("search:history_back_to_edit_history")}
      </Link>
      <header className="grid gap-2">
        <h2 className="text-lg font-medium leading-ui text-text-primary">
          {getI18nRuntime().i18n.t("search:history_compare_title", {
            base: comparison.fromSequence,
            target: comparison.toSequence,
          })}
        </h2>
        <p className="text-sm leading-ui text-text-secondary">
          {getI18nRuntime().i18n.t("search:history_compare_description")}
        </p>
      </header>
      <section
        className="grid gap-3 border-y border-border-whisper py-4 md:grid-cols-[1fr_auto]"
        aria-label={getI18nRuntime().i18n.t(
          "search:history_compare_controls_label",
        )}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-medium leading-dense text-text-secondary">
            {getI18nRuntime().i18n.t("search:history_compare_base_revision")}
            <select
              className="rounded-md bg-surface-subtle px-3 py-2 text-sm leading-ui text-text-primary"
              value={base}
              onChange={(event) =>
                updateCompare({ base: Number(event.currentTarget.value) })
              }
            >
              {revisionOptions.map((sequence) => (
                <option key={sequence} value={sequence}>
                  {getI18nRuntime().i18n.t("search:history_revision_title", {
                    sequence,
                  })}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-medium leading-dense text-text-secondary">
            {getI18nRuntime().i18n.t("search:history_compare_target_revision")}
            <select
              className="rounded-md bg-surface-subtle px-3 py-2 text-sm leading-ui text-text-primary"
              value={target}
              onChange={(event) =>
                updateCompare({ target: Number(event.currentTarget.value) })
              }
            >
              {revisionOptions.map((sequence) => (
                <option key={sequence} value={sequence}>
                  {getI18nRuntime().i18n.t("search:history_revision_title", {
                    sequence,
                  })}
                </option>
              ))}
            </select>
          </label>
        </div>
        <fieldset
          className="m-0 flex items-end gap-2 border-0 p-0"
          aria-label={getI18nRuntime().i18n.t(
            "search:history_compare_layout_label",
          )}
        >
          <button
            type="button"
            aria-pressed={mode === "unified"}
            className={
              mode === "unified"
                ? "rounded-md bg-brand-fill px-3 py-2 text-sm leading-ui text-text-on-brand"
                : "rounded-md px-3 py-2 text-sm leading-ui text-text-secondary hover:bg-surface-subtle"
            }
            onClick={() => updateCompare({ mode: "unified" })}
          >
            {getI18nRuntime().i18n.t("search:history_compare_unified")}
          </button>
          <button
            type="button"
            aria-pressed={mode === "split"}
            className={
              mode === "split"
                ? "rounded-md bg-brand-fill px-3 py-2 text-sm leading-ui text-text-on-brand"
                : "rounded-md px-3 py-2 text-sm leading-ui text-text-secondary hover:bg-surface-subtle"
            }
            onClick={() => updateCompare({ mode: "split" })}
          >
            {getI18nRuntime().i18n.t("search:history_compare_split")}
          </button>
        </fieldset>
      </section>
      <nav
        className="flex flex-wrap gap-2"
        aria-label={getI18nRuntime().i18n.t(
          "search:history_compare_changed_fields",
        )}
      >
        {comparison.changes.length === 0 ? (
          <span className="text-sm leading-ui text-text-secondary">
            {getI18nRuntime().i18n.t("search:history_compare_no_changes")}
          </span>
        ) : (
          comparison.changes.map((change) => (
            <a
              key={change.path}
              href={`#${fieldAnchor(change.path)}`}
              className="rounded-md bg-surface-subtle px-2 py-1 text-xs leading-dense text-text-secondary hover:text-text-primary"
            >
              {editorialPathLabel(change.path)}
            </a>
          ))
        )}
      </nav>
      <div className="grid gap-4">
        {comparison.changes.map((change) => (
          <section
            key={change.path}
            id={fieldAnchor(change.path)}
            className="grid gap-3 border-t border-border-whisper pt-4"
          >
            <h3 className="text-sm font-medium leading-ui text-text-primary">
              {editorialPathLabel(change.path)}
            </h3>
            <CompareChange
              change={change}
              mode={mode}
              references={references}
            />
          </section>
        ))}
      </div>
    </section>
  );
}

export function CompareChange({
  change,
  mode,
  references,
}: {
  change: HistoryFieldChange;
  mode: "split" | "unified";
  references: Record<
    string,
    { status: string; title?: string; unitType?: string }
  >;
}) {
  if (change.kind === "scalar") {
    return (
      <dl className="grid gap-2 text-sm leading-ui sm:grid-cols-2">
        <div>
          <dt className="text-xs leading-dense text-text-tertiary">
            {getI18nRuntime().i18n.t("search:history_compare_before")}
          </dt>
          <dd className="text-text-primary">
            {String(change.before ?? "null")}
          </dd>
        </div>
        <div>
          <dt className="text-xs leading-dense text-text-tertiary">
            {getI18nRuntime().i18n.t("search:history_compare_after")}
          </dt>
          <dd className="text-text-primary">
            {String(change.after ?? "null")}
          </dd>
        </div>
      </dl>
    );
  }
  if (change.kind === "markdown") {
    return mode === "split" ? (
      <SplitMarkdownDiff parts={change.lineParts} />
    ) : (
      <UnifiedMarkdownDiff parts={change.lineParts} />
    );
  }
  if (change.kind === "collection") {
    return (
      <div className="grid gap-2 text-sm leading-ui text-text-primary">
        {change.added.map((item) => (
          <StatusLine
            key={`add-${stableHistoryKey(item)}`}
            status={getI18nRuntime().i18n.t(
              "search:history_compare_status_added",
            )}
            value={item}
            references={references}
          />
        ))}
        {change.removed.map((item) => (
          <StatusLine
            key={`remove-${stableHistoryKey(item)}`}
            status={getI18nRuntime().i18n.t(
              "search:history_compare_status_removed",
            )}
            value={item}
            references={references}
          />
        ))}
        {change.updated.map((item) => (
          <StatusLine
            key={item.key}
            status={getI18nRuntime().i18n.t(
              "search:history_compare_status_changed",
            )}
            value={item}
            references={references}
          />
        ))}
      </div>
    );
  }
  return (
    <RevisionPayloadValue
      value={
        change.hidden
          ? getI18nRuntime().i18n.t("search:history_compare_status_changed")
          : change.after
      }
    />
  );
}

function UnifiedMarkdownDiff({ parts }: { parts: DiffPart[] }) {
  const rows = createMarkdownDiffRows(parts);
  return (
    <div className="rezics-history-diff overflow-auto rounded-md bg-surface-subtle text-sm leading-ui text-text-primary">
      <HistoryDiffStyles />
      {rows.map((row) => (
        <DiffLine key={diffRowKey(row)} row={row} variant="unified" />
      ))}
    </div>
  );
}

function SplitMarkdownDiff({ parts }: { parts: DiffPart[] }) {
  const rows = createMarkdownDiffRows(parts);
  return (
    <div className="rezics-history-diff grid gap-2 md:grid-cols-2">
      <HistoryDiffStyles />
      <DiffPane
        label={getI18nRuntime().i18n.t("search:history_compare_before")}
        rows={rows.filter((row) => row.type !== "added")}
        side="old"
      />
      <DiffPane
        label={getI18nRuntime().i18n.t("search:history_compare_after")}
        rows={rows.filter((row) => row.type !== "removed")}
        side="new"
      />
    </div>
  );
}

function HistoryDiffStyles() {
  return (
    <style>{`
      .rezics-history-diff {
        --history-diff-added-bg: color-mix(in srgb, var(--colors-semantic-success-fill) 16%, transparent);
        --history-diff-added-gutter-bg: color-mix(in srgb, var(--colors-semantic-success-fill) 24%, transparent);
        --history-diff-removed-bg: color-mix(in srgb, var(--colors-semantic-error-fill) 14%, transparent);
        --history-diff-removed-gutter-bg: color-mix(in srgb, var(--colors-semantic-error-fill) 22%, transparent);
      }

      :where(html.dark, html[data-theme="dark"]) .rezics-history-diff {
        --history-diff-added-bg: color-mix(in srgb, var(--colors-semantic-success-fill) 24%, transparent);
        --history-diff-added-gutter-bg: color-mix(in srgb, var(--colors-semantic-success-fill) 34%, transparent);
        --history-diff-removed-bg: color-mix(in srgb, var(--colors-semantic-error-fill) 22%, transparent);
        --history-diff-removed-gutter-bg: color-mix(in srgb, var(--colors-semantic-error-fill) 32%, transparent);
      }

      .rezics-history-diff-line--added {
        background: var(--history-diff-added-bg);
      }

      .rezics-history-diff-line--removed {
        background: var(--history-diff-removed-bg);
      }

      .rezics-history-diff-sign--added {
        background: var(--history-diff-added-gutter-bg);
      }

      .rezics-history-diff-sign--removed {
        background: var(--history-diff-removed-gutter-bg);
      }
    `}</style>
  );
}

function diffRowKey(row: MarkdownDiffRow) {
  return [
    row.type,
    row.oldLineNumber ?? "",
    row.newLineNumber ?? "",
    row.content,
  ].join(":");
}

function stableHistoryKey(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

function createMarkdownDiffRows(parts: DiffPart[]): MarkdownDiffRow[] {
  let oldLineNumber = 1;
  let newLineNumber = 1;

  return parts.flatMap((part) =>
    part.value
      .split(/(?<=\n)/)
      .filter((line) => line.length > 0)
      .map((line) => {
        const row: MarkdownDiffRow = {
          content: line.endsWith("\n") ? line.slice(0, -1) : line,
          type: part.type,
        };

        if (part.type !== "added") {
          row.oldLineNumber = oldLineNumber;
          oldLineNumber += 1;
        }
        if (part.type !== "removed") {
          row.newLineNumber = newLineNumber;
          newLineNumber += 1;
        }

        return row;
      }),
  );
}

function DiffPane({
  label,
  rows,
  side,
}: {
  label: string;
  rows: MarkdownDiffRow[];
  side: "new" | "old";
}) {
  return (
    <section className="overflow-hidden rounded-md bg-surface-subtle">
      <h4 className="border-b border-border-whisper px-3 py-2 text-xs font-medium leading-dense text-text-secondary">
        {label}
      </h4>
      <div className="overflow-auto text-sm leading-ui text-text-primary">
        {rows.map((row) => (
          <DiffLine
            key={`${side}-${diffRowKey(row)}`}
            row={row}
            side={side}
            variant="split"
          />
        ))}
      </div>
    </section>
  );
}

function DiffLine({
  row,
  side,
  variant,
}: {
  row: MarkdownDiffRow;
  side?: "new" | "old";
  variant: "split" | "unified";
}) {
  const sign = row.type === "added" ? "+" : row.type === "removed" ? "-" : " ";
  const rowClass =
    row.type === "added"
      ? "rezics-history-diff-line--added"
      : row.type === "removed"
        ? "rezics-history-diff-line--removed"
        : "";
  const signClass =
    row.type === "added"
      ? "rezics-history-diff-sign--added text-success-text"
      : row.type === "removed"
        ? "rezics-history-diff-sign--removed text-error-text"
        : "text-text-tertiary";

  if (variant === "split") {
    const lineNumber = side === "old" ? row.oldLineNumber : row.newLineNumber;
    return (
      <div className={`grid grid-cols-[3rem_1.5rem_minmax(0,1fr)] ${rowClass}`}>
        <span className="select-none border-r border-border-whisper px-2 text-right font-mono text-xs leading-ui text-text-tertiary">
          {lineNumber ?? ""}
        </span>
        <span
          className={`select-none px-2 text-center font-mono text-xs leading-ui ${signClass}`}
        >
          {sign}
        </span>
        <span className="whitespace-pre-wrap break-words py-1 pr-3">
          {row.content || " "}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`grid grid-cols-[3rem_3rem_1.5rem_minmax(0,1fr)] ${rowClass}`}
    >
      <span className="select-none border-r border-border-whisper px-2 text-right font-mono text-xs leading-ui text-text-tertiary">
        {row.oldLineNumber ?? ""}
      </span>
      <span className="select-none border-r border-border-whisper px-2 text-right font-mono text-xs leading-ui text-text-tertiary">
        {row.newLineNumber ?? ""}
      </span>
      <span
        className={`select-none px-2 text-center font-mono text-xs leading-ui ${signClass}`}
      >
        {sign}
      </span>
      <span className="whitespace-pre-wrap break-words py-1 pr-3">
        {row.content || " "}
      </span>
    </div>
  );
}

function StatusLine({
  references,
  status,
  value,
}: {
  references: Record<
    string,
    { status: string; title?: string; unitType?: string }
  >;
  status: string;
  value: unknown;
}) {
  return (
    <div className="rounded-md bg-surface-subtle p-3">
      <span className="text-xs font-medium leading-dense text-text-secondary">
        {status}
      </span>
      <RevisionPayloadValue references={references} value={value} />
    </div>
  );
}

function RevisionSections({
  payload,
  references,
}: {
  payload: Record<string, unknown>;
  references: Record<
    string,
    { status: string; title?: string; unitType?: string }
  >;
}) {
  const entries = Object.entries(payload);
  if (entries.length === 0) {
    return (
      <EmptyHistoryState
        label={getI18nRuntime().i18n.t(
          "search:history_revision_content_unavailable",
        )}
      />
    );
  }
  return (
    <div className="grid gap-5">
      {entries.map(([slotKey, value]) => (
        <section key={slotKey} className="grid gap-2">
          <h3 className="text-sm font-medium leading-ui text-text-primary">
            {slotLabel(slotKey)}
          </h3>
          <RevisionPayloadValue value={value} />
        </section>
      ))}
      {Object.keys(references).length > 0 ? (
        <section className="grid gap-2">
          <h3 className="text-sm font-medium leading-ui text-text-primary">
            {getI18nRuntime().i18n.t("search:history_references_title")}
          </h3>
          <ul className="grid gap-2">
            {Object.entries(references).map(([unitId, reference]) => (
              <li
                key={unitId}
                className="text-sm leading-ui text-text-secondary"
              >
                <CheckCircle2
                  className="mr-2 inline h-4 w-4"
                  aria-hidden="true"
                />
                {referenceLabel(reference)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function FieldChips({ keys }: { keys: readonly string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {keys.map((path) => (
        <span
          key={path}
          title={path}
          className="rounded-full bg-surface-subtle px-2 py-0.5 text-xs leading-dense text-text-secondary"
        >
          {editorialPathLabel(path)}
        </span>
      ))}
    </div>
  );
}

function EmptyHistoryState({ label }: { label?: string }) {
  return (
    <section className="flex flex-col items-center gap-3 py-16 text-center">
      <History className="h-8 w-8 text-text-tertiary" aria-hidden="true" />
      <div>
        <h2 className="text-lg font-medium leading-ui text-text-primary">
          {label ?? getI18nRuntime().i18n.t("search:history_empty_revisions")}
        </h2>
        <p className="mt-2 max-w-md text-sm leading-ui text-text-secondary">
          {getI18nRuntime().i18n.t("search:history_empty_ingestion_lag")}
        </p>
      </div>
    </section>
  );
}

function RevisionPayloadValue({
  references = {},
  value,
}: {
  references?: Record<
    string,
    { status: string; title?: string; unitType?: string }
  >;
  value: unknown;
}) {
  if (value == null || typeof value === "string" || typeof value === "number") {
    if (typeof value === "string" && references[value]) {
      return <span>{referenceLabel(references[value])}</span>;
    }
    if (typeof value === "string" && isUuid(value)) {
      return (
        <span>
          {getI18nRuntime().i18n.t("search:history_references_unresolved")}
        </span>
      );
    }
    return (
      <span>
        {value == null
          ? getI18nRuntime().i18n.t("search:history_value_null")
          : String(value)}
      </span>
    );
  }
  if (typeof value === "boolean") {
    return <span>{value ? "true" : "false"}</span>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return (
        <span>{getI18nRuntime().i18n.t("search:history_value_empty")}</span>
      );
    }
    return (
      <ul className="mt-2 grid gap-2">
        {value.map((item) => (
          <li
            key={stableHistoryKey(item)}
            className="rounded-md bg-surface-subtle p-3 text-sm leading-ui text-text-primary"
          >
            <RevisionPayloadValue references={references} value={item} />
          </li>
        ))}
      </ul>
    );
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      return (
        <span>{getI18nRuntime().i18n.t("search:history_value_empty")}</span>
      );
    }
    return (
      <dl className="mt-2 grid gap-2 text-sm leading-ui">
        {entries.map(([key, nested]) => (
          <div key={key} className="grid gap-1">
            <dt className="text-xs font-medium leading-dense text-text-tertiary">
              {slotLabel(key)}
            </dt>
            <dd className="text-text-primary">
              <RevisionPayloadValue references={references} value={nested} />
            </dd>
          </div>
        ))}
      </dl>
    );
  }
  return (
    <span className="text-text-secondary">
      {getI18nRuntime().i18n.t("search:history_value_changed_structured")}
    </span>
  );
}

function extractUuidStrings(value: unknown) {
  const ids = new Set<string>();
  const visit = (current: unknown) => {
    if (typeof current === "string") {
      const matches = current.matchAll(
        /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,
      );
      for (const match of matches) ids.add(match[0]);
      return;
    }
    if (Array.isArray(current)) {
      for (const item of current) visit(item);
      return;
    }
    if (current && typeof current === "object") {
      for (const item of Object.values(current)) visit(item);
    }
  };
  visit(value);
  return [...ids];
}

function actorLabel(
  actor: HistoryActorResolution | undefined,
  fallback: string,
) {
  if (!actor)
    return fallback && !isUuid(fallback)
      ? fallback
      : getI18nRuntime().i18n.t("search:history_unknown_actor");
  if (actor.status !== "OK") return actor.status.toLowerCase();
  return (
    actor.displayName ??
    actor.handle ??
    getI18nRuntime().i18n.t("search:history_unknown_actor")
  );
}

function referenceLabel(reference: {
  status: string;
  title?: string;
  unitType?: string;
}) {
  if (reference.status === "OK") {
    const title =
      reference.title ??
      getI18nRuntime().i18n.t("search:history_references_untitled");
    return `${title} · ${reference.unitType ?? getI18nRuntime().i18n.t("search:history_references_unit")}`;
  }
  if (reference.status === "RESTRICTED") {
    return getI18nRuntime().i18n.t("search:history_references_restricted");
  }
  if (reference.status === "DELETED") {
    return getI18nRuntime().i18n.t("search:history_references_deleted");
  }
  if (reference.status === "GONE") {
    return getI18nRuntime().i18n.t("search:history_references_gone");
  }
  return getI18nRuntime().i18n.t("search:history_references_unresolved");
}

function fieldAnchor(value: string) {
  return value.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
}

function unique(values: readonly string[]) {
  return [...new Set(values.filter(Boolean))];
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function formatDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
