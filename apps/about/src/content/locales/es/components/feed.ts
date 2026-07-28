import { esTerminology } from "@rezics/i18n/terminology/es";

const content = {
	consumers: "Productos que usan esta capacidad",
	zone: esTerminology.zone.forms.label,
	realm: esTerminology.realm.forms.label,
	home: "Inicio",
	zoneFeed: `Flujo de ${esTerminology.zone.forms.label}`,
	realmFeed: `Flujo de ${esTerminology.realm.forms.label}`,
	homeFeed: "Flujo de inicio",
	postCard: `Tarjeta de ${esTerminology.post.forms.label}`,
	bookCard: "Tarjeta de libro",
	commentCard: "Tarjeta de comentario",
	kindAware: "adaptado al tipo",
	catalog: "catálogo",
	discussion: "conversación",
	consumerConfiguration: "Configuración del consumidor",
	query: "Consulta",
	consumerScope: "alcance del consumidor",
	card: "Tarjeta",
	perFeature: "por función",
	order: "Orden",
	feedOrder: "orden del flujo",
} satisfies typeof import("../../en/components/feed").default;

export default content;
