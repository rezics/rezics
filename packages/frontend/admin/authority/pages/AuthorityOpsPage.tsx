import { UnitAuthorityRoleKey } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Textarea,
} from "@rezics/ui/shadcn";
import { RotateCcw as RetryIcon, Search as SearchIcon } from "lucide-react";
import React from "react";
import { Page } from "@/admin/core/layouts/Page";
import {
  useRemoveUnitCollaboratorMutation,
  useRemoveUnitFieldLockMutation,
  useRetryFailedHistoryOutboxMutation,
  useUnitCollaboratorsQuery,
  useUnitFieldLocksQuery,
  useUpsertUnitCollaboratorMutation,
  useUpsertUnitFieldLockMutation,
} from "@/admin/unit/hooks/useUnitAdminQueries";

const authorityRoles = Object.values(UnitAuthorityRoleKey);

function fmtDate(v?: string | Date) {
  if (!v) return "";
  const d = typeof v === "string" ? new Date(v) : v;
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString();
}

export default function AuthorityOpsPage() {
  const { t } = useTranslation(["admin", "common"]);
  const [unitIdInput, setUnitIdInput] = React.useState("");
  const [unitId, setUnitId] = React.useState("");
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [collaboratorUserId, setCollaboratorUserId] = React.useState("");
  const [collaboratorRole, setCollaboratorRole] =
    React.useState<UnitAuthorityRoleKey>(UnitAuthorityRoleKey.EDITOR);
  const [lockPath, setLockPath] = React.useState("");
  const [lockReason, setLockReason] = React.useState("");

  const fieldLocksQuery = useUnitFieldLocksQuery(unitId, Boolean(unitId));
  const collaboratorsQuery = useUnitCollaboratorsQuery(unitId, Boolean(unitId));
  const upsertCollaborator = useUpsertUnitCollaboratorMutation();
  const removeCollaborator = useRemoveUnitCollaboratorMutation();
  const upsertFieldLock = useUpsertUnitFieldLockMutation();
  const removeFieldLock = useRemoveUnitFieldLockMutation();
  const retryFailedHistoryOutbox = useRetryFailedHistoryOutboxMutation();

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setUnitId(unitIdInput.trim());
  }

  async function retryFailedOutbox() {
    setError(null);
    setMessage(null);
    try {
      const result = await retryFailedHistoryOutbox.mutateAsync(
        unitId ? { unitId } : {},
      );
      setMessage(t("admin:authority_retry_queued", { count: result.retried }));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("admin:authority_retry_failed"),
      );
    }
  }

  async function submitCollaborator(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    const targetUserId = collaboratorUserId.trim();
    if (!unitId) {
      setError("Search for a Unit before changing authority.");
      return;
    }
    if (!targetUserId) {
      setError("Collaborator user id is required.");
      return;
    }
    try {
      await upsertCollaborator.mutateAsync({
        unitId,
        userId: targetUserId,
        roleKey: collaboratorRole,
      });
      setMessage("Collaborator authority updated.");
      setCollaboratorUserId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authority update failed.");
    }
  }

  async function submitFieldLock(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    const path = lockPath.trim();
    const reason = lockReason.trim();
    if (!unitId) {
      setError("Search for a Unit before changing authority.");
      return;
    }
    if (!path) {
      setError("Field lock path is required.");
      return;
    }
    if (reason.length < 3) {
      setError("Field lock reason must explain the operator action.");
      return;
    }
    try {
      await upsertFieldLock.mutateAsync({
        unitId,
        path,
        reason,
      });
      setMessage("Field lock updated.");
      setLockPath("");
      setLockReason("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Field lock update failed.",
      );
    }
  }

  async function handleRemoveCollaborator(userId: string) {
    setError(null);
    setMessage(null);
    try {
      await removeCollaborator.mutateAsync({ unitId, userId });
      setMessage("Collaborator authority removed.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Collaborator removal failed.",
      );
    }
  }

  async function handleRemoveFieldLock(path: string) {
    setError(null);
    setMessage(null);
    try {
      await removeFieldLock.mutateAsync({ unitId, path });
      setMessage("Field lock removed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Field unlock failed.");
    }
  }

  return (
    <Page
      title={t("admin:authority_title")}
      description={t("admin:authority_description")}
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
              <Label htmlFor="authority-unit-id">{t("common:unit_id")}</Label>
              <Input
                id="authority-unit-id"
                value={unitIdInput}
                onChange={(e) => setUnitIdInput(e.target.value)}
                placeholder={t("admin:authority_unit_search_placeholder")}
              />
            </div>
            <Button type="submit" className="self-end">
              <SearchIcon className="size-4" />
              {t("common:search")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="self-end"
              disabled={retryFailedHistoryOutbox.isPending}
              onClick={retryFailedOutbox}
            >
              <RetryIcon className="size-4" />
              {t("admin:authority_retry_failed_button")}
            </Button>
          </form>

          <Separator className="my-4" />

          {!unitId ? (
            <p className="text-sm text-text-secondary">
              {t("admin:authority_empty_help")}
            </p>
          ) : (
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card surface="contained">
                  <CardContent>
                    <form
                      onSubmit={submitCollaborator}
                      className="flex flex-col gap-3"
                    >
                      <div>
                        <h3 className="text-base font-semibold">
                          Collaborator authority
                        </h3>
                        <p className="mt-1 text-sm text-text-secondary">
                          Grants or changes a user role on this Unit. Impact:
                          the user receives the selected editorial authority for
                          collaborative surfaces.
                        </p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
                        <div className="flex flex-col gap-1">
                          <Label htmlFor="authority-collaborator-user">
                            User ID
                          </Label>
                          <Input
                            id="authority-collaborator-user"
                            value={collaboratorUserId}
                            onChange={(event) =>
                              setCollaboratorUserId(event.target.value)
                            }
                            placeholder="target user id"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <Label htmlFor="authority-collaborator-role">
                            Role
                          </Label>
                          <Select
                            value={collaboratorRole}
                            onValueChange={(value) =>
                              setCollaboratorRole(value as UnitAuthorityRoleKey)
                            }
                          >
                            <SelectTrigger id="authority-collaborator-role">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {authorityRoles.map((role) => (
                                <SelectItem key={role} value={role}>
                                  {role}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <Button
                        type="submit"
                        disabled={upsertCollaborator.isPending}
                      >
                        Apply collaborator role
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                <Card surface="contained">
                  <CardContent>
                    <form
                      onSubmit={submitFieldLock}
                      className="flex flex-col gap-3"
                    >
                      <div>
                        <h3 className="text-base font-semibold">
                          Field lock authority
                        </h3>
                        <p className="mt-1 text-sm text-text-secondary">
                          Locks a field path from normal edits. Impact: matching
                          edit patches are rejected until an operator removes
                          the lock.
                        </p>
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label htmlFor="authority-lock-path">Field path</Label>
                        <Input
                          id="authority-lock-path"
                          value={lockPath}
                          onChange={(event) => setLockPath(event.target.value)}
                          placeholder="translations.en.title or *"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label htmlFor="authority-lock-reason">
                          Audit reason
                        </Label>
                        <Textarea
                          id="authority-lock-reason"
                          value={lockReason}
                          onChange={(event) =>
                            setLockReason(event.target.value)
                          }
                          rows={3}
                          placeholder="why this field requires operator lock"
                        />
                      </div>
                      <Button
                        type="submit"
                        disabled={upsertFieldLock.isPending}
                      >
                        Apply field lock
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <section className="flex flex-col gap-3">
                  <h3 className="text-base font-semibold">
                    {t("admin:unit_field_locks_title")}
                  </h3>
                  {fieldLocksQuery.isLoading ? (
                    <div className="flex justify-center py-4">
                      <Spinner />
                    </div>
                  ) : fieldLocksQuery.isError ? (
                    <p className="text-sm text-error-text">
                      {t("admin:unit_field_locks_failed_load")}
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
                            {t("admin:unit_field_lock_locked_by", {
                              userId: lock.lockedById,
                              date: fmtDate(lock.createdAt),
                            })}
                          </p>
                          {lock.reason ? (
                            <p className="text-xs text-text-secondary">
                              {lock.reason}
                            </p>
                          ) : null}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="mt-2"
                            disabled={removeFieldLock.isPending}
                            onClick={() => handleRemoveFieldLock(lock.path)}
                          >
                            Remove lock
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-text-secondary">
                      {t("admin:unit_field_locks_empty")}
                    </p>
                  )}
                </section>

                <section className="flex flex-col gap-3">
                  <h3 className="text-base font-semibold">
                    {t("admin:unit_collaborators_title")}
                  </h3>
                  {collaboratorsQuery.isLoading ? (
                    <div className="flex justify-center py-4">
                      <Spinner />
                    </div>
                  ) : collaboratorsQuery.isError ? (
                    <p className="text-sm text-error-text">
                      {t("admin:unit_collaborators_failed_load")}
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
                              {t("admin:unit_collaborator_added_by", {
                                role: collaborator.roleKey,
                                userId: collaborator.addedById,
                                date: fmtDate(collaborator.createdAt),
                              })}
                            </p>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="mt-2"
                              disabled={removeCollaborator.isPending}
                              onClick={() =>
                                handleRemoveCollaborator(collaborator.userId)
                              }
                            >
                              Remove collaborator
                            </Button>
                          </div>
                        ),
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-text-secondary">
                      {t("admin:unit_collaborators_empty")}
                    </p>
                  )}
                </section>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </Page>
  );
}
