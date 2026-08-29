"use client";

import type { PresentedAvatar } from "@rezics/avatar";
import { Button, IdentityAvatar, cn } from "@rezics/ui";
import { Settings } from "lucide-react";
import { useEffect, useState } from "react";

import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { FollowButton } from "@/features/following/components/follow-button";
import { useTranslation } from "@/i18n/client";
import type { ZoneRenderProjection } from "../model/zone-render";
import { ZoneSurfaceContainerClassName } from "./zone-surface-layout";

/** Platform-provided Zone identity and actions; navigation remains in the Dock. */
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
		<div className="sticky top-28 z-30 min-h-14 bg-background/96 backdrop-blur-xl sm:top-14 sm:min-h-16">
			<div
				className={cn(
					ZoneSurfaceContainerClassName,
					"grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 py-2",
				)}
			>
				<IdentityAvatar
					avatar={avatar}
					className={cn("shrink-0 transition-[width,height]", compact ? "size-9" : "size-10")}
					fallback={title.slice(0, 1).toUpperCase()}
				/>
				<p
					className={cn(
						"min-w-0 truncate font-bold tracking-tight transition-[font-size]",
						compact ? "text-sm sm:text-base" : "text-base sm:text-lg",
					)}
				>
					{title}
				</p>
				<div className="flex shrink-0 items-center gap-2">
					{projection.zone.capabilities.canManage ? (
						<Button asChild size={compact ? "sm" : "md"} variant="outline">
							<Link href={`/zone/${projection.zone.id}/manage`}>
								<Settings aria-hidden />
								<span className="hidden lg:inline">{t.management.title}</span>
							</Link>
						</Button>
					) : null}
					<FollowButton size={compact ? "sm" : "md"} unitId={projection.zone.id} />
				</div>
			</div>
		</div>
	);
}
