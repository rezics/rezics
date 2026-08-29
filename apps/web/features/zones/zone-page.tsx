"use client";

import { cn } from "@rezics/ui";
import { useTranslation } from "@/i18n/client";
import { ZoneDocument } from "./components/block-renderer";
import { ZoneSurface, type ZonePageSelection } from "./components/zone-surface";
import { ZoneSurfaceContainerClassName } from "./components/zone-surface-layout";

export function ZonePage({
	id,
	baseHref,
	selection = { by: "home" },
}: {
	id: string;
	baseHref: string;
	selection?: ZonePageSelection;
}) {
	const { t } = useTranslation(["zones"]);
	return (
		<ZoneSurface aggregatePage baseHref={baseHref} id={id} selection={selection}>
			{(projection) => (
				<div className={cn(ZoneSurfaceContainerClassName, "py-8 sm:py-12")}>
					{projection.page ? (
						<ZoneDocument
							blocks={projection.page.document.blocks}
							surface={{ kind: "page", pageId: projection.page.id }}
						/>
					) : (
						<section className="mx-auto max-w-3xl py-8 text-center">
							<h1 className="font-serif font-bold text-3xl">{t.zones.emptyTitle}</h1>
							<p className="mt-3 text-muted-foreground leading-7">{t.zones.emptyBody}</p>
						</section>
					)}
				</div>
			)}
		</ZoneSurface>
	);
}
