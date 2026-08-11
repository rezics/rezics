"use client";

import {
	getApiUsersMeTagRealmSubscriptionsQueryKey,
	useDeleteApiUsersMeTagRealmSubscriptionsByRealmId,
	useGetApiUsersMeTagRealmSubscriptions,
	usePutApiUsersMeTagRealmSubscriptionsByRealmId,
} from "@rezics/openapi-tanstack-query";
import {
	Button,
	Card,
	CardContent,
	EntityPicker,
	ManagementWorkspaceSectionHeader,
	QueryFailure,
	QueryPending,
} from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import { generateKeyBetween } from "fractional-indexing";
import { ArrowDown, ArrowUp } from "lucide-react";
import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { useState } from "react";

import { LocalizedText } from "@/features/content-language-display/chinese-content-display-context";
import { SettingsOverviewHref } from "@/features/settings/routing/settings-routes";
import { useTranslation } from "@/i18n/client";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { RequestFailure } from "@/i18n/request-failure";

interface PickedRealm {
	readonly id: string;
	readonly label: string;
}

export function TagSourcesSettingsPage() {
	const { t } = useTranslation(["settings", "tags", "ui"]);
	const queryClient = useQueryClient();
	const localizationLanguages = useLocalizationLanguages();
	const [selectedRealm, setSelectedRealm] = useState<PickedRealm>();
	const query = useGetApiUsersMeTagRealmSubscriptions({
		query: { localizationLanguages },
	});
	const invalidate = () =>
		queryClient.invalidateQueries({
			queryKey: getApiUsersMeTagRealmSubscriptionsQueryKey(),
		});
	const upsert = usePutApiUsersMeTagRealmSubscriptionsByRealmId({
		mutation: { onSuccess: invalidate },
	});
	const remove = useDeleteApiUsersMeTagRealmSubscriptionsByRealmId({
		mutation: { onSuccess: invalidate },
	});

	if (query.isPending) return <QueryPending />;
	if (query.isError || !query.data)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	const items = query.data.items;

	async function addSource() {
		if (!selectedRealm) return;
		try {
			await upsert.mutateAsync({
				path: { realmId: selectedRealm.id },
				query: { localizationLanguages },
				body: {
					position: generateKeyBetween(items.at(-1)?.position ?? null, null),
				},
			});
			setSelectedRealm(undefined);
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}

	async function moveSource(index: number, direction: "earlier" | "later") {
		const item = items[index];
		if (!item) return;
		const position =
			direction === "earlier"
				? generateKeyBetween(items[index - 2]?.position ?? null, items[index - 1]?.position ?? null)
				: generateKeyBetween(
						items[index + 1]?.position ?? null,
						items[index + 2]?.position ?? null,
					);
		try {
			await upsert.mutateAsync({
				path: { realmId: item.realmId },
				query: { localizationLanguages },
				body: { position },
			});
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}

	return (
		<section className="max-w-2xl">
			<ManagementWorkspaceSectionHeader
				backHref={SettingsOverviewHref}
				backLabel={t.settings.workspace.backToOverview}
				description={t.tags.sources.description}
				link={Link}
				title={t.tags.sources.title}
			/>
			<div className="grid gap-8">
				<Card>
					<CardContent className="grid gap-4 p-5 sm:p-6">
						<div className="grid gap-1">
							<h3 className="font-semibold">{t.tags.sources.addTitle}</h3>
							<p className="text-sm text-muted-foreground">{t.tags.sources.addDescription}</p>
						</div>
						<div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
							<EntityPicker
								ariaLabel={t.tags.sources.addTitle}
								index="realms"
								onChange={setSelectedRealm}
								placeholder={t.ui.pickerPlaceholders.realm}
								value={selectedRealm}
							/>
							<Button
								disabled={!selectedRealm}
								isLoading={upsert.isPending}
								onClick={() => void addSource()}
								type="button"
							>
								{t.tags.sources.add}
							</Button>
						</div>
					</CardContent>
				</Card>

				{items.length ? (
					<ol className="grid gap-3">
						{items.map((item, index) => (
							<li key={item.realmId}>
								<Card>
									<CardContent className="flex flex-wrap items-center gap-3 p-4">
										<div className="me-auto min-w-0">
											<Link
												className="font-semibold text-link hover:text-link-hover hover:underline"
												href={`/realms/${item.realmId}`}
											>
												{item.title ? (
													<LocalizedText language={item.language} value={item.title} />
												) : (
													t.tags.unnamedRealm
												)}
											</Link>
											{item.summary ? (
												<p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
													<LocalizedText language={item.language} value={item.summary} />
												</p>
											) : null}
										</div>
										<Button
											aria-label={t.tags.sources.moveEarlier}
											disabled={index === 0 || upsert.isPending}
											onClick={() => void moveSource(index, "earlier")}
											size="sm"
											type="button"
											variant="outline"
										>
											<ArrowUp aria-hidden className="size-4" />
										</Button>
										<Button
											aria-label={t.tags.sources.moveLater}
											disabled={index === items.length - 1 || upsert.isPending}
											onClick={() => void moveSource(index, "later")}
											size="sm"
											type="button"
											variant="outline"
										>
											<ArrowDown aria-hidden className="size-4" />
										</Button>
										<Button
											disabled={remove.isPending}
											onClick={() =>
												remove.mutate({
													path: { realmId: item.realmId },
												})
											}
											size="sm"
											type="button"
											variant="quiet"
										>
											{t.tags.sources.remove}
										</Button>
									</CardContent>
								</Card>
							</li>
						))}
					</ol>
				) : (
					<p className="text-sm text-muted-foreground">{t.tags.sources.empty}</p>
				)}
				<RequestFailure error={upsert.error ?? remove.error} fallback={t.ui.retryLater} />
			</div>
		</section>
	);
}
