"use client";

import { usePostApiTagStructures } from "@rezics/openapi-tanstack-query";
import { Button, Card, CardContent, PageHeading } from "@rezics/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { RequireSession } from "@/features/auth/require-session";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import {
	TagStructureMemberEditor,
	type EditableTagStructureMember,
} from "../components/tag-structure-member-editor";
import { tagStructureHref } from "../routing/tag-links";

export function TagStructureCreatePage() {
	const { t } = useTranslation(["tags", "ui"]);
	const router = useRouter();
	const [members, setMembers] = useState<EditableTagStructureMember[]>([]);
	const create = usePostApiTagStructures();

	return (
		<RequireSession>
			<main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6">
				<PageHeading title={t.tags.createStructure.title} />
				<p className="max-w-3xl text-muted-foreground">
					{t.tags.createStructure.description}
				</p>
				<Card>
					<CardContent className="grid gap-5 p-5 sm:p-6">
						<TagStructureMemberEditor members={members} onChange={setMembers} />
						<Button
							disabled={members.length < 2}
							isLoading={create.isPending}
							onClick={() => {
								if (members.length < 2) return;
								void create
									.mutateAsync({
										body: {
											memberTagIds: members.map(({ id }) => id),
										},
									})
									.then(({ structureId }) =>
										router.push(tagStructureHref(structureId)),
									)
									.catch(() => undefined);
							}}
							type="button"
						>
							{t.tags.createStructure.submit}
						</Button>
						<RequestFailure error={create.error} fallback={t.ui.retryLater} />
					</CardContent>
				</Card>
			</main>
		</RequireSession>
	);
}
