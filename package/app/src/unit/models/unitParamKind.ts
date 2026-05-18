import type { CandidateKind, IdentifierType } from "./types";

const PARAM_KIND_BY_NAME: Record<string, CandidateKind> = {
  rootPostUnitId: "post",
  reviewId: "review",
  remarkId: "remark",
  bookUnitId: "book",
  shelfId: "shelf",
  realmId: "realm",
  domainId: "domain",
  userSlug: "user",
  userId: "user",
  zoneId: "zone",
};

const ID_SUFFIX = "Id";
const SLUG_SUFFIX = "Slug";

export interface ParamKind {
  kind: CandidateKind;
  identifierType: IdentifierType;
}

/**
 * Derive the candidate kind and identifier type for a route param name.
 * Returns null if the param name does not end in Id or Slug.
 */
export function unitParamKind(paramName: string): ParamKind | null {
  let identifierType: IdentifierType | null = null;
  let baseName = "";
  if (paramName.endsWith(SLUG_SUFFIX)) {
    identifierType = "slug";
    baseName = paramName.slice(0, -SLUG_SUFFIX.length);
  } else if (paramName.endsWith(ID_SUFFIX)) {
    identifierType = "id";
    baseName = paramName.slice(0, -ID_SUFFIX.length);
  } else {
    return null;
  }
  if (!baseName) return null;

  const namedKind = PARAM_KIND_BY_NAME[paramName];
  if (namedKind) {
    return { kind: namedKind, identifierType };
  }

  return { kind: baseName.toLowerCase() as CandidateKind, identifierType };
}
