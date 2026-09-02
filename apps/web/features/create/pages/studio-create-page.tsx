import { TranslationBoundary } from "@/i18n/translation-boundary";
import { postCreateSearchParams } from "@/lib/search-params.server";
import type {
	StudioCreateSearchParams,
	StudioGenericCreateSectionId,
} from "../model/studio-section";

export async function StudioCreatePage({
	searchParams,
	sectionId,
}: {
	readonly searchParams: StudioCreateSearchParams;
	readonly sectionId: StudioGenericCreateSectionId;
}) {
	switch (sectionId) {
		case "book":
		case "software":
		case "media": {
			const { UnitCreatePage } = await import("@/features/units/unit-pages");
			return (
				<TranslationBoundary
					namespaces={[
						"actions",
						"cover",
						"create",
						"licenses",
						"media",
						"search",
						"tags",
						"ui",
						"units",
					]}
				>
					<UnitCreatePage type={sectionId} />
				</TranslationBoundary>
			);
		}
		case "entity": {
			const { EntityCreatePage } = await import("@/features/units/unit-resource-pages");
			return (
				<TranslationBoundary
					namespaces={["actions", "create", "entities", "errors", "media", "search", "ui", "units"]}
				>
					<EntityCreatePage />
				</TranslationBoundary>
			);
		}
		case "realm": {
			const { RealmCreatePage } = await import("@/features/realms/realm-pages");
			return (
				<TranslationBoundary namespaces={["media", "realms", "tags", "ui", "units"]}>
					<RealmCreatePage />
				</TranslationBoundary>
			);
		}
		case "zone": {
			const { ZoneCreatePage } = await import("@/features/zones/zone-create-page");
			return (
				<TranslationBoundary namespaces={["previewAccess", "search", "ui", "units", "zones"]}>
					<ZoneCreatePage />
				</TranslationBoundary>
			);
		}
		case "post":
		case "wiki": {
			const { realmId } = await postCreateSearchParams.parse(Promise.resolve(searchParams));
			if (sectionId === "post") {
				const { PostCreatePage } = await import("@/features/posts/pages/post-create-page");
				return (
					<TranslationBoundary namespaces={["posts", "realms", "ui", "units"]}>
						<PostCreatePage defaultRealmId={realmId ?? undefined} />
					</TranslationBoundary>
				);
			}
			const { WikiCreatePage } = await import("@/features/posts/pages/wiki-create-page");
			return (
				<TranslationBoundary namespaces={["posts", "realms", "ui", "units"]}>
					<WikiCreatePage defaultRealmId={realmId ?? undefined} />
				</TranslationBoundary>
			);
		}
		case "collection": {
			const { CollectionCreatePage } = await import(
				"@/features/collections/pages/collection-create-page"
			);
			return (
				<TranslationBoundary namespaces={["collections", "media", "ui", "units"]}>
					<CollectionCreatePage />
				</TranslationBoundary>
			);
		}
		case "review": {
			const { ReviewCreatePage } = await import("@/features/reviews/pages/review-create-page");
			return (
				<TranslationBoundary namespaces={["engagement", "posts", "realms", "ui", "units"]}>
					<ReviewCreatePage />
				</TranslationBoundary>
			);
		}
		case "poll": {
			const { PollCreate } = await import("@/features/polls/polls");
			return (
				<TranslationBoundary namespaces={["actions", "engagement", "errors", "ui"]}>
					<PollCreate />
				</TranslationBoundary>
			);
		}
	}
}
