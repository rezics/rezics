import { expect } from "storybook/test";
import preview from "@/.storybook/preview";
import type { UnitListBlock } from "@rezics/block";
import type { ZoneRenderProjection } from "../model/zone-render";
import { ZoneBlockProvider, ZoneDocument } from "./block-renderer";

const timestamp = "2026-09-09T00:00:00Z";
const items = [
	{ id: "019f0000-0001-7000-8000-000000000001", kind: "publishing", title: "A publishing work" },
	{ id: "019f0000-0001-7000-8000-000000000002", kind: "music", title: "A music release" },
	{ id: "019f0000-0001-7000-8000-000000000003", kind: "entity", title: "A credited creator" },
	{ id: "019f0000-0001-7000-8000-000000000004", kind: "software", title: "A software project" },
].map((item) => ({
	...item,
	language: "en" as const,
	summary: "Open the native catalog entry.",
	avatar: null,
	banner: null,
	cover: null,
	zonePageSlug: null,
}));
const projection: ZoneRenderProjection = {
	dock: null,
	page: null,
	navigations: [],
	resolvedPresentation: {
		targetContract: "rezics.unit.presentation@0",
		document: {
			_type: "unit-presentation-document",
			_key: "000000000010",
			header: { _type: "block-document", _key: "000000000011", blocks: [] },
			footer: { _type: "block-document", _key: "000000000012", blocks: [] },
		},
		documentRevisionId: null,
		customTheme: null,
		fallbackReason: "none_installed",
	},
	references: { assets: [], units: items, wikiPosts: [] },
	zone: {
		id: "019f0000-0001-7000-8000-000000000010",
		language: "en",
		avatar: null,
		banner: null,
		cover: null,
		createdAt: timestamp,
		updatedAt: timestamp,
		startsAt: null,
		endsAt: null,
		filterDocument: {},
		localRuleRealmId: null,
		localizations: [],
		slugAddress: null,
		themeHero: null,
		capabilities: { canManage: false, canManageTheme: false, hasDevelopmentPreviewAccess: false },
		appearanceDocument: {
			_key: "000000000001",
			_type: "zone-appearance",
			accent: "#2563eb",
			colorScheme: "system",
			density: "comfortable",
		},
	},
};

const meta = preview.meta({
	component: ZoneDocument,
	title: "Zones/Native resource lists",
	tags: ["ai-generated"],
});
export default meta;

function List({ layout }: { layout: UnitListBlock["layout"] }) {
	return (
		<main className="max-w-4xl p-6">
			<ZoneBlockProvider baseHref="/zone/example" projection={projection}>
				<ZoneDocument
					surface={{ kind: "dock" }}
					blocks={[
						{
							_type: "unit-list",
							_key: "000000000002",
							layout,
							limit: 4,
							source: { kind: "units", unitIds: items.map((item) => item.id) },
						},
					]}
				/>
			</ZoneBlockProvider>
		</main>
	);
}

export const Grid = meta.story({
	globals: { locale: "en", contentLanguage: "en" },
	render: () => <List layout="grid" />,
	play: async ({ canvas, userEvent }) => {
		for (const item of items)
			await expect(
				await canvas.findByRole("link", { name: (name) => name.startsWith(item.title) }),
			).toHaveAttribute("href", `/catalog/${item.kind}/${item.id}`);
		await userEvent.tab();
		await expect(
			canvas.getByRole("link", { name: (name) => name.startsWith(items[0]!.title) }),
		).toHaveFocus();
	},
});
export const Carousel = meta.story({
	globals: { locale: "en", contentLanguage: "en" },
	render: () => <List layout="carousel" />,
	play: async ({ canvas, userEvent }) => {
		await userEvent.click(await canvas.findByRole("button", { name: "Next items" }));
		await expect(await canvas.findByRole("link", { name: items[3]!.title })).toHaveAttribute(
			"href",
			`/catalog/software/${items[3]!.id}`,
		);
	},
});
