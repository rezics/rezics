import type { DraftKind, DraftMetadata } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { FileText } from "lucide-react";
import type React from "react";
import { Link } from "@/shared/ui/link";

export interface DraftListProps {
  drafts: DraftMetadata[];
}

/**
 * Presentational list of cross-type drafts. Each row links to the draft's
 * server-resolved `resumeRoute` so the matching editor reopens with the
 * draft loaded. Empty/loading/error states are owned by the caller.
 */
export const DraftList: React.FC<DraftListProps> = ({ drafts }) => {
  const { t } = useTranslation(["page"]);
  return (
    <ul className="flex flex-col gap-2">
      {drafts.map((draft) => (
        <li key={draft.id}>
          <Link
            to={draft.resumeRoute}
            className="flex items-start gap-3 rounded-md p-3 hover:bg-surface-sunken"
          >
            <FileText className="mt-0.5 h-4 w-4 flex-none text-text-tertiary" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="line-clamp-1 text-sm font-semibold text-text-primary">
                  {draft.title}
                </span>
                <span className="flex-none rounded-pill bg-surface-sunken px-2 py-0.5 text-xs text-text-secondary">
                  {draftKindLabel(t, draft.kind)}
                </span>
              </div>
              {draft.excerpt ? (
                <p className="mt-0.5 line-clamp-2 text-xs text-text-secondary">
                  {draft.excerpt}
                </p>
              ) : null}
              <p className="mt-1 text-xs text-text-tertiary">
                {formatUpdatedAt(draft.updatedAt)}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
};

/** Localized per-kind label. Literal `t` calls keep the R12 token check happy. */
function draftKindLabel(t: (key: string) => string, kind: DraftKind): string {
  switch (kind) {
    case "review":
      return t("page:draft_kind_review");
    case "post":
      return t("page:draft_kind_post");
    case "remark":
      return t("page:draft_kind_remark");
    case "wiki":
      return t("page:draft_kind_wiki");
    case "shelf-description":
      return t("page:draft_kind_shelf_description");
  }
}

function formatUpdatedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    date,
  );
}
