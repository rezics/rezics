import { useEntitySearch } from "@rezics/api/entity";
import {
  type CreditAttributionRole,
  creditAttributionRoleRegistry,
  type EntityDTO,
  type EntityKind,
  type SubjectAttributionRole,
  subjectAttributionRoleRegistry,
} from "@rezics/contract";
import { creditRoleLabel, subjectRoleLabel } from "@rezics/i18n";
import { useTranslation } from "@rezics/i18n/react";
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
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
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
  /**
   * Invoked with the selected entity's unitId (existing or just-created).
   * 以所选 entity 的 unitId（已存在或刚创建的）调用。
   */
  onSelect: (
    unitId: string,
    selection: EntityPickerSelection,
  ) => boolean | undefined;
  /**
   * Catalog creates wiki entities; personal creates current-user entities.
   * catalog 创建 wiki entity；personal 创建当前用户的 entity。
   */
  creationContext?: "catalog" | "personal";
  /**
   * Optional current USER unitId for personal-context owner bias.
   * 可选的当前 USER unitId，用于 personal 上下文下的 owner 偏置。
   */
  ownerUnitId?: string;
  /**
   * Soft kind hints for ranking and inline-create defaults.
   * 用于排序以及内联创建默认值的软性 kind 提示。
   */
  kindHints?: readonly EntityKind[];
  kindHint?: EntityKind;
  /**
   * Credit roles shown as search filters in the picker modal.
   * 在选择器弹窗中作为搜索过滤项展示的 credit role。
   */
  creditRoleOptions?: readonly CreditAttributionRole[];
  /**
   * Subject roles shown as search filters in the picker modal.
   * 在选择器弹窗中作为搜索过滤项展示的 subject role。
   */
  subjectRoleOptions?: readonly SubjectAttributionRole[];
  /**
   * Locks the picker to a single credit role and hides the role filter.
   * 将选择器锁定为单一 credit role 并隐藏 role 过滤项。
   */
  lockedCreditRole?: CreditAttributionRole;
  /**
   * Locks the picker to a single subject role and hides the role filter.
   * 将选择器锁定为单一 subject role 并隐藏 role 过滤项。
   */
  lockedSubjectRole?: SubjectAttributionRole;
  /**
   * Prevents selection while the role filter is set to `all`.
   * 当 role 过滤项设为 `all` 时禁止选择。
   */
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
  const { t } = useTranslation(["entity"]);
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

  // Skip the search query while the dialog is closed to avoid unnecessary network requests.
  // 对话框关闭时跳过搜索查询，避免不必要的网络请求。
  const { data, isFetching } = useEntitySearch(open ? searchQuery : undefined);
  const results = data?.entities ?? [];

  // When the kindHint is provided we soft-sort matches of that kind first,
  // emulating a Meili `filter` weight without dropping other matches.
  // 提供 kindHint 时，我们将该 kind 的匹配项软性地排在前面，
  // 以此模拟 Meili 的 `filter` 权重，同时不丢弃其他匹配项。
  const orderedResults = useMemo(() => {
    if (effectiveKindHints.length === 0 && !ownerUnitId) return results;
    return [...results].sort((a, b) => {
      const ao =
        creationContext === "personal" && a.ownerUnitId === ownerUnitId ? 0 : 1;
      const bo =
        creationContext === "personal" && b.ownerUnitId === ownerUnitId ? 0 : 1;
      if (ao !== bo) return ao - bo;
      const am =
        a.kind && effectiveKindHints.includes(a.kind as EntityKind) ? 0 : 1;
      const bm =
        b.kind && effectiveKindHints.includes(b.kind as EntityKind) ? 0 : 1;
      return am - bm;
    });
  }, [creationContext, effectiveKindHints, ownerUnitId, results]);

  const handleSelect = (unitId: string) => {
    if (requireCreditRoleForSelect && !activeCreditRole) {
      setSelectionError(t("entity:picker_errors_credit_role_required"));
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
          <DialogTitle>{t("entity:picker_title")}</DialogTitle>
          <DialogDescription>
            {t("entity:picker_description")}
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
                    {t("entity:picker_filters_credit_role")}
                  </SelectLabel>
                  <SelectItem value={ALL_CREDIT_ROLES}>
                    {t("entity:picker_filters_all")}
                  </SelectItem>
                  {creditRoleOptions.map((role) => (
                    <SelectItem key={role} value={role}>
                      {creditRoleLabel(role)}
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
                    {t("entity:picker_filters_subject_role")}
                  </SelectLabel>
                  <SelectItem value={ALL_SUBJECT_ROLES}>
                    {t("entity:picker_filters_all")}
                  </SelectItem>
                  {subjectRoleOptions.map((role) => (
                    <SelectItem key={role} value={role}>
                      {subjectRoleLabel(role)}
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
            placeholder={t("entity:picker_search_placeholder")}
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
              {t("entity:picker_no_matches_create")}
            </p>
          ) : null}

          {orderedResults.map((entity) => (
            <EntityResultRow
              key={entity.unitId}
              entity={entity as unknown as EntityDTO}
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
                    t("entity:picker_errors_credit_role_required"),
                  );
                  return;
                }
                setCreating(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              {query.trim()
                ? t("entity:picker_create_named", { name: query.trim() })
                : t("entity:picker_create_new")}
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
