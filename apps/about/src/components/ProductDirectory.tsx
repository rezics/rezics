import {
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	Input,
} from "@rezics/ui";
import { ArrowUpRight, Search } from "lucide-react";
import { useMemo, useState } from "react";

import type { ProductLayerId } from "../content/productTypes";

export type DirectoryItem = {
	readonly id: string;
	readonly layer: ProductLayerId;
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
	};
};

export function ProductDirectory({ items, layers, labels }: Props) {
	const [query, setQuery] = useState("");
	const [activeLayer, setActiveLayer] = useState<ProductLayerId | "all">("all");
	const normalizedQuery = query.trim().toLocaleLowerCase();

	const visibleByLayer = useMemo(
		() =>
			layers.map((layer) => ({
				...layer,
				items: items.filter((item) => {
					const matchesLayer = activeLayer === "all" || item.layer === activeLayer;
					const matchesQuery =
						normalizedQuery.length === 0 ||
						`${item.title} ${item.summary}`
							.toLocaleLowerCase()
							.includes(normalizedQuery);
					return matchesLayer && matchesQuery && item.layer === layer.id;
				}),
			})),
		[activeLayer, items, layers, normalizedQuery],
	);

	const visibleCount = visibleByLayer.reduce((count, layer) => count + layer.items.length, 0);

	return (
		<div className="directory">
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

			{visibleByLayer.map((layer) =>
				layer.items.length > 0 ? (
					<section className="directory-layer" id={layer.id} key={layer.id}>
						<header>
							<p className="section-index">
								{String(layers.indexOf(layer) + 1).padStart(2, "0")}
							</p>
							<div>
								<h2>{layer.title}</h2>
								<p>{layer.body}</p>
							</div>
						</header>
						<div className="product-grid">
							{layer.items.map((item) => (
								<a className="product-card-link" href={item.href} key={item.id}>
									<Card appearance="outlined" className="product-card">
										<CardHeader>
											<CardTitle>{item.title}</CardTitle>
											<ArrowUpRight aria-hidden="true" />
										</CardHeader>
										<CardContent>
											<CardDescription>{item.summary}</CardDescription>
											<span className="sr-only">{labels.open}</span>
										</CardContent>
									</Card>
								</a>
							))}
						</div>
					</section>
				) : null,
			)}
		</div>
	);
}
