import type { PostDTO } from "@rezics/contract";
import { Avatar, AvatarFallback, AvatarImage } from "@rezics/ui/shadcn";
import type React from "react";

import { UserHoverPreview } from "@/user/components";

interface PostAuthorHeaderProps {
  post: PostDTO;
  size?: "compact" | "default";
}

export const PostAuthorHeader: React.FC<PostAuthorHeaderProps> = ({
  post,
  size = "default",
}) => {
  const dateStr = post.createdAt
    ? new Date(String(post.createdAt)).toLocaleDateString()
    : "";
  const nameClass =
    size === "compact" ? "text-xs font-semibold" : "text-sm font-semibold";
  const author = post.author?.userId ? post.author : undefined;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: this only prevents the parent post card click when nested author content is used.
    // biome-ignore lint/a11y/useKeyWithClickEvents: the container itself is not an activation target.
    <div
      className="flex items-center gap-2"
      onClick={(e) => e.stopPropagation()}
    >
      {author ? (
        <UserHoverPreview user={author} size={size} nameClassName={nameClass} />
      ) : (
        <AnonymousAuthor size={size} nameClassName={nameClass} />
      )}
      {dateStr && (
        <span className="text-xs text-text-secondary">{dateStr}</span>
      )}
    </div>
  );
};

interface AnonymousAuthorProps {
  size: "compact" | "default";
  nameClassName: string;
}

function AnonymousAuthor({ size, nameClassName }: AnonymousAuthorProps) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <Avatar className={size === "compact" ? "size-6" : "size-9"}>
        <AvatarImage alt="Anonymous avatar" />
        <AvatarFallback>?</AvatarFallback>
      </Avatar>
      <span className={nameClassName}>Anonymous</span>
    </span>
  );
}
