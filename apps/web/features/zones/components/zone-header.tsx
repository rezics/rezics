"use client";

import type { PresentedAvatar } from "@rezics/avatar";
import { IdentityAvatar, Popover, PopoverContent, PopoverTrigger, cn } from "@rezics/ui";
import { ListTree } from "lucide-react";
import { useEffect, useState } from "react";

import { FollowButton } from "@/features/following/components/follow-button";
import { useTranslation } from "@/i18n/client";
import type { ZoneRenderProjection } from "../model/zone-render";
import { ZoneDocument } from "./block-renderer";

export function ZoneHeader({
	avatar,
	projection,
	title,
}: {
	avatar?: PresentedAvatar | null;
	projection: ZoneRenderProjection;
	title: string;
}) {
	const { t } = useTranslation("zones");
	const [compact, setCompact] = useState(false);

	useEffect(() => {
		const update = () => setCompact(window.scrollY >= 64);
		update();
		window.addEventListener("scroll", update, { passive: true });
		return () => window.removeEventListener("scroll", update);
	}, []);

	return (
		<header
			aria-label={t.navigation}
			className={cn(
				"sticky top-28 z-30 border-b bg-background/96 backdrop-blur-xl transition-[min-height] duration-200 sm:top-14 motion-reduce:transition-none",
				compact ? "min-h-14" : "min-h-14 sm:min-h-24",
			)}
			style={{ borderBottomColor: projection.zone.themeDocument.accent }}
		>
			<div
				className={cn(
					"mx-auto flex w-full max-w-screen-2xl items-center gap-3 px-3 transition-[padding] duration-200 sm:px-5 motion-reduce:transition-none",
					compact ? "py-2" : "py-2 sm:py-4",
				)}
			>
				{projection.dock ? (
					<Popover modal={false} positioning={{ placement: "bottom-start", gutter: 6 }}>
						<PopoverTrigger
							aria-label={t.openNavigation}
							className="flex size-10 shrink-0 items-center justify-center rounded-lg hover:bg-accent sm:hidden"
						>
							<ListTree aria-hidden className="size-5" />
						</PopoverTrigger>
						<PopoverContent className="w-[min(20rem,calc(100vw-1.5rem))] p-2 sm:hidden">
							<ZoneDocument
								blocks={projection.dock.document.blocks}
								navigationLayout="vertical"
								surface={{ kind: "dock" }}
							/>
						</PopoverContent>
					</Popover>
				) : null}
				<IdentityAvatar
					avatar={avatar}
					className={cn(
						"hidden shrink-0 transition-[width,height] sm:flex",
						compact ? "size-9" : "size-11 sm:size-14",
					)}
					fallback={title.slice(0, 1).toUpperCase()}
				/>
				<p
					className={cn(
						"min-w-0 flex-1 truncate font-bold tracking-tight transition-[font-size] sm:flex-initial",
						compact
							? "max-w-48 text-sm sm:max-w-64 sm:text-base"
							: "max-w-64 text-base sm:max-w-sm sm:text-xl",
					)}
				>
					{title}
				</p>
				<div className="hidden min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] sm:block [&::-webkit-scrollbar]:hidden">
					{projection.dock ? (
						<ZoneDocument
							blocks={projection.dock.document.blocks}
							surface={{ kind: "dock" }}
						/>
					) : null}
				</div>
				<FollowButton
					className="shrink-0"
					size={compact ? "sm" : "md"}
					unitId={projection.zone.id}
				/>
			</div>
		</header>
	);
}
