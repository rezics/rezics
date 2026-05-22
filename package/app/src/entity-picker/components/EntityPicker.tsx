import { useEntitySearch } from "@rezics/api/entity";
import {
  type CreditAttributionRole,
  creditAttributionRoleRegistry,
  type EntityKind,
  type SubjectAttributionRole,
  subjectAttributionRoleRegistry,
} from "@rezics/contract";
import { Spinner } from "@rezics/ui";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@rezics/ui/shadcn";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { EntityInlineCreateForm } from "./EntityInlineCreateForm";
import { EntityResultRow } from "./EntityResultRow";

const ALL_CREDIT_ROLES = "all";
const ALL_SUBJECT_ROLES = "all";

type CreditRoleFilterValue = CreditAttributionRole | typeof ALL_CREDIT_ROLES;
type SubjectRoleFilterValue = SubjectAttributionRole | typeof ALL_SUBJECT_ROLES;

export interface EntityPickerSelection {
  creditRole?: CreditAttributionRole;
  subjectRole?: SubjectAttributionRole;
}

export interface EntityPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Invoked with the selected entity's unitId (existing or just-created). */
  onSelect: (
    unitId: string,
    selection: EntityPickerSelection,
  ) => boolean | undefined;
  /** Catalog creates wiki entities; personal creates current-user entities. */
  creationContext?: "catalog" | "personal";
  /** Optional current USER unitId for personal-context owner bias. */
  ownerUnitId?: string;
  /** Soft kind hints for ranking and inline-create defaults. */
  kindHints?: readonly EntityKind[];
  kindHint?: EntityKind;
  /** Credit roles shown as search filters in the picker modal. */
  creditRoleOptions?: readonly CreditAttributionRole[];
  /** Subject roles shown as search filters in the picker modal. */
  subjectRoleOptions?: readonly SubjectAttributionRole[];
  /** Locks the picker to a single credit role and hides the role filter. */
  lockedCreditRole?: CreditAttributionRole;
  /** Locks the picker to a single subject role and hides the role filter. */
  lockedSubjectRole?: SubjectAttributionRole;
  /** Prevents selection while the role filter is set to `all`. */
  requireCreditRoleForSelect?: boolean;
}

export function EntityPicker({
  open,
  onOpenChange,
  onSelect,
  creationContext = "catalog",
  ownerUnitId,
  kindHints,
  kindHint,
  creditRoleOptions,
  subjectRoleOptions,
  lockedCreditRole,
  lockedSubjectRole,
  requireCreditRoleForSelect = false,
}: EntityPickerProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [creditRoleFilter, setCreditRoleFilter] =
    useState<CreditRoleFilterValue>(lockedCreditRole ?? ALL_CREDIT_ROLES);
  const [subjectRoleFilter, setSubjectRoleFilter] =
    useState<SubjectRoleFilterValue>(lockedSubjectRole ?? ALL_SUBJECT_ROLES);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const debouncedQuery = useDebouncedValue(query.trim(), 200);
  const activeCreditRole =
    lockedCreditRole ??
    (creditRoleFilter === ALL_CREDIT_ROLES ? undefined : creditRoleFilter);
  const activeSubjectRole =
    lockedSubjectRole ??
    (subjectRoleFilter === ALL_SUBJECT_ROLES ? undefined : subjectRoleFilter);

  const effectiveKindHints = useMemo(
    () =>
      activeCreditRole
        ? creditAttributionRoleRegistry[activeCreditRole].entityKindHints
        : activeSubjectRole
          ? subjectAttributionRoleRegistry[activeSubjectRole].entityKindHints
          : (kindHints ?? (kindHint ? [kindHint] : [])),
    [activeCreditRole, activeSubjectRole, kindHint, kindHints],
  );

  const searchQuery = useMemo(
    () => ({
      q: debouncedQuery || undefined,
      limit: 12,
      eligibleCreditRole: activeCreditRole,
      eligibleSubjectRole: activeSubjectRole,
    }),
    [activeCreditRole, activeSubjectRole, debouncedQuery],
  );

  const { data, isFetching } = useEntitySearch(searchQuery);
  const results = data?.entities ?? [];

  // When the kindHint is provided we soft-sort matches of that kind first,
  // emulating a Meili `filter` weight without dropping other matches.
  const orderedResults = useMemo(() => {
    if (effectiveKindHints.length === 0 && !ownerUnitId) return results;
    return [...results].sort((a, b) => {
      const ao =
        creationContext === "personal" && a.ownerUnitId === ownerUnitId ? 0 : 1;
      const bo =
        creationContext === "personal" && b.ownerUnitId === ownerUnitId ? 0 : 1;
      if (ao !== bo) return ao - bo;
      const am = a.kind && effectiveKindHints.includes(a.kind) ? 0 : 1;
      const bm = b.kind && effectiveKindHints.includes(b.kind) ? 0 : 1;
      return am - bm;
    });
  }, [creationContext, effectiveKindHints, ownerUnitId, results]);

  const handleSelect = (unitId: string) => {
    if (requireCreditRoleForSelect && !activeCreditRole) {
      setSelectionError(
        t(
          "entity_picker.errors.credit_role_required",
          "Choose a credit role before selecting an entity.",
        ),
      );
      return;
    }

    const accepted = onSelect(unitId, {
      creditRole: activeCreditRole,
      subjectRole: activeSubjectRole,
    });
    if (accepted === false) return;
    reset();
    onOpenChange(false);
  };

  const reset = () => {
    setQuery("");
    setCreating(false);
    setCreditRoleFilter(lockedCreditRole ?? ALL_CREDIT_ROLES);
    setSubjectRoleFilter(lockedSubjectRole ?? ALL_SUBJECT_ROLES);
    setSelectionError(null);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-xl gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border-whisper p-4">
          <DialogTitle>Find or create entity</DialogTitle>
          <DialogDescription>
            Search for an existing entity, or create a new one inline.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 p-3">
          {!lockedCreditRole && creditRoleOptions?.length ? (
            <Select
              value={creditRoleFilter}
              onValueChange={(value) => {
                setCreditRoleFilter(value as CreditRoleFilterValue);
                setCreating(false);
                setSelectionError(null);
              }}
            >
              <SelectTrigger
                id="entity-picker-credit-role"
                className="w-36 shrink-0"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>
                    {t("entity_picker.filters.credit_role", "Credit role")}
                  </SelectLabel>
                  <SelectItem value={ALL_CREDIT_ROLES}>
                    {t("entity_picker.filters.all", "All")}
                  </SelectItem>
                  {creditRoleOptions.map((role) => (
                    <SelectItem key={role} value={role}>
                      {t(creditAttributionRoleRegistry[role].i18nKey, role)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          ) : null}
          {!lockedSubjectRole && subjectRoleOptions?.length ? (
            <Select
              value={subjectRoleFilter}
              onValueChange={(value) => {
                setSubjectRoleFilter(value as SubjectRoleFilterValue);
                setCreating(false);
                setSelectionError(null);
              }}
            >
              <SelectTrigger
                id="entity-picker-subject-role"
                className="w-40 shrink-0"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>
                    {t("entity_picker.filters.subject_role", "Subject role")}
                  </SelectLabel>
                  <SelectItem value={ALL_SUBJECT_ROLES}>
                    {t("entity_picker.filters.all", "All")}
                  </SelectItem>
                  {subjectRoleOptions.map((role) => (
                    <SelectItem key={role} value={role}>
                      {t(subjectAttributionRoleRegistry[role].i18nKey, role)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          ) : null}
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectionError(null);
            }}
            placeholder="Search entities…"
            autoFocus
            className="min-w-0 flex-1"
          />
        </div>

        <div className="max-h-64 overflow-y-auto px-3 pb-2">
          {isFetching && debouncedQuery ? (
            <div className="flex justify-center py-4">
              <Spinner />
            </div>
          ) : null}

          {!isFetching && debouncedQuery && orderedResults.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-text-secondary">
              No matching entities — create one?
            </p>
          ) : null}

          {orderedResults.map((entity) => (
            <EntityResultRow
              key={entity.unitId}
              entity={entity}
              onSelect={handleSelect}
            />
          ))}
          {selectionError ? (
            <p className="px-3 py-2 text-xs text-text-error">
              {selectionError}
            </p>
          ) : null}
        </div>

        <div className="sticky bottom-0 border-t border-border-whisper bg-surface-canvas p-3">
          {creating ? null : (
            <Button
              type="button"
              variant="ghost"
              className="w-full justify-start"
              onClick={() => {
                if (requireCreditRoleForSelect && !activeCreditRole) {
                  setSelectionError(
                    t(
                      "entity_picker.errors.credit_role_required",
                      "Choose a credit role before selecting an entity.",
                    ),
                  );
                  return;
                }
                setCreating(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create new entity
              {query.trim() ? `: “${query.trim()}”` : ""}
            </Button>
          )}
        </div>

        {creating ? (
          <EntityInlineCreateForm
            initialTitle={query.trim()}
            creationContext={creationContext}
            kindHint={effectiveKindHints[0]}
            selectedCreditRole={activeCreditRole}
            selectedSubjectRole={activeSubjectRole}
            onCreated={handleSelect}
            onCancel={() => setCreating(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
