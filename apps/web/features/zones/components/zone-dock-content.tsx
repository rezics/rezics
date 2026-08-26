"use client";

import { cn } from "@rezics/ui";

import type { ZoneRenderProjection } from "../model/zone-render";
import { ZoneDocument } from "./block-renderer";
import { ZoneSurfaceContainerClassName } from "./zone-surface-layout";

/** Render the non-navigation portion of the Zone's independently owned main Dock. */
export function ZoneDockContent({ projection }: { readonly projection: ZoneRenderProjection }) {
	const blocks = projection.dock?.document.blocks.filter((block) => block._type !== "menu") ?? [];
	if (blocks.length === 0) return null;
	return (
		<aside className={cn(ZoneSurfaceContainerClassName, "py-6 sm:py-8")}>
			<ZoneDocument blocks={blocks} surface={{ kind: "dock" }} />
		</aside>
	);
}
