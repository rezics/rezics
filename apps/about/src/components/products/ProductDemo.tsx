import { useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import type { ProductDemoKind } from "../../content/productTypes";
import { getLocaleContent } from "../../content/locales";
import type { AboutLocale } from "../../i18n/locales";

type Props = {
	kind: ProductDemoKind;
	productName: string;
	locale: AboutLocale;
	label: string;
	caption: string;
};
export function ProductDemo({ kind, productName: name, locale, label, caption }: Props) {
	const { components } = getLocaleContent(locale);
	const {
		book,
		gamebook,
		structure,
		history,
		attribution,
		zone,
		feed,
		catalog,
		editor,
		progress,
		generic,
	} = components;
	const instanceId = useId();
	const panelId = (suffix: string) => `${instanceId}-${suffix}`;
	const figureRef = useRef<HTMLElement>(null);
	const [activePanelId, setActivePanelId] = useState<string | null>(null);
	const [choice, setChoice] = useState<{ index: number; outcome: string; step: string } | null>(
		null,
	);

	useEffect(() => {
		setActivePanelId(null);
		setChoice(null);
	}, [kind]);

	useEffect(() => {
		if (!activePanelId) return;
		const scope = figureRef.current;
		if (!scope) return;
		scope.querySelectorAll<HTMLButtonElement>('[role="tab"]').forEach((button) => {
			const selected = button.getAttribute("aria-controls") === activePanelId;
			button.setAttribute("aria-selected", String(selected));
			button.tabIndex = selected ? 0 : -1;
			button.classList.toggle("is-active", selected);
		});
		scope.querySelectorAll<HTMLElement>('[role="tabpanel"]').forEach((panel) => {
			panel.hidden = panel.id !== activePanelId;
		});
	}, [activePanelId]);

	useEffect(() => {
		if (!choice) return;
		const scope = figureRef.current;
		if (!scope) return;
		const outcome = scope.querySelector<HTMLElement>("[data-choice-outcome]");
		const step = scope.querySelector<HTMLElement>("[data-journey-step]");
		if (outcome) outcome.textContent = choice.outcome;
		if (step) step.textContent = choice.step;
		scope.querySelectorAll<HTMLButtonElement>("[data-choice]").forEach((button, index) => {
			const selected = index === choice.index;
			button.setAttribute("aria-pressed", String(selected));
			button.classList.toggle("is-active", selected);
		});
	}, [choice]);

	const activate = (button: HTMLButtonElement) => {
		const controlledPanel = button.getAttribute("aria-controls");
		if (controlledPanel) setActivePanelId(controlledPanel);
	};

	const handleClick = (event: MouseEvent<HTMLElement>) => {
		const button = (event.target as Element).closest<HTMLButtonElement>("button");
		if (!button || !figureRef.current?.contains(button)) return;
		if (button.matches("[data-choice]")) {
			const buttons = Array.from(
				figureRef.current.querySelectorAll<HTMLButtonElement>("[data-choice]"),
			);
			setChoice({
				index: buttons.indexOf(button),
				outcome: button.dataset.outcome ?? "",
				step: button.dataset.step ?? "",
			});
			return;
		}
		if (button.getAttribute("role") === "tab") activate(button);
	};

	const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
		const button = (event.target as Element).closest<HTMLButtonElement>('[role="tab"]');
		if (!button) return;
		const tablist = button.closest<HTMLElement>('[role="tablist"]');
		if (!tablist) return;
		const tabs = Array.from(tablist.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
		const index = tabs.indexOf(button);
		let next = index;
		if (event.key === "ArrowRight" || event.key === "ArrowDown")
			next = (index + 1) % tabs.length;
		else if (event.key === "ArrowLeft" || event.key === "ArrowUp")
			next = (index - 1 + tabs.length) % tabs.length;
		else if (event.key === "Home") next = 0;
		else if (event.key === "End") next = tabs.length - 1;
		else return;
		event.preventDefault();
		const nextButton = tabs[next];
		if (!nextButton) return;
		nextButton.focus();
		activate(nextButton);
	};

	return (
		<figure
			ref={figureRef}
			className="product-stage"
			onClick={handleClick}
			onKeyDown={handleKeyDown}
		>
			<figcaption className="product-stage__label">
				<strong>
					{label} · {name}
				</strong>
				<span>{caption}</span>
			</figcaption>
			<div className="product-stage__body">
				{kind === "book" && (
					<div className="demo-shell">
						<aside className="demo-sidebar" aria-label={book.sectionsLabel}>
							<p className="demo-sidebar__title">{book.book}</p>
							<div className="demo-nav">
								<span className="is-active">{book.identity}</span>
								<span>{book.variants}</span>
								<span>{book.contents}</span>
								<span>{book.history}</span>
							</div>
						</aside>
						<div className="demo-main">
							<div className="demo-toolbar">
								<span className="demo-toolbar__path">{book.book} / main</span>
								<span className="demo-status">{book.published}</span>
							</div>
							<h2 className="demo-title">{book.title}</h2>
							<p className="demo-muted">{book.variantDescription}</p>
							<div className="demo-grid">
								<section className="demo-panel">
									<h3>{book.contents} · ContentStructure</h3>
									<ol className="demo-list">
										<li>
											<strong>{book.chapterOne}</strong>
											<span>{book.postA}</span>
										</li>
										<li>
											<strong>{book.chapterTwo}</strong>
											<span>{book.postB}</span>
										</li>
										<li>
											<strong>{book.reusedInterlude}</strong>
											<span>{book.postA}</span>
										</li>
									</ol>
								</section>
								<section className="demo-panel">
									<h3>{book.credits} · CreditAttribution</h3>
									<ul className="demo-list">
										<li>
											<strong>{book.author}</strong>
											<span>{book.entity}</span>
										</li>
										<li>
											<strong>{book.translator}</strong>
											<span>{book.entity}</span>
										</li>
										<li>
											<strong>{book.publisher}</strong>
											<span>{book.entity}</span>
										</li>
									</ul>
								</section>
							</div>
						</div>
					</div>
				)}

				{kind === "gamebook" && (
					<div className="demo-main" data-choice-demo>
						<div className="demo-toolbar">
							<span className="demo-toolbar__path">
								{book.book} / GameContentStructure
							</span>
							<span className="demo-status">{name}</span>
						</div>
						<div className="demo-grid">
							<section className="demo-panel">
								<h3>{gamebook.reader}</h3>
								<p className="demo-muted">
									{gamebook.journey} ·{" "}
									<span data-journey-step>{gamebook.entrance}</span>
								</p>
								<h2 className="demo-title" data-choice-outcome>
									{gamebook.passageTitle}
								</h2>
								<p className="demo-muted">{gamebook.branchDescription}</p>
								<div className="choice-list" aria-label={gamebook.choose}>
									<button
										className="choice-button"
										type="button"
										data-choice
										data-outcome={gamebook.choiceAOutcome}
										data-step={gamebook.choiceAStep}
										aria-pressed="false"
									>
										{gamebook.choiceA}
									</button>
									<button
										className="choice-button"
										type="button"
										data-choice
										data-outcome={gamebook.choiceBOutcome}
										data-step={gamebook.choiceBStep}
										aria-pressed="false"
									>
										{gamebook.choiceB}
									</button>
								</div>
							</section>
							<section className="demo-panel">
								<h3>
									{gamebook.authoring} · {gamebook.validation}
								</h3>
								<div
									className="game-editor"
									aria-label={gamebook.authoringSequence}
								>
									<div className="game-node">
										<strong>{gamebook.entrance}</strong>
										<span>{gamebook.entry}</span>
									</div>
									<div className="game-node is-passage">
										<strong>{gamebook.passage}</strong>
										<span>{gamebook.choicesTwo}</span>
									</div>
									<div className="game-node">
										<strong>{gamebook.ending}</strong>
										<span>{gamebook.retirable}</span>
									</div>
								</div>
								<p className="demo-muted">{gamebook.constraints}</p>
							</section>
						</div>
					</div>
				)}

				{kind === "structure" && (
					<div className="demo-main">
						<div className="demo-toolbar">
							<span className="demo-toolbar__path">{structure.path}</span>
							<span className="demo-status">{structure.validation}</span>
						</div>
						<div role="tablist" className="tab-list" aria-label={structure.structure}>
							<button
								className="tab-button"
								type="button"
								role="tab"
								aria-selected="true"
								aria-controls={panelId("tree")}
							>
								{structure.treeMode}
							</button>
							<button
								className="tab-button"
								type="button"
								role="tab"
								aria-selected="false"
								tabIndex={-1}
								aria-controls={panelId("game")}
							>
								{structure.gameMode}
							</button>
						</div>
						<section
							id={panelId("tree")}
							role="tabpanel"
							aria-label={structure.treeMode}
						>
							<div className="demo-grid">
								<div className="demo-panel">
									<h3>{structure.orderedTree}</h3>
									<div className="demo-tree">
										<div className="demo-tree__row is-selected" data-depth="0">
											{structure.bookRoot}
										</div>
										<div className="demo-tree__row" data-depth="1">
											{structure.partOccurrence}
										</div>
										<div
											className="demo-tree__row"
											data-depth={structure.choicesCount}
										>
											{structure.postAOccurrence}
										</div>
										<div
											className="demo-tree__row"
											data-depth={structure.choicesCount}
										>
											{structure.postBOccurrence}
										</div>
										<div className="demo-tree__row" data-depth="1">
											{structure.reusedOccurrence}
										</div>
									</div>
								</div>
								<div className="demo-panel">
									<h3>{structure.bookReaderResult}</h3>
									<ol className="demo-list">
										<li>
											<strong>{structure.partOne}</strong>
											<span>{structure.section}</span>
										</li>
										<li>
											<strong>{structure.chapterOne}</strong>
											<span>{structure.postA}</span>
										</li>
										<li>
											<strong>{structure.chapterTwo}</strong>
											<span>{structure.postB}</span>
										</li>
									</ol>
								</div>
							</div>
						</section>
						<section
							id={panelId("game")}
							role="tabpanel"
							aria-label={structure.gameMode}
							hidden
						>
							<div className="demo-grid">
								<div className="demo-panel">
									<h3>{structure.optionalGraph}</h3>
									<div className="game-editor">
										<div className="game-node">
											<strong>{structure.entrance}</strong>
											<span>{structure.entry}</span>
										</div>
										<div className="game-node is-passage">
											<strong>{structure.passage}</strong>
											<span>{structure.choiceAB}</span>
										</div>
										<div className="game-node">
											<strong>{structure.ending}</strong>
											<span>{structure.terminal}</span>
										</div>
									</div>
								</div>
								<div className="demo-panel">
									<h3>{structure.gamebookReaderResult}</h3>
									<ul className="demo-list">
										<li>
											<strong>{structure.currentPassage}</strong>
											<span>{structure.stableId}</span>
										</li>
										<li>
											<strong>{structure.availableChoices}</strong>
											<span>{structure.choicesCount}</span>
										</li>
										<li>
											<strong>{structure.journeyStep}</strong>
											<span>{structure.separate}</span>
										</li>
									</ul>
								</div>
							</div>
						</section>
					</div>
				)}

				{kind === "history" && (
					<div className="demo-shell">
						<aside className="demo-sidebar">
							<p className="demo-sidebar__title">{history.versions}</p>
							<div
								className="demo-nav"
								role="tablist"
								aria-label={history.publishedVersions}
							>
								<button
									className="tab-button is-active"
									type="button"
									role="tab"
									aria-selected="true"
									aria-controls={panelId("history-title")}
								>
									{history.bookTitle}
								</button>
								<button
									className="tab-button"
									type="button"
									role="tab"
									aria-selected="false"
									tabIndex={-1}
									aria-controls={panelId("history-post")}
								>
									{history.postBlock}
								</button>
								<button
									className="tab-button"
									type="button"
									role="tab"
									aria-selected="false"
									tabIndex={-1}
									aria-controls={panelId("history-zone")}
								>
									{history.zoneConfig}
								</button>
							</div>
						</aside>
						<div className="demo-main">
							<div className="demo-toolbar">
								<span className="demo-toolbar__path">
									{history.fieldHistory} / {history.publishedVersions}
								</span>
								<span className="demo-status">{book.history}</span>
							</div>
							<section id={panelId("history-title")} role="tabpanel">
								<div className="demo-grid">
									<div className="demo-panel">
										<h3>{history.publishedVersions}</h3>
										<ul className="demo-list">
											<li>
												<strong>{history.publishedVersionC}</strong>
												<span>{history.current}</span>
											</li>
											<li>
												<strong>{history.publishedVersionB}</strong>
												<span>{history.previous}</span>
											</li>
											<li>
												<strong>{history.publishedVersionA}</strong>
												<span>{history.initial}</span>
											</li>
										</ul>
									</div>
									<div className="demo-panel">
										<h3>{history.diff} · Book.title</h3>
										<div className="diff-line">
											<span>−</span>
											<span>{history.previousTitle}</span>
										</div>
										<div className="diff-line is-change">
											<span>+</span>
											<span>{history.currentTitle}</span>
										</div>
										<div className="lock-banner">
											<span>{history.locked}</span>
											<strong>{history.bookTitle}</strong>
										</div>
									</div>
								</div>
							</section>
							<section id={panelId("history-post")} role="tabpanel" hidden>
								<div className="demo-panel">
									<h3>{history.postBlockHistory}</h3>
									<div className="diff-line">
										<span>−</span>
										<span>{history.previousPostBlock}</span>
									</div>
									<div className="diff-line is-change">
										<span>+</span>
										<span>{history.currentPostBlock}</span>
									</div>
								</div>
							</section>
							<section id={panelId("history-zone")} role="tabpanel" hidden>
								<div className="demo-panel">
									<h3>{history.zoneConfigurationHistory}</h3>
									<div className="diff-line">
										<span>−</span>
										<span>{history.previousZoneQuery}</span>
									</div>
									<div className="diff-line is-change">
										<span>+</span>
										<span>{history.currentZoneQuery}</span>
									</div>
								</div>
							</section>
						</div>
					</div>
				)}

				{kind === "attribution" && (
					<div className="demo-main">
						<div className="demo-toolbar">
							<span className="demo-toolbar__path">
								{book.book} / {attribution.entity} / {book.credits}
							</span>
							<span className="demo-status">{attribution.implemented}</span>
						</div>
						<div role="tablist" className="tab-list" aria-label={attribution.modes}>
							<button
								className="tab-button"
								type="button"
								role="tab"
								aria-selected="true"
								aria-controls={panelId("credit")}
							>
								{attribution.credit}
							</button>
							<button
								className="tab-button"
								type="button"
								role="tab"
								aria-selected="false"
								tabIndex={-1}
								aria-controls={panelId("subject")}
							>
								{attribution.subject}
							</button>
						</div>
						<section id={panelId("credit")} role="tabpanel">
							<div className="demo-grid">
								<div className="demo-panel">
									<h3>{attribution.bookCredits}</h3>
									<table className="demo-table">
										<thead>
											<tr>
												<th>{attribution.relationship}</th>
												<th>{attribution.entity}</th>
												<th>{attribution.unit}</th>
											</tr>
										</thead>
										<tbody>
											<tr>
												<td>
													<strong>{attribution.author}</strong>
												</td>
												<td>{attribution.personEntity}</td>
												<td>{attribution.book}</td>
											</tr>
											<tr>
												<td>
													<strong>{attribution.translator}</strong>
												</td>
												<td>{attribution.personEntity}</td>
												<td>{attribution.bookVariant}</td>
											</tr>
											<tr>
												<td>
													<strong>{attribution.publisher}</strong>
												</td>
												<td>{attribution.organizationEntity}</td>
												<td>{attribution.release}</td>
											</tr>
										</tbody>
									</table>
								</div>
								<aside className="demo-panel">
									<h3>{attribution.entityDetail}</h3>
									<ul className="demo-list">
										<li>
											<strong>{attribution.entityType}</strong>
											<span>{attribution.realOrFictional}</span>
										</li>
										<li>
											<strong>{attribution.record}</strong>
											<span>{attribution.stableIdentity}</span>
										</li>
										<li>
											<strong>{attribution.attributions}</strong>
											<span>{attribution.managedList}</span>
										</li>
									</ul>
								</aside>
							</div>
						</section>
						<section id={panelId("subject")} role="tabpanel" hidden>
							<div className="demo-grid">
								<div className="demo-panel">
									<h3>{attribution.bookSubjects}</h3>
									<table className="demo-table">
										<thead>
											<tr>
												<th>{attribution.relationship}</th>
												<th>{attribution.subject}</th>
												<th>{attribution.unit}</th>
											</tr>
										</thead>
										<tbody>
											<tr>
												<td>
													<strong>{attribution.protagonist}</strong>
												</td>
												<td>{attribution.characterEntity}</td>
												<td>{attribution.book}</td>
											</tr>
											<tr>
												<td>
													<strong>{attribution.character}</strong>
												</td>
												<td>{attribution.fictionalEntity}</td>
												<td>{attribution.book}</td>
											</tr>
											<tr>
												<td>
													<strong>{attribution.derivativeOf}</strong>
												</td>
												<td>{attribution.entityUnitRelation}</td>
												<td>{attribution.post}</td>
											</tr>
										</tbody>
									</table>
								</div>
								<aside className="demo-panel">
									<h3>{attribution.relationshipEditor}</h3>
									<ul className="demo-list">
										<li>
											<strong>{attribution.type}</strong>
											<span>{attribution.protagonist}</span>
										</li>
										<li>
											<strong>{attribution.subject}</strong>
											<span>{attribution.characterEntity}</span>
										</li>
										<li>
											<strong>{attribution.targetUnit}</strong>
											<span>{attribution.book}</span>
										</li>
									</ul>
								</aside>
							</div>
						</section>
					</div>
				)}

				{kind === "zone" && (
					<div className="demo-shell">
						<aside className="demo-sidebar">
							<p className="demo-sidebar__title">{zone.zone}</p>
							<div className="demo-nav">
								<span className="is-active">{zone.blocks}</span>
								<span>{zone.query}</span>
								<span>{zone.history}</span>
								<span>{zone.preview}</span>
							</div>
						</aside>
						<div className="demo-main">
							<div className="demo-toolbar">
								<span className="demo-toolbar__path">{zone.path}</span>
								<span className="demo-status">{zone.blockSchema}</span>
							</div>
							<div className="demo-grid">
								<section className="demo-panel">
									<h3>{zone.blocks}</h3>
									<div className="demo-tree">
										<div className="demo-tree__row is-selected">
											{zone.headerBlock}
										</div>
										<div className="demo-tree__row">{zone.feedBlock}</div>
										<div className="demo-tree__row">{zone.collectionBlock}</div>
									</div>
								</section>
								<section className="demo-panel">
									<h3>{zone.preview}</h3>
									<ul className="demo-list">
										<li>
											<strong>{zone.feedResult}</strong>
											<span>{zone.postCard}</span>
										</li>
										<li>
											<strong>{zone.catalogResult}</strong>
											<span>{zone.bookCard}</span>
										</li>
										<li>
											<strong>{zone.discussion}</strong>
											<span>{zone.comment}</span>
										</li>
									</ul>
								</section>
							</div>
						</div>
					</div>
				)}

				{kind === "feed" && (
					<div className="demo-main">
						<div className="demo-toolbar">
							<span className="demo-toolbar__path">
								{name} / {feed.consumers}
							</span>
							<span className="demo-status">{name}</span>
						</div>
						<div role="tablist" className="tab-list" aria-label={feed.consumers}>
							{["Zone", "Realm", "Home"].map((consumer, index) => (
								<button
									className="tab-button"
									type="button"
									role="tab"
									aria-selected={index === 0 ? "true" : "false"}
									tabIndex={index === 0 ? 0 : -1}
									aria-controls={panelId(`feed-${consumer.toLowerCase()}`)}
								>
									{consumer}
								</button>
							))}
						</div>
						{["Zone", "Realm", "Home"].map((consumer, index) => (
							<section
								id={panelId(`feed-${consumer.toLowerCase()}`)}
								role="tabpanel"
								hidden={index !== 0}
							>
								<div className="demo-grid">
									<div className="demo-panel">
										<h3>{consumer} feed</h3>
										<ul className="demo-list">
											<li>
												<strong>{feed.postCard}</strong>
												<span>{feed.kindAware}</span>
											</li>
											<li>
												<strong>{feed.bookCard}</strong>
												<span>{feed.catalog}</span>
											</li>
											<li>
												<strong>{feed.commentCard}</strong>
												<span>{feed.discussion}</span>
											</li>
										</ul>
									</div>
									<div className="demo-panel">
										<h3>{feed.consumerConfiguration}</h3>
										<ul className="demo-list">
											<li>
												<strong>{feed.query}</strong>
												<span>{feed.consumerScope}</span>
											</li>
											<li>
												<strong>{feed.card}</strong>
												<span>{feed.perFeature}</span>
											</li>
											<li>
												<strong>{feed.order}</strong>
												<span>{feed.feedOrder}</span>
											</li>
										</ul>
									</div>
								</div>
							</section>
						))}
					</div>
				)}

				{kind === "catalog" && (
					<div className="demo-main">
						<div className="demo-toolbar">
							<span className="demo-toolbar__path">
								{name} / {catalog.unitTypes}
							</span>
							<span className="demo-status">{name}</span>
						</div>
						<h2 className="demo-title">{catalog.identity}</h2>
						<p className="demo-muted">{catalog.description}</p>
						<div className="demo-grid">
							<section className="demo-panel">
								<h3>{catalog.unitTypes}</h3>
								<ul className="demo-list">
									<li>
										<strong>{catalog.book}</strong>
										<span>{catalog.mainVariants}</span>
									</li>
									<li>
										<strong>{catalog.media}</strong>
										<span>{catalog.mainVariants}</span>
									</li>
									<li>
										<strong>{catalog.software}</strong>
										<span>{catalog.mainVariants}</span>
									</li>
									<li>
										<strong>{catalog.series}</strong>
										<span>{catalog.composition}</span>
									</li>
								</ul>
							</section>
							<section className="demo-panel">
								<h3>{catalog.selectedIdentity}</h3>
								<ul className="demo-list">
									<li>
										<strong>{catalog.canonicalUnit}</strong>
										<span>{catalog.stableId}</span>
									</li>
									<li>
										<strong>{catalog.release}</strong>
										<span>{catalog.editionContext}</span>
									</li>
									<li>
										<strong>{catalog.attribution}</strong>
										<span>{catalog.entityRelations}</span>
									</li>
								</ul>
							</section>
						</div>
					</div>
				)}

				{kind === "editor" && (
					<div className="demo-shell">
						<aside className="demo-sidebar">
							<p className="demo-sidebar__title">{name}</p>
							<div className="demo-nav">
								<span className="is-active">{editor.document}</span>
								<span>{editor.blocks}</span>
								<span>{editor.history}</span>
							</div>
						</aside>
						<div className="demo-main">
							<div className="demo-toolbar">
								<span className="demo-toolbar__path">Editor / {name}</span>
								<span className="demo-status">{editor.draftBoundary}</span>
							</div>
							<h2 className="demo-title">{editor.contentTitle}</h2>
							<div className="demo-panel" style={{ marginTop: "1.5rem" }}>
								<p className="demo-muted">{editor.paragraphBlock}</p>
								<p style={{ margin: "0.8rem 0 0", lineHeight: 1.75 }}>
									{editor.description}
								</p>
							</div>
						</div>
					</div>
				)}

				{kind === "progress" && (
					<div className="demo-main">
						<div className="demo-toolbar">
							<span className="demo-toolbar__path">
								{name} / {progress.book}
							</span>
							<span className="demo-status">{progress.generalProgress}</span>
						</div>
						<div className="demo-grid">
							<section className="demo-panel">
								<h3>{progress.readingPosition}</h3>
								<ul className="demo-list">
									<li>
										<strong>{progress.unit}</strong>
										<span>{progress.book}</span>
									</li>
									<li>
										<strong>{progress.occurrence}</strong>
										<span>{progress.chapter}</span>
									</li>
									<li>
										<strong>{progress.position}</strong>
										<span>{progress.readerState}</span>
									</li>
								</ul>
							</section>
							<section className="demo-panel">
								<h3>{progress.gamebookBoundary}</h3>
								<ul className="demo-list">
									<li>
										<strong>{progress.progress}</strong>
										<span>{progress.generalSummary}</span>
									</li>
									<li>
										<strong>{progress.journey}</strong>
										<span>{progress.gamebookOwned}</span>
									</li>
									<li>
										<strong>{progress.journeyStep}</strong>
										<span>{progress.pathHistory}</span>
									</li>
								</ul>
							</section>
						</div>
					</div>
				)}

				{kind === "generic" && (
					<div className="demo-shell">
						<aside className="demo-sidebar">
							<p className="demo-sidebar__title">{name}</p>
							<div className="demo-nav">
								<span className="is-active">{generic.record}</span>
								<span>{generic.relations}</span>
								<span>{generic.history}</span>
							</div>
						</aside>
						<div className="demo-main">
							<div className="demo-toolbar">
								<span className="demo-toolbar__path">
									{name} / {generic.record}
								</span>
								<span className="demo-status">{generic.conceptPreview}</span>
							</div>
							<h2 className="demo-title">{name}</h2>
							<p className="demo-muted">{generic.description}</p>
							<div className="demo-grid">
								<section className="demo-panel">
									<h3>{generic.identity}</h3>
									<ul className="demo-list">
										<li>
											<strong>{generic.stableRecord}</strong>
											<span>{generic.unit}</span>
										</li>
										<li>
											<strong>{generic.relatedProducts}</strong>
											<span>{generic.references}</span>
										</li>
										<li>
											<strong>{generic.publishedState}</strong>
											<span>{generic.history}</span>
										</li>
									</ul>
								</section>
								<section className="demo-panel">
									<h3>{generic.sharedCapabilities}</h3>
									<ul className="demo-list">
										<li>
											<strong>{generic.attribution}</strong>
											<span>{generic.entity}</span>
										</li>
										<li>
											<strong>{generic.tags}</strong>
											<span>{generic.queryable}</span>
										</li>
										<li>
											<strong>{generic.api}</strong>
											<span>{generic.permissioned}</span>
										</li>
									</ul>
								</section>
							</div>
						</div>
					</div>
				)}
			</div>
		</figure>
	);
}
