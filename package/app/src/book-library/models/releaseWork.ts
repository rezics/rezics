import type { BookDTO } from "@rezics/contract";

export type ReleaseListItem = Pick<
  BookDTO,
  "unitId" | "defaultLanguage" | "translations" | "workMembership"
>;

export const ALL_RELEASE_LANGUAGES = "__all__";

export function releaseWorkUnitId(
  bookInfo: Pick<BookDTO, "workMembership" | "workUnitId"> | null | undefined,
): string | undefined {
  return (
    bookInfo?.workMembership?.workUnitId ?? bookInfo?.workUnitId ?? undefined
  );
}

export function releaseLanguage(
  release: Pick<BookDTO, "defaultLanguage" | "translations" | "workMembership">,
): string {
  return (
    (release.workMembership?.language as string | null | undefined) ??
    (release.defaultLanguage as string | null | undefined) ??
    (release.translations?.[0]?.language as string | undefined) ??
    ""
  );
}

export function releaseLanguages(
  releases: readonly ReleaseListItem[],
): string[] {
  return [
    ...new Set(
      releases.map((release) => releaseLanguage(release)).filter(Boolean),
    ),
  ].sort((left, right) => left.localeCompare(right));
}

export function hasMissingReleaseLanguages(
  currentReleaseLanguages: readonly string[],
  releases: readonly ReleaseListItem[],
): boolean {
  const current = new Set(currentReleaseLanguages);
  return releaseLanguages(releases).some((language) => !current.has(language));
}

function displayPolicyRank(policy: string | null | undefined): number {
  if (policy === "PRIMARY") return 0;
  if (policy === "SECONDARY") return 1;
  return 2;
}

export function sortWorkReleases<T extends ReleaseListItem>(
  releases: readonly T[],
): T[] {
  return [...releases].sort((left, right) => {
    const leftMembership = left.workMembership;
    const rightMembership = right.workMembership;
    const policy =
      displayPolicyRank(leftMembership?.displayPolicy) -
      displayPolicyRank(rightMembership?.displayPolicy);
    if (policy !== 0) return policy;

    const leftPosition = leftMembership?.position ?? "";
    const rightPosition = rightMembership?.position ?? "";
    const position = leftPosition.localeCompare(rightPosition);
    if (position !== 0) return position;

    return left.unitId.localeCompare(right.unitId);
  });
}

export function filterReleasesByLanguage<T extends ReleaseListItem>(
  releases: readonly T[],
  language: string,
): T[] {
  if (language === ALL_RELEASE_LANGUAGES) return [...releases];
  return releases.filter((release) => releaseLanguage(release) === language);
}

export function filterReleasesByLanguages<T extends ReleaseListItem>(
  releases: readonly T[],
  languages: readonly string[],
): T[] {
  if (languages.length === 0) return [...releases];
  const languageSet = new Set(languages);
  return releases.filter((release) =>
    languageSet.has(releaseLanguage(release)),
  );
}
