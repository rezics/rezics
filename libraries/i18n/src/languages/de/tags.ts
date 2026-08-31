import { insert } from "native-i18n";

import { deTerminology } from "@rezics/i18n/terminology/de";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const { forms: realmTerms } = deTerminology.realm;
const { forms: followTerms } = deTerminology.follow;
const { forms: postTerms } = deTerminology.post;
const { forms: tagPathTerms } = deTerminology.tagPath;

export default {
	page: {
		title: "Tags",
		description:
			"Prüfe globale Tags und die kontextbezogenen Bewertungen der von dir ausgewählten Tag-Quellen.",
		viewAll: "Vollständige Tag-Seite anzeigen",
		more: insert("{{count}} weitere", { count: Number }),
		manageOnTagPage: `Füge Tags und ${tagPathTerms.pluralLabel} auf der eigenen Tag-Seite hinzu, damit der Abstimmungskontext sichtbar bleibt.`,
	},
	card: {
		open: insert("Tag-Karte für {{tag}} öffnen ({{context}})", {
			tag: String,
			context: String,
		}),
		close: "Tag-Karte schließen",
		globalContext: "Globaler Kontext",
		pathContext: tagPathTerms.label,
		policy: `Vom ${realmTerms.inline} festgelegt`,
		search: "Diesen Tag durchsuchen",
		details: "Tag-Details anzeigen",
	},
	selection: {
		start: "Mehrere auswählen",
		finish: "Auswahl abschließen",
		add: "Zur Auswahl hinzufügen",
		remove: "Aus Auswahl entfernen",
		addNamed: insert("{{tag}} auswählen", { tag: String }),
		removeNamed: insert("Auswahl von {{tag}} aufheben", { tag: String }),
		selectedCount: insert("{{count}} Tags ausgewählt", { count: Number }),
		search: "Ausgewählte Tags durchsuchen",
		clear: "Auswahl aufheben",
	},
	basic: {
		title: "Einfache Tags",
		description: `Globale Tags und ${tagPathTerms.pluralLabel} ohne kontextbezogene Bewertungen eines ${realmTerms.inline}s.`,
	},
	voteContext: {
		title: "Nach Kontext abstimmen",
		description: `Wähle „Global“ oder einen ${realmTerms.label}, in dem du mitwirken darfst. Liste, Wertungen und deine Stimmen verwenden diesen Kontext.`,
		select: "Abstimmungskontext auswählen",
	},
	details: {
		title: "Weitere Tag-Kontexte",
		description: `Globale Tags und deine ausgewählten ${realmTerms.label}-Quellen behalten ihren eigenen Kontext. Der aktive Abstimmungskontext wird hier nicht wiederholt.`,
		empty: "Keine weiteren Tag-Quellen ausgewählt.",
	},
	paths: {
		title: tagPathTerms.pluralLabel,
		description: `${tagPathTerms.pluralLabel} bewahren die Vokabularstruktur; die angewendete Bedeutung wird durch einen eindeutigen Pfadsinn bestimmt.`,
		addTitle: `${tagPathTerms.label} hinzufügen`,
		addDescription: `Suche nach eindeutigen Tag-Bedeutungen und Pfadsinnen. Ein Pfadsinn wendet nicht jeden Tag seines Pfades an.`,
		add: `${tagPathTerms.label} hinzufügen`,
		create: `${tagPathTerms.label} erstellen`,
		details: `${tagPathTerms.label} anzeigen`,
		empty: `Für dieses Werk gibt es noch keine angenommenen ${tagPathTerms.plural}.`,
		memberFallback: "Tag ohne Namen",
		pathLabel: `Geordneter ${tagPathTerms.label}`,
		fitLabel: "Passgenauigkeit",
		spoilerLabel: "Spoilergrad",
		spoilerNone: "Keine",
		spoilerMinor: "Leicht",
		spoilerMajor: "Erheblich",
		spoilerSummary: insert("Stimmen: {{none}} keine · {{minor}} leicht · {{major}} erheblich", {
			none: Number,
			minor: Number,
			major: Number,
		}),
	},
	expressions: {
		title: "Angewendete Tag-Bedeutungen",
		description:
			"Dieselbe Bedeutung innerhalb einer Zuständigkeit wird zusammengefasst; jede direkte oder pfadbasierte Quelle bleibt einzeln einsehbar.",
		empty: "Noch keine Tag-Bedeutung angewendet.",
		partial: "Diese Karte enthält weitere Tag-Bedeutungen.",
		open: insert("Karte zur Tag-Bedeutung {{expression}} öffnen ({{authority}})", {
			expression: String,
			authority: String,
		}),
		close: "Karte zur Tag-Bedeutung schließen",
		applicationsTitle: "Anwendungen auf diesen Inhalt",
		applicationCount: insert("{{count}} Anwendungsquellen", { count: Number }),
		directApplication: "Direkte Anwendung",
		pathApplication: "Anwendung eines Pfadsinns",
		sourceDate: insert("Erstellt am {{date}}", { date: String }),
		sourceContributor: "Mitwirkende Person ansehen",
		removeApplication: "Diese Pfadanwendung entfernen",
		showCompletePath: "Vollständigen Pfad anzeigen",
		otherPositionsTitle: "Andere Positionen dieses Tags",
		otherPositionsDescription:
			"Diese Positionen gehören zur Vokabularstruktur, sind aber nicht auf diesen Inhalt angewendet.",
		authoritySection: insert("Tag-Bedeutungen von {{authority}}", { authority: String }),
		relationFallback: "Beziehung",
		relations: {
			generic: "Art",
			partitive: "Teil",
			instance: "Instanz",
			organizational: "Organisation",
			facet_value: "Facettenwert",
		},
	},
	searchMatches: {
		matched: "Treffer durch:",
		why: "Warum dieses Ergebnis passt",
		evidence: {
			direct: "Direkte Tag-Zuweisung",
			primary: "Angewandte Tag-Bedeutung",
			entailed: "Semantische Folgerung",
			retrieval_only: "Sucherweiterung",
		},
		otherPositions: "Weitere Positionen im Vokabular sind verfügbar",
	},
	semantics: {
		structureTitle: "Vokabularstruktur",
		structureDescription:
			"Dieser Pfad erfasst nur eine Vokabularposition und typisierte Beziehungen. Er schreibt einem Inhalt nicht automatisch jedes Element zu.",
		sensesTitle: "Pfadbedeutungen",
		sensesDescription:
			"Jede Bedeutung bindet Pfadelemente an einen vollständigen Tag-Ausdruck, der auf Inhalte angewendet werden kann.",
		noSenses: "Für diesen Pfad ist noch keine anwendbare Bedeutung definiert.",
		expressionKind: "Ausdruckstyp",
		expressionKinds: {
			simple: "Einzelbegriff",
			facet_value: "Facette und Wert",
			relation: "Beziehung und Objekt",
		},
		focus: "Zentraler Begriff",
		value: "Wert",
		slot: "Facette",
		predicate: "Beziehung",
		scope: "Geltungsbereich",
		globalScope: "Global",
		realmScope: realmTerms.label,
		status: "Status",
		statuses: { active: "Aktiv", retired: "Stillgelegt" },
		labelSignature: "Bestandteile der eigenständigen Bezeichnung",
		bindingsTitle: "Bindungen von Elementen an Rollen",
		roles: {
			predicate: "Beziehung",
			slot: "Facette",
			value: "Wert",
			focus: "Fokus",
			qualifier: "Qualifikator",
		},
		inferenceRulesTitle: "Explizite Inferenzregeln",
		noInferenceRules: "Dieser Ausdruck hat keine zusätzlichen Inferenzregeln.",
		inferenceKind: "Regeltyp",
		inferenceKinds: { entailed: "Semantische Folgerung", retrieval_only: "Nur Suche" },
		inferenceTarget: "Regelziel",
		targetTag: "Ziel-Tag",
		targetExpression: "Zielausdruck",
		ruleRevision: insert("Revision {{revision}}", { revision: Number }),
		provenance: "Herkunftsnachweis",
		curationTitle: "Semantische Kuratierung",
		curationDescription:
			"Erstelle unveränderliche semantische Bindungen und ergänze Inferenzen nur durch explizite, verwaltete Regeln.",
		createSense: "Pfadbedeutung erstellen",
		createSenseAction: "Bedeutung erstellen",
		sense: "Ausgangsbedeutung",
		addInference: "Inferenzregel hinzufügen",
		expressionId: `Ausdrucks-${verbatimTerms.id.value}`,
		expressionIdPlaceholder: `Unveränderliche ${verbatimTerms.id.value} des Zielausdrucks eingeben`,
		addInferenceAction: "Regel hinzufügen",
		lifecycleTitle: "Definitionen stilllegen",
		lifecycleDescription:
			"Die Stilllegung bewahrt den Verlauf bestehender Anwendungen. Eine stillgelegte Bedeutung kann nicht erneut angewendet werden; eine stillgelegte Regel trägt nicht mehr zu neu aufgebauten Inferenzergebnissen bei.",
		retireSenseAction: "Bedeutung stilllegen",
		retireSenseConfirm:
			"Diese Bedeutung stilllegen? Bestehende Anwendungen behalten ihren Verlauf, aber neue Anwendungen können sie nicht verwenden.",
		retireInferenceAction: "Regel stilllegen",
		retireInferenceConfirm:
			"Diese Regel stilllegen? Sie trägt nicht mehr zu neu aufgebauten Inferenz- und Suchergebnissen bei.",
		directMeaningTitle: "Direkte Tag-Bedeutung",
		directMeaningDescription:
			"Direkte Anwendungen dieses Tags verwenden diesen Einzelbegriff-Ausdruck.",
		qualifiedTitle: "Qualifizierte Ausdrücke",
		qualifiedDescription:
			"Diese Ausdrücke verwenden den Begriff als Facettenwert, Beziehung oder Qualifikator.",
		noQualified: "Noch kein qualifizierter Ausdruck verwendet diesen Begriff.",
		positionsTitle: "Alle Vokabularpositionen",
		positionsDescription:
			"Dies sind die Positionen des Begriffs in der globalen Vokabularstruktur; sie bedeuten nicht, dass Inhalte sie übernommen haben.",
		noPositions: "Dieser Begriff erscheint noch in keinem akzeptierten Pfad.",
		inferredReachTitle: "Inferenzreichweite",
		inferredReachDescription:
			"Diese Ausdrücke erreichen den Begriff über eine explizite Folgerungs- oder Sucherweiterungsregel.",
		noInferredReach: "Derzeit folgert oder erweitert kein Ausdruck auf diesen Begriff.",
		directUsagesTitle: "Direkte Anwendungen",
		directUsagesDescription:
			"Hier erscheinen nur Inhalte mit einer direkten Anwendung dieses Einzelbegriffs.",
		semanticReachTitle: "Semantische und Suchreichweite",
		semanticReachDescription:
			"Hier erscheinen Inhalte, die über einen primären Ausdruck, eine semantische Folgerung oder eine Sucherweiterung verbunden sind.",
	},
	detail: {
		sections: "Registerkarten der Tag-Details",
		tabs: {
			overview: "Übersicht",
			discussion: "Diskussion",
			content: "Verwandte Inhalte",
			paths: "Hierarchie",
		},
		overviewTitle: "Tag-Beschreibung",
		overviewDescription:
			"Lies die vollständige Erklärung dieses Tags. Die Zusammenfassung bleibt auf Karten und in Vorschauen sichtbar.",
		bodyEmpty: "Dieser Tag hat noch keine ausführliche Beschreibung.",
		discussionTitle: "Diskussion",
		discussionDescription: `Erstelle ${postTerms.pluralLabel} zu diesem Tag und beteilige dich an Diskussionen.`,
		contentTitle: "Verwandte Inhalte",
		contentDescription: "Durchsuche Werke und andere Inhalte, die diesen Tag verwenden.",
		pathsTitle: "Tag-Hierarchie",
		pathsDescription:
			"Sieh, wo dieser Tag in von der Community angenommenen Tag-Strukturen vorkommt.",
		editTitle: "Tag-Inhalt bearbeiten",
		editDescription:
			"Aktualisiere Titel, Zusammenfassung und Beschreibung in der aktuellen Inhaltssprache.",
		editNavigation: "Tag-Inhalte verwalten",
		backToTag: "Zurück zum Tag",
		backToEditOverview: "Zurück zur Bearbeitungsübersicht",
		childrenTitle: "Direkt untergeordnete Tags",
		childrenDescription: `Diese Beziehungen stammen aus angenommenen und von der Community gesperrten ${tagPathTerms.pluralLabel}. Für jedes untergeordnete Element werden seine direkten Unterelemente angezeigt.`,
		noChildren: "Dieser Tag hat noch keine angenommenen direkten Unterelemente.",
		grandchildrenTitle: "Direkte Unterelemente",
	},
	createPath: {
		title: `${tagPathTerms.label} erstellen`,
		description:
			"Erstelle einen geordneten Pfad von allgemeineren zu spezifischeren Tags. Definitionen sind nach der Erstellung unveränderlich; erstelle stattdessen einen neuen Pfad und reiche einen manuellen Governance-Vorschlag ein.",
		pick: "Nächsten Tag auswählen",
		addMember: "Zum Pfad hinzufügen",
		removeMember: "Aus dem Pfad entfernen",
		moveEarlier: "Nach vorne verschieben",
		moveLater: "Nach hinten verschieben",
		preview: "Vorschau des von der Community gesperrten Pfads",
		relationKind: "Beziehung zum vorherigen Knoten",
		minimum: "Füge mindestens zwei verschiedene Tags hinzu.",
		submit: `${tagPathTerms.label} erstellen und abstimmen`,
		relatedTitle: "Verwandte akzeptierte Pfade prüfen",
		relatedDescription:
			"Diese Pfade enden bereits beim selben Tag. Sie sind nicht automatisch Duplikate; prüfe ihre Bedeutung, bevor du eine eigenständige unveränderliche Definition erstellst.",
		continueDistinct: "Eigenständigen Pfad erstellen",
	},
	create: {
		noResults: insert("Kein Tag stimmt mit „{{query}}“ überein.", { query: String }),
		inStudio: insert(`„{{query}}“ in ${verbatimTerms.studio.value} erstellen`, {
			query: String,
		}),
		title: "Tag erstellen",
		description:
			"Erstelle nach der Prüfung bestehender Tags einen wiederverwendbaren globalen Tag.",
		voteDescription:
			"Nach dem Erstellen kehrst du zum Werk zurück und stimmst im aktuellen Kontext mit „Passt“.",
		backToUnitTags: "Zurück zu den Tags des Werks",
		backToStudioTags: `Zurück zu Tags in ${verbatimTerms.studio.value}`,
		submit: "Tag erstellen",
		submitAndVote: "Tag erstellen und mit „Passt“ stimmen",
		applying: "Tag erstellt. Deine Stimme wird erfasst…",
		partialTitle: "Tag erstellt, Stimme nicht erfasst",
		partialDescription:
			"Der Tag wurde erstellt, konnte aber nicht auf das Werk angewendet oder mit deiner Stimme versehen werden. Du kannst es sicher erneut versuchen, ohne einen weiteren Tag zu erstellen.",
		retryVote: "Abstimmung wiederholen",
		returnToUnitTags: "Zu den Tags des Werks",
		completed: "Der Tag wurde erstellt und deine Stimme „Passt“ wurde erfasst.",
	},
	global: {
		title: "Globaler Kontext",
		description:
			"Im globalen Kontext stammt die Erklärung eines Tags aus dem Tag-Eintrag selbst; alle Personen mit Interaktionszugriff können an der Bewertung mitwirken.",
		addTitle: "Globalen Tag hinzufügen",
		addDescription:
			"Suche zuerst nach vorhandenen Tags. Beim Hinzufügen wird zugleich mit „Passt“ abgestimmt.",
		add: "Tag hinzufügen",
		pinned: "Fixiert",
		empty: "Dieses Werk hat noch keine globalen Tags.",
	},
	management: {
		title: "Tag-Kuratierung",
		addSectionTitle: "Tags hinzufügen",
		addSectionDescription:
			"Öffne die Tag-Seite, um Tags zu suchen und anzuwenden. Hinzufügen und Abstimmen erfordern keine Kuratierungsberechtigung.",
		addSectionAction: "Tags hinzufügen",
		description:
			"Wähle aus, welche globalen Tags zuerst erscheinen. Alle anderen bleiben nach der Community-Wertung sortiert.",
		featuredTitle: "Hervorgehobene Tags",
		featuredDescription:
			"Hervorgehobene Tags erscheinen in der festgelegten Reihenfolge zuerst. Ziehe sie oder nutze die Schaltflächen.",
		rankedTitle: "Nach Community sortierte Tags",
		rankedDescription:
			"Alle anderen globalen Tags werden weiterhin automatisch nach den Community-Stimmen sortiert.",
		feature: "Hervorheben",
		unfeature: "Hervorhebung aufheben",
		moveEarlier: "Nach vorne",
		moveLater: "Nach hinten",
		drag: insert("{{tag}} zum Sortieren ziehen", { tag: String }),
		instructions:
			"Drücke die Leertaste, um ein hervorgehobenes Tag aufzunehmen. Verschiebe es mit den Pfeiltasten und lege es mit der Leertaste ab.",
		pickedUp: insert("{{tag}} aufgenommen.", { tag: String }),
		over: insert("{{tag}} befindet sich über Position {{position}} von {{count}}.", {
			tag: String,
			position: Number,
			count: Number,
		}),
		cancelled: insert("Verschieben von {{tag}} abgebrochen.", { tag: String }),
		featuredAnnouncement: insert("{{tag}} wurde an Position {{position}} hervorgehoben.", {
			tag: String,
			position: Number,
		}),
		unfeaturedAnnouncement: insert("Hervorhebung von {{tag}} aufgehoben.", {
			tag: String,
		}),
		movedAnnouncement: insert("{{tag}} wurde an Position {{position}} verschoben.", {
			tag: String,
			position: Number,
		}),
		noFeatured: "Noch keine hervorgehobenen Tags.",
		noRanked: "Es gibt keine weiteren globalen Tags zum Hervorheben.",
	},
	realms: {
		pathsTitle: `${tagPathTerms.pluralLabel} im ${realmTerms.label}`,
		applyPath: "Pfad anwenden",
		authority: { realm: `Dieser ${realmTerms.label}`, global: "Global" },
		pathAuthority: insert("Eignung: {{fit}} · Spoiler: {{spoiler}}", {
			fit: String,
			spoiler: String,
		}),
		title: `${realmTerms.label}-Tag-Kontexte`,
		description: `Jeder ${realmTerms.inline} ist ein unabhängiger Kontext. Seine Bewertungen werden nie mit globalen Tags oder einem anderen ${realmTerms.inline} zusammengeführt.`,
		addTitle: `Tag-Stimme in diesem ${realmTerms.label} hinzufügen`,
		addDescription: `Suche zuerst nach vorhandenen Tags. Beim Hinzufügen wird in diesem ${realmTerms.inline} zugleich mit „Passt“ abgestimmt.`,
		add: "Stimme hinzufügen",
		policy: `Vom ${realmTerms.inline} festgelegte Tags`,
		votes: `Stimmen der Mitglieder des ${realmTerms.inline}s`,
		empty: "Die ausgewählten Tag-Quellen haben dieses Werk noch nicht bewertet.",
		cannotVote: `Tritt diesem ${realmTerms.inline} bei, um an seiner kontextbezogenen Abstimmung teilzunehmen.`,
	},
	vote: {
		fits: "Passt",
		doesNotFit: "Passt nicht",
		clear: "Meine Bewertung entfernen",
		signIn: "Zum Abstimmen anmelden",
		signInDescription: "Melde dich an, um im globalen Tag-Kontext abzustimmen.",
		summary: insert("Saldo {{score}} · {{count}} Stimmen", {
			score: String,
			count: String,
		}),
	},
	sources: {
		title: "Tag-Quellen",
		description: `Wähle und ordne die ${realmTerms.plural}, die in den Tag-Bereichen von Werken angezeigt werden. Dadurch wird für kein Werk „${followTerms.actionLabel}“ aktiviert und die Mitgliedschaft in einem ${realmTerms.inline} nicht geändert.`,
		addTitle: "Tag-Quelle hinzufügen",
		addDescription: `Suche lesbare ${realmTerms.plural} und füge einen zu deiner persönlichen Liste der Tag-Quellen hinzu.`,
		add: "Quelle hinzufügen",
		remove: "Quelle entfernen",
		moveEarlier: "Nach vorne verschieben",
		moveLater: "Nach hinten verschieben",
		empty: "Keine Tag-Quellen ausgewählt.",
		manage: "Tag-Quellen verwalten",
	},
	unnamedTag: "Tag ohne Namen",
	unnamedRealm: `${realmTerms.label} ohne Namen`,
	unnamedPath: `${tagPathTerms.label} ohne Namen`,
} satisfies typeof import("../zh-Hant/tags").default;
