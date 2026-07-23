"use client";

import { toContentLanguage } from "@rezics/i18n";
import { usePostApiPosts } from "@rezics/openapi-tanstack-query";
import type { PortableTextValue } from "@rezics/portable-text";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

import { Button, EntityPicker, Field, FieldGroup, FieldLabel, Input } from "@rezics/ui";
import { PortableTextEditor } from "@/features/editor/portable-text-editor";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { writePortableText } from "@/lib/block";
import { invalidatePostQueries } from "./query";

interface PickedRealm {
	readonly id: string;
	readonly label: string;
}

export function SubjectPostComposer({
	onCreated,
	subjectId,
}: {
	onCreated?: (postId: string) => void | Promise<void>;
	subjectId: string;
}) {
	const { locale, t } = useTranslation(["errors", "posts", "ui"]);
	const create = usePostApiPosts();
	const queryClient = useQueryClient();
	const [realm, setRealm] = useState<PickedRealm>();
	const [body, setBody] = useState<PortableTextValue>([]);
	const [invalid, setInvalid] = useState(false);

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const title = String(new FormData(event.currentTarget).get("title") ?? "").trim();
		if (!title || !body.length) {
			setInvalid(true);
			return;
		}
		setInvalid(false);
		try {
			const result = await create.mutateAsync({
				body: {
					title,
					language: toContentLanguage(locale.target),
					body: writePortableText(body),
					subjectId,
					...(realm ? { realmId: realm.id } : {}),
				},
			});
			await invalidatePostQueries(queryClient, result.id);
			await onCreated?.(result.id);
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}

	return (
		<form className="grid gap-6" onSubmit={(event) => void submit(event)}>
			<FieldGroup>
				<Field required>
					<FieldLabel>{t.ui.title}</FieldLabel>
					<Input maxLength={500} name="title" required />
				</Field>
				<Field>
					<FieldLabel>{t.posts.realm}</FieldLabel>
					<EntityPicker index="realms" onChange={setRealm} value={realm} />
				</Field>
				<PortableTextEditor label={t.ui.body} onChange={setBody} required value={body} />
			</FieldGroup>
			{invalid ? (
				<p className="text-sm text-destructive" role="alert">
					{t.errors.invalid}
				</p>
			) : null}
			<RequestFailure error={create.error} fallback={t.ui.retryLater} />
			<Button
				className="w-fit"
				disabled={!body.length}
				isLoading={create.isPending}
				type="submit"
				variant="solid"
			>
				{t.posts.publish}
			</Button>
		</form>
	);
}
