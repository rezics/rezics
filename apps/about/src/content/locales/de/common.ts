const content = {
	nav: {
		products: "Produkte",
		platform: "Plattform",
		history: "History",
		docs: "Dokumentation",
		github: "GitHub",
		language: "Sprache",
		theme: "Darstellung",
		openMenu: "Menü öffnen",
		closeMenu: "Menü schließen",
	},
	theme: {
		light: "Hell",
		dark: "Dunkel",
		toggle: "Farbschema wechseln",
	},
	status: {
		implemented: "Implementiert",
		documented: "Design bestätigt",
		planned: "Geplant",
		research: "In Prüfung",
	},
	classes: {
		surface: "Produktoberfläche",
		capability: "Geteilte Fähigkeit",
		manifestation: "Produktform",
		protocol: "Internes Protokoll",
	},
	labels: {
		conceptPreview: "Konzeptvorschau",
		conceptCaption:
			"Eine austauschbare, im Code erstellte Produktansicht für spätere echte Screenshots gleicher Größe.",
		viewProduct: "Produkt ansehen",
		viewAll: "Alle ansehen",
		learnMore: "Mehr erfahren",
		documentation: "Outline-Dokumentation",
		sourceCode: "Quellcode",
		relatedProducts: "Verwandte Produkte",
		usedCapabilities: "Genutzte Plattformfähigkeiten",
		noParent: "Eigenständiges Produkt ohne übergeordnetes Trägerprodukt",
		parentProduct: "Übergeordnetes Produkt",
		sourceBasis: "Faktenquellen",
	},
	footer: {
		statement:
			"Rezics ist ein offenes Produktsystem für Identität, Struktur und Verlauf von Inhalten.",
		productLinks: "Produkte",
		platformLinks: "Plattform",
		openLinks: "Offen",
	},
	notFound: {
		title: "Seite nicht gefunden",
		body: "Der Link wurde möglicherweise verschoben oder ist noch nicht öffentlich.",
		back: "Zur Startseite",
	},
	a11y: {
		skipContent: "Zum Hauptinhalt",
		primaryNavigation: "Hauptnavigation",
		mobileNavigation: "Mobile Navigation",
		breadcrumb: "Brotkrümelnavigation",
		modes: "Funktionsmodi",
	},
} satisfies typeof import("../en/common").default;

export default content;
