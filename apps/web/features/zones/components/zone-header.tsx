"use client";

import type { PresentedAvatar } from "@rezics/avatar";
import type { MenuBlock } from "@rezics/block";
import { Button, IdentityAvatar, Popover, PopoverContent, PopoverTrigger, cn } from "@rezics/ui";
import { ListTree, Settings } from "lucide-react";
import { useEffect, useState } from "react";

import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { FollowButton } from "@/features/following/components/follow-button";
import { useTranslation } from "@/i18n/client";
import { ZoneDocument } from "./block-renderer";
import { ZoneSurfaceContainerClassName } from "./zone-surface-layout";

/** Platform-provided Zone identity, Dock navigation, and actions. */
export function ZoneHeader({
	avatar,
	canManage,
	menuBlocks,
	title,
	zoneId,
}: {
	avatar?: PresentedAvatar | null;
	canManage: boolean;
	menuBlocks: readonly MenuBlock[];
	title: string;
	zoneId: string;
}) {
	const { t } = useTranslation("zones");
	const [compact, setCompact] = useState(false);
	const hasMenu = menuBlocks.length > 0;
	const expanded = hasMenu && !compact;

	useEffect(() => {
		const update = () => setCompact(window.scrollY >= 64);
		update();
		window.addEventListener("scroll", update, { passive: true });
		return () => window.removeEventListener("scroll", update);
	}, []);

	return (
		<div
			className={cn(
				"sticky top-28 z-30 bg-background/96 backdrop-blur-xl transition-[min-height] duration-200 sm:top-14 motion-reduce:transition-none",
				expanded ? "min-h-14 sm:min-h-24" : "min-h-14 sm:min-h-16",
			)}
			data-zone-part="platform-header"
		>
			<div
				className={cn(
					ZoneSurfaceContainerClassName,
					"grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 py-2 transition-[padding] duration-200 motion-reduce:transition-none",
					expanded
						? "sm:grid-cols-[3.5rem_minmax(0,1fr)_auto] sm:grid-rows-[auto_auto] sm:gap-y-0 sm:py-3"
						: "sm:grid-cols-[auto_auto_minmax(0,1fr)_auto] sm:grid-rows-1",
				)}
			>
				{hasMenu ? (
					<Popover modal={false} positioning={{ placement: "bottom-start", gutter: 6 }}>
						<PopoverTrigger
							aria-label={t.openNavigation}
							className="col-start-1 row-start-1 flex size-10 shrink-0 items-center justify-center rounded-lg hover:bg-accent sm:hidden"
						>
							<ListTree aria-hidden className="size-5" />
						</PopoverTrigger>
						<PopoverContent className="w-[min(20rem,calc(100vw-1.5rem))] p-2 sm:hidden">
							<ZoneDocument
								blocks={menuBlocks}
								navigationLayout="vertical"
								surface={{ kind: "dock" }}
							/>
						</PopoverContent>
					</Popover>
				) : null}
				<IdentityAvatar
					avatar={avatar}
					className={cn(
						"hidden shrink-0 transition-[width,height] sm:col-start-1 sm:row-start-1 sm:flex",
						expanded ? "size-14 sm:row-span-2" : compact ? "size-9" : "size-10",
					)}
					fallback={title.slice(0, 1).toUpperCase()}
				/>
				<p
					className={cn(
						"col-start-2 row-start-1 min-w-0 truncate font-bold tracking-tight transition-[font-size]",
						compact
							? "text-sm sm:text-base"
							: expanded
								? "text-base sm:text-xl"
								: "text-base sm:text-lg",
					)}
				>
					{title}
				</p>
				<div
					className={cn(
						"hidden min-w-0 items-center overflow-x-auto [scrollbar-width:none] sm:flex [&::-webkit-scrollbar]:hidden",
						expanded ? "sm:col-start-2 sm:row-start-2" : "sm:col-start-3 sm:row-start-1",
					)}
				>
					{hasMenu ? (
						<ZoneDocument
							blocks={menuBlocks}
							navigationLayout="horizontal"
							surface={{ kind: "dock" }}
						/>
					) : null}
				</div>
				<div
					className={cn(
						"col-start-3 row-start-1 flex shrink-0 items-center gap-2",
						expanded
							? "sm:col-start-3 sm:row-span-2 sm:row-start-1"
							: "sm:col-start-4 sm:row-start-1",
					)}
				>
					{canManage ? (
						<Button asChild size={compact ? "sm" : "md"} variant="outline">
							<Link href={`/zone/${zoneId}/manage`}>
								<Settings aria-hidden />
								<span className="hidden lg:inline">{t.management.title}</span>
							</Link>
						</Button>
					) : null}
					<FollowButton size={compact ? "sm" : "md"} unitId={zoneId} />
				</div>
			</div>
		</div>
	);
}
