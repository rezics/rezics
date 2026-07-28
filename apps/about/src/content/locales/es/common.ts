import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	siteName: String(verbatimTerms.rezics.value),
	nav: {
		products: "Productos",
		platform: "Plataforma",
		history: "Historial",
		docs: "Documentación",
		github: String(verbatimTerms.github.value),
		language: "Idioma",
		theme: "Tema",
		openMenu: "Abrir menú",
		closeMenu: "Cerrar menú",
	},
	theme: {
		light: "Claro",
		dark: "Oscuro",
		toggle: "Cambiar el tema de color",
	},
	status: {
		implemented: "Implementado",
		documented: "Diseño documentado",
		planned: "Planificado",
		research: "Investigación",
	},
	classes: {
		surface: "Superficie de producto",
		capability: "Capacidad compartida",
		manifestation: "Manifestación de producto",
		protocol: "Protocolo interno",
	},
	labels: {
		conceptPreview: "Vista previa conceptual",
		conceptCaption:
			"Una representación sustituible del producto implementada en código, que más adelante puede reemplazarse por una captura real del mismo tamaño.",
		viewProduct: "Ver producto",
		viewAll: "Ver todo",
		learnMore: "Más información",
		documentation: `Documentación de ${verbatimTerms.outline.value}`,
		sourceCode: "Código fuente",
		relatedProducts: "Productos relacionados",
		usedCapabilities: "Capacidades compartidas utilizadas",
		noParent: "Producto independiente sin producto portador superior",
		parentProduct: "Producto superior",
		sourceBasis: "Fuentes de los datos",
	},
	footer: {
		statement: `${verbatimTerms.rezics.value} es un sistema de productos abierto construido en torno a la identidad, la estructura y el historial del contenido.`,
		productLinks: "Productos",
		platformLinks: "Plataforma",
		openLinks: "Abierto",
		implementation: `${verbatimTerms.agpl30.value} · Sitio estático creado con ${verbatimTerms.vike.value} y ${verbatimTerms.react.value}`,
	},
	notFound: {
		title: "Página no encontrada",
		body: "Es posible que este enlace haya cambiado o que no corresponda a una página pública de producto.",
		back: "Volver al inicio",
	},
	a11y: {
		home: `Inicio de ${verbatimTerms.rezics.value}`,
		skipContent: "Saltar al contenido principal",
		primaryNavigation: "Navegación principal",
		mobileNavigation: "Navegación móvil",
		breadcrumb: "Ruta de navegación",
		modes: "Modos",
	},
} satisfies typeof import("../en/common").default;

export default content;
