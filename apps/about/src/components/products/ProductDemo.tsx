import { useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import type { ProductDemoKind } from "../../content/productTypes";
import { getSiteCopy } from "../../content/siteCopy";
import type { AboutLocale } from "../../i18n/locales";

type Props = {
	kind: ProductDemoKind;
	productName: string;
	locale: AboutLocale;
	label: string;
	caption: string;
};
const DEMO_TEXT = {
	"zh-hant": {
		identity: "整體身份",
		variants: "main 與 variants",
		contents: "章節目錄",
		credits: "歸屬關係",
		author: "作者",
		translator: "譯者",
		publisher: "出版商",
		entity: "Entity 記錄",
		published: "已發佈",
		reader: "讀者界面",
		authoring: "作者編輯器",
		journey: "本次 Journey",
		currentStep: "目前 JourneyStep",
		choose: "做出選擇",
		structure: "結構編輯器",
		validation: "結構有效 · DAG 檢查通過",
		versions: "版本",
		diff: "欄位差異",
		locked: "此欄位目前在編輯範圍內被鎖定",
		relationship: "關係類型",
		subject: "主題對象",
		blocks: "區塊配置",
		query: "內容查詢",
		preview: "產品預覽",
		record: "記錄",
	},
	"zh-hans": {
		identity: "整体身份",
		variants: "main 与 variants",
		contents: "章节目录",
		credits: "归属关系",
		author: "作者",
		translator: "译者",
		publisher: "出版商",
		entity: "Entity 记录",
		published: "已发布",
		reader: "读者界面",
		authoring: "作者编辑器",
		journey: "本次 Journey",
		currentStep: "当前 JourneyStep",
		choose: "做出选择",
		structure: "结构编辑器",
		validation: "结构有效 · DAG 检查通过",
		versions: "版本",
		diff: "字段差异",
		locked: "此字段当前在编辑范围内被锁定",
		relationship: "关系类型",
		subject: "主题对象",
		blocks: "区块配置",
		query: "内容查询",
		preview: "产品预览",
		record: "记录",
	},
	en: {
		identity: "Book identity",
		variants: "main and variants",
		contents: "Chapter structure",
		credits: "Attribution",
		author: "Author",
		translator: "Translator",
		publisher: "Publisher",
		entity: "Entity record",
		published: "Published",
		reader: "Reader",
		authoring: "Authoring editor",
		journey: "Current Journey",
		currentStep: "Current JourneyStep",
		choose: "Make a choice",
		structure: "Structure editor",
		validation: "Valid structure · DAG check passed",
		versions: "Versions",
		diff: "Field diff",
		locked: "This field is locked within the active editing scope",
		relationship: "Relationship type",
		subject: "Subject",
		blocks: "Block configuration",
		query: "Content query",
		preview: "Product preview",
		record: "Record",
	},
	ja: {
		identity: "書籍の同一性",
		variants: "main と variants",
		contents: "章構造",
		credits: "帰属関係",
		author: "著者",
		translator: "翻訳者",
		publisher: "出版社",
		entity: "Entity レコード",
		published: "公開済み",
		reader: "読者画面",
		authoring: "著者エディタ",
		journey: "現在の Journey",
		currentStep: "現在の JourneyStep",
		choose: "選択する",
		structure: "構造エディタ",
		validation: "有効な構造 · DAG 検証済み",
		versions: "バージョン",
		diff: "フィールド差分",
		locked: "このフィールドは現在の編集範囲でロック中です",
		relationship: "関係タイプ",
		subject: "対象",
		blocks: "ブロック設定",
		query: "コンテンツクエリ",
		preview: "プロダクトプレビュー",
		record: "レコード",
	},
	de: {
		identity: "Buchidentität",
		variants: "main und variants",
		contents: "Kapitelstruktur",
		credits: "Zuordnungen",
		author: "Autor",
		translator: "Übersetzer",
		publisher: "Verlag",
		entity: "Entity-Datensatz",
		published: "Veröffentlicht",
		reader: "Leseansicht",
		authoring: "Autoreneditor",
		journey: "Aktuelle Journey",
		currentStep: "Aktueller JourneyStep",
		choose: "Auswahl treffen",
		structure: "Struktur-Editor",
		validation: "Gültige Struktur · DAG-Prüfung bestanden",
		versions: "Versionen",
		diff: "Felddifferenz",
		locked: "Dieses Feld ist im aktiven Bearbeitungsbereich gesperrt",
		relationship: "Beziehungstyp",
		subject: "Gegenstand",
		blocks: "Blockkonfiguration",
		query: "Inhaltsabfrage",
		preview: "Produktvorschau",
		record: "Datensatz",
	},
	ko: {
		identity: "책 정체성",
		variants: "main과 variants",
		contents: "장 구조",
		credits: "귀속 관계",
		author: "저자",
		translator: "번역자",
		publisher: "출판사",
		entity: "Entity 레코드",
		published: "공개됨",
		reader: "독자 화면",
		authoring: "저작 편집기",
		journey: "현재 Journey",
		currentStep: "현재 JourneyStep",
		choose: "선택하기",
		structure: "구조 편집기",
		validation: "유효한 구조 · DAG 검사 통과",
		versions: "버전",
		diff: "필드 차이",
		locked: "이 필드는 현재 편집 범위에서 잠겨 있습니다",
		relationship: "관계 유형",
		subject: "주제 대상",
		blocks: "블록 설정",
		query: "콘텐츠 쿼리",
		preview: "제품 미리보기",
		record: "레코드",
	},
} as const;
export function ProductDemo({ kind, productName: name, locale, label, caption }: Props) {
	const copy = getSiteCopy(locale);
	const ui = DEMO_TEXT[locale];
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
						<aside className="demo-sidebar" aria-label="Book sections">
							<p className="demo-sidebar__title">Book</p>
							<div className="demo-nav">
								<span className="is-active">{ui.identity}</span>
								<span>{ui.variants}</span>
								<span>{ui.contents}</span>
								<span>History</span>
							</div>
						</aside>
						<div className="demo-main">
							<div className="demo-toolbar">
								<span className="demo-toolbar__path">Book / main</span>
								<span className="demo-status">{ui.published}</span>
							</div>
							<h2 className="demo-title">Book title</h2>
							<p className="demo-muted">
								main · variant: translation-edition · Unit / Book
							</p>
							<div className="demo-grid">
								<section className="demo-panel">
									<h3>{ui.contents} · ContentStructure</h3>
									<ol className="demo-list">
										<li>
											<strong>01 · Chapter title</strong>
											<span>Post A</span>
										</li>
										<li>
											<strong>02 · Chapter title</strong>
											<span>Post B</span>
										</li>
										<li>
											<strong>03 · Reused interlude</strong>
											<span>Post A</span>
										</li>
									</ol>
								</section>
								<section className="demo-panel">
									<h3>{ui.credits} · CreditAttribution</h3>
									<ul className="demo-list">
										<li>
											<strong>{ui.author}</strong>
											<span>{ui.entity}</span>
										</li>
										<li>
											<strong>{ui.translator}</strong>
											<span>{ui.entity}</span>
										</li>
										<li>
											<strong>{ui.publisher}</strong>
											<span>{ui.entity}</span>
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
							<span className="demo-toolbar__path">Book / GameContentStructure</span>
							<span className="demo-status">GameBook</span>
						</div>
						<div className="demo-grid">
							<section className="demo-panel">
								<h3>{ui.reader}</h3>
								<p className="demo-muted">
									{ui.journey} · <span data-journey-step>Entrance</span>
								</p>
								<h2 className="demo-title" data-choice-outcome>
									Passage: Archive entrance
								</h2>
								<p className="demo-muted">
									The reader reaches a documented branch. The selected path is
									recorded as JourneyStep, separate from general Progress.
								</p>
								<div className="choice-list" aria-label={ui.choose}>
									<button
										className="choice-button"
										type="button"
										data-choice
										data-outcome="Passage: Reading room"
										data-step="Choice A → Reading room"
										aria-pressed="false"
									>
										Choice A · Continue to the reading room
									</button>
									<button
										className="choice-button"
										type="button"
										data-choice
										data-outcome="Ending: Return later"
										data-step="Choice B → Ending"
										aria-pressed="false"
									>
										Choice B · Leave the archive
									</button>
								</div>
							</section>
							<section className="demo-panel">
								<h3>
									{ui.authoring} · {ui.validation}
								</h3>
								<div
									className="game-editor"
									aria-label="GameContentStructure authoring sequence"
								>
									<div className="game-node">
										<strong>Entrance</strong>
										<span>entry</span>
									</div>
									<div className="game-node is-passage">
										<strong>Passage</strong>
										<span>choices: 2</span>
									</div>
									<div className="game-node">
										<strong>Ending</strong>
										<span>retirable</span>
									</div>
								</div>
								<p className="demo-muted">
									Entrance → Passage → Ending · no loops, scripts, variables,
									combat, or runtime rules.
								</p>
							</section>
						</div>
					</div>
				)}

				{kind === "structure" && (
					<div className="demo-main">
						<div className="demo-toolbar">
							<span className="demo-toolbar__path">
								Content Structure / Book adapter
							</span>
							<span className="demo-status">{ui.validation}</span>
						</div>
						<div role="tablist" className="tab-list" aria-label={ui.structure}>
							<button
								className="tab-button"
								type="button"
								role="tab"
								aria-selected="true"
								aria-controls={panelId("tree")}
							>
								{copy.product.structureTree}
							</button>
							<button
								className="tab-button"
								type="button"
								role="tab"
								aria-selected="false"
								tabIndex={-1}
								aria-controls={panelId("game")}
							>
								{copy.product.structureGame}
							</button>
						</div>
						<section
							id={panelId("tree")}
							role="tabpanel"
							aria-label={copy.product.structureTree}
						>
							<div className="demo-grid">
								<div className="demo-panel">
									<h3>ContentStructure · ordered tree</h3>
									<div className="demo-tree">
										<div className="demo-tree__row is-selected" data-depth="0">
											Book root
										</div>
										<div className="demo-tree__row" data-depth="1">
											Part I · occurrence
										</div>
										<div className="demo-tree__row" data-depth="2">
											Post A · occurrence 01
										</div>
										<div className="demo-tree__row" data-depth="2">
											Post B · occurrence 02
										</div>
										<div className="demo-tree__row" data-depth="1">
											Post A · reused occurrence 03
										</div>
									</div>
								</div>
								<div className="demo-panel">
									<h3>Book reader result</h3>
									<ol className="demo-list">
										<li>
											<strong>Part I</strong>
											<span>section</span>
										</li>
										<li>
											<strong>Chapter 01</strong>
											<span>Post A</span>
										</li>
										<li>
											<strong>Chapter 02</strong>
											<span>Post B</span>
										</li>
									</ol>
								</div>
							</div>
						</section>
						<section
							id={panelId("game")}
							role="tabpanel"
							aria-label={copy.product.structureGame}
							hidden
						>
							<div className="demo-grid">
								<div className="demo-panel">
									<h3>GameContentStructure · optional graph layer</h3>
									<div className="game-editor">
										<div className="game-node">
											<strong>Entrance</strong>
											<span>entry</span>
										</div>
										<div className="game-node is-passage">
											<strong>Passage</strong>
											<span>Choice A / B</span>
										</div>
										<div className="game-node">
											<strong>Ending</strong>
											<span>terminal</span>
										</div>
									</div>
								</div>
								<div className="demo-panel">
									<h3>GameBook reader result</h3>
									<ul className="demo-list">
										<li>
											<strong>Current Passage</strong>
											<span>stable id</span>
										</li>
										<li>
											<strong>Available choices</strong>
											<span>2</span>
										</li>
										<li>
											<strong>JourneyStep</strong>
											<span>separate</span>
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
							<p className="demo-sidebar__title">{ui.versions}</p>
							<div
								className="demo-nav"
								role="tablist"
								aria-label={copy.product.publishedVersions}
							>
								<button
									className="tab-button is-active"
									type="button"
									role="tab"
									aria-selected="true"
									aria-controls={panelId("history-title")}
								>
									Book.title
								</button>
								<button
									className="tab-button"
									type="button"
									role="tab"
									aria-selected="false"
									tabIndex={-1}
									aria-controls={panelId("history-post")}
								>
									Post.block
								</button>
								<button
									className="tab-button"
									type="button"
									role="tab"
									aria-selected="false"
									tabIndex={-1}
									aria-controls={panelId("history-zone")}
								>
									Zone.config
								</button>
							</div>
						</aside>
						<div className="demo-main">
							<div className="demo-toolbar">
								<span className="demo-toolbar__path">
									{copy.product.fieldHistory} / {copy.product.publishedVersions}
								</span>
								<span className="demo-status">History</span>
							</div>
							<section id={panelId("history-title")} role="tabpanel">
								<div className="demo-grid">
									<div className="demo-panel">
										<h3>{copy.product.publishedVersions}</h3>
										<ul className="demo-list">
											<li>
												<strong>Published version C</strong>
												<span>current</span>
											</li>
											<li>
												<strong>Published version B</strong>
												<span>previous</span>
											</li>
											<li>
												<strong>Published version A</strong>
												<span>initial</span>
											</li>
										</ul>
									</div>
									<div className="demo-panel">
										<h3>{ui.diff} · Book.title</h3>
										<div className="diff-line">
											<span>−</span>
											<span>Previous title</span>
										</div>
										<div className="diff-line is-change">
											<span>+</span>
											<span>Current published title</span>
										</div>
										<div className="lock-banner">
											<span>{ui.locked}</span>
											<strong>Book.title</strong>
										</div>
									</div>
								</div>
							</section>
							<section id={panelId("history-post")} role="tabpanel" hidden>
								<div className="demo-panel">
									<h3>Post block history</h3>
									<div className="diff-line">
										<span>−</span>
										<span>paragraph.block / published B</span>
									</div>
									<div className="diff-line is-change">
										<span>+</span>
										<span>paragraph.block / published C</span>
									</div>
								</div>
							</section>
							<section id={panelId("history-zone")} role="tabpanel" hidden>
								<div className="demo-panel">
									<h3>Zone configuration history</h3>
									<div className="diff-line">
										<span>−</span>
										<span>feed.query / published A</span>
									</div>
									<div className="diff-line is-change">
										<span>+</span>
										<span>feed.query / published B</span>
									</div>
								</div>
							</section>
						</div>
					</div>
				)}

				{kind === "attribution" && (
					<div className="demo-main">
						<div className="demo-toolbar">
							<span className="demo-toolbar__path">Book / Entity / Attribution</span>
							<span className="demo-status">{copy.status.implemented}</span>
						</div>
						<div role="tablist" className="tab-list" aria-label="Attribution modes">
							<button
								className="tab-button"
								type="button"
								role="tab"
								aria-selected="true"
								aria-controls={panelId("credit")}
							>
								{copy.product.credit}
							</button>
							<button
								className="tab-button"
								type="button"
								role="tab"
								aria-selected="false"
								tabIndex={-1}
								aria-controls={panelId("subject")}
							>
								{copy.product.subject}
							</button>
						</div>
						<section id={panelId("credit")} role="tabpanel">
							<div className="demo-grid">
								<div className="demo-panel">
									<h3>Book credits</h3>
									<table className="demo-table">
										<thead>
											<tr>
												<th>{ui.relationship}</th>
												<th>Entity</th>
												<th>Unit</th>
											</tr>
										</thead>
										<tbody>
											<tr>
												<td>
													<strong>{ui.author}</strong>
												</td>
												<td>Entity / person</td>
												<td>Book</td>
											</tr>
											<tr>
												<td>
													<strong>{ui.translator}</strong>
												</td>
												<td>Entity / person</td>
												<td>Book variant</td>
											</tr>
											<tr>
												<td>
													<strong>{ui.publisher}</strong>
												</td>
												<td>Entity / organization</td>
												<td>Release</td>
											</tr>
										</tbody>
									</table>
								</div>
								<aside className="demo-panel">
									<h3>Entity detail</h3>
									<ul className="demo-list">
										<li>
											<strong>Entity type</strong>
											<span>real / fictional</span>
										</li>
										<li>
											<strong>{ui.record}</strong>
											<span>stable identity</span>
										</li>
										<li>
											<strong>Attributions</strong>
											<span>managed list</span>
										</li>
									</ul>
								</aside>
							</div>
						</section>
						<section id={panelId("subject")} role="tabpanel" hidden>
							<div className="demo-grid">
								<div className="demo-panel">
									<h3>Book subjects</h3>
									<table className="demo-table">
										<thead>
											<tr>
												<th>{ui.relationship}</th>
												<th>{ui.subject}</th>
												<th>Unit</th>
											</tr>
										</thead>
										<tbody>
											<tr>
												<td>
													<strong>Protagonist</strong>
												</td>
												<td>Character Entity</td>
												<td>Book</td>
											</tr>
											<tr>
												<td>
													<strong>Character</strong>
												</td>
												<td>Fictional Entity</td>
												<td>Book</td>
											</tr>
											<tr>
												<td>
													<strong>Derivative of</strong>
												</td>
												<td>Entity / Unit relation</td>
												<td>Post</td>
											</tr>
										</tbody>
									</table>
								</div>
								<aside className="demo-panel">
									<h3>Relationship editor</h3>
									<ul className="demo-list">
										<li>
											<strong>Type</strong>
											<span>Protagonist</span>
										</li>
										<li>
											<strong>Subject</strong>
											<span>Character Entity</span>
										</li>
										<li>
											<strong>Target Unit</strong>
											<span>Book</span>
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
							<p className="demo-sidebar__title">Zone</p>
							<div className="demo-nav">
								<span className="is-active">{ui.blocks}</span>
								<span>{ui.query}</span>
								<span>History</span>
								<span>Preview</span>
							</div>
						</aside>
						<div className="demo-main">
							<div className="demo-toolbar">
								<span className="demo-toolbar__path">Zone / configuration</span>
								<span className="demo-status">Block Schema</span>
							</div>
							<div className="demo-grid">
								<section className="demo-panel">
									<h3>{ui.blocks}</h3>
									<div className="demo-tree">
										<div className="demo-tree__row is-selected">
											Header block
										</div>
										<div className="demo-tree__row">
											Feed block · query: recent
										</div>
										<div className="demo-tree__row">
											Shelf block · reference
										</div>
									</div>
								</section>
								<section className="demo-panel">
									<h3>{ui.preview}</h3>
									<ul className="demo-list">
										<li>
											<strong>Feed result</strong>
											<span>Post card</span>
										</li>
										<li>
											<strong>Catalog result</strong>
											<span>Book card</span>
										</li>
										<li>
											<strong>Discussion</strong>
											<span>Comment</span>
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
							<span className="demo-toolbar__path">Feed / consumers</span>
							<span className="demo-status">Feed</span>
						</div>
						<div
							role="tablist"
							className="tab-list"
							aria-label={copy.product.consumers}
						>
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
												<strong>Post card</strong>
												<span>kind-aware</span>
											</li>
											<li>
												<strong>Book card</strong>
												<span>catalog</span>
											</li>
											<li>
												<strong>Comment card</strong>
												<span>discussion</span>
											</li>
										</ul>
									</div>
									<div className="demo-panel">
										<h3>Consumer configuration</h3>
										<ul className="demo-list">
											<li>
												<strong>Query</strong>
												<span>consumer scope</span>
											</li>
											<li>
												<strong>Card</strong>
												<span>per feature</span>
											</li>
											<li>
												<strong>Order</strong>
												<span>feed order</span>
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
							<span className="demo-toolbar__path">Catalog / Unit types</span>
							<span className="demo-status">Catalog</span>
						</div>
						<h2 className="demo-title">Catalog identity</h2>
						<p className="demo-muted">
							No Work abstraction: each catalog Unit keeps its own identity and main /
							variants relationship.
						</p>
						<div className="demo-grid">
							<section className="demo-panel">
								<h3>Unit types</h3>
								<ul className="demo-list">
									<li>
										<strong>Book</strong>
										<span>main + variants</span>
									</li>
									<li>
										<strong>Media</strong>
										<span>main + variants</span>
									</li>
									<li>
										<strong>Software</strong>
										<span>main + variants</span>
									</li>
									<li>
										<strong>Series</strong>
										<span>composition</span>
									</li>
								</ul>
							</section>
							<section className="demo-panel">
								<h3>Selected identity</h3>
								<ul className="demo-list">
									<li>
										<strong>Canonical Unit</strong>
										<span>stable id</span>
									</li>
									<li>
										<strong>Release</strong>
										<span>edition context</span>
									</li>
									<li>
										<strong>Attribution</strong>
										<span>Entity relations</span>
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
								<span className="is-active">Document</span>
								<span>Blocks</span>
								<span>History</span>
							</div>
						</aside>
						<div className="demo-main">
							<div className="demo-toolbar">
								<span className="demo-toolbar__path">Editor / {name}</span>
								<span className="demo-status">Draft boundary</span>
							</div>
							<h2 className="demo-title">Content title</h2>
							<div className="demo-panel" style={{ marginTop: "1.5rem" }}>
								<p className="demo-muted">Paragraph block</p>
								<p style={{ margin: "0.8rem 0 0", lineHeight: 1.75 }}>
									Structured content stays editable here. Published changes enter
									History only at the publication boundary.
								</p>
							</div>
						</div>
					</div>
				)}

				{kind === "progress" && (
					<div className="demo-main">
						<div className="demo-toolbar">
							<span className="demo-toolbar__path">Progress / Book</span>
							<span className="demo-status">General progress</span>
						</div>
						<div className="demo-grid">
							<section className="demo-panel">
								<h3>Reading position</h3>
								<ul className="demo-list">
									<li>
										<strong>Unit</strong>
										<span>Book</span>
									</li>
									<li>
										<strong>Occurrence</strong>
										<span>Chapter</span>
									</li>
									<li>
										<strong>Position</strong>
										<span>reader state</span>
									</li>
								</ul>
							</section>
							<section className="demo-panel">
								<h3>GameBook boundary</h3>
								<ul className="demo-list">
									<li>
										<strong>Progress</strong>
										<span>general summary</span>
									</li>
									<li>
										<strong>Journey</strong>
										<span>GameBook-owned</span>
									</li>
									<li>
										<strong>JourneyStep</strong>
										<span>path history</span>
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
								<span className="is-active">{ui.record}</span>
								<span>Relations</span>
								<span>History</span>
							</div>
						</aside>
						<div className="demo-main">
							<div className="demo-toolbar">
								<span className="demo-toolbar__path">
									{name} / {ui.record}
								</span>
								<span className="demo-status">{copy.common.conceptPreview}</span>
							</div>
							<h2 className="demo-title">{name}</h2>
							<p className="demo-muted">
								A neutral, replaceable product surface. It contains no decorative
								artwork or invented usage metrics.
							</p>
							<div className="demo-grid">
								<section className="demo-panel">
									<h3>Identity</h3>
									<ul className="demo-list">
										<li>
											<strong>Stable record</strong>
											<span>Unit</span>
										</li>
										<li>
											<strong>Related products</strong>
											<span>references</span>
										</li>
										<li>
											<strong>Published state</strong>
											<span>History</span>
										</li>
									</ul>
								</section>
								<section className="demo-panel">
									<h3>Shared capabilities</h3>
									<ul className="demo-list">
										<li>
											<strong>Attribution</strong>
											<span>Entity</span>
										</li>
										<li>
											<strong>Tags</strong>
											<span>queryable</span>
										</li>
										<li>
											<strong>API</strong>
											<span>permissioned</span>
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
