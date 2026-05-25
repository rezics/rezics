import {
  subjectAttributionQueries,
  useLinkSubjectAttributionMutation,
  useUnlinkSubjectAttributionMutation,
} from "@rezics/api/subject-attribution/subject-attribution";
import {
  type RemoveUnitCollaboratorVariables,
  type RemoveUnitFieldLockVariables,
  type UnitDTO,
  unitAuthorityQueries,
  unitMutations,
  unitQueries,
  useRemoveUnitCollaboratorMutation,
  useRemoveUnitFieldLockMutation,
  useUpsertUnitCollaboratorMutation,
  useUpsertUnitFieldLockMutation,
} from "@rezics/api/unit/unit";
import {
  subjectAttributionRoles,
  UNIT_FIELD_LOCK_ALL,
  UnitAuthorityRoleKey,
  type UnitAuthorityRoleKey as UnitAuthorityRoleKeyType,
} from "@rezics/contract";
import { entityKindLabel, subjectRoleLabel } from "@rezics/i18n";
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
import {
  ArrowLeft as ArrowBackIcon,
  Plus as PlusIcon,
  Save as SaveIcon,
  Trash2 as TrashIcon,
} from "lucide-react";
import React from "react";
import { Page } from "@/core/layouts/Page";
import { Route } from "@/routes/_admin/unit/$unitId";
import { Link } from "@/shared/ui/link";
import { useMessage } from "@rezics/i18n/react";
import {
  admin_auth_email_status,
  admin_auth_user_id,
  admin_auth_user_role,
  admin_unit_collaborator_added_by,
  admin_unit_collaborator_removal_failed,
  admin_unit_collaborator_remove,
  admin_unit_collaborator_required,
  admin_unit_collaborator_update_failed,
  admin_unit_collaborators_description,
  admin_unit_collaborators_empty,
  admin_unit_collaborators_failed_load,
  admin_unit_collaborators_title,
  admin_unit_default_language,
  admin_unit_edit_description,
  admin_unit_edit_title,
  admin_unit_entity_fallback,
  admin_unit_extra_json,
  admin_unit_extra_json_invalid,
  admin_unit_failed_load,
  admin_unit_field,
  admin_unit_field_lock_locked_by,
  admin_unit_field_lock_removal_failed,
  admin_unit_field_lock_remove,
  admin_unit_field_lock_update_failed,
  admin_unit_field_locks_description,
  admin_unit_field_locks_empty,
  admin_unit_field_locks_failed_load,
  admin_unit_field_locks_title,
  admin_unit_locked_reason,
  admin_unit_no_title,
  admin_unit_no_translations,
  admin_unit_optional,
  admin_unit_optional_moderation_note,
  admin_unit_order,
  admin_unit_sort_order_invalid,
  admin_unit_status_placeholder,
  admin_unit_subject_attribution_empty,
  admin_unit_subject_attribution_failed_load,
  admin_unit_subject_attribution_remove,
  admin_unit_subject_attributions_description,
  admin_unit_subject_attributions_title,
  admin_unit_subject_entity_id,
  admin_unit_subject_entity_placeholder,
  admin_unit_subject_link_failed,
  admin_unit_subject_required,
  admin_unit_subject_unlink_failed,
  admin_unit_subtitle_label,
  admin_unit_translations,
  admin_unit_translations_help,
  admin_unit_update_failed,
  admin_unit_user_unit_id,
  admin_unit_user_unit_placeholder,
  admin_unit_visibility,
  admin_unit_visibility_placeholder,
  admin_unit_weight,
  admin_unit_weight_invalid,
  common_add,
  common_back,
  common_created,
  common_link,
  common_lock,
  common_save,
  common_saving,
  common_type,
  common_updated,
} from "@rezics/i18n/messages";
const i18nMessages = {
  admin_auth_email_status,
  admin_auth_user_id,
  admin_auth_user_role,
  admin_unit_collaborator_added_by,
  admin_unit_collaborator_removal_failed,
  admin_unit_collaborator_remove,
  admin_unit_collaborator_required,
  admin_unit_collaborator_update_failed,
  admin_unit_collaborators_description,
  admin_unit_collaborators_empty,
  admin_unit_collaborators_failed_load,
  admin_unit_collaborators_title,
  admin_unit_default_language,
  admin_unit_edit_description,
  admin_unit_edit_title,
  admin_unit_entity_fallback,
  admin_unit_extra_json,
  admin_unit_extra_json_invalid,
  admin_unit_failed_load,
  admin_unit_field,
  admin_unit_field_lock_locked_by,
  admin_unit_field_lock_removal_failed,
  admin_unit_field_lock_remove,
  admin_unit_field_lock_update_failed,
  admin_unit_field_locks_description,
  admin_unit_field_locks_empty,
  admin_unit_field_locks_failed_load,
  admin_unit_field_locks_title,
  admin_unit_locked_reason,
  admin_unit_no_title,
  admin_unit_no_translations,
  admin_unit_optional,
  admin_unit_optional_moderation_note,
  admin_unit_order,
  admin_unit_sort_order_invalid,
  admin_unit_status_placeholder,
  admin_unit_subject_attribution_empty,
  admin_unit_subject_attribution_failed_load,
  admin_unit_subject_attribution_remove,
  admin_unit_subject_attributions_description,
  admin_unit_subject_attributions_title,
  admin_unit_subject_entity_id,
  admin_unit_subject_entity_placeholder,
  admin_unit_subject_link_failed,
  admin_unit_subject_required,
  admin_unit_subject_unlink_failed,
  admin_unit_subtitle_label,
  admin_unit_translations,
  admin_unit_translations_help,
  admin_unit_update_failed,
  admin_unit_user_unit_id,
  admin_unit_user_unit_placeholder,
  admin_unit_visibility,
  admin_unit_visibility_placeholder,
  admin_unit_weight,
  admin_unit_weight_invalid,
  common_add,
  common_back,
  common_created,
  common_link,
  common_lock,
  common_save,
  common_saving,
  common_type,
  common_updated,
};

const lockPathOptions = [
  UNIT_FIELD_LOCK_ALL,
  "translations",
  "translations.en.title",
  "translations.en.summary",
  "translations.en.description",
  "extension.isbn13",
  "extension.publicationDate",
  "extension.pageCount",
  "credits.authors",
  "credits.translators",
  "subjects.character",
  "post.content.main",
  "post.content.main.source",
] as const;
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

export default function UnitEditPage() {
  const m = useMessage(i18nMessages);
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
      setError(
        err instanceof Error ? err.message : m.admin_unit_update_failed(),
      ),
    onSuccess: () => setError(null),
  });
  const linkSubjectMutation = useLinkSubjectAttributionMutation({
    onError: (err) =>
      setError(
        err instanceof Error ? err.message : m.admin_unit_subject_link_failed(),
      ),
    onSuccess: () => setError(null),
  });
  const unlinkSubjectMutation = useUnlinkSubjectAttributionMutation({
    onError: (err) =>
      setError(
        err instanceof Error
          ? err.message
          : m.admin_unit_subject_unlink_failed(),
      ),
    onSuccess: () => setError(null),
  });
  const upsertFieldLockMutation = useUpsertUnitFieldLockMutation({
    onError: (err) =>
      setError(
        err instanceof Error
          ? err.message
          : m.admin_unit_field_lock_update_failed(),
      ),
    onSuccess: () => setError(null),
  });
  const removeFieldLockMutation = useRemoveUnitFieldLockMutation({
    onError: (err) =>
      setError(
        err instanceof Error
          ? err.message
          : m.admin_unit_field_lock_removal_failed(),
      ),
    onSuccess: () => setError(null),
  });
  const upsertCollaboratorMutation = useUpsertUnitCollaboratorMutation({
    onError: (err) =>
      setError(
        err instanceof Error
          ? err.message
          : m.admin_unit_collaborator_update_failed(),
      ),
    onSuccess: () => setError(null),
  });
  const removeCollaboratorMutation = useRemoveUnitCollaboratorMutation({
    onError: (err) =>
      setError(
        err instanceof Error
          ? err.message
          : m.admin_unit_collaborator_removal_failed(),
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
  const [lockPath, setLockPath] = React.useState<string>(UNIT_FIELD_LOCK_ALL);
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
        setError(m.admin_unit_extra_json_invalid());
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
      setError(m.admin_unit_subject_required());
      return;
    }
    if (Number.isNaN(parsedSortOrder)) {
      setError(m.admin_unit_sort_order_invalid());
      return;
    }
    if (parsedWeight !== undefined && Number.isNaN(parsedWeight)) {
      setError(m.admin_unit_weight_invalid());
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
      path: lockPath,
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
      setError(m.admin_unit_collaborator_required());
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
    <Page
      title={m.admin_unit_edit_title()}
      description={m.admin_unit_edit_description({ unitId })}
    >
      <Card>
        <CardContent>
          <div className="flex flex-row items-center gap-2 mb-2">
            <Button
              variant="ghost"
              size="sm"
              render={(props) => (
                <Link to="/unit" {...props}>
                  <ArrowBackIcon className="size-4" />
                  {m.common_back()}
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
                  {m.admin_unit_failed_load()}
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
                  {m.admin_auth_user_id()}:{" "}
                  <strong>{detailQuery.data?.userId ?? "-"}</strong>
                </p>
                <p className="text-sm text-text-secondary">
                  {m.common_type()}:{" "}
                  <strong>{detailQuery.data?.type ?? "-"}</strong>
                </p>
                <p className="text-sm text-text-secondary">
                  {m.admin_unit_default_language()}:{" "}
                  <strong>{detailQuery.data?.defaultLanguage ?? "-"}</strong>
                </p>
                <p className="text-sm text-text-secondary">
                  {m.common_created()}:{" "}
                  <strong>{fmtDate(detailQuery.data?.createdAt)}</strong>
                </p>
                <p className="text-sm text-text-secondary">
                  {m.common_updated()}:{" "}
                  <strong>{fmtDate(detailQuery.data?.updatedAt)}</strong>
                </p>
              </div>

              {/* Translations (read-only display) */}
              {detailQuery.data?.translations?.length ? (
                <div className="flex flex-col gap-2 mb-6">
                  <p className="text-xs font-semibold text-text-secondary">
                    {m.admin_unit_translations()}
                  </p>
                  {detailQuery.data.translations.map((tr) => (
                    <div
                      key={`${tr.unitId}-${tr.language}`}
                      className="pl-4 border-l-2 border-border-whisper"
                    >
                      <p className="text-sm font-semibold">
                        [{tr.language}] {tr.title || m.admin_unit_no_title()}
                      </p>
                      {tr.subtitle ? (
                        <p className="text-xs text-text-secondary">
                          {m.admin_unit_subtitle_label({
                            subtitle: tr.subtitle,
                          })}
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
                    {m.admin_unit_translations_help()}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-text-secondary mb-4">
                  {m.admin_unit_no_translations()}
                </p>
              )}

              <Separator className="mb-4" />

              <section className="flex flex-col gap-3 mb-6">
                <div className="flex flex-col gap-1">
                  <h3 className="text-base font-semibold">
                    {m.admin_unit_subject_attributions_title()}
                  </h3>
                  <p className="text-xs text-text-secondary">
                    {m.admin_unit_subject_attributions_description()}
                  </p>
                </div>

                {subjectQuery.isLoading ? (
                  <div className="flex justify-center py-4">
                    <Spinner />
                  </div>
                ) : subjectQuery.isError ? (
                  <p className="text-sm text-error-text">
                    {m.admin_unit_subject_attribution_failed_load()}
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
                              {subjectRoleLabel(subject.role)} ·{" "}
                              {subject.entity?.kind
                                ? entityKindLabel(subject.entity.kind)
                                : m.admin_unit_entity_fallback()}{" "}
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
                          aria-label={m.admin_unit_subject_attribution_remove()}
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
                    {m.admin_unit_subject_attribution_empty()}
                  </p>
                )}

                <form
                  onSubmit={onLinkSubject}
                  className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_180px_96px_96px_auto]"
                >
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="subject-entity-id">
                      {m.admin_unit_subject_entity_id()}
                    </Label>
                    <Input
                      id="subject-entity-id"
                      value={subjectEntityId}
                      onChange={(e) => setSubjectEntityId(e.target.value)}
                      placeholder={m.admin_unit_subject_entity_placeholder()}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="subject-role">
                      {m.admin_auth_user_role()}
                    </Label>
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
                          {subjectRoleLabel(role)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="subject-sort-order">
                      {m.admin_unit_order()}
                    </Label>
                    <Input
                      id="subject-sort-order"
                      value={subjectSortOrder}
                      onChange={(e) => setSubjectSortOrder(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="subject-weight">
                      {m.admin_unit_weight()}
                    </Label>
                    <Input
                      id="subject-weight"
                      value={subjectWeight}
                      onChange={(e) => setSubjectWeight(e.target.value)}
                      placeholder={m.admin_unit_optional()}
                    />
                  </div>
                  <Button
                    type="submit"
                    className="self-end"
                    disabled={linkSubjectMutation.isPending}
                  >
                    <PlusIcon className="size-4" />
                    {m.common_link()}
                  </Button>
                </form>
              </section>

              <Separator className="mb-4" />

              <section className="grid grid-cols-1 gap-6 mb-6 lg:grid-cols-2">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <h3 className="text-base font-semibold">
                      {m.admin_unit_field_locks_title()}
                    </h3>
                    <p className="text-xs text-text-secondary">
                      {m.admin_unit_field_locks_description()}
                    </p>
                  </div>

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
                          className="flex flex-col gap-2 border-b border-border-whisper py-2 sm:flex-row sm:items-center"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {lock.path}
                            </p>
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
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={m.admin_unit_field_lock_remove()}
                            disabled={removeFieldLockMutation.isPending}
                            onClick={() =>
                              onRemoveFieldLock({
                                unitId,
                                path: lock.path,
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
                      {m.admin_unit_field_locks_empty()}
                    </p>
                  )}

                  <form
                    onSubmit={onUpsertFieldLock}
                    className="grid grid-cols-1 gap-3 sm:grid-cols-[220px_minmax(0,1fr)_auto]"
                  >
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="field-lock-path">
                        {m.admin_unit_field()}
                      </Label>
                      <select
                        id="field-lock-path"
                        value={lockPath}
                        onChange={(e) => setLockPath(e.target.value)}
                        className="h-9 rounded-md border border-border-whisper bg-transparent px-2 text-sm"
                      >
                        {lockPathOptions.map((path) => (
                          <option key={path} value={path}>
                            {path}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="field-lock-reason">
                        {m.admin_unit_locked_reason()}
                      </Label>
                      <Input
                        id="field-lock-reason"
                        value={lockReason}
                        onChange={(e) => setLockReason(e.target.value)}
                        placeholder={m.admin_unit_optional_moderation_note()}
                      />
                    </div>
                    <Button
                      type="submit"
                      className="self-end"
                      disabled={upsertFieldLockMutation.isPending}
                    >
                      <PlusIcon className="size-4" />
                      {m.common_lock()}
                    </Button>
                  </form>
                </div>

                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <h3 className="text-base font-semibold">
                      {m.admin_unit_collaborators_title()}
                    </h3>
                    <p className="text-xs text-text-secondary">
                      {m.admin_unit_collaborators_description()}
                    </p>
                  </div>

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
                            className="flex flex-col gap-2 border-b border-border-whisper py-2 sm:flex-row sm:items-center"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">
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
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={m.admin_unit_collaborator_remove()}
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
                      {m.admin_unit_collaborators_empty()}
                    </p>
                  )}

                  <form
                    onSubmit={onUpsertCollaborator}
                    className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_160px_auto]"
                  >
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="collaborator-user-id">
                        {m.admin_unit_user_unit_id()}
                      </Label>
                      <Input
                        id="collaborator-user-id"
                        value={collaboratorUserId}
                        onChange={(e) => setCollaboratorUserId(e.target.value)}
                        placeholder={m.admin_unit_user_unit_placeholder()}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="collaborator-role">
                        {m.admin_auth_user_role()}
                      </Label>
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
                      {m.common_add()}
                    </Button>
                  </form>
                </div>
              </section>

              <Separator className="mb-4" />

              <form onSubmit={onSubmit}>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="uep-status">
                      {m.admin_auth_email_status()}
                    </Label>
                    <Input
                      id="uep-status"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      placeholder={m.admin_unit_status_placeholder()}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="uep-visibility">
                      {m.admin_unit_visibility()}
                    </Label>
                    <Input
                      id="uep-visibility"
                      value={visibility}
                      onChange={(e) => setVisibility(e.target.value)}
                      placeholder={m.admin_unit_visibility_placeholder()}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="uep-extra">
                      {m.admin_unit_extra_json()}
                    </Label>
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
                      {updateMutation.isPending
                        ? m.common_saving()
                        : m.common_save()}
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
