import preview from "@/.storybook/preview";
import { FeedItemCard, FeedPostCard, FeedUnitCard } from "./feed-item-card";
import {
	book,
	contextualReview,
	mediaWithGlobalFallback,
	ProductionUnitCards,
	realm,
	unratedSoftware,
	zoneWithoutAvatar,
} from "./feed-item-card.fixture";

const meta = preview.meta({
	component: FeedItemCard,
	subcomponents: { FeedPostCard, FeedUnitCard },
	args: { item: book, canExclude: false },
	tags: ["ai-generated"],
});
export default meta;

export const PreferredScore = meta.story();
export const GlobalScoreWithoutCover = meta.story({ args: { item: mediaWithGlobalFallback } });
export const UnratedWithoutCover = meta.story({ args: { item: unratedSoftware } });
export const RealmAvatar = meta.story({ args: { item: realm } });
export const ZoneFallback = meta.story({ args: { item: zoneWithoutAvatar } });
export const ContextualReview = meta.story({
	args: { item: contextualReview, displayContext: { kind: "unit", unitId: book.id } },
});
export const ProductionItems = meta.story({ render: () => <ProductionUnitCards /> });
export const MobileDark = PreferredScore.extend({
	globals: { theme: "dark", viewport: { value: "mobile", isRotated: false } },
});
