import { bookQueries } from "@rezics/api/book/book";
import type { BookDTO } from "@rezics/contract";
import {
  Badge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useMemo } from "react";
import { getTranslation } from "@/shared/utils/translation-helpers";

export type ReleaseOption = {
  unitId: string;
  title: string;
  language: string;
  isOfficial: boolean;
};

export type ReleaseSelectorProps = {
  bookInfo: BookDTO;
  selectedLang: string;
  selectedReleaseUnitId: string;
  onSelect: (releaseUnitId: string) => void;
};

function buildOfficialReleaseMap(
  translations: BookDTO["translations"],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const tr of translations ?? []) {
    const release = (tr as { sourceReleaseUnitId?: string | null })
      .sourceReleaseUnitId;
    if (tr.language && release) {
      map.set(tr.language as string, release);
    }
  }
  return map;
}

export function sortReleases(
  releases: ReleaseOption[],
  currentLang: string,
): ReleaseOption[] {
  const groupRank = (lang: string) => (lang === currentLang ? 0 : 1);
  const officialRank = (isOfficial: boolean) => (isOfficial ? 0 : 1);
  return [...releases].sort((a, b) => {
    const g = groupRank(a.language) - groupRank(b.language);
    if (g !== 0) return g;
    if (a.language !== b.language) return a.language.localeCompare(b.language);
    return officialRank(a.isOfficial) - officialRank(b.isOfficial);
  });
}

/**
 * Release selector for a book's Content tab. Lists every release under the
 * parent work, sorted so that the current language and official releases
 * appear first.
 */
export const ReleaseSelector: React.FC<ReleaseSelectorProps> = ({
  bookInfo,
  selectedLang,
  selectedReleaseUnitId,
  onSelect,
}) => {
  const workUnitId = bookInfo.workUnitId ?? undefined;

  const { data: releaseList } = useQuery({
    ...bookQueries.list({ workUnitId, limit: 50 }),
    enabled: Boolean(workUnitId),
  });

  const officialByLang = useMemo(
    () => buildOfficialReleaseMap(bookInfo.translations),
    [bookInfo.translations],
  );

  const options = useMemo<ReleaseOption[]>(() => {
    const releases = releaseList?.books ?? [];
    const list: ReleaseOption[] = [];
    // Ensure the current book is always present even if not returned.
    const seen = new Set<string>();
    for (const r of releases) {
      const lang =
        (r.defaultLanguage as string | undefined) ??
        r.translations?.[0]?.language ??
        "";
      list.push({
        unitId: r.unitId,
        title:
          getTranslation(
            r.translations,
            selectedLang,
            r.defaultLanguage ?? undefined,
          )?.title ?? "Untitled release",
        language: String(lang),
        isOfficial: officialByLang.get(String(lang)) === r.unitId,
      });
      seen.add(r.unitId);
    }
    if (!seen.has(bookInfo.unitId)) {
      list.push({
        unitId: bookInfo.unitId,
        title:
          getTranslation(
            bookInfo.translations,
            selectedLang,
            bookInfo.defaultLanguage ?? undefined,
          )?.title ?? "Current",
        language:
          (bookInfo.defaultLanguage as string | undefined) ?? selectedLang,
        isOfficial:
          officialByLang.get(
            (bookInfo.defaultLanguage as string | undefined) ?? selectedLang,
          ) === bookInfo.unitId,
      });
    }
    return sortReleases(list, selectedLang);
  }, [releaseList, bookInfo, officialByLang, selectedLang]);

  if (options.length <= 1) return null;

  return (
    <div className="flex flex-row items-center gap-2">
      <span className="text-sm text-text-secondary">Release</span>
      <Select value={selectedReleaseUnitId} onValueChange={(v) => onSelect(v)}>
        <SelectTrigger className="min-w-[260px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.unitId} value={opt.unitId}>
              <div className="flex flex-row items-center gap-2">
                <span>{opt.title}</span>
                <Badge variant="outline">{opt.language}</Badge>
                {opt.isOfficial && (
                  <Badge
                    variant="outline"
                    className="text-brand-fill border-brand-fill"
                  >
                    official
                  </Badge>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
