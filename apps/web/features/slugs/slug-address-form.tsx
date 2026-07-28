"use client";

import { isProfileSlugReserved, SlugLabelPatternSource } from "@rezics/slug";
import { Button, Field, FieldGroup, FieldLabel, Input } from "@rezics/ui";
import { useState, type FormEvent } from "react";

import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";

export function SlugAddressForm({
	initialSlug,
	isPending,
	error,
	onSubmit,
	mode = "replace",
}: {
	readonly initialSlug?: string;
	readonly isPending: boolean;
	readonly error: Parameters<typeof RequestFailure>[0]["error"];
	readonly onSubmit: (slug: string) => Promise<unknown>;
	readonly mode?: "assign-once" | "replace";
}) {
	const { t } = useTranslation(["settings", "ui"]);
	const [saved, setSaved] = useState(false);
	const [reserved, setReserved] = useState(false);
	const assignmentComplete = mode === "assign-once" && (initialSlug !== undefined || saved);

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setSaved(false);
		setReserved(false);
		const slug = String(new FormData(event.currentTarget).get("slug") ?? "").trim();
		if (mode === "assign-once" && isProfileSlugReserved(slug)) {
			setReserved(true);
			return;
		}
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
						disabled={assignmentComplete}
						maxLength={63}
						name="slug"
						pattern={SlugLabelPatternSource}
						required
						spellCheck={false}
					/>
					<p className="text-muted-foreground text-sm leading-6">
						{mode === "replace"
							? t.settings.slugAddressHint
							: assignmentComplete
								? t.settings.profileSlugAddressAssignedHint
								: t.settings.profileSlugAddressHint}
					</p>
				</Field>
				{reserved ? (
					<p className="text-destructive text-sm" role="alert">
						{t.settings.profileSlugReserved}
					</p>
				) : null}
				<RequestFailure error={error} />
				{saved ? <p className="text-success-foreground text-sm">{t.ui.saved}</p> : null}
				{assignmentComplete ? null : (
					<Button variant="solid" className="w-fit" isLoading={isPending} type="submit">
						{t.ui.save}
					</Button>
				)}
			</FieldGroup>
		</form>
	);
}
