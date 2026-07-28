import { generateKeyBetween } from "fractional-indexing";

export interface UnitTagCurationItem {
	readonly tagId: string;
	readonly pinned: boolean;
	readonly position: string | null;
}

export type FeaturedUnitTag<Item extends UnitTagCurationItem> = Item & {
	readonly pinned: true;
	readonly position: string;
};

export type RankedUnitTag<Item extends UnitTagCurationItem> = Item & {
	readonly pinned: false;
	readonly position: null;
};

export function partitionUnitTagCuration<Item extends UnitTagCurationItem>(
	items: readonly Item[],
): {
	readonly featured: readonly FeaturedUnitTag<Item>[];
	readonly ranked: readonly RankedUnitTag<Item>[];
} {
	const featured: FeaturedUnitTag<Item>[] = [];
	const ranked: RankedUnitTag<Item>[] = [];
	for (const item of items) {
		if (item.pinned) {
			if (item.position === null)
				throw new Error("Pinned Unit Tag is missing its ordered position");
			featured.push({ ...item, pinned: true, position: item.position });
			continue;
		}
		if (item.position !== null)
			throw new Error("Community-ranked Unit Tag unexpectedly has a position");
		ranked.push({ ...item, pinned: false, position: null });
	}
	return { featured, ranked };
}

export function nextFeaturedUnitTagPosition<Item extends UnitTagCurationItem>(
	featured: readonly FeaturedUnitTag<Item>[],
): string {
	return generateKeyBetween(featured.at(-1)?.position ?? null, null);
}

export type FeaturedUnitTagMove =
	| {
			readonly ok: true;
			readonly position: string;
	  }
	| {
			readonly ok: false;
			readonly reason: "tag-not-featured" | "target-out-of-range" | "unchanged";
	  };

export function positionForFeaturedUnitTagMove<Item extends UnitTagCurationItem>(
	featured: readonly FeaturedUnitTag<Item>[],
	tagId: string,
	targetIndex: number,
): FeaturedUnitTagMove {
	const sourceIndex = featured.findIndex((item) => item.tagId === tagId);
	if (sourceIndex < 0) return { ok: false, reason: "tag-not-featured" };
	if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= featured.length)
		return { ok: false, reason: "target-out-of-range" };
	if (sourceIndex === targetIndex) return { ok: false, reason: "unchanged" };

	const withoutMoved = featured.filter((item) => item.tagId !== tagId);
	return {
		ok: true,
		position: generateKeyBetween(
			withoutMoved[targetIndex - 1]?.position ?? null,
			withoutMoved[targetIndex]?.position ?? null,
		),
	};
}
