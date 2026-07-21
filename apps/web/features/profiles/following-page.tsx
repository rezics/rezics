"use client";

import {
	getApiUsersMeFollowingQueryKey,
	useGetApiUsersMeFollowing,
	usePatchApiUsersMeFollowingByUnitId,
} from "@rezics/openapi-tanstack-query";
import { useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button, ChoiceSelect, PageHeading, QueryFailure, QueryPending } from "@rezics/ui";
import { RequireSession } from "@/features/auth/require-session";
import { useTranslation } from "@/i18n/client";

const FollowingKinds = [
	"slug_namespace",
	"profile",
	"book",
	"software",
	"media",
	"release",
	"entity",
	"tag",
	"series",
	"zone",
	"collection",
	"post",
	"poll",
	"realm",
	"realm_rule",
] as const;
type FollowingKind = (typeof FollowingKinds)[number];

function isFollowingKind(value: string): value is FollowingKind {
	return FollowingKinds.some((kind) => kind === value);
}

function followingHref(kind: FollowingKind, id: string) {
	switch (kind) {
		case "zone":
			return `/zones/${id}`;
		case "realm":
			return `/realms/${id}`;
		case "profile":
			return `/users/${id}`;
		case "book":
		case "software":
		case "media":
			return `/units/${kind}/${id}`;
		case "entity":
			return `/entities/${id}`;
		case "collection":
			return `/collections/${id}`;
		case "post":
			return `/posts/${id}`;
		case "poll":
			return `/polls/${id}`;
		case "slug_namespace":
		case "release":
		case "tag":
		case "series":
		case "realm_rule":
			return undefined;
	}
}

export function FollowingPage() {
	return (
		<RequireSession>
			<FollowingContent />
		</RequireSession>
	);
}

function FollowingContent() {
	const { t } = useTranslation(["nav", "ui"]);
	const queryClient = useQueryClient();
	const query = useGetApiUsersMeFollowing();
	const update = usePatchApiUsersMeFollowingByUnitId({
		mutation: {
			onSuccess: () =>
				queryClient.invalidateQueries({ queryKey: getApiUsersMeFollowingQueryKey() }),
		},
	});
	const [kinds, setKinds] = useState<readonly FollowingKind[]>(FollowingKinds);
	const options = FollowingKinds.map((value) => ({
		value,
		label: t.nav.following.types[value],
	}));

	if (query.isPending) return <QueryPending />;
	if (query.isError)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;

	const items = query.data.items.filter(
		(item) => isFollowingKind(item.kind) && kinds.includes(item.kind),
	);

	return (
		<main className="mx-auto flex w-full max-w-4xl flex-col gap-7 px-4 py-8 sm:px-6 sm:py-10">
			<PageHeading description={t.nav.following.description} title={t.nav.following.manage} />

			<ChoiceSelect
				ariaLabel={t.nav.following.filter}
				className="w-full sm:w-fit"
				multiple
				onValueChange={setKinds}
				options={options}
				placeholder={t.nav.following.filter}
				value={kinds}
			/>

			{items.length ? (
				<div className="divide-y divide-border-weak border-y border-border-weak">
					{items.map((item) => {
						if (!isFollowingKind(item.kind)) return null;
						const imageUrl = item.avatar?.url ?? item.cover?.url;
						const destination = followingHref(item.kind, item.id);
						const identity = (
							<>
								<span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-full bg-surface-selected font-bold text-sm">
									{imageUrl ? (
										<img
											alt=""
											className="size-full object-cover"
											src={imageUrl}
										/>
									) : (
										(item.title ?? t.ui.unnamed).slice(0, 1).toUpperCase()
									)}
								</span>
								<span className="min-w-0">
									<strong className="block truncate text-sm">
										{item.title ?? t.ui.unnamed}
									</strong>
									<span className="text-muted-foreground text-xs">
										{t.nav.following.types[item.kind]}
									</span>
								</span>
							</>
						);
						return (
							<article className="flex min-w-0 items-center gap-3 py-3" key={item.id}>
								{destination ? (
									<Link
										className="flex min-w-0 flex-1 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
										href={destination}
									>
										{identity}
									</Link>
								) : (
									<div className="flex min-w-0 flex-1 items-center gap-3">
										{identity}
									</div>
								)}
								<Button
									aria-label={
										item.favorite
											? t.nav.following.unfavorite
											: t.nav.following.favorite
									}
									className="shrink-0"
									disabled={update.isPending}
									onClick={() =>
										update.mutate({
											body: { favorite: !item.favorite },
											path: { unitId: item.id },
										})
									}
									size="icon-md"
									variant="ghost"
								>
									<Star
										aria-hidden
										className={item.favorite ? "fill-current" : undefined}
									/>
								</Button>
							</article>
						);
					})}
				</div>
			) : (
				<p className="border-y border-border-weak py-8 text-muted-foreground text-sm">
					{t.nav.following.empty}
				</p>
			)}
		</main>
	);
}
