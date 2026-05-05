import type { PostDTO } from "@rezics/contract";
import { Link } from "@rezics/ui/primitive/link/Link.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "@rezics/ui/shadcn";
import type React from "react";

interface PostAuthorHeaderProps {
  post: PostDTO;
  size?: "compact" | "default";
}

export const PostAuthorHeader: React.FC<PostAuthorHeaderProps> = ({
  post,
  size = "default",
}) => {
  const avatarSize = size === "compact" ? 24 : 36;
  const dateStr = post.createdAt
    ? new Date(String(post.createdAt)).toLocaleDateString()
    : "";
  const nameClass =
    size === "compact" ? "text-xs font-semibold" : "text-sm font-semibold";

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: this only prevents the parent post card click when nested author content is used.
    // biome-ignore lint/a11y/useKeyWithClickEvents: the container itself is not an activation target.
    <div
      className="flex items-center gap-2"
      onClick={(e) => e.stopPropagation()}
    >
      <Link to="/user/$unitId" params={{ unitId: post.author?.unitId ?? "" }}>
        <Avatar style={{ width: avatarSize, height: avatarSize }}>
          <AvatarImage src={post.author?.avatar ?? ""} />
          <AvatarFallback>
            {(post.author?.name ?? "?").slice(0, 1)}
          </AvatarFallback>
        </Avatar>
      </Link>
      <span className={nameClass}>{post.author?.name ?? "Anonymous"}</span>
      {dateStr && (
        <span className="text-xs text-text-secondary">{dateStr}</span>
      )}
    </div>
  );
};
