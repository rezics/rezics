import { useReactionHydration } from "@rezics/api/reaction/reaction";
import type { ExcerptSource, UnitDTO } from "@rezics/contract";
import { MarkdownContent } from "@rezics/ui/composite/content/MarkdownContent.tsx";
import { SafeLink } from "@rezics/ui/link/SafeLink.tsx";
import { LazyLoadImage } from "@rezics/ui/primitive/image/LazyLoadImage.tsx";
import { Link } from "@rezics/ui/primitive/link/Link.tsx";
import { useMemo } from "react";
import type React from "react";
import { ReactionBar, type ReactionBarPost } from "@/engagement";
import {
  excerptDetailActions,
  excerptPolicy,
} from "../../models/excerptPolicy";
import { Quote as FormatQuoteIcon } from "lucide-react";

interface ExcerptDetailProps {
  excerpt: UnitDTO;
  onReplyInvoke?: () => void;
}

export const ExcerptDetail: React.FC<ExcerptDetailProps> = ({
  excerpt,
  onReplyInvoke,
}) => {
  const description = excerpt.translations?.[0]?.description ?? "";
  const source = (excerpt.extra as Record<string, unknown> | null)?.source as
    | ExcerptSource
    | string
    | undefined;
  const dateStr = excerpt.createdAt
    ? new Date(String(excerpt.createdAt)).toLocaleDateString()
    : "";

  const reactionPost: ReactionBarPost = {
    unitId: excerpt.id,
    replyCount: (excerpt as unknown as { replyCount?: number }).replyCount,
  };
  const hydrationIds = useMemo(
    () => (excerpt.id ? [excerpt.id] : []),
    [excerpt.id],
  );
  useReactionHydration(hydrationIds);

  return (
    <div className="flex flex-col gap-4">
      {excerpt.user && (
        <div className="flex items-center gap-3">
          <Link
            to={excerpt.user.slug ? "/u/$userSlug" : "/user/$userId"}
            params={
              excerpt.user.slug
                ? { userSlug: excerpt.user.slug }
                : { userId: excerpt.user.userId ?? "" }
            }
            className="flex items-center gap-3"
          >
            <LazyLoadImage
              src={excerpt.user.avatar ?? ""}
              alt={excerpt.user.name ?? ""}
              className="w-16 h-16 rounded-full shadow"
            />
            <p className="text-sm font-semibold">{excerpt.user.name ?? ""}</p>
          </Link>
          {dateStr && <p className="text-xs text-text-secondary">{dateStr}</p>}
        </div>
      )}

      <div className="flex items-start gap-2">
        <FormatQuoteIcon className="h-7 w-7 text-text-secondary mt-1" />
        <div className="flex-1">
          <MarkdownContent content={description} />
        </div>
      </div>

      <ExcerptSourceLine source={source} />

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

function ExcerptSourceLine({ source }: { source?: ExcerptSource | string }) {
  if (!source) return null;
  if (typeof source === "string") {
    return <p className="text-xs text-text-secondary">—— {source}</p>;
  }
  const href =
    source.mode === "unit" ? `/unit/id/${source.unitId}` : source.url;
  return (
    <p className="text-xs text-text-secondary">
      ——{" "}
      <SafeLink href={href} className="underline">
        {source.title}
      </SafeLink>
    </p>
  );
}
