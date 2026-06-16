import type { ZoneMenu, ZonePageSummary } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@rezics/ui/shadcn";
import { ChevronRight, ExternalLink } from "lucide-react";
import { useMemo, useState } from "react";
import { AppSafeLink as SafeLink } from "@/shared/ui/link";
import { cn } from "@/shared/utils/css-util";
import {
  type ResolvedZoneMenuNode,
  resolveZoneMenuNodes,
  type ZoneRefUnitMap,
} from "../models/zoneMenu";
import { useZoneLabelResolver } from "./sections/shared";

export type ZoneNavTreeProps = {
  menu: ZoneMenu;
  zoneSlug: string;
  pages?: readonly ZonePageSummary[];
  refUnits: ZoneRefUnitMap;
  className?: string;
};

/**
 * App-themed tree renderer for Zone menus outside the Zone portal chrome.
 * Zone theme variables are only injected by `ZonePortalPage`; this component
 * intentionally uses app tokens and never sets `--zone-color-*`.
 */
export function ZoneNavTree({
  menu,
  zoneSlug,
  pages,
  refUnits,
  className,
}: ZoneNavTreeProps) {
  const { t } = useTranslation(["zone"]);
  const resolveLabel = useZoneLabelResolver();
  const nodes = useMemo(
    () =>
      resolveZoneMenuNodes(menu.nodes, {
        routeLocation: { kind: "slug", zoneSlug },
        pages,
        refUnits,
      }),
    [menu.nodes, pages, refUnits, zoneSlug],
  );

  if (nodes.length === 0) return null;

  return (
    <nav aria-label={t("zone:menu")} className={className}>
      <ul className="flex flex-col gap-1">
        {nodes.map((node) => (
          <ZoneNavTreeNode
            key={node.id}
            node={node}
            depth={0}
            nodeLabel={(item) => resolveLabel(item.label, item.labelKey)}
          />
        ))}
      </ul>
    </nav>
  );
}

function ZoneNavTreeNode({
  node,
  depth,
  nodeLabel,
}: {
  node: ResolvedZoneMenuNode;
  depth: number;
  nodeLabel: (node: ResolvedZoneMenuNode) => string | null;
}) {
  const [open, setOpen] = useState(depth === 0);
  const label = nodeLabel(node);
  if (!label) return null;

  const itemClass = cn(
    "flex min-h-9 w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm leading-ui transition-colors",
    depth > 0 && "pl-4",
    node.href
      ? "font-medium text-text-primary hover:bg-surface-subtle"
      : "font-medium text-text-secondary",
  );

  return (
    <li>
      <div className="flex items-start gap-1">
        {node.children.length > 0 ? (
          <Collapsible
            open={open}
            onOpenChange={setOpen}
            className="min-w-0 flex-1"
          >
            <CollapsibleTrigger className={itemClass}>
              <ChevronRight
                aria-hidden
                className={cn(
                  "size-4 shrink-0 text-text-tertiary transition-transform",
                  open && "rotate-90",
                )}
              />
              <span className="min-w-0 flex-1 truncate">{label}</span>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul className="ml-3 mt-1 flex flex-col gap-1 border-l border-border-whisper pl-2">
                {node.children.map((child) => (
                  <ZoneNavTreeNode
                    key={child.id}
                    node={child}
                    depth={depth + 1}
                    nodeLabel={nodeLabel}
                  />
                ))}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        ) : node.href ? (
          <SafeLink href={node.href} className={itemClass}>
            <span className="min-w-0 flex-1 truncate">{label}</span>
            {node.isExternal ? (
              <ExternalLink
                aria-hidden
                className="size-3.5 shrink-0 text-text-tertiary"
              />
            ) : null}
          </SafeLink>
        ) : (
          <span className={itemClass}>{label}</span>
        )}
      </div>
    </li>
  );
}
