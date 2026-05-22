import {
  creditAttributionQueries,
  useLinkCreditAttributionMutation,
  useUnlinkCreditAttributionMutation,
} from "@rezics/api/credit-attribution/credit-attribution";
import {
  creditAttributionRoleRegistry,
  creditAttributionRoles,
} from "@rezics/contract";
import { Button } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { EntityIdentityRow } from "@/entity";
import { EntityPicker } from "@/entity-picker";

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
  const { t } = useTranslation();
  const [pickerOpen, setPickerOpen] = useState(false);

  const creditQuery = useQuery(creditAttributionQueries.byUnit(bookUnitId));
  const linkCredit = useLinkCreditAttributionMutation();
  const unlinkCredit = useUnlinkCreditAttributionMutation();

  const visibleCredits = useMemo(
    () =>
      (creditQuery.data ?? []).filter((credit) =>
        bookCreditRoles.includes(credit.role),
      ),
    [creditQuery.data],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          disabled={disabled || linkCredit.isPending}
          onClick={() => setPickerOpen(true)}
        >
          <Plus className="size-4" />
          {t("book.actions.add_credit", "Add credit")}
        </Button>
      </div>

      {creditQuery.isLoading ? (
        <p className="text-sm text-text-secondary">{t("common.loading")}</p>
      ) : visibleCredits.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {visibleCredits.map((credit) => {
            const roleLabel = t(
              creditAttributionRoleRegistry[credit.role].i18nKey,
              credit.role,
            );
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
                  aria-label={t("book.actions.remove_credit", "Remove credit")}
                  disabled={disabled || unlinkCredit.isPending}
                  onClick={() =>
                    unlinkCredit.mutate({
                      unitId: bookUnitId,
                      entityId: credit.entityId,
                      role: credit.role,
                    })
                  }
                >
                  <Trash2 className="size-4 text-text-secondary" />
                </Button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-text-secondary">
          {t("book.empty.credit_attributions", "No credits yet.")}
        </p>
      )}

      <EntityPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        creationContext="catalog"
        creditRoleOptions={bookCreditRoles}
        requireCreditRoleForSelect
        onSelect={(entityId, selection) => {
          if (!selection.creditRole) return false;
          linkCredit.mutate({
            unitId: bookUnitId,
            entityId,
            role: selection.creditRole,
          });
        }}
      />
    </div>
  );
}
