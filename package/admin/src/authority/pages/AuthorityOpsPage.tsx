import { apiFetch } from "@rezics/api/react-query/http";
import { unitAuthorityQueries } from "@rezics/api/unit/unit";
import * as m from "@rezics/i18n/messages";
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
import { RotateCcw as RetryIcon, Search as SearchIcon } from "lucide-react";
import React from "react";
import { Page } from "@/core/layouts/Page";

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
      setMessage(m.admin_authority_retry_queued({ count: result.retried }));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : m.admin_authority_retry_failed(),
      );
    } finally {
      setRetrying(false);
    }
  }

  return (
    <Page
      title={m.admin_authority_title()}
      description={m.admin_authority_description()}
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
              <Label htmlFor="authority-unit-id">{m.common_unit_id()}</Label>
              <Input
                id="authority-unit-id"
                value={unitIdInput}
                onChange={(e) => setUnitIdInput(e.target.value)}
                placeholder={m.admin_authority_unit_search_placeholder()}
              />
            </div>
            <Button type="submit" className="self-end">
              <SearchIcon className="size-4" />
              {m.common_search()}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="self-end"
              disabled={retrying}
              onClick={retryFailedOutbox}
            >
              <RetryIcon className="size-4" />
              {m.admin_authority_retry_failed_button()}
            </Button>
          </form>

          <Separator className="my-4" />

          {!unitId ? (
            <p className="text-sm text-text-secondary">
              {m.admin_authority_empty_help()}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <section className="flex flex-col gap-3">
                <h3 className="text-base font-semibold">
                  {m.admin_unit_field_locks_title()}
                </h3>
                {fieldLocksQuery.isLoading ? (
                  <div className="flex justify-center py-4">
                    <Spinner />
                  </div>
                ) : fieldLocksQuery.isError ? (
                  <p className="text-sm text-error-text">
                    {m.admin_unit_field_locks_failed_load()}
                  </p>
                ) : fieldLocksQuery.data?.locks.length ? (
                  <div className="flex flex-col gap-2">
                    {fieldLocksQuery.data.locks.map((lock) => (
                      <div
                        key={lock.path}
                        className="border-b border-border-whisper py-2"
                      >
                        <p className="text-sm font-medium">{lock.path}</p>
                        <p className="text-xs text-text-secondary">
                          {m.admin_unit_field_lock_locked_by({
                            userId: lock.lockedById,
                            date: fmtDate(lock.createdAt),
                          })}
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
                    {m.admin_unit_field_locks_empty()}
                  </p>
                )}
              </section>

              <section className="flex flex-col gap-3">
                <h3 className="text-base font-semibold">
                  {m.admin_unit_collaborators_title()}
                </h3>
                {collaboratorsQuery.isLoading ? (
                  <div className="flex justify-center py-4">
                    <Spinner />
                  </div>
                ) : collaboratorsQuery.isError ? (
                  <p className="text-sm text-error-text">
                    {m.admin_unit_collaborators_failed_load()}
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
                            {m.admin_unit_collaborator_added_by({
                              role: collaborator.roleKey,
                              userId: collaborator.addedById,
                              date: fmtDate(collaborator.createdAt),
                            })}
                          </p>
                        </div>
                      ),
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-text-secondary">
                    {m.admin_unit_collaborators_empty()}
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
