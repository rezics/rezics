"use client";

import {
	type GetApiCollectionsByCollectionIdItemsStatus200,
	useGetApiCollectionsByCollectionIdItems,
} from "@rezics/openapi-tanstack-query";
import { CuratedCreationTagCollectionUnitIds } from "@rezics/slug";
import {
	Button,
	Checkbox,
	CheckboxGroup,
	Field,
	FieldLabel,
	FieldLegend,
	FieldSet,
	RadioGroup,
	RadioGroupItem,
	Skeleton,
} from "@rezics/ui";

import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";

type CuratedWorkType = "book" | "media" | "software";
type TagChoice = { readonly id: string; readonly title: string };

/**
 * Temporary create-form routing to fixed bootstrap Collections.
 *
 * @remarks
 * Only Collection identities are fixed here. Tag identities are always loaded from the Collection
 * API. Replace this map when the server exposes creation-field taxonomy configuration.
 *
 * @alpha
 */
export const CuratedCreationTagCollectionsByContext = {
	book: {
		form: CuratedCreationTagCollectionUnitIds.bookForm,
		category: CuratedCreationTagCollectionUnitIds.bookCategory,
	},
	media: {
		form: CuratedCreationTagCollectionUnitIds.mediaForm,
		category: CuratedCreationTagCollectionUnitIds.mediaCategory,
	},
	software: {
		form: CuratedCreationTagCollectionUnitIds.softwareForm,
		category: CuratedCreationTagCollectionUnitIds.softwareCategory,
	},
	realm: { topic: CuratedCreationTagCollectionUnitIds.realmTopic },
} as const;

function toTagChoice(
	item: GetApiCollectionsByCollectionIdItemsStatus200["items"][number],
): TagChoice | null {
	const { content } = item;
	if (
		content.itemType !== "unit" ||
		content.unitKind !== "tag" ||
		typeof content.title !== "string" ||
		content.title.length === 0
	)
		return null;
	return { id: content.id, title: content.title };
}

function useCuratedTagChoices(collectionId: string) {
	const localizationLanguages = useLocalizationLanguages();
	const query = useGetApiCollectionsByCollectionIdItems({
		path: { collectionId },
		query: { localizationLanguages, limit: 100 },
	});
	return {
		...query,
		choices: query.data?.items.flatMap((item) => {
			const choice = toTagChoice(item);
			return choice ? [choice] : [];
		}),
	};
}

function CuratedSingleTagField({
	collectionId,
	onChange,
	value,
}: {
	readonly collectionId: string;
	readonly onChange: (value: string | null) => void;
	readonly value: string | null;
}) {
	const { t } = useTranslation(["ui", "units"]);
	const query = useCuratedTagChoices(collectionId);
	if (query.isPending) return <Skeleton className="h-24 rounded-xl" />;
	if (query.isError) return <RequestFailure error={query.error} />;
	if (!query.choices?.length) return null;
	return (
		<FieldSet>
			<FieldLegend variant="label">{t.units.creation.workForm}</FieldLegend>
			<RadioGroup
				className="grid gap-2 sm:grid-cols-2"
				onValueChange={({ value: nextValue }) => onChange(nextValue || null)}
				value={value ?? ""}
			>
				{query.choices.map((choice) => (
					<RadioGroupItem key={choice.id} value={choice.id}>
						{choice.title}
					</RadioGroupItem>
				))}
			</RadioGroup>
			{value ? (
				<Button
					className="w-fit"
					onClick={() => onChange(null)}
					size="xs"
					type="button"
					variant="quiet"
				>
					{t.ui.clear}
				</Button>
			) : null}
		</FieldSet>
	);
}

function CuratedMultipleTagField({
	collectionId,
	label,
	onChange,
	value,
}: {
	readonly collectionId: string;
	readonly label: string;
	readonly onChange: (value: readonly string[]) => void;
	readonly value: readonly string[];
}) {
	const query = useCuratedTagChoices(collectionId);
	if (query.isPending) return <Skeleton className="h-24 rounded-xl" />;
	if (query.isError) return <RequestFailure error={query.error} />;
	if (!query.choices?.length) return null;
	return (
		<FieldSet>
			<FieldLegend variant="label">{label}</FieldLegend>
			<CheckboxGroup
				className="grid gap-2 sm:grid-cols-2"
				onValueChange={onChange}
				value={[...value]}
			>
				{query.choices.map((choice) => (
					<Field key={choice.id} orientation="horizontal">
						<Checkbox value={choice.id} />
						<FieldLabel className="font-normal">{choice.title}</FieldLabel>
					</Field>
				))}
			</CheckboxGroup>
		</FieldSet>
	);
}

export function WorkCreationTagFields({
	categoryTagIds,
	formTagId,
	onCategoryTagIdsChange,
	onFormTagIdChange,
	type,
}: {
	readonly categoryTagIds: readonly string[];
	readonly formTagId: string | null;
	readonly onCategoryTagIdsChange: (value: readonly string[]) => void;
	readonly onFormTagIdChange: (value: string | null) => void;
	readonly type: CuratedWorkType;
}) {
	const { t } = useTranslation(["units"]);
	const collections = CuratedCreationTagCollectionsByContext[type];
	return (
		<>
			<CuratedSingleTagField
				collectionId={collections.form}
				onChange={onFormTagIdChange}
				value={formTagId}
			/>
			<CuratedMultipleTagField
				collectionId={collections.category}
				label={t.units.creation.commonCategories}
				onChange={onCategoryTagIdsChange}
				value={categoryTagIds}
			/>
		</>
	);
}

export function RealmCreationTagFields({
	onTagIdsChange,
	tagIds,
}: {
	readonly onTagIdsChange: (value: readonly string[]) => void;
	readonly tagIds: readonly string[];
}) {
	const { t } = useTranslation(["units"]);
	return (
		<CuratedMultipleTagField
			collectionId={CuratedCreationTagCollectionsByContext.realm.topic}
			label={t.units.creation.commonTopics}
			onChange={onTagIdsChange}
			value={tagIds}
		/>
	);
}
