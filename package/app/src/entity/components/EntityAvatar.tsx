import { cn } from "@/shared/utils/css-util";

interface EntityAvatarProps {
  avatar?: string | null;
  title?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClass = {
  sm: "size-8 text-xs",
  md: "size-9 text-xs",
  lg: "size-16 text-lg",
} as const;

export function EntityAvatar({
  avatar,
  title,
  size = "md",
  className,
}: EntityAvatarProps) {
  const fallback = title?.trim().slice(0, 1).toUpperCase() || "?";

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-subtle font-medium text-text-secondary",
        sizeClass[size],
        className,
      )}
    >
      {avatar ? (
        <img
          src={avatar}
          alt=""
          className="size-full object-cover"
          loading="lazy"
        />
      ) : (
        fallback
      )}
    </span>
  );
}
