export type EditorialContentType = "book" | "entity" | "wiki-post";

export type EditorialLeaf = {
  path: string;
  value: unknown;
};

export const editorialPathScope = {
  book: {
    exact: [
      "unit.rating",
      "unit.aiDisclosureMode",
      "unit.aiDisclosureDetails",
      "unit.visibility",
      "unit.license",
      "extension.isbn13",
      "extension.publicationDate",
      "extension.pageCount",
      "extension.textLength",
      "extension.formatKey",
      "extension.isLicensed",
      "extension.extra",
    ],
    prefixes: ["translations."],
  },
  entity: {
    exact: [
      "unit.slug",
      "entity.kind",
      "entity.avatar",
      "entity.verified",
      "entity.eligibleCreditRoles",
      "entity.eligibleSubjectRoles",
    ],
    prefixes: ["translations."],
  },
  "wiki-post": {
    exact: ["post.content", "post.content.main"],
    prefixes: ["post.content.main."],
  },
} as const satisfies Record<
  EditorialContentType,
  { exact: readonly string[]; prefixes: readonly string[] }
>;

export function isEditorialPathInScope(
  contentType: EditorialContentType,
  path: string,
): boolean {
  const scope = editorialPathScope[contentType];
  return (
    scope.exact.includes(path as never) ||
    scope.prefixes.some((prefix) => path.startsWith(prefix))
  );
}

export function explodeEditorialPatchLeaves(
  value: unknown,
  prefix = "",
): EditorialLeaf[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return prefix ? [{ path: prefix, value }] : [];
  }

  const leaves: EditorialLeaf[] = [];
  for (const [key, nested] of Object.entries(
    value as Record<string, unknown>,
  )) {
    if (key === "$unset") {
      if (Array.isArray(nested)) {
        leaves.push(
          ...nested
            .filter((path): path is string => typeof path === "string")
            .map((path) => ({ path, value: null })),
        );
      }
      continue;
    }

    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    const nestedLeaves = explodeEditorialPatchLeaves(nested, nextPrefix);
    leaves.push(
      ...(nestedLeaves.length > 0
        ? nestedLeaves
        : [{ path: nextPrefix, value: nested }]),
    );
  }

  const unique = new Map<string, EditorialLeaf>();
  for (const leaf of leaves) unique.set(leaf.path, leaf);
  return [...unique.values()];
}

export function collectEditorialPatchLeafPaths(value: unknown): string[] {
  return explodeEditorialPatchLeaves(value).map((leaf) => leaf.path);
}
