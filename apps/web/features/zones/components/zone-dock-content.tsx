"use client";

import { cn } from "@rezics/ui";

import type { ZoneRenderProjection } from "../model/zone-render";
import { ZoneDocument } from "./block-renderer";
import { ZoneSurfaceContainerClassName } from "./zone-surface-layout";

/** Render the Zone's independently owned main Dock without borrowing Blocks for the Header. */
export function ZoneDockContent({ projection }: { readonly projection: ZoneRenderProjection }) {
	const blocks = projection.dock?.document.blocks ?? [];
	if (blocks.length === 0) return null;
	return (
		<aside className={cn(ZoneSurfaceContainerClassName, "py-6 sm:py-8")}>
			<ZoneDocument blocks={blocks} surface={{ kind: "dock" }} />
		</aside>
	);
}
