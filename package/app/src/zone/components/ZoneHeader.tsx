import type { ZoneDTO } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@rezics/ui/shadcn";
import { useNavigate } from "@tanstack/react-router";
import { ChevronDown, Menu as MenuIcon, Search } from "lucide-react";
import {
  type CSSProperties,
  type FormEvent,
  Fragment,
  useEffect,
  useRef,
  useState,
} from "react";
import { Link, AppSafeLink as SafeLink } from "@/shared/ui/link";
import { cn } from "@/shared/utils/css-util";
import {
  findZoneMenu,
  type ResolvedZoneMenuNode,
  resolveZoneMenuNodes,
  type ZoneRefUnitMap,
} from "../models/zoneMenu";
import { ZONE_CONTENT_MAX_WIDTH_DEFAULT } from "../models/zoneTheme";
import { useZoneLabelResolver } from "./sections/shared";

type ZoneHeaderProps = {
  zone: ZoneDTO;
  refUnits: ZoneRefUnitMap;
};

/**
 * Layer-2 zone header below the app shell header.
 *
 * Boundary: the shell header (core `MainLayoutHeader`) stays fixed above
 * this bar and keeps owning the sidebar toggle, the rezics mark, and the
 * user area. Fully absorbing those into one merged header on scroll would
 * fork shell internals (layout store, auth sections), so the zone header
 * merges progressively instead: it sticks directly beneath the shell
 * header and adopts the same canvas/border treatment once stuck.
 * 应用外壳头部之下的第二层专区头部。
 *
 * 边界：外壳头部（core `MainLayoutHeader`）固定在此栏上方，并继续拥有
 * 侧栏开关、rezics 标识与用户区。滚动时把它们完全吸收进一个合并头部
 * 需要 fork 外壳内部实现（布局 store、认证区块），因此专区头部改为
 * 渐进合并：紧贴外壳头部下方吸附，吸附后采用相同的画布/描边处理。
 */
export function ZoneHeader({ zone, refUnits }: ZoneHeaderProps) {
  const { t } = useTranslation(["zone"]);
  const resolveLabel = useZoneLabelResolver();
  const navigate = useNavigate();
  const [stuck, setStuck] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => setStuck(entry ? !entry.isIntersecting : false),
      { threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  const { header, menus } = zone.nav;
  const menu = findZoneMenu(menus, header.menuId);
  const nodes = menu
    ? resolveZoneMenuNodes(menu.nodes, {
        zoneSlug: zone.slug,
        pages: zone.pages,
        refUnits,
      })
    : [];
  const logoUrl = header.logoImageUrl ?? zone.theme.images?.logoUrl ?? null;
  const searchPlaceholder = header.searchPlaceholderKey
    ? t(header.searchPlaceholderKey, {
        defaultValue: t("zone:search_placeholder"),
      })
    : t("zone:search_placeholder");
  const contentStyle = {
    maxWidth: `var(--zone-content-max-width, ${ZONE_CONTENT_MAX_WIDTH_DEFAULT}px)`,
  } satisfies CSSProperties;

  const nodeLabel = (node: ResolvedZoneMenuNode) =>
    resolveLabel(node.label, node.labelKey);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const q = keyword.trim();
    setDrawerOpen(false);
    navigate({
      to: "/z/$slug/search",
      params: { slug: zone.slug },
      search: q ? { q } : {},
    });
  };

  return (
    <>
      <div ref={sentinelRef} aria-hidden className="h-px w-full" />
      <div
        className={cn(
          "sticky top-[49px] z-30 transition-colors duration-200 md:top-14",
          stuck
            ? "border-b border-border-whisper bg-surface-canvas"
            : "bg-transparent",
        )}
      >
        <div
          className="mx-auto flex h-12 items-center gap-2 px-4 md:gap-3 md:px-6"
          style={contentStyle}
        >
          <SafeLink
            href={`/z/${zone.slug}`}
            className="flex min-w-0 shrink-0 items-center gap-2"
          >
            {logoUrl ? (
              <img
                src={logoUrl}
                alt=""
                className="h-7 w-7 rounded-sm object-cover"
              />
            ) : null}
            <span className="max-w-48 truncate text-base font-semibold leading-ui text-text-primary">
              {zone.name}
            </span>
          </SafeLink>

          <nav className="hidden min-w-0 flex-1 items-center gap-1 overflow-hidden md:flex">
            {nodes.map((node) => (
              <DesktopMenuNode
                key={node.id}
                node={node}
                label={nodeLabel(node)}
                nodeLabel={nodeLabel}
              />
            ))}
          </nav>

          <form
            onSubmit={submitSearch}
            className="ml-auto hidden w-44 sm:block lg:w-64"
          >
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-text-tertiary"
                aria-hidden
              />
              <Input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder={searchPlaceholder}
                className="h-8 pl-8"
              />
            </div>
          </form>

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="md:hidden"
            aria-label={t("zone:open_menu")}
            onClick={() => setDrawerOpen(true)}
          >
            <MenuIcon aria-hidden />
          </Button>
        </div>
      </div>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="w-[min(20rem,100vw)]">
          <SheetHeader>
            <SheetTitle>{zone.name}</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-6">
            <form onSubmit={submitSearch}>
              <Input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder={searchPlaceholder}
              />
            </form>
            <nav aria-label={t("zone:menu")}>
              <DrawerMenuList
                nodes={nodes}
                depth={0}
                nodeLabel={nodeLabel}
                onNavigate={() => setDrawerOpen(false)}
              />
            </nav>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function DesktopMenuNode({
  node,
  label,
  nodeLabel,
}: {
  node: ResolvedZoneMenuNode;
  label: string | null;
  nodeLabel: (node: ResolvedZoneMenuNode) => string | null;
}) {
  if (!label) return null;

  if (node.children.length === 0) {
    if (!node.href) return null;
    return (
      <SafeLink
        href={node.href}
        className="rounded-md px-3 py-1.5 text-sm font-medium leading-ui text-text-secondary transition-colors hover:bg-surface-subtle hover:text-text-primary"
      >
        {label}
      </SafeLink>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={(props) => (
          <Button {...props} type="button" variant="ghost" size="sm">
            {label}
            <ChevronDown aria-hidden />
          </Button>
        )}
      />
      <DropdownMenuContent align="start">
        {node.children.map((child) => (
          <DropdownNode key={child.id} node={child} nodeLabel={nodeLabel} />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DropdownNode({
  node,
  nodeLabel,
}: {
  node: ResolvedZoneMenuNode;
  nodeLabel: (node: ResolvedZoneMenuNode) => string | null;
}) {
  const label = nodeLabel(node);
  if (!label) return null;

  // Depth-3 leaves render under a non-interactive group label — the tree is
  // already clamped at ZONE_MENU_MAX_DEPTH by the model projection.
  // 第三层叶子渲染在不可交互的分组标签之下——树已由模型投影按
  // ZONE_MENU_MAX_DEPTH 截断。
  if (node.children.length > 0) {
    return (
      <Fragment>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        {node.children.map((child) => (
          <DropdownNode key={child.id} node={child} nodeLabel={nodeLabel} />
        ))}
      </Fragment>
    );
  }

  if (!node.href) return null;
  if (node.isExternal) {
    return (
      <DropdownMenuItem
        render={(props) => (
          <SafeLink
            href={node.href ?? ""}
            className={(props as { className?: string }).className}
          >
            {label}
          </SafeLink>
        )}
      />
    );
  }
  return (
    <DropdownMenuItem
      render={(props) => (
        <Link to={node.href ?? ""} {...props}>
          {label}
        </Link>
      )}
    />
  );
}

function DrawerMenuList({
  nodes,
  depth,
  nodeLabel,
  onNavigate,
}: {
  nodes: ResolvedZoneMenuNode[];
  depth: number;
  nodeLabel: (node: ResolvedZoneMenuNode) => string | null;
  onNavigate: () => void;
}) {
  return (
    <ul className={cn("flex flex-col gap-1", depth > 0 && "ml-3")}>
      {nodes.map((node) => {
        const label = nodeLabel(node);
        if (!label) return null;
        return (
          <li key={node.id}>
            {node.href && node.isExternal ? (
              // External targets open in a new tab; the drawer stays put.
              // 外部目标在新标签页打开；抽屉保持原样。
              <SafeLink
                href={node.href}
                className="block rounded-md px-3 py-2 text-sm font-medium leading-ui text-text-primary transition-colors hover:bg-surface-subtle"
              >
                {label}
              </SafeLink>
            ) : node.href ? (
              <Link
                to={node.href}
                onClick={onNavigate}
                className="block rounded-md px-3 py-2 text-sm font-medium leading-ui text-text-primary transition-colors hover:bg-surface-subtle"
              >
                {label}
              </Link>
            ) : (
              <span className="block px-3 py-2 text-xs font-medium uppercase leading-dense text-text-tertiary">
                {label}
              </span>
            )}
            {node.children.length > 0 ? (
              <DrawerMenuList
                nodes={node.children}
                depth={depth + 1}
                nodeLabel={nodeLabel}
                onNavigate={onNavigate}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
