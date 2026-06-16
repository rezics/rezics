import { useTranslation } from "@rezics/i18n/react";
import { Button, Checkbox, Input, Label } from "@rezics/ui/shadcn";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import type React from "react";
import { useId } from "react";

/**
 * Shared form scaffolding for the zone manage editors: label + control
 * stacks and the unit-id list editor used across the query builder.
 * 专区管理编辑器共享的表单脚手架：标签 + 控件堆叠，以及查询构建器各处
 * 使用的 unit id 列表编辑器。
 */
export function ManageField({
  label,
  htmlFor,
  children,
  hint,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? (
        <p className="text-xs leading-dense text-text-tertiary">{hint}</p>
      ) : null}
    </div>
  );
}

export function ManageGroupHeading({ children }: { children: string }) {
  return (
    <h3 className="text-sm font-semibold leading-ui text-text-primary">
      {children}
    </h3>
  );
}

/**
 * Free-form string list (unit ids, role keys). Empty entries are kept while
 * editing and trimmed by the caller on save.
 * 自由字符串列表（unit id、role key）。编辑期间保留空条目，由调用方在
 * 保存时修剪。
 */
export function StringListEditor({
  label,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  values: readonly string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}) {
  const { t } = useTranslation(["common"]);
  const baseId = useId();
  return (
    <ManageField label={label} htmlFor={`${baseId}-0`}>
      <div className="flex flex-col gap-2">
        {values.map((value, index) => (
          <div
            // Index keys are stable here: rows are only appended/removed and
            // inputs are fully controlled.
            // 此处索引键是稳定的：行只会追加/删除，且输入完全受控。
            // biome-ignore lint/suspicious/noArrayIndexKey: positional rows
            key={index}
            className="flex items-center gap-2"
          >
            <Input
              id={`${baseId}-${index}`}
              value={value}
              placeholder={placeholder}
              onChange={(event) =>
                onChange(
                  values.map((current, currentIndex) =>
                    currentIndex === index ? event.target.value : current,
                  ),
                )
              }
              className="font-mono text-sm"
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={t("common:remove")}
              onClick={() =>
                onChange(
                  values.filter((_, currentIndex) => currentIndex !== index),
                )
              }
            >
              <X className="size-4" aria-hidden />
            </Button>
          </div>
        ))}
        <div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onChange([...values, ""])}
          >
            <Plus className="mr-1 size-4" aria-hidden />
            {t("common:add")}
          </Button>
        </div>
      </div>
    </ManageField>
  );
}

/**
 * Flex-wrap checkbox group over contract literal values. Codes render
 * verbatim by default (technical vocabulary, not authored copy); pass
 * `renderOption` for translated labels.
 * 针对契约字面量值的弹性换行复选组。代码默认原样渲染（技术词汇而非撰写
 * 文案）；需要翻译标签时传入 `renderOption`。
 */
export function CheckGroup<T extends string>({
  label,
  options,
  values,
  onChange,
  renderOption,
}: {
  label: string;
  options: readonly T[];
  values: readonly T[];
  onChange: (values: T[]) => void;
  renderOption?: (option: T) => string;
}) {
  const baseId = useId();
  const selected = new Set(values);
  return (
    <ManageField label={label}>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {options.map((option) => {
          const id = `${baseId}-${option}`;
          return (
            <label
              key={option}
              htmlFor={id}
              className="flex cursor-pointer items-center gap-2 text-sm leading-ui text-text-primary"
            >
              <Checkbox
                id={id}
                checked={selected.has(option)}
                onCheckedChange={(checked) => {
                  const next = options.filter((candidate) =>
                    candidate === option ? checked : selected.has(candidate),
                  );
                  onChange(next);
                }}
              />
              <span className={renderOption ? undefined : "font-mono text-xs"}>
                {renderOption ? renderOption(option) : option}
              </span>
            </label>
          );
        })}
      </div>
    </ManageField>
  );
}

/**
 * Reorder/remove affordances shared by every list-shaped editor row.
 * 所有列表形编辑器行共享的重排/移除操作。
 */
export function RowActions({
  onMoveUp,
  onMoveDown,
  onRemove,
  children,
}: {
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onRemove?: () => void;
  children?: React.ReactNode;
}) {
  const { t } = useTranslation(["common"]);
  return (
    <div className="flex items-center gap-1">
      {children}
      {onMoveUp ? (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label={t("common:up")}
          onClick={onMoveUp}
        >
          <ArrowUp className="size-4" aria-hidden />
        </Button>
      ) : null}
      {onMoveDown ? (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label={t("common:down")}
          onClick={onMoveDown}
        >
          <ArrowDown className="size-4" aria-hidden />
        </Button>
      ) : null}
      {onRemove ? (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label={t("common:remove")}
          onClick={onRemove}
        >
          <X className="size-4" aria-hidden />
        </Button>
      ) : null}
    </div>
  );
}
