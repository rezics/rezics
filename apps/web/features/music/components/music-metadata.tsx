"use client";
import {
	usePatchMusicMetadata,
	type ReadMusicDetailStatus200,
} from "@rezics/openapi-tanstack-query";
import { Button, Field, FieldLabel, Input } from "@rezics/ui";
import { useState, type FormEvent } from "react";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import Link from "next/link";

export function MusicMetadata({
	detail,
	refresh,
}: {
	detail: ReadMusicDetailStatus200;
	refresh: () => Promise<void>;
}) {
	const { t } = useTranslation(["units", "ui"]);
	const labels = t.units.nativeMusic;
	const mutation = usePatchMusicMetadata();
	const [editing, setEditing] = useState(false);
	const [barcode, setBarcode] = useState(
		detail.kind === "release" ? (detail.metadata.barcode ?? "") : "",
	);
	const [language, setLanguage] = useState(
		detail.kind === "release" ? (detail.metadata.languageTag ?? "") : "",
	);
	const [script, setScript] = useState(
		detail.kind === "release" ? (detail.metadata.scriptCode ?? "") : "",
	);
	const [duration, setDuration] = useState(
		detail.kind === "recording" ? (detail.metadata.lengthMilliseconds?.toString() ?? "") : "",
	);
	async function submit(event: FormEvent) {
		event.preventDefault();
		if (!detail.headId) return;
		const expected = { expectedRevision: detail.revision, expectedHeadId: detail.headId };
		try {
			if (detail.kind === "release")
				await mutation.mutateAsync({
					path: { id: detail.id },
					body: {
						...expected,
						kind: "release",
						value: {
							barcode: barcode || null,
							languageTag: language || null,
							scriptCode: script || null,
						},
					},
				});
			if (detail.kind === "recording")
				await mutation.mutateAsync({
					path: { id: detail.id },
					body: {
						...expected,
						kind: "recording",
						value: { lengthMilliseconds: duration === "" ? null : Number(duration) },
					},
				});
			await refresh();
			setEditing(false);
		} catch {
			/* Keep the form draft and display the mutation failure. */
		}
	}
	const editable =
		detail.canEdit && detail.headId && (detail.kind === "release" || detail.kind === "recording");
	return (
		<section className="grid gap-3">
			{detail.kind === "release" ? (
				<dl className="grid gap-2">
					{detail.metadata.barcode ? (
						<div>
							<dt>{labels.barcode}</dt>
							<dd>{detail.metadata.barcode}</dd>
						</div>
					) : null}
					{detail.metadata.languageTag ? (
						<div>
							<dt>{labels.language}</dt>
							<dd>{detail.metadata.languageTag}</dd>
						</div>
					) : null}
					{detail.metadata.scriptCode ? (
						<div>
							<dt>{labels.script}</dt>
							<dd>{detail.metadata.scriptCode}</dd>
						</div>
					) : null}
					{detail.metadata.releaseGroupId ? (
						<div>
							<Link href={`/catalog/music/${detail.metadata.releaseGroupId}`} className="underline">
								{labels.release_group}
							</Link>
						</div>
					) : null}
				</dl>
			) : null}
			{detail.kind === "recording" && detail.metadata.lengthMilliseconds !== null ? (
				<p>
					{labels.duration}: {detail.metadata.lengthMilliseconds}
				</p>
			) : null}
			{editable ? (
				<Button
					variant="outline"
					aria-expanded={editing}
					onClick={() => setEditing((value) => !value)}
				>
					{t.ui.edit}
				</Button>
			) : null}
			{editing ? (
				<form onSubmit={(event) => void submit(event)} className="grid gap-3">
					{detail.kind === "release" ? (
						<>
							<Field>
								<FieldLabel htmlFor="music-barcode">{labels.barcode}</FieldLabel>
								<Input
									id="music-barcode"
									maxLength={512}
									value={barcode}
									onChange={(event) => setBarcode(event.currentTarget.value)}
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor="music-language">{labels.language}</FieldLabel>
								<Input
									id="music-language"
									maxLength={255}
									value={language}
									onChange={(event) => setLanguage(event.currentTarget.value)}
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor="music-script">{labels.script}</FieldLabel>
								<Input
									id="music-script"
									maxLength={4}
									pattern="[A-Z][a-z]{3}"
									value={script}
									onChange={(event) => setScript(event.currentTarget.value)}
								/>
							</Field>
						</>
					) : (
						<Field>
							<FieldLabel htmlFor="music-duration">{labels.duration}</FieldLabel>
							<Input
								id="music-duration"
								type="number"
								min={0}
								step={1}
								value={duration}
								onChange={(event) => setDuration(event.currentTarget.value)}
							/>
						</Field>
					)}
					<RequestFailure error={mutation.error} />
					<Button type="submit" isLoading={mutation.isPending}>
						{t.ui.save}
					</Button>
				</form>
			) : null}
		</section>
	);
}
