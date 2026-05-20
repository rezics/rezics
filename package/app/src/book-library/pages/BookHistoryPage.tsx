import { historyQueries } from "@rezics/api";
import type {
  HistoryActorResolution,
  StructureEventDTO,
  UnitRevisionDTO,
} from "@rezics/contract";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import {
  ArrowLeftRight,
  CheckCircle2,
  ChevronDown,
  History,
  LockKeyhole,
  RotateCcw,
} from "lucide-react";
import { useMemo, useState } from "react";
import { QueryErrorDisplay } from "@/core/components/QueryErrorDisplay";
import { compareRevisionSlots } from "../models/historyCompare";

type HistoryTab = "editorial" | "structure" | "authority";

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
      eventType: "book.contentStructure.batch",
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
    return <p className="text-sm leading-ui text-text-secondary">Loading...</p>;
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
          <h2 className="text-sm font-medium leading-ui">Content history</h2>
        </div>
        <div className="flex flex-wrap gap-2" role="tablist">
          <HistoryTabButton
            active={tab === "editorial"}
            onClick={() => setTab("editorial")}
          >
            Editorial
          </HistoryTabButton>
          <HistoryTabButton
            active={tab === "structure"}
            onClick={() => setTab("structure")}
          >
            Content structure
          </HistoryTabButton>
          <HistoryTabButton
            active={tab === "authority"}
            onClick={() => setTab("authority")}
          >
            Authority
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
      {tab === "structure" ? (
        <StructureTimeline events={structureEvents} actors={actors} />
      ) : null}
      {tab === "authority" ? <AuthorityPanel /> : null}

      {restoreSequence !== null ? (
        <section className="grid gap-3 rounded-md bg-surface-subtle p-4">
          <div className="flex items-center gap-2 text-sm font-medium leading-ui text-text-primary">
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Restore revision {restoreSequence}
          </div>
          <p className="text-sm leading-ui text-text-secondary">
            Restoring creates a new latest revision through the normal edit
            path. Later history remains preserved.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/book/$bookId/history/$sequence"
              params={{ bookId, sequence: String(restoreSequence) }}
              className="rounded-md bg-brand-fill px-3 py-2 text-sm leading-ui text-text-on-brand"
            >
              Review source revision
            </Link>
            <button
              type="button"
              className="rounded-md px-3 py-2 text-sm leading-ui text-text-secondary hover:bg-surface-base"
              onClick={() => setRestoreSequence(null)}
            >
              Cancel
            </button>
          </div>
        </section>
      ) : null}
    </section>
  );
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
          ? "rounded-md bg-brand-fill px-3 py-2 text-sm leading-ui text-text-on-brand"
          : "rounded-md px-3 py-2 text-sm leading-ui text-text-secondary hover:bg-surface-subtle"
      }
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function RevisionTimeline({
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
  return (
    <ol className="flex flex-col divide-y divide-border-whisper">
      {revisions.map((revision) => (
        <li key={revision.id} className="grid gap-3 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Link
                to="/book/$bookId/history/$sequence"
                params={{ bookId, sequence: String(revision.sequence) }}
                className="text-sm font-medium leading-ui text-text-primary hover:text-text-brand"
              >
                Revision {revision.sequence}
              </Link>
              <p className="mt-1 text-sm leading-ui text-text-secondary">
                {revision.message ?? "Metadata update"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/book/$bookId/history/compare/$targetSequence"
                params={{ bookId, targetSequence: String(revision.sequence) }}
                aria-label={`Compare revision ${revision.sequence}`}
                className="rounded-md p-2 text-text-secondary hover:bg-surface-subtle hover:text-text-primary"
              >
                <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <button
                type="button"
                aria-label={`Restore revision ${revision.sequence}`}
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
      ))}
    </ol>
  );
}

function StructureTimeline({
  actors,
  events,
}: {
  actors: Record<string, HistoryActorResolution>;
  events: StructureEventDTO[];
}) {
  if (events.length === 0) {
    return <EmptyHistoryState label="No structure history yet" />;
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
                  Structure save {event.sequence}
                </span>
                <span className="flex items-center gap-2 text-xs leading-dense text-text-secondary">
                  {operations.length} operations
                  <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
                </span>
              </summary>
              <ol className="mt-3 grid gap-2">
                {operations.map((operation, index) => (
                  <li
                    key={`${event.id}-${index}`}
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

function AuthorityPanel() {
  return (
    <section className="grid gap-3 rounded-md bg-surface-subtle p-4 text-sm leading-ui text-text-secondary">
      <div className="flex items-center gap-2 text-text-primary">
        <LockKeyhole className="h-4 w-4" aria-hidden="true" />
        <h3 className="font-medium">History authority</h3>
      </div>
      <p>
        Public viewers can read visible history metadata. Raw payload inspection
        and restore actions are reserved for owners, maintainers, and admins.
      </p>
      <p>
        Restricted references render with status text instead of leaking private
        Unit names.
      </p>
    </section>
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
  const referencedUnitIds = useMemo(
    () => extractUuidStrings(payload).slice(0, 40),
    [payload],
  );
  const referencesQuery = useQuery(
    historyQueries.unitReferenceResolution(referencedUnitIds),
  );
  const references = referencesQuery.data?.units ?? {};

  if (isLoading) {
    return <p className="text-sm leading-ui text-text-secondary">Loading...</p>;
  }
  if (error) return <QueryErrorDisplay error={error} />;
  if (!revision) {
    return (
      <p className="text-sm leading-ui text-text-secondary">
        Revision not found.
      </p>
    );
  }

  return (
    <section className="grid gap-6">
      <header className="grid gap-2">
        <h2 className="text-lg font-medium leading-ui text-text-primary">
          Revision {revision.sequence}
        </h2>
        <p className="text-sm leading-ui text-text-secondary">
          {formatDate(revision.createdAt)} · {revision.actorUserId}
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
  const target = Number(targetSequence);
  const base = Math.max(1, target - 1);
  const { data, isLoading, error } = useQuery({
    ...historyQueries.revisionCompareInput(bookId, base, target),
    enabled: Boolean(bookId) && Number.isFinite(target),
  });
  const compare = useMemo(() => {
    const before = data?.base.content?.payload ?? {};
    const after = data?.target.content?.payload ?? {};
    return compareRevisionSlots(before, after, { allowRaw: true });
  }, [data]);

  if (isLoading) {
    return <p className="text-sm leading-ui text-text-secondary">Loading...</p>;
  }
  if (error) return <QueryErrorDisplay error={error} />;

  return (
    <section className="grid gap-6">
      <header className="grid gap-2">
        <h2 className="text-lg font-medium leading-ui text-text-primary">
          Compare revisions {base} and {target}
        </h2>
        <p className="text-sm leading-ui text-text-secondary">
          Unified source diff with changed-field navigation.
        </p>
      </header>
      <nav className="flex flex-wrap gap-2" aria-label="Changed fields">
        {compare.changes.map((change) => (
          <a
            key={change.path}
            href={`#${fieldAnchor(change.path)}`}
            className="rounded-md bg-surface-subtle px-2 py-1 text-xs leading-dense text-text-secondary hover:text-text-primary"
          >
            {change.path}
          </a>
        ))}
      </nav>
      <div className="grid gap-4">
        {compare.changes.map((change) => (
          <section
            key={change.path}
            id={fieldAnchor(change.path)}
            className="grid gap-3 border-t border-border-whisper pt-4"
          >
            <h3 className="text-sm font-medium leading-ui text-text-primary">
              {change.path}
            </h3>
            <CompareChange change={change} />
          </section>
        ))}
      </div>
    </section>
  );
}

function CompareChange({
  change,
}: {
  change: ReturnType<typeof compareRevisionSlots>["changes"][number];
}) {
  if (change.kind === "scalar") {
    return (
      <dl className="grid gap-2 text-sm leading-ui sm:grid-cols-2">
        <div>
          <dt className="text-xs leading-dense text-text-tertiary">Before</dt>
          <dd className="text-text-primary">
            {String(change.before ?? "null")}
          </dd>
        </div>
        <div>
          <dt className="text-xs leading-dense text-text-tertiary">After</dt>
          <dd className="text-text-primary">
            {String(change.after ?? "null")}
          </dd>
        </div>
      </dl>
    );
  }
  if (change.kind === "markdown") {
    return (
      <pre className="overflow-auto rounded-md bg-surface-subtle p-3 text-xs leading-dense text-text-primary">
        {change.lineParts
          .map(
            (part) =>
              `${part.type === "added" ? "+ " : part.type === "removed" ? "- " : "  "}${part.value}`,
          )
          .join("")}
      </pre>
    );
  }
  if (change.kind === "collection") {
    return (
      <div className="grid gap-2 text-sm leading-ui text-text-primary">
        {change.added.map((item, index) => (
          <StatusLine key={`add-${index}`} status="Added" value={item} />
        ))}
        {change.removed.map((item, index) => (
          <StatusLine key={`remove-${index}`} status="Removed" value={item} />
        ))}
        {change.updated.map((item) => (
          <StatusLine key={item.key} status="Changed" value={item} />
        ))}
      </div>
    );
  }
  return (
    <RevisionPayloadValue value={change.hidden ? "Changed" : change.after} />
  );
}

function StatusLine({ status, value }: { status: string; value: unknown }) {
  return (
    <div className="rounded-md bg-surface-subtle p-3">
      <span className="text-xs font-medium leading-dense text-text-secondary">
        {status}
      </span>
      <RevisionPayloadValue value={value} />
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
    return <EmptyHistoryState label="Revision content is unavailable" />;
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
            Referenced Units
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
                {reference.status === "OK"
                  ? `${reference.title ?? unitId} · ${reference.unitType ?? "Unit"}`
                  : `${reference.status} · ${unitId}`}
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
      {keys.map((fieldKey) => (
        <span
          key={fieldKey}
          className="rounded-full bg-surface-subtle px-2 py-0.5 text-xs leading-dense text-text-secondary"
        >
          {fieldKey}
        </span>
      ))}
    </div>
  );
}

function EmptyHistoryState({ label = "No revision history yet" }) {
  return (
    <section className="flex flex-col items-center gap-3 py-16 text-center">
      <History className="h-8 w-8 text-text-tertiary" aria-hidden="true" />
      <div>
        <h2 className="text-lg font-medium leading-ui text-text-primary">
          {label}
        </h2>
        <p className="mt-2 max-w-md text-sm leading-ui text-text-secondary">
          Recent edits may take a moment to appear while the history service
          ingests them.
        </p>
      </div>
    </section>
  );
}

function RevisionPayloadValue({ value }: { value: unknown }) {
  if (value == null || typeof value === "string" || typeof value === "number") {
    return <span>{String(value ?? "null")}</span>;
  }
  if (typeof value === "boolean") {
    return <span>{value ? "true" : "false"}</span>;
  }
  return (
    <pre className="overflow-auto rounded-md bg-surface-subtle p-3 text-xs leading-dense text-text-primary">
      {JSON.stringify(value, null, 2)}
    </pre>
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
  if (!actor) return fallback;
  if (actor.status !== "OK") return actor.status.toLowerCase();
  return actor.displayName ?? actor.handle ?? fallback;
}

function slotLabel(value: string) {
  return value
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (char) => char.toUpperCase());
}

function fieldAnchor(value: string) {
  return value.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
}

function unique(values: readonly string[]) {
  return [...new Set(values.filter(Boolean))];
}

function formatDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
