"use client";

import type { PortableTextValue } from "@rezics/portable-text";
import { Button, Spinner } from "@rezics/ui";

import { PortableTextEditor } from "@/features/editor/portable-text-editor";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";

export function PostEditorFields({
	body,
	onBodyChange,
	submitLabel,
	pending,
	error,
}: {
	body: PortableTextValue;
	onBodyChange: (value: PortableTextValue) => void;
	submitLabel: string;
	pending: boolean;
	error: Parameters<typeof RequestFailure>[0]["error"];
}) {
	const { t } = useTranslation(["posts", "ui"]);
	return (
		<>
			<PortableTextEditor label={t.ui.body} onChange={onBodyChange} required value={body} />
			<RequestFailure error={error} />
			<Button
				className="w-fit"
				disabled={!body.length || pending}
				type="submit"
				variant="solid"
			>
				{pending ? <Spinner data-icon="inline-start" /> : null}
				{submitLabel}
			</Button>
		</>
	);
}
