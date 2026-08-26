"use client";

import type { PortableTextValue } from "@rezics/portable-text";
import {
	Button,
	Checkbox,
	Field,
	FieldDescription,
	FieldLabel,
	RadioGroup,
	RadioGroupItem,
	RadioGroupLabel,
	Spinner,
} from "@rezics/ui";

import {
	PortableTextEditor,
	spoilerPortableTextEditorCapabilities,
} from "@/features/editor/portable-text-editor";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";

export function PostEditorFields({
	body,
	onBodyChange,
	submitLabel,
	pending,
	error,
	contentSpoilerLevel,
	onContentSpoilerLevelChange,
	contentNsfw,
	onContentNsfwChange,
}: {
	body: PortableTextValue;
	onBodyChange: (value: PortableTextValue) => void;
	submitLabel: string;
	pending: boolean;
	error: Parameters<typeof RequestFailure>[0]["error"];
	contentSpoilerLevel?: 0 | 1 | 2;
	onContentSpoilerLevelChange?: (value: 0 | 1 | 2) => void;
	contentNsfw?: boolean;
	onContentNsfwChange?: (value: boolean) => void;
}) {
	const { t } = useTranslation(["posts", "ui"]);
	return (
		<>
			<PortableTextEditor
				capabilities={spoilerPortableTextEditorCapabilities}
				label={t.ui.body}
				onChange={onBodyChange}
				required
				value={body}
			/>
			{contentSpoilerLevel !== undefined && onContentSpoilerLevelChange ? (
				<RadioGroup
					onValueChange={({ value }) => {
						const level = Number(value);
						if (level === 0 || level === 1 || level === 2) onContentSpoilerLevelChange(level);
					}}
					value={String(contentSpoilerLevel)}
				>
					<RadioGroupLabel>{t.posts.contentSpoilerLabel}</RadioGroupLabel>
					<div className="flex flex-wrap gap-3">
						<RadioGroupItem value="0">{t.posts.contentSpoilerNone}</RadioGroupItem>
						<RadioGroupItem value="1">{t.posts.contentSpoilerMinor}</RadioGroupItem>
						<RadioGroupItem value="2">{t.posts.contentSpoilerMajor}</RadioGroupItem>
					</div>
				</RadioGroup>
			) : null}
			{contentNsfw !== undefined && onContentNsfwChange ? (
				<Field orientation="horizontal">
					<Checkbox
						checked={contentNsfw}
						onCheckedChange={({ checked }) => onContentNsfwChange(checked === true)}
					/>
					<div>
						<FieldLabel>{t.posts.contentNsfwLabel}</FieldLabel>
						<FieldDescription>{t.posts.contentNsfwDescription}</FieldDescription>
					</div>
				</Field>
			) : null}
			<RequestFailure error={error} />
			<Button className="w-fit" disabled={!body.length || pending} type="submit" variant="solid">
				{pending ? <Spinner data-icon="inline-start" /> : null}
				{submitLabel}
			</Button>
		</>
	);
}
