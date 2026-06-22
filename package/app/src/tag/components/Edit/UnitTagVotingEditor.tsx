import {
  realmQueries,
  useCastRealmTagApplicationVoteMutation,
  useCreateRealmTagApplicationMutation,
  useWithdrawRealmTagApplicationVoteMutation,
} from "@rezics/api/realm/realm";
import {
  tagApi,
  tagQueries,
  useCastTagVoteMutation,
  useCreateUnitTagMutation,
  useWithdrawUnitTagVoteMutation,
} from "@rezics/api/tag/tag";
import { meiliTagSearchQueryOptions } from "@rezics/api/meili/meili.queries";
import {
  useDeleteUserTagApplicationMutation,
  userTagApplicationQueries,
  useSetUserTagApplicationsMutation,
} from "@rezics/api/user-tag-application/user-tag-application";
import type {
  BatchTagTranslationResult,
  TagSearchDocument,
  UserTagApplicationDTO,
} from "@rezics/contract";
import { useLocale, useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import { Badge, Button, Input, Label } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { Check, Search, X } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
import { RealmSearchField } from "@/shared/ui/RealmSearchField";
import { TagVoteChipGroup, type TagVoteChipRow } from "../TagVoteChipGroup";

type TagSearchResult = {
  unitId?: string;
  tagUnitId?: string;
  label?: string;
  title?: string | null;
  slug?: string;
};

type TagOption = {
  tagUnitId: string;
  label: string;
  slug?: string;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function tagResultToOption(
  result: TagSearchResult,
  fallbackLabel: string,
): TagOption | null {
  const tagUnitId = result.unitId ?? result.tagUnitId;
  if (!tagUnitId) return null;
  return {
    tagUnitId,
    label: result.title ?? result.label ?? result.slug ?? fallbackLabel,
    slug: result.slug,
  };
}

function resolveTagLabel(
  tagUnitId: string,
  labels: Map<string, string>,
  fallbackLabel: string,
): string {
  return labels.get(tagUnitId) ?? fallbackLabel;
}

function parseTagLookupInput(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    const parts = url.pathname.split("/").filter(Boolean);
    return parts.at(-1) ?? trimmed;
  } catch {
    return trimmed.replace(/^@/, "");
  }
}

async function resolveTagOption(
  value: string,
  fallbackLabel: string,
): Promise<TagOption | null> {
  const token = parseTagLookupInput(value);
  if (!token) return null;
  const tag = UUID_RE.test(token)
    ? ((await tagApi.get(token)) as TagSearchResult)
    : ((await tagApi.getBySlug(token)) as TagSearchResult);
  return tagResultToOption(tag, fallbackLabel);
}

function useTagLabels(tagUnitIds: string[]) {
  const locale = useLocale();
  const uniqueIds = useMemo(
    () => Array.from(new Set(tagUnitIds.filter(Boolean))).sort(),
    [tagUnitIds],
  );
  const { data } = useQuery(tagQueries.batchTranslations(uniqueIds, locale));
  return useMemo(() => {
    const labels = new Map<string, string>();
    for (const tagUnitId of uniqueIds) {
      const label = data?.[tagUnitId]?.name;
      if (label) labels.set(tagUnitId, label);
    }
    return labels;
  }, [data, uniqueIds]);
}

function labelMapToTranslations(
  labels: Map<string, string>,
): BatchTagTranslationResult {
  return Object.fromEntries(
    Array.from(labels.entries()).map(([tagUnitId, name]) => [
      tagUnitId,
      { name, slug: "", description: "" },
    ]),
  );
}

function useTagSearchOptions(
  query: string,
  excludeIds: Set<string>,
  fallbackLabel: string,
) {
  const locale = useLocale();
  const debouncedQuery = useDebouncedValue(query.trim(), 200);
  const search = useQuery({
    ...meiliTagSearchQueryOptions({
      keyword: debouncedQuery,
      limit: 8,
      appLocale: locale,
    }),
    enabled: debouncedQuery.length > 0,
  });
  const options = useMemo(
    () =>
      ((search.data?.items ?? []) as Array<TagSearchDocument & TagSearchResult>)
        .map((result) => tagResultToOption(result, fallbackLabel))
        .filter((option): option is TagOption =>
          Boolean(option && !excludeIds.has(option.tagUnitId)),
        ),
    [excludeIds, fallbackLabel, search.data?.items],
  );
  return { ...search, options, debouncedQuery };
}

type TagSearchPickerProps = {
  id: string;
  label: string;
  placeholder: string;
  actionLabel: string;
  excludeIds: Set<string>;
  disabled?: boolean;
  onSelect: (option: TagOption) => Promise<void> | void;
};

/**
 * 可复用 tag 搜索选择器。窄屏下输入、解析按钮、结果列表纵向堆叠；宽屏下输入
 * 拉伸、按钮固定宽度。极窄时按钮不会挤压输入，结果项名称 `min-w-0 truncate`。
 *
 * Mobile
 * +------------------------------+
 * | Label                        |
 * | [search / slug / URL input]  |
 * | [Resolve]                    |
 * | result name        [action]  |
 * +------------------------------+
 *
 * Tablet
 * +------------------------------------------+
 * | Label                                    |
 * | [input flex-1] [Resolve fixed]           |
 * | result rows full width                   |
 * +------------------------------------------+
 *
 * Desktop
 * +------------------------------------------------+
 * | input grows, action button keeps fixed width   |
 * | selected rows align labels left, action right  |
 * +------------------------------------------------+
 *
 * Ultra-wide
 * +------------------------------------------------+
 * | parent max-width controls readable line length |
 * +------------------------------------------------+
 */
function TagSearchPicker({
  id,
  label,
  placeholder,
  actionLabel,
  excludeIds,
  disabled,
  onSelect,
}: TagSearchPickerProps) {
  const { t } = useTranslation(["common", "community"]);
  const [query, setQuery] = useState("");
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unknownTagLabel = t("community:tag_unknown_label");
  const { options, isFetching, debouncedQuery } = useTagSearchOptions(
    query,
    excludeIds,
    unknownTagLabel,
  );
  const listboxId = `${id}-results`;

  const handleSelect = async (option: TagOption) => {
    setError(null);
    await onSelect(option);
    setQuery("");
  };

  const handleResolve = async () => {
    if (!query.trim()) return;
    setError(null);
    setResolving(true);
    try {
      const resolved = await resolveTagOption(query, unknownTagLabel);
      if (!resolved || excludeIds.has(resolved.tagUnitId)) {
        setError(t("community:tag_picker_no_resolved_tag"));
        return;
      }
      await handleSelect(resolved);
    } catch {
      setError(t("community:tag_picker_no_resolved_tag"));
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-tertiary"
            aria-hidden
          />
          <Input
            id={id}
            value={query}
            className="w-full pl-9"
            placeholder={placeholder}
            role="combobox"
            aria-expanded={options.length > 0}
            aria-controls={listboxId}
            aria-autocomplete="list"
            disabled={disabled}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full shrink-0 sm:w-auto"
          disabled={disabled || resolving || !query.trim()}
          onClick={handleResolve}
        >
          {resolving ? <Spinner size="sm" /> : <Check className="size-4" />}
          {t("community:tag_picker_resolve")}
        </Button>
      </div>

      {isFetching ? (
        <div className="flex items-center gap-2 text-sm leading-ui text-text-secondary">
          <Spinner size="sm" />
          {t("common:search")}
        </div>
      ) : null}

      {error ? (
        <p className="m-0 text-sm leading-ui text-error-text">{error}</p>
      ) : null}

      {debouncedQuery && options.length > 0 ? (
        <div
          id={listboxId}
          role="listbox"
          aria-label={t("common:accessibility_search_results")}
          className="flex flex-col overflow-hidden rounded-md border border-border-whisper bg-surface-canvas"
        >
          {options.map((option) => (
            <button
              key={option.tagUnitId}
              type="button"
              role="option"
              className="flex w-full min-w-0 items-center gap-3 px-3 py-2 text-left hover:bg-surface-subtle"
              disabled={disabled}
              onClick={() => handleSelect(option)}
            >
              <span className="min-w-0 flex-1 truncate text-sm leading-ui text-text-primary">
                {option.label}
              </span>
              {option.slug ? (
                <span className="hidden shrink-0 text-xs leading-dense text-text-tertiary sm:inline">
                  {option.slug}
                </span>
              ) : null}
              <span className="shrink-0 text-sm leading-ui text-link">
                {actionLabel}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PersonalTagRows({
  rows,
  labels,
  fallbackLabel,
  onRemove,
  disabled,
}: {
  rows: UserTagApplicationDTO[];
  labels: Map<string, string>;
  fallbackLabel: string;
  onRemove: (tagUnitId: string) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation("community");
  if (rows.length === 0) {
    return (
      <p className="m-0 text-sm leading-ui text-text-secondary">
        {t("community:tag_personal_empty")}
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {rows.map((row) => (
        <Badge
          key={row.tagUnitId}
          variant="secondary"
          className="flex min-w-0 max-w-full items-center gap-2 px-2 py-1"
        >
          <span className="min-w-0 truncate">
            {resolveTagLabel(row.tagUnitId, labels, fallbackLabel)}
          </span>
          <button
            type="button"
            className="shrink-0 rounded-sm text-text-tertiary hover:text-text-primary"
            disabled={disabled}
            aria-label={t("community:tag_personal_remove")}
            onClick={() => onRemove(row.tagUnitId)}
          >
            <X className="size-3" aria-hidden />
          </button>
        </Badge>
      ))}
    </div>
  );
}

/**
 * Unit tag 投票编辑器。三段式结构：全局 tag vote、带 realm context 的 tag vote、
 * 当前用户个人 tag 标识。页面宽度由父容器控制；每个 section 内部 `w-full`，
 * 并列行都声明 `min-w-0`、`flex-1` 与固定按钮宽度。
 *
 * Mobile
 * +------------------------------+
 * | Global section               |
 * | existing votes stacked       |
 * | picker stacked               |
 * | Realm section                |
 * | realm picker + tag picker    |
 * | Personal marks               |
 * +------------------------------+
 *
 * Tablet
 * +------------------------------------------+
 * | Section header                           |
 * | vote row label flex-1 | action fixed     |
 * | picker input flex-1    | resolve fixed   |
 * +------------------------------------------+
 *
 * Desktop
 * +----------------------------------------------------+
 * | max-width parent; dense rows and search controls   |
 * | sections separated by whitespace and borders       |
 * +----------------------------------------------------+
 *
 * Ultra-wide
 * +----------------------------------------------------+
 * | editor remains constrained by parent max width     |
 * | no content-dependent centering or horizontal drift |
 * +----------------------------------------------------+
 */
export function UnitTagVotingEditor({
  unitId,
  className,
}: {
  unitId: string;
  className?: string;
}) {
  const { t } = useTranslation(["common", "community"]);
  const globalPickerId = useId();
  const realmPickerId = useId();
  const personalPickerId = useId();
  const [realmUnitId, setRealmUnitId] = useState("");
  const globalTags = useQuery(tagQueries.forUnit(unitId));
  const realmTags = useQuery(
    realmQueries.tagApplicationsForUnit(realmUnitId, unitId),
  );
  const personalTags = useQuery(userTagApplicationQueries.forUnit(unitId));
  const castUnitTagVote = useCastTagVoteMutation();
  const createUnitTag = useCreateUnitTagMutation();
  const withdrawUnitTag = useWithdrawUnitTagVoteMutation();
  const castRealmTagVote = useCastRealmTagApplicationVoteMutation();
  const createRealmTag = useCreateRealmTagApplicationMutation();
  const withdrawRealmTag = useWithdrawRealmTagApplicationVoteMutation();
  const setPersonalTags = useSetUserTagApplicationsMutation();
  const deletePersonalTag = useDeleteUserTagApplicationMutation();
  const unknownTagLabel = t("community:tag_unknown_label");

  const globalRows = globalTags.data?.tags ?? [];
  const personalRows = personalTags.data ?? [];
  const realmRows: TagVoteChipRow[] = (realmTags.data?.tags ?? []).map(
    (tag) => ({
      tagUnitId: tag.tagUnitId,
      score: tag.score,
      voteCount: tag.voteCount,
      viewerVote: tag.viewerVote ?? null,
    }),
  );

  const labelIds = [
    ...globalRows.map((tag) => tag.tagUnitId),
    ...personalRows.map((tag) => tag.tagUnitId),
    ...realmRows.map((tag) => tag.tagUnitId),
  ];
  const labels = useTagLabels(labelIds);
  const chipTranslations = useMemo(
    () => labelMapToTranslations(labels),
    [labels],
  );
  const globalIds = useMemo(
    () => new Set(globalRows.map((tag) => tag.tagUnitId)),
    [globalRows],
  );
  const realmIds = useMemo(
    () => new Set(realmRows.map((tag) => tag.tagUnitId)),
    [realmRows],
  );
  const personalIds = useMemo(
    () => new Set(personalRows.map((tag) => tag.tagUnitId)),
    [personalRows],
  );

  const handleAddPersonal = async (option: TagOption) => {
    await setPersonalTags.mutateAsync({
      unitId,
      tagUnitIds: [
        ...personalRows.map((tag) => tag.tagUnitId),
        option.tagUnitId,
      ],
    });
  };

  return (
    <div className={className}>
      <div className="flex w-full flex-col gap-8">
        <section className="flex w-full flex-col gap-4">
          <div>
            <h2 className="m-0 text-base font-medium leading-ui text-text-primary">
              {t("community:tag_global_vote_title")}
            </h2>
            <p className="m-0 mt-1 text-sm leading-ui text-text-secondary">
              {t("community:tag_global_vote_description")}
            </p>
          </div>
          {globalTags.isLoading ? (
            <Spinner size="sm" />
          ) : (
            <TagVoteChipGroup
              tags={globalRows}
              translations={chipTranslations}
              emptyText={t("community:tag_global_vote_empty")}
              votePending={
                castUnitTagVote.isPending || withdrawUnitTag.isPending
              }
              onVote={(tagUnitId, value) =>
                castUnitTagVote.mutate({ unitId, tagUnitId, value })
              }
              onWithdraw={(tagUnitId) =>
                withdrawUnitTag.mutate({ unitId, tagUnitId })
              }
            />
          )}
          <TagSearchPicker
            id={globalPickerId}
            label={t("community:tag_global_vote_picker_label")}
            placeholder={t("community:tag_picker_placeholder")}
            actionLabel={t("common:add")}
            excludeIds={globalIds}
            disabled={createUnitTag.isPending}
            onSelect={(option) =>
              createUnitTag.mutateAsync({ unitId, tagUnitId: option.tagUnitId })
            }
          />
        </section>

        <section className="flex w-full flex-col gap-4 border-t border-border-whisper pt-8">
          <div>
            <h2 className="m-0 text-base font-medium leading-ui text-text-primary">
              {t("community:tag_realm_vote_title")}
            </h2>
            <p className="m-0 mt-1 text-sm leading-ui text-text-secondary">
              {t("community:tag_realm_vote_description")}
            </p>
          </div>
          <RealmSearchField
            value={realmUnitId}
            onChange={setRealmUnitId}
            label={t("community:tag_realm_picker_label")}
            placeholder={t("community:tag_realm_picker_placeholder")}
          />
          {realmUnitId ? (
            <>
              <TagVoteChipGroup
                tags={realmRows}
                translations={chipTranslations}
                emptyText={t("community:tag_realm_vote_empty")}
                votePending={
                  castRealmTagVote.isPending || withdrawRealmTag.isPending
                }
                onVote={(tagUnitId, value) =>
                  castRealmTagVote.mutate({
                    realmUnitId,
                    unitId,
                    tagUnitId,
                    value,
                  })
                }
                onWithdraw={(tagUnitId) =>
                  withdrawRealmTag.mutate({
                    realmUnitId,
                    unitId,
                    tagUnitId,
                  })
                }
              />
              <TagSearchPicker
                id={realmPickerId}
                label={t("community:tag_realm_vote_picker_label")}
                placeholder={t("community:tag_picker_placeholder")}
                actionLabel={t("common:add")}
                excludeIds={realmIds}
                disabled={createRealmTag.isPending}
                onSelect={(option) =>
                  createRealmTag.mutateAsync({
                    realmUnitId,
                    unitId,
                    tagUnitId: option.tagUnitId,
                  })
                }
              />
            </>
          ) : null}
        </section>

        <section className="flex w-full flex-col gap-4 border-t border-border-whisper pt-8">
          <div>
            <h2 className="m-0 text-base font-medium leading-ui text-text-primary">
              {t("community:tag_personal_title")}
            </h2>
            <p className="m-0 mt-1 text-sm leading-ui text-text-secondary">
              {t("community:tag_personal_description")}
            </p>
          </div>
          <PersonalTagRows
            rows={personalRows}
            labels={labels}
            fallbackLabel={unknownTagLabel}
            disabled={deletePersonalTag.isPending}
            onRemove={(tagUnitId) =>
              deletePersonalTag.mutate({ unitId, tagUnitId })
            }
          />
          <TagSearchPicker
            id={personalPickerId}
            label={t("community:tag_personal_picker_label")}
            placeholder={t("community:tag_picker_placeholder")}
            actionLabel={t("common:add")}
            excludeIds={personalIds}
            disabled={setPersonalTags.isPending}
            onSelect={handleAddPersonal}
          />
        </section>
      </div>
    </div>
  );
}
