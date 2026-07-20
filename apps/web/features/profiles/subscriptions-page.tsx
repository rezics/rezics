"use client";

import {
	getApiUsersMeSubscriptionsQueryKey,
	useGetApiUsersMeSubscriptions,
	usePatchApiUsersMeSubscriptionsByUnitId,
} from "@rezics/openapi-tanstack-query";
import { useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button, ChoiceSelect, PageHeading, QueryFailure, QueryPending } from "@rezics/ui";
import { RequireSession } from "@/features/auth/require-session";
import { useTranslation } from "@/i18n/client";

const SubscriptionKinds = ["zone", "realm", "profile"] as const;
type SubscriptionKind = (typeof SubscriptionKinds)[number];

function isSubscriptionKind(value: string): value is SubscriptionKind {
	return SubscriptionKinds.some((kind) => kind === value);
}

function subscriptionHref(kind: SubscriptionKind, id: string) {
	switch (kind) {
		case "zone":
			return `/zones/${id}`;
		case "realm":
			return `/realms/${id}`;
		case "profile":
			return `/users/${id}`;
	}
}

export function SubscriptionsPage() {
	return (
		<RequireSession>
			<SubscriptionsContent />
		</RequireSession>
	);
}

function SubscriptionsContent() {
	const { t } = useTranslation(["nav", "ui"]);
	const queryClient = useQueryClient();
	const query = useGetApiUsersMeSubscriptions();
	const update = usePatchApiUsersMeSubscriptionsByUnitId({
		mutation: {
			onSuccess: () =>
				queryClient.invalidateQueries({ queryKey: getApiUsersMeSubscriptionsQueryKey() }),
		},
	});
	const [kinds, setKinds] = useState<readonly SubscriptionKind[]>(SubscriptionKinds);
	const options = [
		{ value: "zone", label: t.nav.subscriptions.zones },
		{ value: "realm", label: t.nav.subscriptions.realms },
		{ value: "profile", label: t.nav.subscriptions.profiles },
	] as const;

	if (query.isPending) return <QueryPending />;
	if (query.isError)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;

	const items = query.data.items.filter(
		(item) => isSubscriptionKind(item.kind) && kinds.includes(item.kind),
	);

	return (
		<main className="mx-auto flex w-full max-w-4xl flex-col gap-7 px-4 py-8 sm:px-6 sm:py-10">
			<PageHeading
				description={t.nav.subscriptions.description}
				title={t.nav.subscriptions.manage}
			/>

			<ChoiceSelect
				ariaLabel={t.nav.subscriptions.filter}
				className="w-full sm:w-fit"
				multiple
				onValueChange={setKinds}
				options={options}
				placeholder={t.nav.subscriptions.filter}
				value={kinds}
			/>

			{items.length ? (
				<div className="divide-y divide-border-weak border-y border-border-weak">
					{items.map((item) => {
						if (!isSubscriptionKind(item.kind)) return null;
						const imageUrl = item.avatar?.url ?? item.cover?.url;
						return (
							<article className="flex min-w-0 items-center gap-3 py-3" key={item.id}>
								<Link
									className="flex min-w-0 flex-1 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
									href={subscriptionHref(item.kind, item.id)}
								>
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
											{
												options.find((option) => option.value === item.kind)
													?.label
											}
										</span>
									</span>
								</Link>
								<Button
									aria-label={
										item.favorite
											? t.nav.subscriptions.unfavorite
											: t.nav.subscriptions.favorite
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
					{t.nav.subscriptions.empty}
				</p>
			)}
		</main>
	);
}
