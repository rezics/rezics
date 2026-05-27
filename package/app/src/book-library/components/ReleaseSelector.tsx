import { bookQueries } from "@rezics/api/book/book";
import type { BookDTO } from "@rezics/contract";
import {
  book_release_current,
  book_release_label,
  book_release_untitled,
  realm_official,
} from "@rezics/i18n/messages";
import { useMessage } from "@rezics/i18n/react";
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
import { releaseLanguage, releaseWorkUnitId } from "../models/releaseWork";
import { getTranslation } from "@/shared/utils/translation-helpers";

const i18nMessages = {
  book_release_current,
  book_release_label,
  book_release_untitled,
  realm_official,
};

export type ReleaseOption = {
  unitId: string;
  title: string;
  language: string;
  isOfficial: boolean;
  position?: string | null;
  displayPolicy?: string | null;
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
    const release = (tr as { sourceUnitId?: string | null }).sourceUnitId;
    if (tr.language && release) {
      map.set(tr.language as string, release);
    }
  }
  return map;
}

export function sortReleases(
  releases: ReleaseOption[],
  _currentLang: string,
): ReleaseOption[] {
  const officialRank = (isOfficial: boolean) => (isOfficial ? 0 : 1);
  const displayRank = (policy: string | null | undefined) => {
    if (policy === "PRIMARY") return 0;
    if (policy === "SECONDARY") return 1;
    return 2;
  };
  return [...releases].sort((a, b) => {
    const display = displayRank(a.displayPolicy) - displayRank(b.displayPolicy);
    if (display !== 0) return display;
    const position = (a.position ?? "").localeCompare(b.position ?? "");
    if (position !== 0) return position;
    const rank = officialRank(a.isOfficial) - officialRank(b.isOfficial);
    if (rank !== 0) return rank;
    return a.unitId.localeCompare(b.unitId);
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
  const m = useMessage(i18nMessages);
  const workUnitId = releaseWorkUnitId(bookInfo);

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
      const lang = releaseLanguage(r);
      list.push({
        unitId: r.unitId,
        title:
          getTranslation(
            r.translations,
            selectedLang,
            r.defaultLanguage ?? undefined,
          )?.title ?? m.book_release_untitled(),
        language: String(lang),
        isOfficial: officialByLang.get(String(lang)) === r.unitId,
        position: r.workMembership?.position,
        displayPolicy: r.workMembership?.displayPolicy,
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
          )?.title ?? m.book_release_current(),
        language:
          (bookInfo.defaultLanguage as string | undefined) ?? selectedLang,
        isOfficial:
          officialByLang.get(
            (bookInfo.defaultLanguage as string | undefined) ?? selectedLang,
          ) === bookInfo.unitId,
        position: bookInfo.workMembership?.position,
        displayPolicy: bookInfo.workMembership?.displayPolicy,
      });
    }
    return sortReleases(list, selectedLang);
  }, [
    releaseList,
    bookInfo,
    officialByLang,
    selectedLang,
    m.book_release_current,
    m.book_release_untitled,
  ]);

  if (options.length <= 1) return null;

  return (
    <div className="flex flex-row items-center gap-2">
      <span className="text-sm text-text-secondary">
        {m.book_release_label()}
      </span>
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
                    className="border-brand-fill text-text-brand"
                  >
                    {m.realm_official()}
                  </Badge>
                )}
                {opt.displayPolicy === "SECONDARY" && (
                  <Badge variant="secondary">Secondary</Badge>
                )}
                {opt.displayPolicy === "HIDDEN_BY_DEFAULT" && (
                  <Badge variant="secondary">Hidden</Badge>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
