import { Chip, Stack } from "@mui/material";
import type { SearchQuery, TagRef } from "@rezics/contract";
import type React from "react";
import { X as CloseIcon } from "lucide-react";

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

const tagLabel = (t: TagRef): string =>
  t.name ?? t.slug ?? t.unitId ?? "";

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
        label: `Type: ${type}`,
        remove: { type: (query.type ?? []).filter((t) => t !== type) },
      });
    }
  }

  if (query.postKind && !rendered.has("postKind")) {
    const hiddenKinds = (hide.postKind ?? []) as string[];
    const visibleKinds = hideStrings(
      query.postKind as string[],
      hiddenKinds,
    );
    for (const kind of visibleKinds) {
      out.push({
        key: `postKind:${kind}`,
        label: `Post: ${kind}`,
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
        label: `Lang: ${lang}`,
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
      label: `In: ${query.realm.slug}`,
      remove: { realm: undefined },
    });
  }

  if (query.ratings?.length && !rendered.has("ratings")) {
    const hiddenRatings = new Set(hide.ratings ?? []);
    for (const tier of query.ratings) {
      if (hiddenRatings.has(tier)) continue;
      out.push({
        key: `rating:${tier}`,
        label: `Rating: ${tier}`,
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
      label: `Licensed: ${query.isLicensed ? "Yes" : "No"}`,
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
      label: `Words: ${bounds}`,
      remove: { textLength: undefined },
    });
  }

  if (query.sort && !rendered.has("sort") && !hide.sort) {
    out.push({
      key: `sort:${query.sort}`,
      label: `Sort: ${query.sort}`,
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
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
      {chips.map((chip) => (
        <Chip
          key={chip.key}
          label={chip.label}
          size="small"
          variant="outlined"
          onDelete={
            onRemove && chip.remove
              ? () => onRemove(chip.remove as Partial<SearchQuery>)
              : undefined
          }
          deleteIcon={<CloseIcon fontSize="small" />}
        />
      ))}
    </Stack>
  );
};
