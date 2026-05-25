import { creditAttributionQueries } from "@rezics/api/credit-attribution/credit-attribution";
import { useEntityAttributionBatchMutation } from "@rezics/api/entity-attribution/entity-attribution";
import {
  creditAttributionRoleRegistry,
  creditAttributionRoles,
} from "@rezics/contract";
import { creditRoleLabel } from "@rezics/i18n";
import { Button } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  addCreditAttribution,
  buildEntityAttributionBatchOps,
  createEntityAttributionEditQueue,
  EntityIdentityRow,
  isEntityAttributionQueueDirty,
  markEntityAttributionQueueError,
  markEntityAttributionQueueSaved,
  markEntityAttributionQueueSaving,
  removeCreditAttribution,
} from "@/entity";
import { EntityPicker } from "@/entity-picker";
import { useMessage } from "@rezics/i18n/react";
import {
  book_actions_add_credit,
  book_actions_remove_credit,
  book_empty_credit_attributions,
  common_loading,
  common_save_changes,
} from "@rezics/i18n/messages";
const i18nMessages = {
  book_actions_add_credit,
  book_actions_remove_credit,
  book_empty_credit_attributions,
  common_loading,
  common_save_changes,
};

interface BookCreditAttributionEditorProps {
  bookUnitId: string;
  disabled?: boolean;
}

const bookCreditRoles = creditAttributionRoles.filter((role) =>
  creditAttributionRoleRegistry[role].appliesToUnitTypes.some(
    (unitType) => unitType === "BOOK",
  ),
);

export function BookCreditAttributionEditor({
  bookUnitId,
  disabled,
}: BookCreditAttributionEditorProps) {
  const m = useMessage(i18nMessages);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [queue, setQueue] = useState(() => createEntityAttributionEditQueue());

  const creditQuery = useQuery(creditAttributionQueries.byUnit(bookUnitId));
  const batchMutation = useEntityAttributionBatchMutation();

  const isDirty = isEntityAttributionQueueDirty(queue);

  useEffect(() => {
    if (isDirty || !creditQuery.data) return;
    setQueue(
      createEntityAttributionEditQueue({
        credits: creditQuery.data.filter((credit) =>
          bookCreditRoles.includes(credit.role),
        ),
      }),
    );
  }, [creditQuery.data, isDirty]);

  const visibleCredits = useMemo(
    () => bookCreditRoles.flatMap((role) => queue.current.credits[role] ?? []),
    [queue.current.credits],
  );

  const handleSave = () => {
    const ops = buildEntityAttributionBatchOps(queue);
    if (ops.length === 0) return;

    setQueue((current) => markEntityAttributionQueueSaving(current));
    batchMutation.mutate(
      {
        unitId: bookUnitId,
        request: { ops },
      },
      {
        onSuccess: (data) => {
          setQueue((current) =>
            markEntityAttributionQueueSaved(current, {
              credits: data.credits.filter((credit) =>
                bookCreditRoles.includes(credit.role),
              ),
              subjects: data.subjects,
            }),
          );
        },
        onError: (error) => {
          setQueue((current) =>
            markEntityAttributionQueueError(
              current,
              error instanceof Error ? error : new Error(String(error)),
            ),
          );
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          disabled={disabled || !isDirty || batchMutation.isPending}
          onClick={handleSave}
        >
          <Save className="size-4" />
          {m.common_save_changes()}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={disabled || batchMutation.isPending}
          onClick={() => setPickerOpen(true)}
        >
          <Plus className="size-4" />
          {m.book_actions_add_credit()}
        </Button>
      </div>

      {creditQuery.isLoading ? (
        <p className="text-sm text-text-secondary">{m.common_loading()}</p>
      ) : visibleCredits.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {visibleCredits.map((credit) => {
            const roleLabel = creditRoleLabel(credit.role);
            return (
              <li
                key={`${credit.entityId}-${credit.role}`}
                className="flex items-center gap-3 border-b border-border-whisper py-2"
              >
                <EntityIdentityRow
                  entity={credit.entity ?? { unitId: credit.entityId }}
                  fallbackTitle={credit.entityId}
                  meta={roleLabel}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={m.book_actions_remove_credit()}
                  disabled={disabled || batchMutation.isPending}
                  onClick={() => {
                    setQueue((current) =>
                      removeCreditAttribution(
                        current,
                        credit.role,
                        credit.entityId,
                      ),
                    );
                  }}
                >
                  <Trash2 className="size-4 text-text-secondary" />
                </Button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-text-secondary">
          {m.book_empty_credit_attributions()}
        </p>
      )}

      {queue.saveStatus === "error" && queue.error ? (
        <p className="text-sm text-text-error">{queue.error.message}</p>
      ) : null}

      <EntityPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        creationContext="catalog"
        creditRoleOptions={bookCreditRoles}
        requireCreditRoleForSelect
        onSelect={(entityId, selection) => {
          if (!selection.creditRole) return false;
          setQueue((current) =>
            addCreditAttribution(current, selection.creditRole!, { entityId }),
          );
        }}
      />
    </div>
  );
}
