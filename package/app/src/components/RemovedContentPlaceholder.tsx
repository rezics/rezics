import type { CommentDTO } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { ShieldOff } from "lucide-react";
import type React from "react";

interface RemovedContentPlaceholderProps {
  redactionKind?: CommentDTO["redactionKind"];
  className?: string;
}

export const RemovedContentPlaceholder: React.FC<
  RemovedContentPlaceholderProps
> = ({ redactionKind, className }) => {
  const { t } = useTranslation(["community"]);
  const label =
    redactionKind === "author_deleted"
      ? t("community:content_deleted_by_author")
      : t("community:content_removed_by_moderator");

  return (
    <div
      className={[
        "flex min-w-0 items-center gap-2 rounded-md bg-surface-subtle px-3 py-2 text-sm leading-ui text-text-tertiary",
        className ?? "",
      ].join(" ")}
    >
      <ShieldOff className="h-4 w-4 shrink-0 text-text-tertiary" aria-hidden />
      <span className="min-w-0 truncate">{label}</span>
    </div>
  );
};
