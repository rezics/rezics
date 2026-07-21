"use client";

import { SlugLabelPatternSource } from "@rezics/slug";
import { Button, Field, FieldGroup, FieldLabel, Input } from "@rezics/ui";
import { useState, type FormEvent } from "react";

import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";

export function SlugAddressForm({
	initialSlug,
	isPending,
	error,
	onSubmit,
}: {
	readonly initialSlug?: string;
	readonly isPending: boolean;
	readonly error: Parameters<typeof RequestFailure>[0]["error"];
	readonly onSubmit: (slug: string) => Promise<unknown>;
}) {
	const { t } = useTranslation(["settings", "ui"]);
	const [saved, setSaved] = useState(false);

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setSaved(false);
		const slug = String(new FormData(event.currentTarget).get("slug") ?? "").trim();
		try {
			await onSubmit(slug);
			setSaved(true);
		} catch {
			setSaved(false);
		}
	}

	return (
		<form onSubmit={submit}>
			<FieldGroup>
				<Field required>
					<FieldLabel>{t.settings.slugAddress}</FieldLabel>
					<Input
						autoCapitalize="none"
						autoComplete="off"
						defaultValue={initialSlug ?? ""}
						maxLength={63}
						name="slug"
						pattern={SlugLabelPatternSource}
						required
						spellCheck={false}
					/>
					<p className="text-muted-foreground text-sm leading-6">
						{t.settings.slugAddressHint}
					</p>
				</Field>
				<RequestFailure error={error} />
				{saved ? <p className="text-success-foreground text-sm">{t.ui.saved}</p> : null}
				<Button className="w-fit" isLoading={isPending} type="submit">
					{t.ui.save}
				</Button>
			</FieldGroup>
		</form>
	);
}
