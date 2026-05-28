import type { SearchQuery, TagRef } from "@rezics/contract";
import { Badge, Button } from "@rezics/ui/shadcn";
import { X as CloseIcon } from "lucide-react";
import type React from "react";

import { getI18nRuntime } from "@rezics/i18n/runtime";
export type { ChipDescriptor as AppliedFilterChipDescriptor };

export type AppliedFilterChipsProps = {
  query: SearchQuery;
  hide?: SearchQuery;
  rendered?: (keyof SearchQuery)[];
  onRemove?: (patch: Partial<SearchQuery>) => void;
};

type ChipDescriptor = {
  key: string;
  label: string;
  remove?: Partial<SearchQuery>;
};

const tagIdentity = (t: TagRef): string => t.unitId ?? t.slug ?? "";

const tagLabel = (t: TagRef): string => t.name ?? t.slug ?? t.unitId ?? "";

function hideTags(all: TagRef[], hidden: TagRef[]): TagRef[] {
  const hiddenIds = new Set(hidden.map(tagIdentity).filter(Boolean));
  return all.filter((t) => {
    const id = tagIdentity(t);
    return !id || !hiddenIds.has(id);
  });
}

function hideStrings(all: string[], hidden: string[]): string[] {
  const hiddenSet = new Set(hidden);
  return all.filter((v) => !hiddenSet.has(v));
}

export function buildAppliedFilterChips(
  query: SearchQuery,
  hide: SearchQuery = {},
  rendered: (keyof SearchQuery)[] = [],
): ChipDescriptor[] {
  return buildChips(query, hide, new Set(rendered));
}

function buildChips(
  query: SearchQuery,
  hide: SearchQuery,
  rendered: Set<keyof SearchQuery>,
): ChipDescriptor[] {
  const out: ChipDescriptor[] = [];

  if (query.keyword && !rendered.has("keyword") && !hide.keyword) {
    out.push({
      key: `keyword:${query.keyword}`,
      label: `"${query.keyword}"`,
      remove: { keyword: "" },
    });
  }

  if (query.tags && !rendered.has("tags")) {
    const visibleTags = hideTags(query.tags, hide.tags ?? []);
    for (const tag of visibleTags) {
      const id = tagIdentity(tag);
      out.push({
        key: `tag:${id}`,
        label: `#${tagLabel(tag)}`,
        remove: {
          tags: (query.tags ?? []).filter((t) => tagIdentity(t) !== id),
        },
      });
    }
  }

  if (query.type && !rendered.has("type")) {
    const visibleTypes = hideStrings(query.type, hide.type ?? []);
    for (const type of visibleTypes) {
      out.push({
        key: `type:${type}`,
        label: getI18nRuntime().i18n.t("search:chip_type", { value: type }),
        remove: { type: (query.type ?? []).filter((t) => t !== type) },
      });
    }
  }

  if (query.postKind && !rendered.has("postKind")) {
    const hiddenKinds = (hide.postKind ?? []) as string[];
    const visibleKinds = hideStrings(query.postKind as string[], hiddenKinds);
    for (const kind of visibleKinds) {
      out.push({
        key: `postKind:${kind}`,
        label: getI18nRuntime().i18n.t("search:chip_post_kind", { value: kind }),
        remove: {
          postKind: (query.postKind ?? []).filter(
            (k) => k !== kind,
          ) as SearchQuery["postKind"],
        },
      });
    }
  }

  if (query.languages && !rendered.has("languages")) {
    const visibleLangs = hideStrings(query.languages, hide.languages ?? []);
    for (const lang of visibleLangs) {
      out.push({
        key: `lang:${lang}`,
        label: getI18nRuntime().i18n.t("search:chip_language", { value: lang }),
        remove: {
          languages: (query.languages ?? []).filter((l) => l !== lang),
        },
      });
    }
  }

  if (
    query.realm &&
    !rendered.has("realm") &&
    hide.realm?.slug !== query.realm.slug
  ) {
    out.push({
      key: `realm:${query.realm.slug}`,
      label: getI18nRuntime().i18n.t("search:chip_realm", { value: query.realm.slug }),
      remove: { realm: undefined },
    });
  }

  if (query.ratings?.length && !rendered.has("ratings")) {
    const hiddenRatings = new Set(hide.ratings ?? []);
    for (const tier of query.ratings) {
      if (hiddenRatings.has(tier)) continue;
      out.push({
        key: `rating:${tier}`,
        label: getI18nRuntime().i18n.t("search:chip_rating", { value: tier }),
        remove: {
          ratings: query.ratings.filter((r) => r !== tier),
        },
      });
    }
  }

  if (
    query.isLicensed !== undefined &&
    !rendered.has("isLicensed") &&
    hide.isLicensed === undefined
  ) {
    out.push({
      key: `licensed:${query.isLicensed}`,
      label: getI18nRuntime().i18n.t("search:chip_licensed", {
        value: query.isLicensed ? getI18nRuntime().i18n.t("common:yes") : getI18nRuntime().i18n.t("common:no"),
      }),
      remove: { isLicensed: undefined },
    });
  }

  if (query.textLength && !rendered.has("textLength") && !hide.textLength) {
    const { min, max } = query.textLength;
    const bounds = [
      min !== undefined ? `${min}` : "",
      max !== undefined ? `${max}` : "",
    ].join("–");
    out.push({
      key: `textLength:${bounds}`,
      label: getI18nRuntime().i18n.t("search:chip_words", { value: bounds }),
      remove: { textLength: undefined },
    });
  }

  if (query.sort && !rendered.has("sort") && !hide.sort) {
    out.push({
      key: `sort:${query.sort}`,
      label: getI18nRuntime().i18n.t("search:chip_sort", { value: query.sort }),
      remove: { sort: undefined },
    });
  }

  return out;
}

export const AppliedFilterChips: React.FC<AppliedFilterChipsProps> = ({
  query,
  hide = {},
  rendered = [],
  onRemove,
}) => {
  const chips = buildChips(query, hide, new Set(rendered));
  if (chips.length === 0) return null;

  return (
    <div className="flex flex-row flex-wrap gap-2">
      {chips.map((chip) => (
        <Badge
          key={chip.key}
          variant="outline"
          className="flex items-center gap-1"
        >
          <span>{chip.label}</span>
          {onRemove && chip.remove && (
            <Button
              size="icon"
              variant="ghost"
              className="h-4 w-4 p-0"
              aria-label={getI18nRuntime().i18n.t("common:remove")}
              onClick={() => onRemove(chip.remove as Partial<SearchQuery>)}
            >
              <CloseIcon size={12} />
            </Button>
          )}
        </Badge>
      ))}
    </div>
  );
};
