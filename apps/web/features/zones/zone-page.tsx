"use client";

import { toContentLanguage } from "@rezics/i18n";

import { useGetApiZonesByZoneId } from "@rezics/openapi-tanstack-query";

import { Avatar, AvatarFallback, AvatarImage, Cover, QueryFailure, QueryPending } from "@rezics/ui";
import { FollowButton } from "@/features/following/follow-button";
import { useTranslation } from "@/i18n/client";
import { selectLocalization } from "@/lib/localization";

export function ZonePage({ id }: { id: string }) {
	const { t, locale } = useTranslation(["feed", "ui"]);
	const query = useGetApiZonesByZoneId({
		path: { zoneId: id },
		query: { language: toContentLanguage(locale.target) },
	});

	if (query.isPending) return <QueryPending />;
	if (query.isError)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;

	const zone = query.data;
	const localization = selectLocalization(
		zone.localizations,
		toContentLanguage(locale.target),
		zone.language,
	);
	const title = localization?.title ?? t.ui.unnamed;
	const avatar = localization?.avatar ?? zone.avatar;
	const banner = localization?.banner ?? zone.banner;
	const cover = localization?.cover ?? zone.cover;

	return (
		<main className="mx-auto flex w-full max-w-6xl flex-col gap-7 px-4 py-6 sm:px-6 sm:py-9">
			<header className="overflow-hidden border-b border-border-weak pb-7">
				{banner ? (
					<div className="aspect-[4/1] min-h-32 overflow-hidden rounded-2xl bg-surface-container">
						<img alt="" className="size-full object-cover" src={banner.url} />
					</div>
				) : null}
				<div className="mt-5 flex min-w-0 flex-wrap items-end gap-4">
					<Avatar className="size-16 shrink-0 ring-4 ring-background sm:size-20">
						{avatar ? <AvatarImage alt="" src={avatar.url} /> : null}
						<AvatarFallback>{title.slice(0, 1).toUpperCase()}</AvatarFallback>
					</Avatar>
					<div className="min-w-0 flex-1">
						<p className="mb-1 font-semibold text-muted-foreground text-xs uppercase tracking-[0.14em]">
							{t.ui.zone}
						</p>
						<h1 className="truncate font-bold text-3xl tracking-tight sm:text-4xl">
							{title}
						</h1>
						{localization?.summary ? (
							<p className="mt-2 max-w-3xl text-muted-foreground leading-7">
								{localization.summary}
							</p>
						) : null}
					</div>
					<FollowButton className="shrink-0" unitId={zone.id} />
				</div>
			</header>

			{cover ? (
				<section className="grid items-start gap-5 border-b border-border-weak pb-7 sm:grid-cols-[9rem_minmax(0,1fr)]">
					<Cover alt={title} className="w-full max-w-36" src={cover.url} />
					<div>
						<h2 className="font-bold text-xl">{title}</h2>
						<p className="mt-2 text-muted-foreground text-sm leading-6">
							{localization?.summary ?? t.feed.subtitle}
						</p>
					</div>
				</section>
			) : null}
		</main>
	);
}
