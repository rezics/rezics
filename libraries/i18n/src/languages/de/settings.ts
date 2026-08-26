import { insert } from "native-i18n";

import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { deTerminology } from "@rezics/i18n/terminology/de";

const { forms: realmTerms } = deTerminology.realm;
const { forms: unitSlugTerms } = deTerminology.unitSlug;
const { forms: licenseTerms } = deTerminology.license;
const { forms: metadataTerms } = deTerminology.metadata;

export default {
	workspace: {
		title: "Einstellungen",
		description: `Verwalte dein Profil, Voreinstellungen, Tag-Quellen, Kontosicherheit und ${verbatimTerms.api.value}-Token.`,
		backToApplication: "Zurück zur Anwendung",
		backToOverview: "Zurück zu den Einstellungen",
		navigation: "Einstellungsnavigation",
		overview: "Alle Einstellungen",
		sections: {
			profile: {
				label: "Profil",
				description:
					"Aktualisiere deinen öffentlichen Namen, deine Vorstellung, Profilbild, Banner und Profiladresse.",
			},
			preferences: {
				label: "Voreinstellungen",
				description: `Wähle Oberflächen- und Inhaltssprachen, Einstufungen, einen standardmäßigen Bewertungs-${realmTerms.inline} und eine Standardlizenz.`,
			},
			privacy: {
				label: "Datenschutz",
				description: "Lege fest, ob andere deine Bewertungen und Fortschritte sehen können.",
			},
			tagSources: {
				label: "Tag-Quellen",
				description: `Wähle und ordne die ${realmTerms.plural}, deren Tag-Bewertungen du sehen möchtest.`,
			},
			account: {
				label: "Konto",
				description: "Prüfe Kontoinformationen und verwalte deine aktuelle Anmeldung.",
			},
			security: {
				label: "Sicherheit",
				description: "Ändere dein Passwort und verwalte angemeldete Geräte.",
			},
			tokens: {
				label: `${verbatimTerms.api.value}-Token`,
				description:
					"Erstelle, begrenze, deaktiviere und widerrufe Zugriffstoken für Automatisierungswerkzeuge.",
			},
		},
	},
	privacy: {
		title: "Datenschutz",
		description:
			"Lege die allgemeine Sichtbarkeitsgrenze für Bewertungen und den aktuellen Fortschritt fest.",
		scoreTitle: "Bewertungen",
		scoreDescription:
			"Begrenzt, ob andere deine Bewertungen im Profil oder in verknüpften Rezensionen sehen können.",
		progressTitle: "Fortschritt",
		progressDescription:
			"Begrenzt, ob andere deinen aktuellen Fortschritt im Profil oder in verknüpften Rezensionen sehen können.",
		categoryRule:
			"Diese allgemeine Einstellung ist eine Sichtbarkeitsgrenze und ändert keine einzelnen Einträge. Privat blendet öffentliche Einträge vorübergehend aus; nach der Rückkehr zu öffentlich werden sie wieder sichtbar.",
		unlistedRule:
			"Nicht gelistete Einträge erscheinen nicht im Profil, können aber in ausdrücklich verknüpften Rezensionen oder Beiträgen sichtbar sein. Private Einträge siehst nur du.",
	},
	profile: "Profil",
	slugAddress: unitSlugTerms.label,
	slugAddressHint: `Verwende 1–63 kleingeschriebene ${verbatimTerms.ascii.value}-Buchstaben, Ziffern oder Bindestriche. Nach einer Änderung leitet die alte ${verbatimTerms.url.value} dauerhaft auf die neue ${verbatimTerms.url.value} weiter.`,
	profileSlugAddressHint: `Wähle sorgfältig: Diese Adresse kann derzeit nur einmal festgelegt und danach nicht geändert werden. Verwende 1–63 kleingeschriebene ${verbatimTerms.ascii.value}-Buchstaben, Ziffern oder Bindestriche. Von der Plattform reservierte Namen sind nicht verfügbar.`,
	profileSlugAddressAssignedHint:
		"Diese Profiladresse wurde festgelegt und kann derzeit nicht geändert werden.",
	profileSlugReserved: "Diese Profiladresse ist reserviert und kann nicht verwendet werden.",
	preferences: "Voreinstellungen",
	interfaceLanguage: "Oberflächensprache",
	contentLanguage: "Bevorzugte Inhaltssprache",
	contentLanguages: "Bevorzugte Inhaltssprachen",
	contentLanguagesHint:
		"Ziehe die Sprachen, um ihre Reihenfolge zu ändern. Inhalte verwenden diese Reihenfolge, dann die Oberflächensprache und anschließend die eigene Sprachreihenfolge der Unit.",
	addContentLanguage: "Sprache hinzufügen",
	dragContentLanguage: insert("{{language}} ziehen, um die Reihenfolge zu ändern", {
		language: String,
	}),
	moveContentLanguageUp: insert("{{language}} nach oben verschieben", { language: String }),
	moveContentLanguageDown: insert("{{language}} nach unten verschieben", { language: String }),
	removeContentLanguage: insert("{{language}} entfernen", { language: String }),
	filterFeedByPreferredLanguages: "Feed nach bevorzugten Sprachen filtern",
	filterFeedByPreferredLanguagesHint:
		"Wenn diese Option aktiviert ist, enthält der Feed nur Inhalte, die in mindestens einer bevorzugten Sprache verfügbar sind. Andere Listen zeigen weiterhin alle passenden Inhalte mit Sprachersatz an.",
	alwaysShowSpoilers: "Spoiler immer anzeigen",
	alwaysShowSpoilersHint: "Als Spoiler gekennzeichnete Inhalte ohne einzelne Freigabe anzeigen.",
	alwaysShowNsfw: `${verbatimTerms.nsfw.value}-Medien immer anzeigen`,
	alwaysShowNsfwHint: `Als ${verbatimTerms.nsfw.value} gekennzeichnete Medien ohne vorherige Unschärfe anzeigen.`,
	customZoneThemes: "Benutzerdefinierte Zonen-Designs anzeigen",
	customZoneThemesHint:
		"Wenn diese Option aus ist, verwenden alle Zonen das Plattform-Standarddesign. Inhalt und Anordnung bleiben unverändert.",
	account: "Konto",
	accountDescription: "Verwalte die aktuell angemeldete Sitzung.",
	security: "Sicherheit",
	securityDescription:
		"Ändere dein Kontopasswort. Du kannst dich auch auf anderen Geräten abmelden.",
	currentPassword: "Aktuelles Passwort",
	newPassword: "Neues Passwort",
	revokeOtherSessions: "Andere Geräte nach der Passwortänderung abmelden",
	passwordChanged: "Dein Passwort wurde geändert.",
	sessions: "Angemeldete Geräte",
	sessionsDescription: "Widerrufe Sitzungen, die du nicht mehr verwendest oder erkennst.",
	currentSession: "Aktuelles Gerät",
	unknownDevice: "Unbekanntes Gerät",
	unknownAddress: "Unbekannte Adresse",
	lastUpdated: "Letzte Aktivität",
	sessionExpires: "Läuft ab",
	revokeSession: "Dieses Gerät abmelden",
	tokens: {
		title: `${verbatimTerms.api.value}-Token`,
		description:
			"Erstelle Automatisierungszugänge mit dem geringstmöglichen Zugriff und eigenen Begrenzungen pro Token.",
		securityWarningTitle: `${verbatimTerms.api.value}-Token sicher aufbewahren`,
		securityWarning:
			"Behandle Token wie Passwörter: Teile sie nicht und übertrage sie nicht in die Versionsverwaltung. Vergib nur die erforderlichen Berechtigungen und lege eine angemessene Gültigkeitsdauer fest. Wenn ein Token offengelegt worden sein könnte, widerrufe und ersetze es sofort.",
		securityGuide: "Anleitung ansehen",
		createTitle: "Token erstellen",
		createDescription:
			"Das Geheimnis wird nur einmal angezeigt. Wähle zuerst den geringstmöglichen Zugriff und vorsichtige Begrenzungen.",
		name: "Name",
		namePlaceholder: `Zum Beispiel: Agent zur Vervollständigung von Buch-${metadataTerms.inline}`,
		expiresIn: "Gültigkeitsdauer",
		expiryDays: {
			thirty: "30 Tage",
			ninety: "90 Tage",
			year: "365 Tage",
		},
		permissions: "Berechtigungen",
		permissionsDescription:
			"Gewähre nur die für die Aufgabe erforderlichen Aktionen. Wähle mindestens eine aus.",
		selectContentAgent: "Standardeinstellungen für Inhaltsagenten auswählen",
		selectReadOnly: "Standardeinstellungen für schreibgeschützten Zugriff auswählen",
		permissionsRequired: "Wähle mindestens eine Berechtigung aus.",
		matrix: {
			templates: "Berechtigungsvorlagen",
			searchPlaceholder: "Berechtigungsgruppen suchen…",
			clear: "Alle abwählen",
			selected: insert("{{selected}} / {{total}} ausgewählt", {
				selected: Number,
				total: Number,
			}),
			categorySelected: insert("{{selected}} ausgewählt", { selected: Number }),
			required: "Erforderlich",
			empty: "Keine Berechtigungen entsprechen der Suche.",
		},
		permissionCategories: {
			content: "Inhalte und Zusammenarbeit",
			identity: "Identität und Profil",
			communication: "Kommunikation",
			platform: "Plattform",
		},
		permissionResources: {
			unit: "Units",
			profile: "Profil",
			interaction: "Interaktionen",
			realm: realmTerms.label,
			message: "Nachrichten",
			notification: "Benachrichtigungen",
			recommendation: "Empfehlungen",
			upload: "Uploads",
			report: "Meldungen",
		},
		permissionActions: {
			read: "Lesen",
			create: "Erstellen",
			update: "Aktualisieren",
			write: "Schreiben",
			manage: "Verwalten",
		},
		permissionLabels: {
			unitRead: "Units und Inhalte lesen",
			unitCreate: "Units erstellen",
			unitUpdate: "Units und Übersetzungen aktualisieren",
			profileRead: "Öffentliche Profile lesen",
			profileUpdate: "Profil aktualisieren",
			interactionRead: "Interaktionen lesen",
			interactionWrite: "Interaktionen erstellen",
			realmRead: `${realmTerms.pluralLabel} lesen`,
			realmManage: `${realmTerms.pluralLabel} verwalten`,
			messageRead: "Nachrichten lesen",
			messageWrite: "Nachrichten senden",
			notificationRead: "Benachrichtigungen lesen",
			notificationWrite: "Benachrichtigungsstatus aktualisieren",
			recommendationRead: "Empfehlungen lesen",
			recommendationWrite: "Empfehlungsinteraktionen übermitteln",
			uploadRead: "Uploads lesen",
			uploadWrite: "Uploads erstellen",
			reportWrite: "Meldungen senden",
		},
		limits: "Nutzungsbegrenzungen",
		standardLimitsDescription: `Jeder Token hat eine eigene Plattformrichtlinie und teilt zusätzlich das Kontokontingent. Dein optionales Schutzlimit kann die Tokenkapazität nur verringern; ${verbatimTerms.privilegedApiQuotaClass.value}-Zugriff erfordert Plattformberechtigung.`,
		limitsDescription:
			"Kontingente müssen innerhalb der zulässigen Bereiche der aktuellen Richtlinie bleiben. Globale und aktionsspezifische Begrenzungen gelten gemeinsam.",
		limitRanges: insert(
			"Zulässige Bereiche: {{requestsMinimum}} bis {{requestsMaximum}} Anfragen pro Minute; Spitzenkapazität {{burstMinimum}} bis {{burstMaximum}}; {{concurrentMinimum}} bis {{concurrentMaximum}} gleichzeitige Anfragen; {{dailyMinimum}} bis {{dailyMaximum}} tägliche Kosteneinheiten.",
			{
				requestsMinimum: String,
				requestsMaximum: String,
				burstMinimum: String,
				burstMaximum: String,
				concurrentMinimum: String,
				concurrentMaximum: String,
				dailyMinimum: String,
				dailyMaximum: String,
			},
		),
		limitRangePlaceholder: insert("Bereich: {{minimum}}–{{maximum}}", {
			minimum: String,
			maximum: String,
		}),
		limitRangeError: insert("Gib eine ganze Zahl von {{minimum}} bis {{maximum}} ein.", {
			minimum: String,
			maximum: String,
		}),
		requestsPerMinute: "Anfragen pro Minute",
		burstCapacity: "Spitzenkapazität",
		maxConcurrentRequests: "Gleichzeitige Anfragen",
		dailyCostUnits: "Tägliche Kosteneinheiten",
		create: "Token erstellen",
		createdTitle: "Neues Token jetzt speichern",
		createdDescription:
			"Nach dem Schließen dieses Hinweises kannst du es nicht erneut anzeigen. Widerrufe und ersetze ein verlorenes Token.",
		copyToken: "Token kopieren",
		dismissSecret: "Ich habe es sicher gespeichert",
		listTitle: "Vorhandene Token",
		listDescription:
			"Prüfe die Nutzung regelmäßig und widerrufe Token, sobald sie nicht mehr benötigt werden.",
		empty: `Es wurden noch keine ${verbatimTerms.api.value}-Token erstellt.`,
		enabled: "Aktiviert",
		disabled: "Deaktiviert",
		prefix: "Erkennungspräfix",
		expires: "Läuft ab",
		lastUsed: "Zuletzt verwendet",
		neverUsed: "Nie verwendet",
		policy: "Richtlinie",
		standardPolicy: "Standard",
		privilegedPolicy: verbatimTerms.privilegedApiQuotaClass.value,
		trustedFallback: "Standardersatz aktiv",
		trustedUntil: "Zugriff mit höherem Limit läuft ab",
		manageAccess: "Name und Zugriff verwalten",
		configureLimits: "Begrenzungen konfigurieren",
		hideEditor: "Einstellungen schließen",
		saveAccess: "Name und Zugriff speichern",
		enable: "Aktivieren",
		disable: "Deaktivieren",
		revoke: "Widerrufen",
		revokeTitle: "Dieses Token dauerhaft widerrufen?",
		revokeDescription:
			"Jede Automatisierung, die dieses Token verwendet, verliert sofort den Zugriff. Dies kann nicht rückgängig gemacht werden.",
		cancel: "Abbrechen",
		saveLimits: "Begrenzungen speichern",
		operationOverrides: "Aktionsspezifische Begrenzungen",
		operationOverridesDescription: `Verwende die ${verbatimTerms.apiPolicyOperationId.value} aus dem ${verbatimTerms.openapi.value}-Dokument, um für eine Aktion eine eigene Begrenzung festzulegen. Die globalen Begrenzungen gelten weiterhin.`,
		operationId: `Aktions-${verbatimTerms.id.value}`,
		operationIdPlaceholder: `Aktions-${verbatimTerms.id.value} einfügen`,
		operations: {
			"search.execute": "Suche ausführen",
			"image.upload": "Bilder hochladen",
		},
		addOperation: "Aktionsbegrenzung hinzufügen",
		removeOperation: "Entfernen",
		invalidLimits: "Prüfe Begrenzungswerte, Aktionskennungen und Duplikate.",
		resetLimits: "Tokenspezifische Grenzen entfernen",
	},
	defaultLicense: `Standard-${licenseTerms.inline}`,
	defaultLicenses: `Standardauswahl der ${licenseTerms.inline}`,
	defaultScoreRealm: `Standard-${realmTerms.label} für Bewertungen`,
	defaultScoreRealmHint: `Bewertungen von allgemeinen Seiten werden in diesem ${realmTerms.inline} gespeichert. Bewertungen in einem anderen ${realmTerms.inline} bleiben dort.`,
	general: "Allgemein",
	realmManageMode: `${realmTerms.pluralLabel} standardmäßig im Verwaltungsmodus erstellen`,
	on: "Ein",
	off: "Aus",
} satisfies typeof import("../zh-Hant/settings").default;
