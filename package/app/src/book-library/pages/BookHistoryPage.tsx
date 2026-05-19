import { historyQueries, type UnitDTO, unitQueries } from "@rezics/api";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { History, LockKeyhole } from "lucide-react";
import { useMemo } from "react";
import { QueryErrorDisplay } from "@/core/components/QueryErrorDisplay";

export function BookHistoryPage() {
  const { bookId } = useParams({ strict: false }) as { bookId: string };
  const { data, isLoading, error } = useQuery({
    ...historyQueries.unitRevisionTimeline(bookId, { limit: 30 }),
    enabled: Boolean(bookId),
  });

  if (isLoading) {
    return <p className="text-sm leading-ui text-text-secondary">Loading...</p>;
  }

  if (error) {
    return <QueryErrorDisplay error={error} />;
  }

  const revisions = data?.revisions ?? [];

  if (revisions.length === 0) {
    return (
      <section className="flex flex-col items-center gap-3 py-16 text-center">
        <History className="h-8 w-8 text-text-tertiary" aria-hidden="true" />
        <div>
          <h2 className="text-lg font-medium leading-ui text-text-primary">
            No revision history yet
          </h2>
          <p className="mt-2 max-w-md text-sm leading-ui text-text-secondary">
            Recent edits may take a moment to appear while the history service
            ingests them.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-text-secondary">
        <History className="h-4 w-4" aria-hidden="true" />
        <h2 className="text-sm font-medium leading-ui">Revision history</h2>
      </div>
      <ol className="flex flex-col divide-y divide-border-whisper">
        {revisions.map((revision) => (
          <li key={revision.id} className="py-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium leading-ui text-text-primary">
                <Link
                  to="/book/$bookId/history/$sequence"
                  params={{
                    bookId,
                    sequence: String(revision.sequence),
                  }}
                  className="text-text-primary hover:text-text-brand"
                >
                  Revision {revision.sequence}
                </Link>
              </span>
              {revision.message ? (
                <span className="text-sm leading-ui text-text-secondary">
                  {revision.message}
                </span>
              ) : null}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {revision.changedFieldKeys.map((fieldKey) => (
                <span
                  key={fieldKey}
                  className="rounded-full bg-surface-subtle px-2 py-0.5 text-xs leading-dense text-text-secondary"
                >
                  {fieldKey}
                </span>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs leading-dense text-text-tertiary">
              <span>{formatDate(revision.createdAt)}</span>
              <span aria-hidden="true">·</span>
              <span>{revision.actorUserId}</span>
            </div>
          </li>
        ))}
      </ol>
      <div className="flex items-center gap-2 rounded-md bg-surface-subtle p-3 text-sm leading-ui text-text-secondary">
        <LockKeyhole className="h-4 w-4" aria-hidden="true" />
        Field locks are shown in edit forms when a save is blocked.
      </div>
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
    ...historyQueries.unitRevision(bookId, parsedSequence),
    enabled: Boolean(bookId) && Number.isFinite(parsedSequence),
  });
  const revision = data?.revision;
  const payload = revision?.content?.payload ?? {};
  const referencedUnitIds = useMemo(
    () => extractUuidStrings(payload).slice(0, 12),
    [payload],
  );
  const referencedUnitQueries = useQueries({
    queries: referencedUnitIds.map((unitId) => ({
      ...unitQueries.detail(unitId),
      enabled: Boolean(revision),
      retry: false,
    })),
  });
  const referencedUnits = referencedUnitQueries
    .map((query) => query.data)
    .filter((unit): unit is UnitDTO => Boolean(unit));

  if (isLoading) {
    return <p className="text-sm leading-ui text-text-secondary">Loading...</p>;
  }

  if (error) {
    return <QueryErrorDisplay error={error} />;
  }

  if (!revision) {
    return (
      <p className="text-sm leading-ui text-text-secondary">
        Revision not found.
      </p>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-medium leading-ui text-text-primary">
          Revision {revision.sequence}
        </h2>
        <p className="mt-1 text-sm leading-ui text-text-secondary">
          {formatDate(revision.createdAt)} · {revision.actorUserId}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {revision.changedFieldKeys.map((fieldKey) => (
          <span
            key={fieldKey}
            className="rounded-full bg-surface-subtle px-2 py-0.5 text-xs leading-dense text-text-secondary"
          >
            {fieldKey}
          </span>
        ))}
      </div>
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-medium leading-ui text-text-primary">
          Payload slots
        </h3>
        <dl className="grid gap-3">
          {Object.entries(payload).map(([slotKey, value]) => (
            <div key={slotKey} className="grid gap-1">
              <dt className="text-xs leading-dense text-text-tertiary">
                {slotKey}
              </dt>
              <dd className="text-sm leading-ui text-text-primary">
                <RevisionPayloadValue value={value} />
              </dd>
            </div>
          ))}
        </dl>
      </section>
      {referencedUnits.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-medium leading-ui text-text-primary">
            Referenced Units
          </h3>
          <ul className="grid gap-2">
            {referencedUnits.map((unit) => (
              <li
                key={unit.id}
                className="flex flex-wrap items-center gap-2 text-sm leading-ui"
              >
                <span className="font-medium text-text-primary">
                  {getUnitTitle(unit)}
                </span>
                <span className="rounded-full bg-surface-subtle px-2 py-0.5 text-xs leading-dense text-text-secondary">
                  {unit.type}
                </span>
                <span className="font-mono text-xs leading-dense text-text-tertiary">
                  {unit.id}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <pre className="max-h-[520px] overflow-auto rounded-md bg-surface-subtle p-4 text-xs leading-dense text-text-primary">
        {JSON.stringify(payload, null, 2)}
      </pre>
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

function getUnitTitle(unit: UnitDTO) {
  const translation = unit.translations?.find((item) => item.title)?.title;
  return translation ?? unit.slug ?? unit.id;
}

function formatDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
