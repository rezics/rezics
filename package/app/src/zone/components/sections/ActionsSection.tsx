import type { ZoneActionsSection } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { buttonVariants } from "@rezics/ui/shadcn";
import { AppSafeLink as SafeLink } from "@/shared/ui/link";
import { cn } from "@/shared/utils/css-util";
import {
  zoneCreateHref,
  zoneJoinHref,
  zoneLinkFallbackKey,
  zoneLinkHref,
  zoneLinkLabel,
} from "../../models/zoneMenu";
import {
  useZoneLabelResolver,
  useZoneSectionTitle,
  type ZonePortalContext,
  ZoneSectionShell,
} from "./shared";

/**
 * Action section with explicit built-in and authored links.
 * 动作分区：内建动作与人工配置链接同处一个可排序 section。
 *
 * Mobile:
 * | [Primary]              |
 * | [Secondary] [Ghost]    |
 *
 * Tablet:
 * | [Primary] [Secondary] [Ghost] wrap as needed |
 *
 * Desktop:
 * | Section title (optional)                     |
 * | [Primary] [Secondary] [Secondary] [Ghost]    |
 *
 * Ultra-wide:
 * | Same content width as parent; buttons keep intrinsic width and wrap. |
 */
export function ActionsSection({
  section,
  ctx,
}: {
  section: ZoneActionsSection;
  ctx: ZonePortalContext;
}) {
  const { t } = useTranslation(["zone"]);
  const title = useZoneSectionTitle(section, ctx.refUnits);
  const resolveLabel = useZoneLabelResolver();
  const linkCtx = {
    zoneSlug: ctx.zone.slug,
    pages: ctx.zone.pages,
    refUnits: ctx.refUnits,
  };
  const builtIns = section.builtIns ?? [];
  const actions = [
    ...builtIns.flatMap((builtIn) => {
      switch (builtIn) {
        case "joinRealm": {
          const href = zoneJoinHref(ctx.zone.boundary, ctx.refUnits);
          return href
            ? [{ key: "builtin:join", href, label: t("zone:join_realm") }]
            : [];
        }
        case "createWiki": {
          const href = zoneCreateHref(ctx.zone.boundary, ctx.refUnits, "wiki");
          return href
            ? [
                {
                  key: "builtin:create-wiki",
                  href,
                  label: t("zone:create_wiki"),
                },
              ]
            : [];
        }
        case "createPost": {
          const href = zoneCreateHref(ctx.zone.boundary, ctx.refUnits, "post");
          return href
            ? [
                {
                  key: "builtin:create-post",
                  href,
                  label: t("zone:create_post"),
                },
              ]
            : [];
        }
      }
      return [];
    }),
    ...(section.items ?? []).flatMap((item, index) => {
      const href = zoneLinkHref(item.target, linkCtx);
      const label = resolveLabel(
        zoneLinkLabel(item, ctx.refUnits),
        zoneLinkFallbackKey(item.target),
      );
      if (!href || !label) return [];
      return [{ key: `item:${index}`, href, label }];
    }),
  ];

  if (actions.length === 0) return null;

  return (
    <ZoneSectionShell title={title}>
      <div className="flex flex-wrap items-center gap-3">
        {actions.map((action, index) => (
          <SafeLink
            key={action.key}
            href={action.href}
            className={cn(
              buttonVariants({
                size: "sm",
                variant: index === 0 ? "default" : "outline",
              }),
            )}
          >
            {action.label}
          </SafeLink>
        ))}
      </div>
    </ZoneSectionShell>
  );
}
