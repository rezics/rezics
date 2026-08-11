"use client";

import {
	usePutApiRealmsByRealmIdPages,
	type GetApiRealmsByRealmIdStatus200,
} from "@rezics/openapi-tanstack-query";
import {
	Button,
	Card,
	CardContent,
	Field,
	FieldContent,
	FieldDescription,
	FieldLabel,
	Switch,
} from "@rezics/ui";
import { ArrowDownIcon, ArrowUpIcon, Trash2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { invalidateRealmDetails } from "../query";

type RealmPage = GetApiRealmsByRealmIdStatus200["pages"][number];

export function RealmPagesSettings({ realm }: { readonly realm: GetApiRealmsByRealmIdStatus200 }) {
	const { t } = useTranslation(["realms", "ui"]);
	const queryClient = useQueryClient();
	const save = usePutApiRealmsByRealmIdPages();
	const [pages, setPages] = useState<RealmPage[]>(() => [...realm.pages]);
	useEffect(() => setPages([...realm.pages]), [realm.pages]);

	function setEnabled(page: Exclude<RealmPage, "main">, enabled: boolean) {
		setPages((current) =>
			enabled
				? current.includes(page)
					? current
					: [...current, page]
				: current.filter((candidate) => candidate !== page),
		);
	}

	function move(page: RealmPage, direction: -1 | 1) {
		setPages((current) => {
			const source = current.indexOf(page);
			const target = source + direction;
			if (source < 0 || target < 0 || target >= current.length) return current;
			const next = [...current];
			[next[source], next[target]] = [next[target]!, next[source]!];
			return next;
		});
	}

	async function savePages() {
		try {
			await save.mutateAsync({
				path: { realmId: realm.id },
				body: { pages, baseRevisionId: realm.latestRevisionId },
			});
			await invalidateRealmDetails(queryClient, realm.id);
		} catch {
			// The typed mutation error is rendered below.
		}
	}

	return (
		<div className="grid gap-4">
			<div className="grid gap-1">
				<h2 className="font-heading font-bold text-xl">{t.realms.pageSettings.title}</h2>
				<p className="text-muted-foreground text-sm">{t.realms.pageSettings.description}</p>
			</div>
			<div className="grid gap-2">
				{pages.map((page, index) => (
					<Card appearance="outlined" key={page}>
						<CardContent className="flex items-center gap-3 p-4">
							<div className="min-w-0 flex-1">
								<p className="font-semibold">{t.realms.pages[page]}</p>
								{page === "main" ? (
									<p className="text-muted-foreground text-xs">
										{t.realms.pageSettings.mainRequired}
									</p>
								) : null}
							</div>
							<Button
								aria-label={t.realms.pageSettings.moveUp}
								disabled={index === 0}
								onClick={() => move(page, -1)}
								size="icon-sm"
								variant="outline"
							>
								<ArrowUpIcon aria-hidden />
							</Button>
							<Button
								aria-label={t.realms.pageSettings.moveDown}
								disabled={index === pages.length - 1}
								onClick={() => move(page, 1)}
								size="icon-sm"
								variant="outline"
							>
								<ArrowDownIcon aria-hidden />
							</Button>
							{page !== "main" ? (
								<Button
									aria-label={t.realms.pageSettings.disable}
									onClick={() => setEnabled(page, false)}
									size="icon-sm"
									variant="quiet"
								>
									<Trash2Icon aria-hidden />
								</Button>
							) : null}
						</CardContent>
					</Card>
				))}
			</div>
			{(["tags", "wiki"] as const).map((page) =>
				pages.includes(page) ? null : (
					<Field className="rounded-xl border bg-muted/24 p-4" key={page} orientation="horizontal">
						<FieldContent>
							<FieldLabel>{t.realms.pages[page]}</FieldLabel>
							<FieldDescription>{t.realms.pageSettings.enableDescription}</FieldDescription>
						</FieldContent>
						<Switch
							checked={false}
							onCheckedChange={({ checked }) => setEnabled(page, checked === true)}
						/>
					</Field>
				),
			)}
			<div className="flex justify-end">
				<Button isLoading={save.isPending} onClick={() => void savePages()}>
					{t.ui.save}
				</Button>
			</div>
			<RequestFailure error={save.error} />
		</div>
	);
}
