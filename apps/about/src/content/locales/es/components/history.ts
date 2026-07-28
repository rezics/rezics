import { esTerminology } from "@rezics/i18n/terminology/es";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	versions: "Versiones",
	publishedVersions: "Versiones publicadas",
	fieldHistory: "Historial del campo",
	diff: "Diferencias del campo",
	locked: "Este campo está bloqueado dentro del contexto de edición activo",
	bookTitle: String(verbatimTerms.bookTitleField.value),
	postBlock: String(verbatimTerms.postBlockField.value),
	zoneConfig: String(verbatimTerms.zoneConfigField.value),
	publishedVersionC: "Versión publicada C",
	publishedVersionB: "Versión publicada B",
	publishedVersionA: "Versión publicada A",
	current: "actual",
	previous: "anterior",
	initial: "inicial",
	previousTitle: "Título anterior",
	currentTitle: "Título publicado actual",
	postBlockHistory: `Historial de bloques de ${esTerminology.post.forms.label}`,
	previousPostBlock: `${verbatimTerms.paragraphBlockField.value} / publicado B`,
	currentPostBlock: `${verbatimTerms.paragraphBlockField.value} / publicado C`,
	zoneConfigurationHistory: `Historial de configuración de ${esTerminology.zone.forms.label}`,
	previousZoneQuery: `${verbatimTerms.feedQueryField.value} / publicado A`,
	currentZoneQuery: `${verbatimTerms.feedQueryField.value} / publicado B`,
} satisfies typeof import("../../en/components/history").default;

export default content;
