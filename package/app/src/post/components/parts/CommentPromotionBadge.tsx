import type { PostDTO } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { CircleCheck, Pin } from "lucide-react";

/**
 * Renders why a reply is promoted within its thread: a distinct accepted-answer
 * badge (✓, success-tinted) or a general pin badge (📌, brand-tinted). Returns
 * nothing for ordinary replies. Icons are lucide glyphs, not emoji.
 */
export function CommentPromotionBadge({
  pinKind,
}: {
  pinKind: PostDTO["pinKind"];
}) {
  const { t } = useTranslation(["community"]);

  if (pinKind === "ACCEPTED_ANSWER") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
        <CircleCheck aria-hidden className="size-3.5" />
        {t("community:post_pin_accepted_answer")}
      </span>
    );
  }

  if (pinKind === "PINNED") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-brand">
        <Pin aria-hidden className="size-3.5" />
        {t("community:post_pin_pinned")}
      </span>
    );
  }

  return null;
}
