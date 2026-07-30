import { notFound } from "next/navigation";

import { TagCreatePage } from "@/features/tags/pages/tag-create-page";
import { loadTagCreateRoute } from "@/features/tags/routing/tag-create-route";
import { TranslationBoundary } from "@/i18n/translation-boundary";

export default async function Page({
	searchParams,
}: {
	readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const route = await loadTagCreateRoute(searchParams);
	if (route.status === "invalid") notFound();
	return (
		<TranslationBoundary namespaces={["tags"]}>
			<TagCreatePage
				initialTitle={route.initialTitle}
				intent={route.intent}
				publicEntrySearchConfirmation={route.publicEntrySearchConfirmation}
			/>
		</TranslationBoundary>
	);
}
