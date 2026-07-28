import { Button } from "@rezics/ui/custom/button";
import { ArrowRight } from "lucide-react";
import { useState } from "react";

import { getLocaleContent } from "../../content/locales";
import type { ProductDemoKind } from "../../content/productTypes";
import type { AboutLocale } from "../../i18n/locales";

type ProductDemoProps = {
	readonly kind: ProductDemoKind;
	readonly locale: AboutLocale;
};

function GamebookDemo({ locale }: { readonly locale: AboutLocale }) {
	const copy = getLocaleContent(locale).products.demos.gamebook;
	const [selectedChoice, setSelectedChoice] = useState(0);
	const selected = copy.choices[selectedChoice];

	return (
		<div className="demo-surface demo-surface--gamebook">
			<div className="demo-surface__intro">
				<h3>{copy.title}</h3>
				<p>{copy.description}</p>
			</div>
			<div className="demo-choice-list">
				{copy.choices.map((choice, index) => (
					<Button
						className="demo-choice"
						key={choice.label}
						type="button"
						variant="quiet"
						aria-pressed={selectedChoice === index}
						onClick={() => setSelectedChoice(index)}
					>
						<span>{choice.label}</span>
						<ArrowRight aria-hidden size={17} />
					</Button>
				))}
			</div>
			<div className="demo-result" aria-live="polite">
				<span>{copy.resultLabel}</span>
				<p>{selected.result}</p>
			</div>
		</div>
	);
}

function StructureDemo({ locale }: { readonly locale: AboutLocale }) {
	const copy = getLocaleContent(locale).products.demos.structure;
	const [selectedNode, setSelectedNode] = useState(0);
	const selected = copy.nodes[selectedNode];

	return (
		<div className="demo-surface demo-surface--structure">
			<div className="demo-surface__intro">
				<h3>{copy.title}</h3>
				<p>{copy.description}</p>
			</div>
			<div className="demo-structure">
				<div className="demo-structure__nodes">
					{copy.nodes.map((node, index) => (
						<Button
							className="demo-node"
							key={node.label}
							type="button"
							variant="quiet"
							aria-pressed={selectedNode === index}
							onClick={() => setSelectedNode(index)}
						>
							<span>{String(index + 1).padStart(2, "0")}</span>
							<strong>{node.label}</strong>
						</Button>
					))}
				</div>
				<div className="demo-result" aria-live="polite">
					<span>{copy.detailLabel}</span>
					<p>{selected.detail}</p>
				</div>
			</div>
		</div>
	);
}

function HistoryDemo({ locale }: { readonly locale: AboutLocale }) {
	const copy = getLocaleContent(locale).products.demos.history;
	const [selectedVersion, setSelectedVersion] = useState(0);
	const selected = copy.versions[selectedVersion];

	return (
		<div className="demo-surface demo-surface--history">
			<div className="demo-surface__intro">
				<h3>{copy.title}</h3>
				<p>{copy.description}</p>
			</div>
			<div className="demo-history">
				<div className="demo-history__versions">
					{copy.versions.map((version, index) => (
						<Button
							className="demo-version"
							key={version.label}
							type="button"
							variant="quiet"
							aria-pressed={selectedVersion === index}
							onClick={() => setSelectedVersion(index)}
						>
							<strong>{version.label}</strong>
							<span>{version.meta}</span>
						</Button>
					))}
				</div>
				<div className="demo-result" aria-live="polite">
					<span>{copy.detailLabel}</span>
					<p>{selected.detail}</p>
				</div>
			</div>
		</div>
	);
}

export function ProductDemo({ kind, locale }: ProductDemoProps) {
	switch (kind) {
		case "gamebook":
			return <GamebookDemo locale={locale} />;
		case "structure":
			return <StructureDemo locale={locale} />;
		case "history":
			return <HistoryDemo locale={locale} />;
	}
}
