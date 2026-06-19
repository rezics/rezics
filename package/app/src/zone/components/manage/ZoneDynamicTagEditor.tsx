import { meiliTagSearchQueryOptions } from "@rezics/api/meili/meili.queries";
import { tagApi } from "@rezics/api/tag/tag";
import type { TagSearchDocument, PageDynamicTags } from "@rezics/contract";
import { useLocale, useTranslation } from "@rezics/i18n/react";
import { Badge, Button, Checkbox, Input } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, X } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { useDebouncedValue } from "@/entity-picker";
import {
  addUniqueDynamicTagUnitIds,
  parseDynamicTagInputTokens,
  removeDynamicTagOptionAt,
  resolveDynamicTagInputTokens,
} from "../../models/zoneDynamicTagInput";
import {
  zoneDynamicTagsFallbackProbability,
  zoneDynamicTagsProbabilityTotal,
  zoneDynamicTagsProbabilityValid,
} from "../../models/zoneManageDraft";
import type { ZoneRefUnitMap } from "../../models/zoneMenu";
import {
  ManageField,
  ManageGroupHeading,
  RowActions,
} from "./ZoneManageFields";

type TagSearchResult = {
  unitId?: string;
  tagUnitId?: string;
  label?: string;
  title?: string | null;
  slug?: string;
};

function percent(value: number): number {
  return Math.round(value * 10000) / 100;
}

function tagLabel(tagUnitId: string, refUnits: ZoneRefUnitMap): string {
  return refUnits[tagUnitId]?.title ?? tagUnitId;
}

async function resolveTagTokens(tokens: readonly string[]): Promise<string[]> {
  return resolveDynamicTagInputTokens(tokens, async (token) => {
    const tag = await tagApi.getBySlug(token);
    return tag.tagUnitId;
  });
}

/**
 * 动态 tag 筛选编辑器。Mobile 下每行纵向堆叠，Tablet 起概率和操作列靠右；
 * Desktop/Ultra-wide 仍由父级 query editor 控制宽度。窄屏 tag chips 可换行，
 * 输入框 `min-w-0` 负责收缩；宽屏标签列 `flex-1` 拉伸，概率列固定宽度。
 *
 * Mobile
 * +------------------------------+
 * | Group [input]                |
 * | [x] fallback                 |
 * | Tags: [tag] [tag]            |
 * | [paste/search input] [Add]   |
 * | Probability [ 30 ] [remove]  |
 * | Fallback 70 disabled         |
 * +------------------------------+
 *
 * Tablet
 * +------------------------------------------+
 * | Tags/chips/input grow        | 30 | x    |
 * | Fallback row readonly        | 70 |      |
 * +------------------------------------------+
 *
 * Desktop
 * +----------------------------------------------------+
 * | tag column flex-1 with wrap | probability | action |
 * +----------------------------------------------------+
 *
 * Ultra-wide
 * +----------------------------------------------------+
 * | parent max-width keeps editor readable             |
 * +----------------------------------------------------+
 */
export function ZoneDynamicTagEditor({
  value,
  onChange,
  refUnits,
}: {
  value: PageDynamicTags | undefined;
  onChange: (value: PageDynamicTags | undefined) => void;
  refUnits: ZoneRefUnitMap;
}) {
  const { t } = useTranslation(["zone", "common"]);
  const fallbackId = useId();

  if (!value) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => onChange({ fallback: true, options: [] })}
      >
        <Plus className="size-4" aria-hidden />
        {t("zone:manage_dynamic_tags_enable")}
      </Button>
    );
  }

  const total = zoneDynamicTagsProbabilityTotal(value);
  const fallbackProbability = zoneDynamicTagsFallbackProbability(value);
  const valid = zoneDynamicTagsProbabilityValid(value);

  const setOption = (
    index: number,
    option: PageDynamicTags["options"][number],
  ) => {
    onChange({
      ...value,
      options: value.options.map((current, currentIndex) =>
        currentIndex === index ? option : current,
      ),
    });
  };

  return (
    <div className="flex flex-col gap-3 rounded-md bg-surface-subtle p-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <ManageField label={t("zone:manage_dynamic_tags_group_id")}>
          <Input
            value={value.groupId ?? ""}
            className="font-mono text-sm"
            onChange={(event) => {
              const groupId = event.target.value.trim();
              const next = { ...value };
              if (groupId) next.groupId = groupId;
              else delete next.groupId;
              onChange(next);
            }}
          />
        </ManageField>
        <div className="flex items-center gap-2 pb-2 text-sm leading-ui text-text-primary">
          <Checkbox
            id={fallbackId}
            checked={value.fallback === true}
            onCheckedChange={(checked) => {
              const next = { ...value };
              if (checked) next.fallback = true;
              else delete next.fallback;
              onChange(next);
            }}
          />
          <label htmlFor={fallbackId}>
            {t("zone:manage_dynamic_tags_fallback")}
          </label>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start md:ml-auto"
          onClick={() => onChange(undefined)}
        >
          {t("common:remove")}
        </Button>
      </div>

      <div className="flex items-center justify-between gap-3">
        <ManageGroupHeading>{t("zone:manage_dynamic_tags")}</ManageGroupHeading>
        <span
          className={
            valid
              ? "text-xs leading-dense text-text-tertiary"
              : "text-xs leading-dense text-error-text"
          }
        >
          {t("zone:manage_dynamic_tags_total", {
            total: percent(total),
          })}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {value.options.map((option, index) => (
          <DynamicTagOptionRow
            // Dynamic tag options intentionally have no ids; row order is the
            // persisted identity.
            // biome-ignore lint/suspicious/noArrayIndexKey: positional rows
            key={index}
            option={option}
            refUnits={refUnits}
            onChange={(next) => setOption(index, next)}
            onRemove={() =>
              onChange({
                ...value,
                options: removeDynamicTagOptionAt(value.options, index),
              })
            }
          />
        ))}
        {value.fallback ? (
          <div className="flex flex-col gap-2 rounded-md bg-surface-base p-3 md:flex-row md:items-center">
            <span className="min-w-0 flex-1 text-sm leading-ui text-text-secondary">
              {t("zone:manage_dynamic_tags_fallback_row")}
            </span>
            <Input
              value={String(percent(fallbackProbability))}
              disabled
              className="w-full font-mono text-sm md:w-24"
            />
          </div>
        ) : null}
      </div>

      {!valid ? (
        <p className="m-0 text-xs leading-dense text-error-text">
          {t("zone:manage_dynamic_tags_invalid_total")}
        </p>
      ) : null}

      <Button
        type="button"
        size="sm"
        variant="outline"
        className="self-start"
        onClick={() =>
          onChange({
            ...value,
            options: [...value.options, { tagUnitIds: [], probability: 0 }],
          })
        }
      >
        <Plus className="size-4" aria-hidden />
        {t("zone:manage_dynamic_tags_add_row")}
      </Button>
    </div>
  );
}

function DynamicTagOptionRow({
  option,
  refUnits,
  onChange,
  onRemove,
}: {
  option: PageDynamicTags["options"][number];
  refUnits: ZoneRefUnitMap;
  onChange: (option: PageDynamicTags["options"][number]) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation(["zone"]);
  const locale = useLocale();
  const [rawTags, setRawTags] = useState("");
  const [searchText, setSearchText] = useState("");
  const [resolving, setResolving] = useState(false);
  const debouncedSearch = useDebouncedValue(searchText.trim(), 200);
  const search = useQuery({
    ...meiliTagSearchQueryOptions({
      keyword: debouncedSearch,
      limit: 8,
      appLocale: locale,
    }),
    enabled: debouncedSearch.length > 0,
  });
  const results = useMemo(
    () =>
      (
        (search.data?.items ?? []) as Array<TagSearchDocument & TagSearchResult>
      ).flatMap((tag) => {
        const tagUnitId = tag.tagUnitId ?? tag.unitId;
        if (!tagUnitId || option.tagUnitIds.includes(tagUnitId)) return [];
        return [
          {
            tagUnitId,
            label: tag.title ?? tag.label ?? tag.slug ?? tagUnitId,
          },
        ];
      }),
    [option.tagUnitIds, search.data?.items],
  );

  const addRawTags = async () => {
    const tokens = parseDynamicTagInputTokens(rawTags);
    if (tokens.length === 0) return;
    setResolving(true);
    try {
      const resolved = await resolveTagTokens(tokens);
      onChange({
        ...option,
        tagUnitIds: addUniqueDynamicTagUnitIds(option.tagUnitIds, resolved),
      });
      setRawTags("");
    } finally {
      setResolving(false);
    }
  };

  const removeTag = (tagUnitId: string) => {
    onChange({
      ...option,
      tagUnitIds: option.tagUnitIds.filter((id) => id !== tagUnitId),
    });
  };

  return (
    <div className="flex flex-col gap-3 rounded-md bg-surface-base p-3 md:flex-row md:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex min-w-0 flex-wrap gap-1.5">
          {option.tagUnitIds.map((tagUnitId) => (
            <Badge key={tagUnitId} variant="outline" className="max-w-48 gap-1">
              <span className="truncate">{tagLabel(tagUnitId, refUnits)}</span>
              <button
                type="button"
                className="shrink-0 text-text-tertiary"
                onClick={() => removeTag(tagUnitId)}
                aria-label={t("zone:manage_dynamic_tags_remove_tag")}
              >
                <X className="size-3" aria-hidden />
              </button>
            </Badge>
          ))}
        </div>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
          <Input
            value={rawTags}
            placeholder={t("zone:manage_dynamic_tags_tag_input")}
            className="min-w-0 flex-1 font-mono text-sm"
            onChange={(event) => setRawTags(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              void addRawTags();
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={resolving}
            onClick={() => void addRawTags()}
          >
            {t("zone:manage_dynamic_tags_add_tags")}
          </Button>
        </div>
        <div className="relative">
          <div className="flex min-w-0 items-center gap-2">
            <Search
              className="size-4 shrink-0 text-text-tertiary"
              aria-hidden
            />
            <Input
              value={searchText}
              placeholder={t("zone:manage_dynamic_tags_search")}
              className="min-w-0 flex-1"
              onChange={(event) => setSearchText(event.target.value)}
            />
          </div>
          {results.length > 0 ? (
            <div className="absolute left-0 right-0 z-20 mt-1 max-h-48 overflow-y-auto rounded-md border border-border-whisper bg-surface-elevated p-1">
              {results.map((result) => (
                <button
                  key={result.tagUnitId}
                  type="button"
                  className="block w-full rounded-sm px-2 py-1.5 text-left text-sm leading-ui hover:bg-surface-subtle"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    onChange({
                      ...option,
                      tagUnitIds: addUniqueDynamicTagUnitIds(
                        option.tagUnitIds,
                        [result.tagUnitId],
                      ),
                    });
                    setSearchText("");
                  }}
                >
                  {result.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <ManageField label={t("zone:manage_dynamic_tags_probability")}>
        <Input
          type="number"
          min={0}
          max={100}
          step={1}
          value={String(percent(option.probability))}
          className="w-full font-mono text-sm md:w-24"
          onChange={(event) => {
            const next = Number(event.target.value);
            onChange({
              ...option,
              probability: Number.isFinite(next) ? next / 100 : 0,
            });
          }}
        />
      </ManageField>
      <div className="shrink-0 pt-0 md:pt-6">
        <RowActions onRemove={onRemove} />
      </div>
    </div>
  );
}
