import { contentDocMarkdownFallback, type PostDTO } from "@rezics/contract";
import { Avatar, AvatarFallback, AvatarImage } from "@rezics/ui/shadcn";
import type React from "react";
import { UserHoverPreview } from "@/user/components";
import { useMessage } from "@rezics/i18n/react";
import {
  post_anonymous_author,
  post_anonymous_avatar_alt,
} from "@rezics/i18n/messages";
const m = {
  post_anonymous_author,
  post_anonymous_avatar_alt,
};

const i18nMessages = {
  post_anonymous_author,
  post_anonymous_avatar_alt,
};

interface PostAuthorHeaderProps {
  post: PostDTO;
  size?: "compact" | "default";
  showAvatar?: boolean;
  avatarClassName?: string;
}

export const PostAuthorHeader: React.FC<PostAuthorHeaderProps> = ({
  post,
  size = "default",
  showAvatar = true,
  avatarClassName,
}) => {
  const dateStr = post.createdAt
    ? new Date(String(post.createdAt)).toLocaleDateString()
    : "";
  const nameClass =
    size === "compact" ? "text-xs font-semibold" : "text-sm font-semibold";
  const author = post.author?.unitId ? post.author : undefined;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: this only prevents the parent post card click when nested author content is used.
    // biome-ignore lint/a11y/useKeyWithClickEvents: the container itself is not an activation target.
    <div
      className="flex items-center gap-2"
      onClick={(e) => e.stopPropagation()}
    >
      {author ? (
        <UserHoverPreview
          user={{
            ...author,
            description: contentDocMarkdownFallback(author.description),
          }}
          size={size}
          avatarClassName={avatarClassName}
          nameClassName={nameClass}
          showAvatar={showAvatar}
        />
      ) : (
        <AnonymousAuthor
          size={size}
          nameClassName={nameClass}
          showAvatar={showAvatar}
          avatarClassName={avatarClassName}
        />
      )}
      {dateStr && (
        <span className="text-xs text-text-secondary">{dateStr}</span>
      )}
    </div>
  );
};

export function PostAuthorAvatar({
  post,
  size = "compact",
  className,
}: {
  post: PostDTO;
  size?: "compact" | "default";
  className?: string;
}) {
  const m = useMessage(i18nMessages);
  const author = post.author?.unitId ? post.author : undefined;
  const avatarClassName = [size === "compact" ? "size-8" : "size-9", className]
    .filter(Boolean)
    .join(" ");

  if (author) {
    return (
      <UserHoverPreview
        user={{
          ...author,
          description: contentDocMarkdownFallback(author.description),
        }}
        size={size}
        avatarClassName={avatarClassName}
        showName={false}
      />
    );
  }

  return (
    <Avatar className={avatarClassName}>
      <AvatarImage alt={m.post_anonymous_avatar_alt()} />
      <AvatarFallback>?</AvatarFallback>
    </Avatar>
  );
}

interface AnonymousAuthorProps {
  size: "compact" | "default";
  nameClassName: string;
  showAvatar: boolean;
  avatarClassName?: string;
}

function AnonymousAuthor({
  size,
  nameClassName,
  showAvatar,
  avatarClassName,
}: AnonymousAuthorProps) {
  const m = useMessage(i18nMessages);
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      {showAvatar ? (
        <Avatar
          className={[size === "compact" ? "size-8" : "size-9", avatarClassName]
            .filter(Boolean)
            .join(" ")}
        >
          <AvatarImage alt={m.post_anonymous_avatar_alt()} />
          <AvatarFallback>?</AvatarFallback>
        </Avatar>
      ) : null}
      <span className={nameClassName}>{m.post_anonymous_author()}</span>
    </span>
  );
}
