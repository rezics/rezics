import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Card,
  CardContent,
} from "@rezics/ui/shadcn";
import type { ExcerptSource, UnitDTO } from "@rezics/contract";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import { ReactionBar, type ReactionBarPost } from "@/engagement";
import { cn } from "@/shared/utils/css-util";
import { excerptCardActions, excerptPolicy } from "../../models/excerptPolicy";
import { Quote as FormatQuoteRoundedIcon } from "lucide-react";
import * as m from "@rezics/i18n/messages";

export interface ExcerptCardProps {
  excerpt: UnitDTO;
  className?: string;
}

export const ExcerptCard: React.FC<ExcerptCardProps> = ({
  excerpt,
  className,
}) => {
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
    excerpt.translations?.[0]?.description ??
    m.excerpt_card_description_fallback();

  const reactionPost: ReactionBarPost = {
    unitId: excerptId ?? "",
    replyCount: (excerpt as unknown as { replyCount?: number }).replyCount,
  };

  return (
    <Card
      className={cn(
        "w-full transition-all mb-1 shadow-none border-none",
        excerptId && "cursor-pointer",
        className,
      )}
      onClick={handleOpenExcerpt}
    >
      <CardContent>
        <div className="flex items-start gap-2">
          <FormatQuoteRoundedIcon className="h-4 w-4 text-text-secondary mt-1 shrink-0" />

          <div className="min-w-0 flex-1">
            {excerpt.user && (
              // biome-ignore lint/a11y/noStaticElementInteractions: this only prevents the parent card click when nested author content is used.
              <div
                className="flex items-center gap-2 mb-1"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={() => undefined}
              >
                <Avatar className="h-5 w-5 rounded-md">
                  <AvatarImage src={excerpt.user.avatar ?? ""} />
                  <AvatarFallback>
                    {(excerpt.user.name ?? "?").slice(0, 1)}
                  </AvatarFallback>
                </Avatar>
                <p className="text-xs font-semibold">
                  {excerpt.user.name ?? ""}
                </p>
              </div>
            )}
            <p className="text-sm text-text-primary line-clamp-3 leading-7">
              {description}
            </p>

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
  if (!source) return <>{m.excerpt_card_source_unknown()}</>;
  if (typeof source === "string") return <>{source}</>;
  return <>{source.title}</>;
}

export default ExcerptCard;
