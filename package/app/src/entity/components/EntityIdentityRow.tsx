import type {
  EntityDTO,
  EntityKind,
  UnitTranslationDTO,
} from "@rezics/contract";
import { useMessage } from "@rezics/i18n/react";
import { entity_untitled } from "@rezics/i18n/messages";
import { cn } from "@/shared/utils/css-util";
import { EntityAvatar } from "./EntityAvatar";
import { EntityKindBadge } from "./EntityKindBadge";
import { EntityVerifiedIcon } from "./EntityVerifiedIcon";

const i18nMessages = {
  entity_untitled,
};

export interface EntityIdentity {
  unitId?: string;
  kind?: EntityKind | null;
  avatar?: string | null;
  verified?: boolean | null;
  translations?: UnitTranslationDTO[];
}

interface EntityIdentityRowProps {
  entity: EntityIdentity | EntityDTO;
  fallbackTitle?: string;
  meta?: string;
  interactive?: boolean;
  avatarSize?: "sm" | "md" | "lg";
  className?: string;
}

export function getEntityIdentityTitle(
  entity?: EntityIdentity | EntityDTO | null,
  fallbackTitle = "",
) {
  const title = entity?.translations?.[0]?.title?.trim();
  return title || fallbackTitle;
}

export function EntityIdentityRow({
  entity,
  fallbackTitle,
  meta,
  interactive = false,
  avatarSize = "md",
  className,
}: EntityIdentityRowProps) {
  const m = useMessage(i18nMessages);
  const title = getEntityIdentityTitle(
    entity,
    fallbackTitle ?? m.entity_untitled(),
  );

  return (
    <span
      className={cn(
        "flex w-full min-w-0 items-center gap-3 text-left text-sm",
        interactive && "rounded-md px-3 py-2 hover:bg-surface-subtle",
        className,
      )}
    >
      <EntityAvatar avatar={entity.avatar} title={title} size={avatarSize} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-text-primary">{title}</span>
        {meta ? (
          <span className="block truncate text-xs text-text-secondary">
            {meta}
          </span>
        ) : null}
      </span>
      <EntityKindBadge kind={entity.kind} />
      <EntityVerifiedIcon verified={entity.verified} />
    </span>
  );
}
