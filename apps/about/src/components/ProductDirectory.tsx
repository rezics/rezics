import { Button, Input } from "@rezics/ui";
import { ArrowRight, Search } from "lucide-react";
import { useMemo, useState } from "react";

import {
	PRODUCT_STAGE_IDS,
	type ProductLayerId,
	type ProductStageId,
} from "../content/productTypes";
import { ProductStageBadge } from "./ProductStageBadge";

export type DirectoryItem = {
	readonly id: string;
	readonly layer: ProductLayerId;
	readonly stage: ProductStageId;
	readonly title: string;
	readonly summary: string;
	readonly href: string;
};

type Layer = {
	readonly id: ProductLayerId;
	readonly title: string;
	readonly body: string;
};

type Props = {
	readonly items: readonly DirectoryItem[];
	readonly layers: readonly Layer[];
	readonly labels: {
		readonly search: string;
		readonly placeholder: string;
		readonly all: string;
		readonly empty: string;
		readonly open: string;
		readonly stage?: {
			readonly legend: string;
			readonly labels: Record<ProductStageId, string>;
		};
	};
};

export function ProductDirectory({ items, layers, labels }: Props) {
	const [query, setQuery] = useState("");
	const [activeLayer, setActiveLayer] = useState<ProductLayerId | "all">("all");
	const normalizedQuery = query.trim().toLocaleLowerCase();
	const stageCopy = labels.stage;

	const visibleByLayer = useMemo(
		() =>
			layers.map((layer) => ({
				...layer,
				items: items.filter((item) => {
					const matchesLayer = activeLayer === "all" || item.layer === activeLayer;
					const stageLabel = stageCopy?.labels[item.stage] ?? "";
					const matchesQuery =
						normalizedQuery.length === 0 ||
						`${item.title} ${item.summary} ${stageLabel}`
							.toLocaleLowerCase()
							.includes(normalizedQuery);
					return matchesLayer && matchesQuery && item.layer === layer.id;
				}),
			})),
		[activeLayer, items, layers, normalizedQuery, stageCopy],
	);

	const visibleCount = visibleByLayer.reduce((count, layer) => count + layer.items.length, 0);

	return (
		<div className="directory">
			{stageCopy ? (
				<div aria-label={stageCopy.legend} className="stage-legend">
					<span>{stageCopy.legend}</span>
					{PRODUCT_STAGE_IDS.map((stage) => (
						<ProductStageBadge
							key={stage}
							label={stageCopy.labels[stage]}
							stage={stage}
						/>
					))}
				</div>
			) : null}
			<div className="directory-controls">
				<label className="directory-search">
					<span className="sr-only">{labels.search}</span>
					<Search aria-hidden="true" />
					<Input
						aria-label={labels.search}
						onChange={(event) => setQuery(event.currentTarget.value)}
						placeholder={labels.placeholder}
						type="search"
						value={query}
					/>
				</label>
				<div className="layer-filter" role="group" aria-label={labels.search}>
					<Button
						aria-pressed={activeLayer === "all"}
						onClick={() => setActiveLayer("all")}
						variant={activeLayer === "all" ? "secondary" : "quiet"}
					>
						{labels.all}
					</Button>
					{layers.map((layer) => (
						<Button
							aria-pressed={activeLayer === layer.id}
							key={layer.id}
							onClick={() => setActiveLayer(layer.id)}
							variant={activeLayer === layer.id ? "secondary" : "quiet"}
						>
							{layer.title}
						</Button>
					))}
				</div>
			</div>

			{visibleCount === 0 ? <p className="directory-empty">{labels.empty}</p> : null}

			{visibleByLayer.map((layer, layerIndex) =>
				layer.items.length > 0 ? (
					<section className="directory-layer" id={layer.id} key={layer.id}>
						<header>
							<p className="section-index">
								{String(layerIndex + 1).padStart(2, "0")}
							</p>
							<div>
								<h2>{layer.title}</h2>
								<p>{layer.body}</p>
							</div>
						</header>
						<div className="product-index">
							{layer.items.map((item, itemIndex) => (
								<a className="product-index-row" href={item.href} key={item.id}>
									<span className="product-index-row__number" aria-hidden="true">
										{String(layerIndex + 1).padStart(2, "0")}.
										{String(itemIndex + 1).padStart(2, "0")}
									</span>
									<h3>{item.title}</h3>
									<p>{item.summary}</p>
									{stageCopy ? (
										<ProductStageBadge
											label={stageCopy.labels[item.stage]}
											stage={item.stage}
										/>
									) : null}
									<ArrowRight aria-hidden="true" />
									<span className="sr-only">{labels.open}</span>
								</a>
							))}
						</div>
					</section>
				) : null,
			)}
		</div>
	);
}
