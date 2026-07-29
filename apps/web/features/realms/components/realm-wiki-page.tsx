"use client";

import type { UnitPredicate } from "@rezics/filter";
import {
	useGetApiRealmsByRealmIdTaxonomy,
	type GetApiRealmsByRealmIdStatus200,
} from "@rezics/openapi-tanstack-query";
import { Field, FieldLabel, NativeSelect, NativeSelectOption } from "@rezics/ui";
import { useState } from "react";

import { useTranslation } from "@/i18n/client";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { RealmFeed } from "./realm-feed";

export function RealmWikiPage({ realm }: { readonly realm: GetApiRealmsByRealmIdStatus200 }) {
	const { t } = useTranslation(["realms", "tags"]);
	const localizationLanguages = useLocalizationLanguages();
	const taxonomy = useGetApiRealmsByRealmIdTaxonomy({
		path: { realmId: realm.id },
		query: { localizationLanguages },
	});
	const [tagId, setTagId] = useState("");
	const contextTags =
		taxonomy.data?.items.filter(
			(item) => item.contentKind === "tag" && item.contextPostId !== null,
		) ?? [];
	const additionalFilter: UnitPredicate | undefined = tagId
		? {
				post: {
					is: {
						explainsRealmTag: {
							realm: { id: { in: [realm.id] } },
							tag: { id: { in: [tagId] } },
						},
					},
				},
			}
		: undefined;
	return (
		<div className="grid min-w-0 gap-4">
			<div className="grid gap-1">
				<h2 className="font-heading font-bold text-xl">{t.realms.pages.wiki}</h2>
				<p className="text-muted-foreground text-sm">{t.realms.wiki.description}</p>
			</div>
			{contextTags.length ? (
				<Field className="max-w-sm">
					<FieldLabel>{t.realms.wiki.contextFilter}</FieldLabel>
					<NativeSelect
						onChange={(event) => setTagId(event.currentTarget.value)}
						value={tagId}
					>
						<NativeSelectOption value="">
							{t.realms.wiki.allArticles}
						</NativeSelectOption>
						{contextTags.map((tag) => (
							<NativeSelectOption key={tag.contentUnitId} value={tag.contentUnitId}>
								{tag.title ?? t.tags.unnamedTag}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</Field>
			) : null}
			<RealmFeed
				additionalFilter={additionalFilter}
				canManagePins={realm.capabilities.canManagePins}
				canManageTags={realm.capabilities.canManageTags}
				contentKinds={["post:wiki"]}
				realmId={realm.id}
				showControls={false}
			/>
		</div>
	);
}
