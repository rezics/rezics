"use client";

import type { UnitReferencedBlock } from "@rezics/block";
import { cn } from "@rezics/ui";

import { ZoneDocument } from "./block-renderer";
import { ZoneSurfaceContainerClassName } from "./zone-surface-layout";

/** Render the non-navigation portion of the Zone's independently owned main Dock. */
export function ZoneDockContent({ blocks }: { readonly blocks: readonly UnitReferencedBlock[] }) {
	if (blocks.length === 0) return null;
	return (
		<aside className={cn(ZoneSurfaceContainerClassName, "py-6 sm:py-8")}>
			<ZoneDocument blocks={blocks} surface={{ kind: "dock" }} />
		</aside>
	);
}
