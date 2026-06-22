import { useReactionHydration } from "@rezics/api/reaction/reaction";
import {
  contentDocMarkdownFallback,
  type ExcerptSource,
  type UnitDTO,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { MarkdownContent } from "@rezics/ui/composite/content/MarkdownContent.tsx";
import { LazyLoadImage } from "@rezics/ui/primitive/image/LazyLoadImage.tsx";
import { Quote as FormatQuoteIcon } from "lucide-react";
import type React from "react";
import { useMemo } from "react";
import { ReactionBar, type ReactionBarPost } from "@/engagement";
import { Link, AppSafeLink as SafeLink, unitHref } from "@/shared/ui/link";
import {
  excerptDetailActions,
  excerptPolicy,
} from "../../models/excerptPolicy";

interface ExcerptDetailProps {
  excerpt: UnitDTO;
  onReplyInvoke?: () => void;
}

export const ExcerptDetail: React.FC<ExcerptDetailProps> = ({
  excerpt,
  onReplyInvoke,
}) => {
  const { t } = useTranslation(["community"]);
  const description = contentDocMarkdownFallback(
    excerpt.translations?.[0]?.description,
  );
  const source = (excerpt.extra as Record<string, unknown> | null)?.source as
    | ExcerptSource
    | string
    | undefined;
  const dateStr = excerpt.createdAt
    ? new Date(String(excerpt.createdAt)).toLocaleDateString()
    : "";

  const reactionPost: ReactionBarPost = {
    unitId: excerpt.id,
  };
  const hydrationIds = useMemo(
    () => (excerpt.id ? [excerpt.id] : []),
    [excerpt.id],
  );
  useReactionHydration(hydrationIds);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-2">
        <FormatQuoteIcon className="h-7 w-7 text-text-secondary mt-1" />
        <div className="flex-1">
          {description ? (
            <MarkdownContent content={description} />
          ) : (
            <p className="text-sm text-text-secondary leading-relaxed">
              {t("community:excerpt_card_description_fallback")}
            </p>
          )}
        </div>
      </div>

      <ExcerptSourceLine source={source} />
      <ExcerptContributorLine user={excerpt.user} createdAtLabel={dateStr} />

      <ReactionBar
        size="lg"
        post={reactionPost}
        policy={excerptPolicy}
        actions={excerptDetailActions}
        onReplyInvoke={onReplyInvoke}
      />
    </div>
  );
};

function ExcerptContributorLine({
  user,
  createdAtLabel,
}: {
  user?: UnitDTO["user"];
  createdAtLabel?: string;
}) {
  const { t } = useTranslation(["community"]);

  if (!user) return null;

  return (
    <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-2 text-right text-xs text-text-secondary">
      <span>{t("community:excerpt_contributor_label")}</span>
      <Link
        to={unitHref({
          type: "USER",
          unitId: user.unitId ?? "",
          slug: user.slug ?? null,
        })}
        className="inline-flex items-center gap-1.5 text-text-primary"
      >
        <LazyLoadImage
          src={user.avatar ?? ""}
          alt={user.name ?? ""}
          className="h-5 w-5 rounded-full"
        />
        <span className="font-semibold">{user.name ?? ""}</span>
      </Link>
      {createdAtLabel && <span>/ {createdAtLabel}</span>}
    </div>
  );
}

function ExcerptSourceLine({ source }: { source?: ExcerptSource | string }) {
  if (!source) return null;
  if (typeof source === "string") {
    return (
      <p className="ml-auto max-w-full text-right text-xs text-text-secondary">
        —— {source}
      </p>
    );
  }
  const href = source.mode === "unit" ? `/unit/${source.unitId}` : source.url;
  return (
    <p className="ml-auto max-w-full text-right text-xs text-text-secondary">
      ——{" "}
      <SafeLink href={href} className="underline">
        {source.title}
      </SafeLink>
    </p>
  );
}
