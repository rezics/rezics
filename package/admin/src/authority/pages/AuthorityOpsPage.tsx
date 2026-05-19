import { unitAuthorityQueries } from "@rezics/api/unit/unit";
import { apiFetch } from "@rezics/api/react-query/http";
import { Spinner } from "@rezics/ui";
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  Input,
  Label,
  Separator,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { Page } from "@/core/layouts/Page";
import { RotateCcw as RetryIcon, Search as SearchIcon } from "lucide-react";

function fmtDate(v?: string | Date) {
  if (!v) return "";
  const d = typeof v === "string" ? new Date(v) : v;
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString();
}

export default function AuthorityOpsPage() {
  const [unitIdInput, setUnitIdInput] = React.useState("");
  const [unitId, setUnitId] = React.useState("");
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [retrying, setRetrying] = React.useState(false);

  const fieldLocksQuery = useQuery({
    ...unitAuthorityQueries.fieldLocks(unitId),
    enabled: !!unitId,
  });
  const collaboratorsQuery = useQuery({
    ...unitAuthorityQueries.collaborators(unitId),
    enabled: !!unitId,
  });

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setUnitId(unitIdInput.trim());
  }

  async function retryFailedOutbox() {
    setRetrying(true);
    setError(null);
    setMessage(null);
    try {
      const result = await apiFetch<{ retried: number }>(
        "/admin/history-outbox/retry-failed",
        {
          method: "POST",
          body: JSON.stringify(unitId ? { unitId } : {}),
        },
      );
      setMessage(`Queued ${result.retried} failed outbox row(s) for retry.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Retry failed");
    } finally {
      setRetrying(false);
    }
  }

  return (
    <Page
      title="Authority Operations"
      description="Inspect Unit locks, collaborators, and history retry state"
    >
      <Card>
        <CardContent>
          {error ? (
            <Alert className="mb-4">
              <AlertDescription className="text-error-text">
                {error}
              </AlertDescription>
            </Alert>
          ) : null}
          {message ? (
            <Alert className="mb-4">
              <AlertDescription className="text-success-text">
                {message}
              </AlertDescription>
            </Alert>
          ) : null}

          <form
            onSubmit={onSearch}
            className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]"
          >
            <div className="flex flex-col gap-1">
              <Label htmlFor="authority-unit-id">Unit ID</Label>
              <Input
                id="authority-unit-id"
                value={unitIdInput}
                onChange={(e) => setUnitIdInput(e.target.value)}
                placeholder="Search locks and collaborators by Unit id"
              />
            </div>
            <Button type="submit" className="self-end">
              <SearchIcon className="size-4" />
              Search
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="self-end"
              disabled={retrying}
              onClick={retryFailedOutbox}
            >
              <RetryIcon className="size-4" />
              Retry failed
            </Button>
          </form>

          <Separator className="my-4" />

          {!unitId ? (
            <p className="text-sm text-text-secondary">
              Enter a Unit id to inspect authority records. Retry without a Unit
              id requeues all failed outbox rows.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <section className="flex flex-col gap-3">
                <h3 className="text-base font-semibold">Field Locks</h3>
                {fieldLocksQuery.isLoading ? (
                  <div className="flex justify-center py-4">
                    <Spinner />
                  </div>
                ) : fieldLocksQuery.isError ? (
                  <p className="text-sm text-error-text">
                    Failed to load field locks.
                  </p>
                ) : fieldLocksQuery.data?.locks.length ? (
                  <div className="flex flex-col gap-2">
                    {fieldLocksQuery.data.locks.map((lock) => (
                      <div
                        key={lock.fieldKey}
                        className="border-b border-border-whisper py-2"
                      >
                        <p className="text-sm font-medium">{lock.fieldKey}</p>
                        <p className="text-xs text-text-secondary">
                          Locked by {lock.lockedById} ·{" "}
                          {fmtDate(lock.createdAt)}
                        </p>
                        {lock.reason ? (
                          <p className="text-xs text-text-secondary">
                            {lock.reason}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-text-secondary">
                    No field locks found.
                  </p>
                )}
              </section>

              <section className="flex flex-col gap-3">
                <h3 className="text-base font-semibold">Collaborators</h3>
                {collaboratorsQuery.isLoading ? (
                  <div className="flex justify-center py-4">
                    <Spinner />
                  </div>
                ) : collaboratorsQuery.isError ? (
                  <p className="text-sm text-error-text">
                    Failed to load collaborators.
                  </p>
                ) : collaboratorsQuery.data?.collaborators.length ? (
                  <div className="flex flex-col gap-2">
                    {collaboratorsQuery.data.collaborators.map(
                      (collaborator) => (
                        <div
                          key={collaborator.userId}
                          className="border-b border-border-whisper py-2"
                        >
                          <p className="text-sm font-medium">
                            {collaborator.userId}
                          </p>
                          <p className="text-xs text-text-secondary">
                            {collaborator.roleKey} · added by{" "}
                            {collaborator.addedById} ·{" "}
                            {fmtDate(collaborator.createdAt)}
                          </p>
                        </div>
                      ),
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-text-secondary">
                    No collaborators found.
                  </p>
                )}
              </section>
            </div>
          )}
        </CardContent>
      </Card>
    </Page>
  );
}
