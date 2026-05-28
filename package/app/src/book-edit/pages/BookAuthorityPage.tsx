import { bookQueries } from "@rezics/api/book/book";
import { useCanEdit } from "@rezics/api/hooks/useCanEdit";
import {
  unitAuthorityQueries,
  useRemoveUnitFieldLockMutation,
  useUpsertUnitFieldLockMutation,
} from "@rezics/api/unit/unit";
import type { UnitFieldLockDTO } from "@rezics/contract";
import {
  EDITORIAL_LOCK_PATH_OPTIONS,
  UNIT_FIELD_LOCK_ALL,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import {
  LockKeyhole,
  Plus,
  ShieldCheck,
  ShieldOff,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { QueryErrorDisplay } from "@/core/components/QueryErrorDisplay";
import {
  BOOK_LOCK_FIELD_GROUPS,
  editorialPathLabel,
  lockMatchesPath,
} from "@/unit/models/lockFieldLabels";

const CUSTOM_LOCK_PATH = "__custom__";

export function BookAuthorityPage() {
  const { bookId } = useParams({ strict: false }) as { bookId: string };
  const bookQuery = useQuery({
    ...bookQueries.detail(bookId),
    enabled: Boolean(bookId),
  });
  const canEditBook = useCanEdit({
    resource: "book",
    ownerUnit: bookQuery.data,
  });

  return (
    <main className="mx-auto mt-16 max-w-5xl px-4 pb-16">
      <BookAuthorityPanel
        unitId={bookId}
        canManageLocks={bookQuery.isSuccess ? canEditBook : undefined}
      />
    </main>
  );
}

export function BookAuthorityPanel({
  canManageLocks,
  initialLocks,
  unitId,
}: {
  canManageLocks?: boolean;
  initialLocks?: UnitFieldLockDTO[];
  unitId?: string;
}) {
  const { t } = useTranslation(["common", "editor"]);
  const [selectedPath, setSelectedPath] = useState<string>(
    EDITORIAL_LOCK_PATH_OPTIONS[1],
  );
  const [customPath, setCustomPath] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [localLocks, setLocalLocks] = useState<UnitFieldLockDTO[]>(
    initialLocks ?? [],
  );
  const demoMode = initialLocks !== undefined;
  const locksQuery = useQuery({
    ...unitAuthorityQueries.fieldLocks(unitId ?? ""),
    enabled: Boolean(unitId) && !demoMode,
  });
  const upsertLock = useUpsertUnitFieldLockMutation({
    onSuccess: () => {
      setError(null);
      setReason("");
    },
    onError: (err) => setError(err.message),
  });
  const removeLock = useRemoveUnitFieldLockMutation({
    onError: (err) => setError(err.message),
  });
  const locks = demoMode ? localLocks : (locksQuery.data?.locks ?? []);
  const allFieldsLock = locks.find((lock) => lock.path === UNIT_FIELD_LOCK_ALL);
  const allFieldsLocked = Boolean(allFieldsLock);
  const showMutationControls = canManageLocks !== false;
  const effectivePath =
    selectedPath === CUSTOM_LOCK_PATH ? customPath.trim() : selectedPath;
  const customPathError =
    selectedPath === CUSTOM_LOCK_PATH && customPath.trim().length === 0
      ? t("editor:authority_custom_path_required")
      : null;

  const upsert = (path: string) => {
    if (!unitId && !demoMode) return;
    if (!path.trim()) {
      setError(t("editor:authority_custom_path_required"));
      return;
    }

    if (demoMode) {
      setLocalLocks((current) =>
        current.some((lock) => lock.path === path)
          ? current
          : [
              ...current,
              {
                unitId: unitId ?? "storybook-unit",
                path,
                reason: reason.trim() || null,
                lockedById: "storybook-user",
                createdAt: new Date().toISOString(),
              },
            ],
      );
      setReason("");
      setError(null);
      return;
    }

    upsertLock.mutate({
      unitId: unitId ?? "",
      path,
      reason: reason.trim() || null,
    });
  };

  const remove = (path: string) => {
    if (!unitId && !demoMode) return;

    if (demoMode) {
      setLocalLocks((current) => current.filter((lock) => lock.path !== path));
      setError(null);
      return;
    }

    removeLock.mutate({ unitId: unitId ?? "", path });
  };

  const togglePath = (path: string, active: boolean) => {
    if (!showMutationControls) return;
    if (active) {
      remove(path);
      return;
    }
    upsert(path);
  };

  return (
    <section className="grid gap-8 text-sm leading-ui text-text-secondary">
      <header className="grid gap-3">
        <div className="flex items-center gap-2 text-text-primary">
          <LockKeyhole className="h-5 w-5" aria-hidden="true" />
          <h1 className="text-2xl font-medium leading-ui">
            {t("editor:authority_page_title")}
          </h1>
        </div>
        <p className="max-w-3xl leading-body">
          {t("editor:authority_page_description")}
        </p>
      </header>

      {canManageLocks === false ? (
        <p className="rounded-md bg-surface-subtle px-4 py-3 text-sm leading-ui text-text-secondary">
          {t("editor:authority_readonly_notice")}
        </p>
      ) : null}

      <section className="grid gap-4 rounded-md bg-surface-subtle p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="grid gap-1">
            <h2 className="text-base font-medium leading-ui text-text-primary">
              {t("editor:authority_all_fields_title")}
            </h2>
            <p className="max-w-2xl text-sm leading-ui text-text-secondary">
              {t("editor:authority_all_fields_description")}
            </p>
            <p className="font-mono text-xs leading-dense text-text-tertiary">
              {UNIT_FIELD_LOCK_ALL}
            </p>
          </div>
          {showMutationControls ? (
            <button
              type="button"
              aria-pressed={allFieldsLocked}
              className={
                allFieldsLocked
                  ? "inline-flex items-center justify-center gap-2 rounded-md bg-brand-fill px-3 py-2 text-sm leading-ui text-text-on-brand disabled:opacity-50"
                  : "inline-flex items-center justify-center gap-2 rounded-md bg-surface-base px-3 py-2 text-sm leading-ui text-text-primary hover:bg-surface-elevated disabled:opacity-50"
              }
              disabled={upsertLock.isPending || removeLock.isPending}
              onClick={() => togglePath(UNIT_FIELD_LOCK_ALL, allFieldsLocked)}
            >
              {allFieldsLocked ? (
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              ) : (
                <ShieldOff className="h-4 w-4" aria-hidden="true" />
              )}
              {allFieldsLocked
                ? t("editor:authority_all_fields_locked")
                : t("editor:authority_all_fields_unlocked")}
            </button>
          ) : null}
        </div>
        {allFieldsLock?.reason ? (
          <p className="text-sm leading-ui text-text-secondary">
            {allFieldsLock.reason}
          </p>
        ) : null}
      </section>

      {locksQuery.isLoading ? (
        <p>{t("common:loading")}</p>
      ) : locksQuery.error ? (
        <QueryErrorDisplay error={locksQuery.error} />
      ) : (
        <section className="grid gap-6">
          {BOOK_LOCK_FIELD_GROUPS.map((group) => (
            <section key={group.id} className="grid gap-3">
              <h2 className="text-base font-medium leading-ui text-text-primary">
                {group.title}
              </h2>
              <ul className="grid gap-2">
                {group.paths.map((path) => {
                  const lock = locks.find((item) =>
                    lockMatchesPath(item, path),
                  );
                  return (
                    <FieldLockRow
                      key={path}
                      allFieldsLocked={allFieldsLocked}
                      lock={lock}
                      mutationPending={
                        upsertLock.isPending || removeLock.isPending
                      }
                      path={path}
                      showMutationControls={showMutationControls}
                      onRemove={() => remove(path)}
                      onUpsert={() => upsert(path)}
                    />
                  );
                })}
              </ul>
            </section>
          ))}
        </section>
      )}

      {showMutationControls ? (
        <section className="grid gap-3 border-t border-border-whisper pt-6">
          <h2 className="text-base font-medium leading-ui text-text-primary">
            {t("editor:authority_custom_path_title")}
          </h2>
          <p className="max-w-3xl text-sm leading-ui text-text-secondary">
            {t("editor:authority_custom_path_description")}
          </p>
          <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <label className="grid gap-1 text-xs font-medium leading-dense text-text-secondary">
              {t("editor:authority_lock_path_label")}
              <select
                className="rounded-md bg-surface-subtle px-3 py-2 text-sm leading-ui text-text-primary"
                value={selectedPath}
                onChange={(event) => setSelectedPath(event.currentTarget.value)}
              >
                {EDITORIAL_LOCK_PATH_OPTIONS.map((path) => (
                  <option key={path} value={path}>
                    {editorialPathLabel(path)} · {path}
                  </option>
                ))}
                <option value={CUSTOM_LOCK_PATH}>
                  {t("editor:authority_custom_path_option")}
                </option>
              </select>
            </label>
            <label className="grid gap-1 text-xs font-medium leading-dense text-text-secondary">
              {t("editor:authority_reason_label")}
              <input
                className="rounded-md bg-surface-subtle px-3 py-2 text-sm leading-ui text-text-primary"
                value={reason}
                onChange={(event) => setReason(event.currentTarget.value)}
              />
            </label>
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 self-end rounded-md bg-brand-fill px-3 py-2 text-sm leading-ui text-text-on-brand disabled:opacity-50"
              disabled={
                !effectivePath ||
                Boolean(customPathError) ||
                upsertLock.isPending
              }
              onClick={() => upsert(effectivePath)}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t("editor:authority_lock_action")}
            </button>
          </div>
          {selectedPath === CUSTOM_LOCK_PATH ? (
            <label className="grid gap-1 text-xs font-medium leading-dense text-text-secondary">
              {t("editor:authority_custom_path_label")}
              <input
                className="rounded-md bg-surface-subtle px-3 py-2 font-mono text-sm leading-ui text-text-primary"
                value={customPath}
                onChange={(event) => setCustomPath(event.currentTarget.value)}
                placeholder="translations.en.title"
              />
              {customPathError ? (
                <span className="text-error-text">{customPathError}</span>
              ) : null}
            </label>
          ) : null}
          {error ? (
            <p className="text-sm leading-ui text-error-text">{error}</p>
          ) : null}
        </section>
      ) : null}

      {locks.length > 0 ? (
        <section className="grid gap-3 border-t border-border-whisper pt-6">
          <h2 className="text-base font-medium leading-ui text-text-primary">
            {t("editor:authority_current_locks_title")}
          </h2>
          <ul className="grid gap-2">
            {locks.map((lock) => (
              <li
                key={lock.path}
                className="grid gap-2 rounded-md bg-surface-subtle p-3 md:grid-cols-[minmax(0,1fr)_auto]"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-text-primary">
                    {editorialPathLabel(lock.path)}
                  </p>
                  <p className="truncate font-mono text-xs leading-dense text-text-tertiary">
                    {lock.path}
                  </p>
                  {lock.reason ? <p className="mt-1">{lock.reason}</p> : null}
                </div>
                {showMutationControls ? (
                  <button
                    type="button"
                    aria-label={t("editor:authority_remove_lock_label", {
                      path: lock.path,
                    })}
                    className="inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm leading-ui text-text-secondary hover:bg-surface-base hover:text-text-primary disabled:opacity-50"
                    disabled={removeLock.isPending}
                    onClick={() => remove(lock.path)}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    {t("editor:authority_remove_lock_action")}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="rounded-md bg-surface-subtle px-4 py-3">
          {t("editor:authority_no_locks")}
        </p>
      )}
    </section>
  );
}

function FieldLockRow({
  allFieldsLocked,
  lock,
  mutationPending,
  onRemove,
  onUpsert,
  path,
  showMutationControls,
}: {
  allFieldsLocked: boolean;
  lock?: UnitFieldLockDTO;
  mutationPending: boolean;
  onRemove: () => void;
  onUpsert: () => void;
  path: string;
  showMutationControls: boolean;
}) {
  const { t } = useTranslation(["common", "editor"]);
  const locked = Boolean(lock);
  const covered = allFieldsLocked && !locked;

  return (
    <li className="grid gap-3 rounded-md bg-surface-subtle p-3 md:grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-text-primary">
            {editorialPathLabel(path)}
          </p>
          {locked ? (
            <span className="rounded-full bg-surface-base px-2 py-0.5 text-xs leading-dense text-text-secondary">
              {t("editor:authority_field_locked_badge")}
            </span>
          ) : null}
          {covered ? (
            <span className="rounded-full bg-surface-base px-2 py-0.5 text-xs leading-dense text-text-secondary">
              {t("editor:authority_field_covered_badge")}
            </span>
          ) : null}
        </div>
        <p className="truncate font-mono text-xs leading-dense text-text-tertiary">
          {path}
        </p>
        {covered ? (
          <p className="mt-1 text-xs leading-dense text-text-secondary">
            {t("editor:authority_field_covered_description")}
          </p>
        ) : null}
        {lock?.reason ? (
          <p className="mt-1 text-sm leading-ui text-text-secondary">
            {lock.reason}
          </p>
        ) : null}
      </div>
      {showMutationControls ? (
        <button
          type="button"
          aria-pressed={locked}
          className={
            locked
              ? "inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm leading-ui text-text-secondary hover:bg-surface-base hover:text-text-primary disabled:opacity-50"
              : "inline-flex items-center justify-center gap-2 rounded-md bg-surface-base px-3 py-2 text-sm leading-ui text-text-primary hover:bg-surface-elevated disabled:opacity-50"
          }
          disabled={mutationPending || covered}
          onClick={locked ? onRemove : onUpsert}
        >
          {locked
            ? t("editor:authority_unlock_field_action")
            : t("editor:authority_lock_field_action")}
        </button>
      ) : null}
    </li>
  );
}
