import {
  contentDocMarkdownFallback,
  type ExcerptSource,
  type UnitDTO,
  type VariantContextSummary,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Card, CardContent } from "@rezics/ui/shadcn";
import { useNavigate } from "@tanstack/react-router";
import { Quote as FormatQuoteRoundedIcon } from "lucide-react";
import type React from "react";
import { ReactionBar, type ReactionBarPost } from "@/engagement";
import { cn } from "@/shared/utils/css-util";
import { VariantContextLink } from "@/unit";
import { excerptCardActions, excerptPolicy } from "../../models/excerptPolicy";

export interface ExcerptCardProps {
  excerpt: UnitDTO;
  className?: string;
  variantContext?: VariantContextSummary | null;
}

export const ExcerptCard: React.FC<ExcerptCardProps> = ({
  excerpt,
  className,
  variantContext,
}) => {
  const { t } = useTranslation(["community"]);
  const navigate = useNavigate();

  const excerptId = excerpt.id;

  const handleOpenExcerpt = () => {
    if (!excerptId) return;
    navigate({ to: "/excerpt/$unitId", params: { unitId: excerptId } });
  };

  const handleReplyInvoke = () => {
    if (!excerptId) return;
    navigate({
      to: "/excerpt/$unitId",
      params: { unitId: excerptId },
      search: { focus: "reply" },
    });
  };

  const source = (excerpt.extra as Record<string, unknown> | null)?.source as
    | ExcerptSource
    | string
    | undefined;
  const description =
    contentDocMarkdownFallback(excerpt.translations?.[0]?.description) ||
    t("community:excerpt_card_description_fallback");

  const reactionPost: ReactionBarPost = {
    unitId: excerptId ?? "",
    replyCount: (excerpt as unknown as { replyCount?: number }).replyCount,
  };

  return (
    <Card
      surface="plain"
      className={cn(
        "w-full transition-all mb-1",
        excerptId && "cursor-pointer",
        className,
      )}
      onClick={handleOpenExcerpt}
    >
      <CardContent>
        <div className="flex items-start gap-2">
          <FormatQuoteRoundedIcon className="h-4 w-4 text-text-secondary mt-1 shrink-0" />

          <div className="min-w-0 flex-1">
            <p className="text-sm text-text-primary line-clamp-3 leading-7">
              {description}
            </p>
            {variantContext && (
              // biome-ignore lint/a11y/noStaticElementInteractions: this only prevents the parent card click when the nested route link is used.
              <div
                className="mt-2 w-fit max-w-full"
                onClick={(event) => event.stopPropagation()}
                onKeyDown={() => undefined}
              >
                <VariantContextLink context={variantContext} />
              </div>
            )}

            <div className="mt-3 flex items-center justify-between gap-2">
              <ReactionBar
                size="sm"
                post={reactionPost}
                policy={excerptPolicy}
                actions={excerptCardActions}
                onReplyInvoke={handleReplyInvoke}
              />
              <p className="text-xs text-text-secondary truncate">
                —— <ExcerptCardSource source={source} />
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

function ExcerptCardSource({ source }: { source?: ExcerptSource | string }) {
  const { t } = useTranslation(["community"]);
  if (!source) return <>{t("community:excerpt_card_source_unknown")}</>;
  if (typeof source === "string") return <>{source}</>;
  return <>{source.title}</>;
}
