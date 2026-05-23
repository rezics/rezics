import type {
  ReactionHistoryGivenItem,
  ReactionHistoryReceivedItem,
} from "@rezics/api/reaction/reaction.types";
import { AppSafeLink as SafeLink } from "@/shared/ui/link";
import { Avatar, AvatarFallback, AvatarImage } from "@rezics/ui/shadcn";
import {
  Bookmark,
  Heart,
  type LucideIcon,
  MessageSquare,
  Sparkles,
  Star,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import type { FC } from "react";
import * as m from "@rezics/i18n/messages";

const REACTION_ICONS: Record<string, LucideIcon> = {
  like: ThumbsUp,
  dislike: ThumbsDown,
  bookmark: Bookmark,
  heart: Heart,
  star: Star,
  insightful: Sparkles,
  reply: MessageSquare,
};

function reactionIconFor(reaction: string): LucideIcon {
  return REACTION_ICONS[reaction] ?? Sparkles;
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

type GivenProps = {
  mode: "given";
  item: ReactionHistoryGivenItem;
};

type ReceivedProps = {
  mode: "received";
  item: ReactionHistoryReceivedItem;
};

export type ReactionHistoryItemProps = GivenProps | ReceivedProps;

export const ReactionHistoryItem: FC<ReactionHistoryItemProps> = (props) => {
  const { mode, item } = props;
  const Icon = reactionIconFor(item.reaction);
  const timestamp = formatTimestamp(item.createdAt);
  const target = item.target;

  return (
    <article className="flex items-start gap-3 py-3 border-b border-border-whisper last:border-b-0">
      <div
        className="mt-0.5 text-text-tertiary"
        aria-hidden="true"
        title={item.reaction}
      >
        <Icon width={18} height={18} />
      </div>

      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="flex items-center gap-2 flex-wrap text-xs text-text-secondary">
          {mode === "received" ? (
            <ReceivedActor actor={props.item.actor} />
          ) : (
            <span className="text-text-secondary">
              {m.reactions_reacted_with()}
            </span>
          )}
          <span className="text-text-primary capitalize">{item.reaction}</span>
          <span aria-hidden="true">·</span>
          <time dateTime={item.createdAt}>{timestamp}</time>
        </div>

        {target ? (
          <SafeLink
            href={target.href}
            className="text-sm text-text-primary hover:text-text-brand no-underline"
          >
            <span className="text-text-tertiary mr-1 capitalize">
              {target.kind}:
            </span>
            <span>{target.title ?? target.snippet ?? target.unitId}</span>
          </SafeLink>
        ) : (
          <span className="text-sm text-text-tertiary italic">
            {m.reactions_deleted_content()}
          </span>
        )}
      </div>
    </article>
  );
};

const ReceivedActor: FC<{
  actor: ReactionHistoryReceivedItem["actor"];
}> = ({ actor }) => {
  const initial = actor.displayName?.charAt(0).toUpperCase() ?? "?";
  return (
    <SafeLink
      href={actor.href}
      className="inline-flex items-center gap-1.5 text-text-primary no-underline hover:text-text-brand"
    >
      <Avatar className="w-5 h-5">
        <AvatarImage src={actor.avatarUrl} alt={actor.displayName} />
        <AvatarFallback>{initial}</AvatarFallback>
      </Avatar>
      <span className="font-medium">{actor.displayName}</span>
    </SafeLink>
  );
};
