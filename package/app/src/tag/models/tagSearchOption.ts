import type { TagSearchDocument } from "@rezics/contract";

export type SearchTagOption = {
  unitId: string;
  label?: string | null;
  slug?: string | null;
};

export function tagSearchOptionFromDoc(
  doc: TagSearchDocument,
): SearchTagOption {
  return {
    unitId: doc.unitId,
    label: doc.title ?? doc.titles[0] ?? null,
    slug: doc.slug ?? null,
  };
}

export function tagOptionLabel(option: SearchTagOption): string {
  return option.label ?? option.slug ?? option.unitId;
}
