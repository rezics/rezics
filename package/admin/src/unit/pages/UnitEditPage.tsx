import {
  type RemoveUnitCollaboratorVariables,
  type RemoveUnitFieldLockVariables,
  type UnitDTO,
  unitAuthorityQueries,
  unitMutations,
  useRemoveUnitCollaboratorMutation,
  useRemoveUnitFieldLockMutation,
  useUpsertUnitCollaboratorMutation,
  useUpsertUnitFieldLockMutation,
} from "@rezics/api/unit/unit";
import {
  subjectAttributionQueries,
  useLinkSubjectAttributionMutation,
  useUnlinkSubjectAttributionMutation,
} from "@rezics/api/subject-attribution/subject-attribution";
import {
  type LockFieldKey,
  UNIT_FIELD_KEYS,
  UNIT_FIELD_LOCK_ALL,
  UnitAuthorityRoleKey,
  type UnitAuthorityRoleKey as UnitAuthorityRoleKeyType,
  subjectAttributionRoleRegistry,
  subjectAttributionRoles,
} from "@rezics/contract";

import { Spinner } from "@rezics/ui";
import { Link } from "@rezics/ui/primitive/link/Link.tsx";
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
import i18n from "i18next";
import React from "react";

import { Page } from "@/core/layouts/Page";
import { Route } from "@/routes/_admin/unit/$unitId";
import {
  ArrowLeft as ArrowBackIcon,
  Plus as PlusIcon,
  Save as SaveIcon,
  Trash2 as TrashIcon,
} from "lucide-react";

const lockFieldOptions = [UNIT_FIELD_LOCK_ALL, ...UNIT_FIELD_KEYS] as const;
const collaboratorRoleOptions = Object.values(UnitAuthorityRoleKey);

function fmtDate(v?: string | Date) {
  if (!v) return "";
  const d = typeof v === "string" ? new Date(v) : v;
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString();
}

function toJsonText(value: unknown) {
  if (value == null) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function tLabel(key: string, fallback: string) {
  const translated = i18n.t(key);
  return translated === key ? fallback : translated;
}

export default function UnitEditPage() {
  const { unitId } = Route.useParams();
  const [error, setError] = React.useState<string | null>(null);

  const detailQuery = useQuery(unitQueries.detail(unitId));
  const subjectQuery = useQuery(subjectAttributionQueries.byUnit(unitId));
  const fieldLocksQuery = useQuery(unitAuthorityQueries.fieldLocks(unitId));
  const collaboratorsQuery = useQuery(
    unitAuthorityQueries.collaborators(unitId),
  );

  const updateMutation = unitMutations.useUpdate({
    onError: (err) =>
      setError(err instanceof Error ? err.message : "Update failed"),
    onSuccess: () => setError(null),
  });
  const linkSubjectMutation = useLinkSubjectAttributionMutation({
    onError: (err) =>
      setError(err instanceof Error ? err.message : "Subject link failed"),
    onSuccess: () => setError(null),
  });
  const unlinkSubjectMutation = useUnlinkSubjectAttributionMutation({
    onError: (err) =>
      setError(err instanceof Error ? err.message : "Subject unlink failed"),
    onSuccess: () => setError(null),
  });
  const upsertFieldLockMutation = useUpsertUnitFieldLockMutation({
    onError: (err) =>
      setError(err instanceof Error ? err.message : "Field lock update failed"),
    onSuccess: () => setError(null),
  });
  const removeFieldLockMutation = useRemoveUnitFieldLockMutation({
    onError: (err) =>
      setError(
        err instanceof Error ? err.message : "Field lock removal failed",
      ),
    onSuccess: () => setError(null),
  });
  const upsertCollaboratorMutation = useUpsertUnitCollaboratorMutation({
    onError: (err) =>
      setError(
        err instanceof Error ? err.message : "Collaborator update failed",
      ),
    onSuccess: () => setError(null),
  });
  const removeCollaboratorMutation = useRemoveUnitCollaboratorMutation({
    onError: (err) =>
      setError(
        err instanceof Error ? err.message : "Collaborator removal failed",
      ),
    onSuccess: () => setError(null),
  });

  const [status, setStatus] = React.useState("");
  const [visibility, setVisibility] = React.useState("");
  const [extraText, setExtraText] = React.useState("");
  const [subjectEntityId, setSubjectEntityId] = React.useState("");
  const [subjectRole, setSubjectRole] = React.useState<
    (typeof subjectAttributionRoles)[number]
  >(subjectAttributionRoles[0]);
  const [subjectSortOrder, setSubjectSortOrder] = React.useState("0");
  const [subjectWeight, setSubjectWeight] = React.useState("");
  const [lockFieldKey, setLockFieldKey] =
    React.useState<LockFieldKey>(UNIT_FIELD_LOCK_ALL);
  const [lockReason, setLockReason] = React.useState("");
  const [collaboratorUserId, setCollaboratorUserId] = React.useState("");
  const [collaboratorRole, setCollaboratorRole] =
    React.useState<UnitAuthorityRoleKeyType>(UnitAuthorityRoleKey.EDITOR);

  React.useEffect(() => {
    const u: UnitDTO | undefined = detailQuery.data;
    if (!u) return;
    setStatus(u.status ?? "");
    setVisibility(u.visibility ?? "");
    setExtraText(toJsonText(u.extra));
  }, [detailQuery.data]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    let extra: any;
    const trimmedExtra = extraText.trim();
    if (trimmedExtra.length > 0) {
      try {
        extra = JSON.parse(trimmedExtra);
      } catch {
        setError("Extra must be valid JSON.");
        return;
      }
    }

    await updateMutation.mutateAsync({
      unitId,
      input: {
        status: status.trim() || undefined,
        visibility: visibility.trim() || undefined,
        extra,
      } as any,
    });

    await detailQuery.refetch();
  }

  async function onLinkSubject(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsedSortOrder = Number.parseInt(subjectSortOrder, 10);
    const parsedWeight = subjectWeight.trim()
      ? Number.parseFloat(subjectWeight)
      : undefined;

    if (!subjectEntityId.trim()) {
      setError("Subject Entity Unit ID is required.");
      return;
    }
    if (Number.isNaN(parsedSortOrder)) {
      setError("Sort order must be a number.");
      return;
    }
    if (parsedWeight !== undefined && Number.isNaN(parsedWeight)) {
      setError("Weight must be a number.");
      return;
    }

    await linkSubjectMutation.mutateAsync({
      unitId,
      entityId: subjectEntityId.trim(),
      role: subjectRole,
      sortOrder: parsedSortOrder,
      weight: parsedWeight,
    });
    setSubjectEntityId("");
    setSubjectSortOrder("0");
    setSubjectWeight("");
    await subjectQuery.refetch();
  }

  async function onUpsertFieldLock(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    await upsertFieldLockMutation.mutateAsync({
      unitId,
      fieldKey: lockFieldKey,
      reason: lockReason.trim() || null,
    });
    setLockReason("");
    await fieldLocksQuery.refetch();
  }

  async function onRemoveFieldLock(variables: RemoveUnitFieldLockVariables) {
    setError(null);
    await removeFieldLockMutation.mutateAsync(variables);
    await fieldLocksQuery.refetch();
  }

  async function onUpsertCollaborator(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!collaboratorUserId.trim()) {
      setError("Collaborator User Unit ID is required.");
      return;
    }
    await upsertCollaboratorMutation.mutateAsync({
      unitId,
      userId: collaboratorUserId.trim(),
      roleKey: collaboratorRole,
    });
    setCollaboratorUserId("");
    await collaboratorsQuery.refetch();
  }

  async function onRemoveCollaborator(
    variables: RemoveUnitCollaboratorVariables,
  ) {
    setError(null);
    await removeCollaboratorMutation.mutateAsync(variables);
    await collaboratorsQuery.refetch();
  }

  return (
    <Page title="Edit Unit" description={`编辑 Unit：${unitId}`}>
      <Card>
        <CardContent>
          <div className="flex flex-row items-center gap-2 mb-2">
            <Button
              variant="ghost"
              size="sm"
              render={(props) => (
                <Link to="/unit" {...props}>
                  <ArrowBackIcon className="size-4" />
                  Back
                </Link>
              )}
            />
            <div className="flex-1" />
          </div>

          <Separator className="my-4" />

          {detailQuery.isLoading ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : detailQuery.isError ? (
            <div>
              <Alert>
                <AlertDescription className="text-error-text">
                  Failed to load unit.
                </AlertDescription>
              </Alert>
              {detailQuery.error ? (
                <p className="text-xs text-error-text mt-2">
                  {String(detailQuery.error)}
                </p>
              ) : null}
            </div>
          ) : (
            <>
              {error ? (
                <Alert className="mb-4">
                  <AlertDescription className="text-error-text">
                    {error}
                  </AlertDescription>
                </Alert>
              ) : null}

              <div className="flex flex-col gap-1 mb-4">
                <p className="text-sm text-text-secondary">
                  ID: <strong>{detailQuery.data?.id ?? "-"}</strong>
                </p>
                <p className="text-sm text-text-secondary">
                  User ID: <strong>{detailQuery.data?.userId ?? "-"}</strong>
                </p>
                <p className="text-sm text-text-secondary">
                  Type: <strong>{detailQuery.data?.type ?? "-"}</strong>
                </p>
                <p className="text-sm text-text-secondary">
                  Default Language:{" "}
                  <strong>{detailQuery.data?.defaultLanguage ?? "-"}</strong>
                </p>
                <p className="text-sm text-text-secondary">
                  Created:{" "}
                  <strong>{fmtDate(detailQuery.data?.createdAt)}</strong>
                </p>
                <p className="text-sm text-text-secondary">
                  Updated:{" "}
                  <strong>{fmtDate(detailQuery.data?.updatedAt)}</strong>
                </p>
              </div>

              {/* Translations (read-only display) */}
              {detailQuery.data?.translations?.length ? (
                <div className="flex flex-col gap-2 mb-6">
                  <p className="text-xs font-semibold text-text-secondary">
                    Translations
                  </p>
                  {detailQuery.data.translations.map((tr) => (
                    <div
                      key={`${tr.unitId}-${tr.language}`}
                      className="pl-4 border-l-2 border-border-whisper"
                    >
                      <p className="text-sm font-semibold">
                        [{tr.language}] {tr.title || "(no title)"}
                      </p>
                      {tr.subtitle ? (
                        <p className="text-xs text-text-secondary">
                          Subtitle: {tr.subtitle}
                        </p>
                      ) : null}
                      {tr.summary ? (
                        <p className="text-sm text-text-secondary mt-1">
                          {tr.summary}
                        </p>
                      ) : null}
                    </div>
                  ))}
                  <p className="text-xs text-text-secondary">
                    Translations are managed via the translation API endpoints.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-text-secondary mb-4">
                  No translations available.
                </p>
              )}

              <Separator className="mb-4" />

              <section className="flex flex-col gap-3 mb-6">
                <div className="flex flex-col gap-1">
                  <h3 className="text-base font-semibold">
                    Subject Attributions
                  </h3>
                  <p className="text-xs text-text-secondary">
                    Link character, faction, location, event, or concept
                    Entities to this Unit for subject indexing.
                  </p>
                </div>

                {subjectQuery.isLoading ? (
                  <div className="flex justify-center py-4">
                    <Spinner />
                  </div>
                ) : subjectQuery.isError ? (
                  <p className="text-sm text-error-text">
                    Failed to load subject attributions.
                  </p>
                ) : subjectQuery.data?.length ? (
                  <div className="flex flex-col gap-2">
                    {subjectQuery.data.map((subject) => (
                      <div
                        key={`${subject.entityId}-${subject.role}`}
                        className="flex flex-col gap-2 border-b border-border-whisper py-2 sm:flex-row sm:items-center"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-subtle text-xs text-text-secondary">
                            {subject.entity?.avatar ? (
                              <img
                                src={subject.entity.avatar}
                                alt=""
                                className="size-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              (
                                subject.entity?.translations?.[0]?.title ??
                                subject.entityId
                              )
                                .slice(0, 1)
                                .toUpperCase()
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {subject.entity?.translations?.[0]?.title ??
                                subject.entityId}
                            </p>
                            <p className="text-xs text-text-secondary">
                              {tLabel(
                                subjectAttributionRoleRegistry[subject.role]
                                  .i18nKey,
                                subject.role,
                              )}{" "}
                              ·{" "}
                              {subject.entity?.kind
                                ? tLabel(
                                    `entity.kind.${subject.entity.kind}`,
                                    subject.entity.kind,
                                  )
                                : "entity"}{" "}
                              · order {subject.sortOrder}
                              {subject.weight != null
                                ? ` · weight ${subject.weight}`
                                : ""}
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Remove subject attribution"
                          disabled={unlinkSubjectMutation.isPending}
                          onClick={async () => {
                            await unlinkSubjectMutation.mutateAsync({
                              unitId,
                              entityId: subject.entityId,
                              role: subject.role,
                            });
                            await subjectQuery.refetch();
                          }}
                        >
                          <TrashIcon className="size-4 text-text-secondary" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-text-secondary">
                    No subject attributions yet.
                  </p>
                )}

                <form
                  onSubmit={onLinkSubject}
                  className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_180px_96px_96px_auto]"
                >
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="subject-entity-id">
                      Subject Entity Unit ID
                    </Label>
                    <Input
                      id="subject-entity-id"
                      value={subjectEntityId}
                      onChange={(e) => setSubjectEntityId(e.target.value)}
                      placeholder="ENTITY unit id"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="subject-role">Role</Label>
                    <select
                      id="subject-role"
                      value={subjectRole}
                      onChange={(e) =>
                        setSubjectRole(
                          e.target
                            .value as (typeof subjectAttributionRoles)[number],
                        )
                      }
                      className="h-9 rounded-md border border-border-whisper bg-transparent px-2 text-sm"
                    >
                      {subjectAttributionRoles.map((role) => (
                        <option key={role} value={role}>
                          {tLabel(
                            subjectAttributionRoleRegistry[role].i18nKey,
                            role,
                          )}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="subject-sort-order">Order</Label>
                    <Input
                      id="subject-sort-order"
                      value={subjectSortOrder}
                      onChange={(e) => setSubjectSortOrder(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="subject-weight">Weight</Label>
                    <Input
                      id="subject-weight"
                      value={subjectWeight}
                      onChange={(e) => setSubjectWeight(e.target.value)}
                      placeholder="optional"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="self-end"
                    disabled={linkSubjectMutation.isPending}
                  >
                    <PlusIcon className="size-4" />
                    Link
                  </Button>
                </form>
              </section>

              <Separator className="mb-4" />

              <section className="grid grid-cols-1 gap-6 mb-6 lg:grid-cols-2">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <h3 className="text-base font-semibold">Field Locks</h3>
                    <p className="text-xs text-text-secondary">
                      Manage sparse collaborative locks for this Unit. Whole
                      object locks use the <code>*</code> field key.
                    </p>
                  </div>

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
                          className="flex flex-col gap-2 border-b border-border-whisper py-2 sm:flex-row sm:items-center"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {lock.fieldKey}
                            </p>
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
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="Remove field lock"
                            disabled={removeFieldLockMutation.isPending}
                            onClick={() =>
                              onRemoveFieldLock({
                                unitId,
                                fieldKey: lock.fieldKey,
                              })
                            }
                          >
                            <TrashIcon className="size-4 text-text-secondary" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-text-secondary">
                      No field locks are active.
                    </p>
                  )}

                  <form
                    onSubmit={onUpsertFieldLock}
                    className="grid grid-cols-1 gap-3 sm:grid-cols-[220px_minmax(0,1fr)_auto]"
                  >
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="field-lock-key">Field</Label>
                      <select
                        id="field-lock-key"
                        value={lockFieldKey}
                        onChange={(e) =>
                          setLockFieldKey(e.target.value as LockFieldKey)
                        }
                        className="h-9 rounded-md border border-border-whisper bg-transparent px-2 text-sm"
                      >
                        {lockFieldOptions.map((fieldKey) => (
                          <option key={fieldKey} value={fieldKey}>
                            {fieldKey}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="field-lock-reason">Reason</Label>
                      <Input
                        id="field-lock-reason"
                        value={lockReason}
                        onChange={(e) => setLockReason(e.target.value)}
                        placeholder="optional moderation note"
                      />
                    </div>
                    <Button
                      type="submit"
                      className="self-end"
                      disabled={upsertFieldLockMutation.isPending}
                    >
                      <PlusIcon className="size-4" />
                      Lock
                    </Button>
                  </form>
                </div>

                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <h3 className="text-base font-semibold">Collaborators</h3>
                    <p className="text-xs text-text-secondary">
                      Delegate per-Unit authority without changing the primary
                      owner.
                    </p>
                  </div>

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
                            className="flex flex-col gap-2 border-b border-border-whisper py-2 sm:flex-row sm:items-center"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">
                                {collaborator.userId}
                              </p>
                              <p className="text-xs text-text-secondary">
                                {collaborator.roleKey} · added by{" "}
                                {collaborator.addedById} ·{" "}
                                {fmtDate(collaborator.createdAt)}
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label="Remove collaborator"
                              disabled={removeCollaboratorMutation.isPending}
                              onClick={() =>
                                onRemoveCollaborator({
                                  unitId,
                                  userId: collaborator.userId,
                                })
                              }
                            >
                              <TrashIcon className="size-4 text-text-secondary" />
                            </Button>
                          </div>
                        ),
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-text-secondary">
                      No collaborators are assigned.
                    </p>
                  )}

                  <form
                    onSubmit={onUpsertCollaborator}
                    className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_160px_auto]"
                  >
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="collaborator-user-id">User Unit ID</Label>
                      <Input
                        id="collaborator-user-id"
                        value={collaboratorUserId}
                        onChange={(e) => setCollaboratorUserId(e.target.value)}
                        placeholder="USER unit id"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="collaborator-role">Role</Label>
                      <select
                        id="collaborator-role"
                        value={collaboratorRole}
                        onChange={(e) =>
                          setCollaboratorRole(
                            e.target.value as UnitAuthorityRoleKeyType,
                          )
                        }
                        className="h-9 rounded-md border border-border-whisper bg-transparent px-2 text-sm"
                      >
                        {collaboratorRoleOptions.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Button
                      type="submit"
                      className="self-end"
                      disabled={upsertCollaboratorMutation.isPending}
                    >
                      <PlusIcon className="size-4" />
                      Add
                    </Button>
                  </form>
                </div>
              </section>

              <Separator className="mb-4" />

              <form onSubmit={onSubmit}>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="uep-status">Status</Label>
                    <Input
                      id="uep-status"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      placeholder="DRAFT / PUBLISHED / ARCHIVED / ..."
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="uep-visibility">Visibility</Label>
                    <Input
                      id="uep-visibility"
                      value={visibility}
                      onChange={(e) => setVisibility(e.target.value)}
                      placeholder="PUBLIC / UNLISTED / PRIVATE"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="uep-extra">Extra (JSON)</Label>
                    <textarea
                      id="uep-extra"
                      value={extraText}
                      onChange={(e) => setExtraText(e.target.value)}
                      rows={6}
                      placeholder='{"key":"value"}'
                      className="font-mono rounded-md border border-border-whisper bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-fill"
                    />
                  </div>

                  <div>
                    <Button type="submit" disabled={updateMutation.isPending}>
                      <SaveIcon className="size-4" />
                      {updateMutation.isPending ? "Saving…" : "Save"}
                    </Button>
                  </div>
                </div>
              </form>
            </>
          )}
        </CardContent>
      </Card>
    </Page>
  );
}
