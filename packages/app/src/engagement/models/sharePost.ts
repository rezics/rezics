import type {
  ContentLanguage,
  CreatePostInput,
  UnitType,
} from "@rezics/contract";
import {
  markdownContentDoc,
  PostKind,
  unitRefContentBlock,
} from "@rezics/contract";

export const defaultSharePostTitle = "Shared item";

export function normalizeSharePostTitle(title?: string | null): string {
  const trimmed = title?.trim();
  return trimmed ? trimmed.slice(0, 300) : defaultSharePostTitle;
}

export function buildSharePostContent(input: {
  body?: string | null;
  targetUnitId: string;
  targetUnitType?: UnitType;
}) {
  return {
    ...markdownContentDoc(input.body?.trim() ?? ""),
    afterMain: [
      unitRefContentBlock({
        unitId: input.targetUnitId,
        unitType: input.targetUnitType,
      }),
    ],
  };
}

export function buildInternalSharePostCreateInput(input: {
  targetUnitId: string;
  targetUnitType?: UnitType;
  title?: string | null;
  body?: string | null;
  language: ContentLanguage;
  status?: "DRAFT" | "PUBLISHED";
}): CreatePostInput {
  return {
    kind: PostKind.POST,
    language: input.language,
    title: normalizeSharePostTitle(input.title),
    content: buildSharePostContent(input),
    status: input.status ?? "PUBLISHED",
  };
}
