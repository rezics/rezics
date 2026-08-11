import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { deTerminology } from "@rezics/i18n/terminology/de";

const { forms: dockTerms } = deTerminology.dock;
const { forms: followTerms } = deTerminology.follow;
const { forms: postTerms } = deTerminology.post;
const { forms: realmTerms } = deTerminology.realm;
const { forms: tagStructureTerms } = deTerminology.tagStructure;
const { forms: unitSlugTerms } = deTerminology.unitSlug;
const { forms: zoneTerms } = deTerminology.zone;
const { forms: entityTerms } = deTerminology.entity;

export default {
	MalformedRequestBody: "Der übermittelte Inhalt konnte nicht gelesen werden.",
	ValidationError: "Der übermittelte Inhalt ist ungültig.",
	InternalError: "Der Dienst ist vorübergehend nicht verfügbar. Versuche es später erneut.",
	AuthenticationRequired: "Melde dich an, um fortzufahren.",
	ApiTokenPermissionRequired: `Dieses ${verbatimTerms.api.value}-Token hat nicht die erforderliche Berechtigung.`,
	ApiTokenRateLimitExceeded: `Dieses ${verbatimTerms.api.value}-Token sendet Anfragen zu schnell. Versuche es gleich noch einmal.`,
	ApiQuotaExceeded: `Das ${verbatimTerms.api.value}-Kontingent ist aufgebraucht. Versuche es nach der angegebenen Zeit erneut.`,
	ApiQuotaPolicyNotFound: `Die angeforderte ${verbatimTerms.api.value}-Kontingentrichtlinie wurde nicht gefunden.`,
	ApiQuotaPolicyKeyConflict: `Eine ${verbatimTerms.api.value}-Kontingentrichtlinie verwendet diesen Schlüssel bereits.`,
	ApiQuotaPolicyInvalid: `Die Konfiguration der ${verbatimTerms.api.value}-Kontingentrichtlinie ist ungültig.`,
	ApiQuotaPolicyRevisionConflict: `Die ${verbatimTerms.api.value}-Kontingentrichtlinie wurde geändert. Lade sie vor dem Speichern neu.`,
	ApiAccountQuotaRevisionConflict: `Das ${verbatimTerms.api.value}-Kontingent des Kontos wurde geändert. Lade es vor dem Speichern neu.`,
	ApiTokenQuotaRevisionConflict: `Die ${verbatimTerms.api.value}-Token-Kontingentzuweisung wurde geändert. Lade sie vor dem Speichern neu.`,
	ApiTokenLimitReached: `Dieses Konto hat die Höchstzahl an ${verbatimTerms.api.value}-Token erreicht.`,
	ApiTokenQuotaOverrideInvalid: `Die Kontingentüberschreibung des ${verbatimTerms.api.value}-Tokens ist ungültig.`,
	ApiTokenQuotaOverrideRevisionConflict: `Die Kontingentüberschreibung des ${verbatimTerms.api.value}-Tokens wurde geändert. Lade sie vor dem Speichern neu.`,
	InteractiveSessionRequired: "Melde dich interaktiv an, um Anmeldeinformationen zu verwalten.",
	FreshSessionRequired:
		"Melde dich erneut an, bevor du eine vertrauliche Verwaltungsaktion ausführst.",
	EmailVerificationRequired: "Bestätige deine E-Mail-Adresse, um fortzufahren.",
	AccountSuspended: "Dieses Konto ist derzeit gesperrt.",
	AccountClosed: "Dieses Konto ist geschlossen.",
	UserAccountStateRevisionConflict: "Der Kontostatus wurde geändert. Bitte neu laden.",
	UserSelfStatusChangeForbidden: "Du kannst dein eigenes Konto nicht sperren oder schließen.",
	PlatformUserManagerRequired: "Mindestens ein aktiver Benutzerverwalter muss erhalten bleiben.",
	UserAccountStateExpiryInvalid: "Das Ende der Sperre muss in der Zukunft liegen.",
	SessionNotFound: "Diese Sitzung wurde nicht gefunden.",
	AccountRestricted: "Dieses Konto darf diese Aktion nicht ausführen.",
	UnitNotFound: "Dieser Inhalt wurde nicht gefunden.",
	UnitPermissionForbidden: "Dir fehlt die erforderliche Berechtigung für diesen Inhalt.",
	UnitAccessRestricted: "Dein Zugriff auf diesen Inhaltsbereich ist eingeschränkt.",
	UnitContentLicenseGrantForbidden: `Nur Werke in persönlichem Besitz können ${verbatimTerms.rezics.value} eine Lizenz erteilen.`,
	UnitChanged: "Dieser Inhalt wurde geändert. Aktualisiere die Seite und versuche es erneut.",
	UnitRevisionConflict:
		"Die Ausgangsversion wurde geändert. Aktualisiere die Seite und versuche es erneut.",
	ContentStructureRevisionConflict:
		"Die Inhaltsstruktur wurde an anderer Stelle geändert. Aktualisiere die Seite und versuche es erneut.",
	CollectionStructureRevisionConflict:
		"Die Struktur der Einträge wurde an anderer Stelle geändert. Aktualisiere die Seite und versuche es erneut.",
	DockRevisionConflict: `Der ${dockTerms.inline} wurde an anderer Stelle geändert. Aktualisiere die Seite und versuche es erneut.`,
	DockNotFound: `Dieser ${dockTerms.inline} wurde nicht gefunden.`,
	DockNotSupported: `Dieser Inhalt unterstützt diesen ${dockTerms.inline} nicht.`,
	DockDocumentInvalid: `Das Dokument des ${dockTerms.inline}s ist ungültig.`,
	ApiTokenNotFound: `Das aktive ${verbatimTerms.api.value}-Token wurde nicht gefunden.`,
	InvalidSearch: "Die Suchanfrage ist ungültig.",
	SearchUnavailable: "Die Suche ist vorübergehend nicht verfügbar. Versuche es später erneut.",
	RealmCapabilityRequired: `Dir fehlt die erforderliche Berechtigung für den ${realmTerms.inline}.`,
	RealmRulesAcceptanceRequired: `Akzeptiere die aktuellen Regeln des ${realmTerms.inline}s, um fortzufahren.`,
	RealmRuleRevisionChanged:
		"Die Regeln auf dem Server wurden geändert. Prüfe die neueste Version und versuche es erneut.",
	PlatformCapabilityRequired: "Für diese Aktion ist eine Plattformberechtigung erforderlich.",
	PlatformAccessManagerRequired:
		"Die Plattform muss mindestens eine nicht ablaufende Verwaltung des Plattformzugriffs behalten.",
	PlatformAccessRevisionConflict:
		"Der Plattformzugriff wurde an anderer Stelle geändert. Lade ihn neu, bevor du es erneut versuchst.",
	PlatformAccessConfigurationInvalid: "Jede Plattformberechtigung darf nur einmal vorkommen.",
	CollectionOwnershipRequired: "Diese Sammlung gehört dir nicht.",
	ProfileNotFound: "Dieses Profil wurde nicht gefunden.",
	ProfileChanged: "Dieses Profil wurde geändert. Aktualisiere die Seite und versuche es erneut.",
	PreferencesNotFound: "Diese Voreinstellungen wurden nicht gefunden.",
	UserNotFound: "Dieser Benutzer wurde nicht gefunden.",
	UserSelfFollowForbidden: `Du kannst dir nicht selbst ${followTerms.action}.`,
	UserFollowBlocked: `${followTerms.stateLabel} ist zwischen blockierten Benutzern nicht verfügbar.`,
	FollowingTargetKindMismatch: `Der Typ der ${followTerms.followed}en Unit hat sich geändert. Lade ihre Einstellungen neu.`,
	UserSelfBlockForbidden: "Du kannst dich nicht selbst blockieren.",
	SoftwareSystemRequirementSourceInvalid:
		"Die Quelle der Systemanforderung muss zu dieser Software gehören.",
	SeriesReleaseNotFound: "Diese Veröffentlichung der Reihe wurde nicht gefunden.",
	ZonePageNotFound: `Diese Seite des ${zoneTerms.inline}s wurde nicht gefunden.`,
	ZonePageInUse: `Diese Seite des ${zoneTerms.inline}s wird noch von einem Block- oder Navigationsdokument verwendet.`,
	ZoneNavigationNotFound: `Diese Navigation des ${zoneTerms.inline}s wurde nicht gefunden.`,
	ZoneNavigationInUse: `Diese Navigation des ${zoneTerms.inline}s wird noch von einem Blockdokument verwendet.`,
	ZoneDocumentInvalid: `Das Block- oder Navigationsdokument des ${zoneTerms.inline}s ist ungültig.`,
	ZoneTimeRangeInvalid: `Die Endzeit des ${zoneTerms.inline}s muss nach seiner Startzeit liegen.`,
	SoftwareNotFound: "Diese Software wurde nicht gefunden.",
	SystemRequirementNotFound: "Diese Systemanforderung wurde nicht gefunden.",
	PollOptionsDuplicated: "Die Antwortmöglichkeiten der Umfrage müssen eindeutig sein.",
	PollNotFound: "Diese Umfrage wurde nicht gefunden.",
	PollClosed: "Diese Umfrage ist geschlossen.",
	PollSingleChoiceInvalid: "Wähle für diese Umfrage genau eine Antwortmöglichkeit.",
	PollOptionInvalid: "Die ausgewählte Antwortmöglichkeit ist ungültig.",
	PollAlreadyClosed: "Diese Umfrage ist bereits geschlossen.",
	ContentStructureInvalid: "Diese Inhaltsstruktur erfüllt ihre Zweckregeln nicht.",
	ContentStructureNotFound: "Diese Inhaltsstruktur wurde nicht gefunden.",
	ContentStructureNodeNotFound: "Dieser Knoten der Inhaltsstruktur wurde nicht gefunden.",
	ReviewNotFound: "Diese Rezension wurde nicht gefunden.",
	ContentGovernanceTargetNotFound: "Das Moderationsziel wurde nicht gefunden.",
	ContentReviewRealmMissing: `In diesem Moderationsfall fehlt der ${realmTerms.inline}.`,
	ContentReviewCaseNotFound: "Dieser Moderationsfall wurde nicht gefunden.",
	ContentGovernanceReversedActionInvalid: "Die zurückgenommene Aktion gehört nicht zu diesem Fall.",
	ContentGovernanceActionIncompatible: "Diese Aktion ist für das Moderationsziel nicht verfügbar.",
	ContentGovernanceTransitionInvalid:
		"Das Ziel kann diesen Wechsel des Moderationsstatus nicht vornehmen.",
	ContentGovernanceActionNoEffect: "Die Moderationsaktion würde das Ziel nicht ändern.",
	ContentGovernanceReversalUnavailable:
		"Diese Aktion kann nicht mehr sicher zurückgenommen werden.",
	ContentGovernanceIdempotencyConflict:
		"Dieser Wiederholungsschlüssel wurde bereits für eine andere Moderationsanfrage verwendet.",
	GovernanceNoteRoleDuplicate:
		"Füge höchstens eine interne Notiz und eine öffentliche Mitteilung hinzu.",
	ReportAlreadySubmitted: "Du hast diese Unit für den laufenden Fall bereits gemeldet.",
	ReportTargetRevisionUnavailable: "Diese Unit hat keine Revision, die gemeldet werden kann.",
	ReportRuleUnavailable: "Für den gewählten Zuständigkeitsbereich gibt es keine aktuellen Regeln.",
	ReportRuleChanged: "Die gewählte Regel wurde geändert. Wähle sie vor dem Senden erneut aus.",
	ReportRuleSourceForbidden: `Meldungen dürfen nur Regeln des aktuellen ${realmTerms.label} und offizielle Regeln anführen.`,
	ContentGovernanceRuleSourceForbidden:
		"Die gewählte Regel liegt außerhalb dieser Zuständigkeit für Inhalts-Governance.",
	ContentGovernanceRuleChanged:
		"Eine gewählte Regel gehört nicht mehr zur aktuellen Regelversion. Wähle sie erneut aus.",
	EnforcementExpiryInvalid: "Der Ablauf der Maßnahme muss in der Zukunft liegen.",
	EnforcementNotFound: "Diese Maßnahme wurde nicht gefunden.",
	EnforcementAlreadyRevoked: "Diese Maßnahme wurde bereits aufgehoben.",
	EnforcementChanged:
		"Diese Maßnahme wurde geändert. Aktualisiere die Seite und versuche es erneut.",
	RealmMemberNotFound: `Dieses aktive Mitglied des ${realmTerms.inline}s wurde nicht gefunden.`,
	CapabilityGrantExpiryInvalid: "Der Ablauf der Berechtigungsvergabe muss in der Zukunft liegen.",
	CapabilityGrantNotFound: "Diese aktive Berechtigungsvergabe wurde nicht gefunden.",
	UnitAccessExpiryInvalid: "Der Ablauf des Unit-Zugriffs muss in der Zukunft liegen.",
	UnitAccessInvitationNotFound: "Diese Einladung zum Unit-Zugriff wurde nicht gefunden.",
	UnitAccessInvitationConflict:
		"Auf diese Einladung zum Unit-Zugriff kann nicht mehr reagiert werden.",
	UnitAccessInvitationExpired: "Diese Einladung zum Unit-Zugriff ist abgelaufen.",
	UnitAccessInvitationSelfForbidden: "Du kannst dich nicht selbst zu einer Unit einladen.",
	UnitOwnerRestrictionForbidden: "Der Eigentümer einer Unit kann nicht eingeschränkt werden.",
	UnitAccessConfigurationInvalid:
		"Diese Konfiguration des Unit-Zugriffs ist ungültig oder überschreitet die Berechtigungen, die du delegieren darfst.",
	UnitOwnershipChanged: "Der Eigentümer der Unit wurde geändert. Lade neu und versuche es erneut.",
	UnitOwnershipTargetIneligible:
		"Das gewählte Profil kann das Eigentum an der Unit nicht mehr erhalten.",
	UnitOwnershipRelinquishmentForbidden:
		"Das Eigentum an einer gemeinschaftseigenen Unit kann nicht aufgegeben werden.",
	UnitOwnershipOverrideConfirmationInvalid:
		"Die eingegebene Unit-Kennung stimmt nicht mit dem Ziel der Eigentumsneuzuweisung überein.",
	UnitOwnershipClaimUnavailable:
		"Ein Eigentumsantrag ist nur für unterstützte öffentliche Units möglich, die noch der Gemeinschaft gehören.",
	UnitOwnershipClaimAlreadyPending:
		"Für diese Unit hast du bereits einen ausstehenden Eigentumsantrag.",
	UnitOwnershipClaimNotFound: "Dieser Eigentumsantrag für die Unit wurde nicht gefunden.",
	UnitOwnershipClaimChanged:
		"Der Eigentumsantrag oder die ursprüngliche Eigentümerschaft wurde geändert. Lade neu und versuche es erneut.",
	UnitOwnershipClaimConfirmationInvalid:
		"Die eingegebene Antragskennung stimmt nicht mit dem Prüfziel überein.",
	UnitOwnershipClaimSelfDecisionForbidden:
		"Antragstellende dürfen ihren eigenen Eigentumsantrag nicht prüfen.",
	UnitLifecycleConfirmationInvalid:
		"Die eingegebene Unit-Kennung stimmt nicht mit dem Ziel überein.",
	UnitLifecycleChanged: "Die Unit wurde geändert. Lade neu und versuche es erneut.",
	UnitLifecycleProtected: "Diese geschützte Unit kann nicht vorläufig gelöscht werden.",
	UnitAlreadyDeleted: "Diese Unit wurde bereits vorläufig gelöscht.",
	UnitNotDeleted: "Diese Unit ist derzeit nicht vorläufig gelöscht.",
	UnitMergeNotFound: "Dieser Antrag auf Unit-Zusammenführung wurde nicht gefunden.",
	UnitMergeConfirmationInvalid: "Die Bestätigung für Quelle oder Ziel stimmt nicht überein.",
	UnitMergeKindIneligible: "Diese Unit-Art kann nicht zusammengeführt werden.",
	UnitMergeKindMismatch: "Quell- und Ziel-Unit müssen dieselbe Art haben.",
	UnitMergeRequestConflict:
		"Für die Quell-Unit besteht bereits eine aktive oder abgeschlossene Zusammenführung.",
	UnitMergeIdempotencyConflict:
		"Dieser Wiederholungsschlüssel wurde bereits für eine andere Zusammenführung verwendet.",
	UnitMergeManifestStale:
		"Quelle, Ziel oder Variant-Graph wurden geändert. Führe die Vorprüfung erneut aus.",
	UnitMergeReviewSelfForbidden:
		"Du kannst eine selbst vorgeschlagene Unit-Zusammenführung nicht prüfen.",
	UnitMergeReviewDuplicate: "Du hast diese Unit-Zusammenführung bereits geprüft.",
	UnitMergeReviewFingerprintMismatch:
		"Diese Prüfung bezieht sich auf ein älteres Zusammenführungsmanifest.",
	UnitMergeRequestNotPending: "Diese Unit-Zusammenführung wartet nicht mehr auf Prüfung.",
	UnitMergeRequestExpired: "Dieser Antrag auf Unit-Zusammenführung ist abgelaufen.",
	UnitMergeRetryUnavailable:
		"Diese Unit-Zusammenführung kann in ihrem aktuellen Status nicht wiederholt werden.",
	InvalidPaginationCursor: "Dieser Seitenlink ist ungültig oder abgelaufen.",
	BookNotFound: "Dieses Buch wurde nicht gefunden.",
	MediaNotFound: "Dieses Medienelement wurde nicht gefunden.",
	ChapterNotFound: "Dieses Kapitel wurde nicht gefunden.",
	ChapterLanguageNotFound: "Diese Kapitelsprache wurde nicht gefunden.",
	ReportRealmMismatch: `Die gemeldete Unit gehört nicht zu diesem ${realmTerms.inline}.`,
	PostNotFound: `Dieser ${postTerms.inline} wurde nicht gefunden.`,
	PostLocalizationNotFound: `Diese Sprachfassung des ${postTerms.inline}s wurde nicht gefunden.`,
	PostTargetingLocked: `Dieses Ziel nimmt keine neuen ${postTerms.pluralLabel} an.`,
	ReplyPostNotFound: `Dieser Antwort-${postTerms.inline} wurde nicht gefunden.`,
	ParentReplyNotFound: `Der übergeordnete Antwort-${postTerms.inline} wurde in dieser Diskussion nicht gefunden.`,
	ReplyDepthExceeded: "Diese Antwort würde die maximale Diskussionstiefe überschreiten.",
	InvalidNotificationCursor: "Dieser Link zur Benachrichtigungsseite ist ungültig oder abgelaufen.",
	NotificationNotFound: "Diese Benachrichtigung wurde nicht gefunden.",
	EntityEntryNotFound: `Dieser ${entityTerms.label}seintrag wurde nicht gefunden.`,
	EntityAssociationRestricted: `Diese ${entityTerms.label} akzeptiert diese Art der Zuordnung nicht.`,
	AssociationProposalNotFound: "Dieser Zuordnungsvorschlag wurde nicht gefunden.",
	AssociationProposalConflict: "Auf diesen Zuordnungsvorschlag kann nicht mehr reagiert werden.",
	AssociationProposalExpired: "Dieser Zuordnungsvorschlag ist abgelaufen.",
	AssociationProposalExpiryInvalid:
		"Der Ablauf des Zuordnungsvorschlags muss in der Zukunft liegen.",
	AssociationProposalRoleInvalid:
		"Die ausgewählte Zuordnungsrolle stimmt nicht mit dem Zuordnungstyp überein.",
	CreditAttributionNotFound: "Diese Mitwirkendenzuordnung wurde nicht gefunden.",
	CreditAttributionRoleInvalid: "Die ausgewählte Mitwirkendenrolle gilt nicht für diesen Unit-Typ.",
	CreditAttributionRequestConfirmationRequired:
		"Bestätige, bevor Mitwirkendeneinladungen gesendet werden.",
	SubjectAssociationNotFound: "Diese Themenzuordnung wurde nicht gefunden.",
	AliasNotFound: "Dieser Alias wurde nicht gefunden.",
	TagApplicationNotFound: "Diese Tag-Verwendung wurde nicht gefunden.",
	UnitTagCurationChanged:
		"Diese Tag-Kuratierung wurde an anderer Stelle geändert. Die neueste Reihenfolge wurde geladen; versuche es erneut.",
	TagNotFound: "Dieser Tag wurde nicht gefunden.",
	UnitExternalLinkNotFound: "Dieser externe Link des Werks wurde nicht gefunden.",
	UnitReferenceCurationChanged:
		"Die Referenzkuratierung wurde an anderer Stelle geändert. Die aktuelle Reihenfolge wurde geladen; bitte erneut versuchen.",
	UnitReferenceLimitReached: "Dieses Werk hat bereits die Höchstzahl aktiver Referenzen.",
	UnitReferencePinnedLimitReached:
		"Dieses Werk hat bereits die Höchstzahl angehefteter Referenzen.",
	UnitReferenceWithdrawn: "Diese Referenz wurde zurückgezogen.",
	UnitVariantKindMismatch:
		"Eine Variante und ihr Haupteintrag müssen denselben unterstützten Unit-Typ verwenden.",
	UnitVariantTargetIsVariant: "Eine Variante muss direkt auf einen Haupteintrag verweisen.",
	UnitVariantSourceHasVariants:
		"Ein Haupteintrag mit Varianten kann nicht selbst zu einer Variante werden.",
	UnitVariantChanged:
		"Die Beziehung der Unit zu ihrem Haupteintrag wurde geändert. Aktualisiere die Seite und versuche es erneut.",
	UnitVariantMainUnavailable: "Der Haupteintrag ist für diesen Variantenstatus nicht verfügbar.",
	InvalidMessageCursor: "Dieser Link zur Nachrichtenseite ist ungültig oder abgelaufen.",
	ConversationNotFound: "Diese Unterhaltung wurde nicht gefunden.",
	ConversationParticipantsInvalid: "Eine direkte Unterhaltung erfordert zwei Benutzer.",
	DirectMessageBlocked: "Direktnachrichten sind zwischen diesen Benutzern nicht verfügbar.",
	MessageNotFound: "Diese Nachricht wurde nicht gefunden.",
	CollectionNotFound: "Diese Sammlung wurde nicht gefunden.",
	RealmNotFound: `Dieser ${realmTerms.inline} wurde nicht gefunden.`,
	RealmMembershipNotFound: `Diese Mitgliedschaft im ${realmTerms.inline} wurde nicht gefunden.`,
	RealmOwnerLeaveForbidden: `Der Eigentümer des ${realmTerms.inline}s kann den ${realmTerms.inline} nicht verlassen.`,
	RealmUnitNotFound: `Diese Unit ist nicht im ${realmTerms.inline} eingebunden.`,
	WikiNavigationNotFound: "Diese Wiki-Navigation wurde nicht gefunden.",
	WikiNavigationInUse: "Diese Wiki-Navigation wird noch verwendet.",
	WikiNavigationDocumentInvalid: "Das Wiki-Navigationsdokument ist ungültig.",
	FavoritesEditForbidden: "Die Favoritensammlung kann nicht bearbeitet werden.",
	FavoritesDeleteForbidden: "Die Favoritensammlung kann nicht gelöscht werden.",
	InvalidFeedCursor: "Dieser Link zur Feed-Seite ist ungültig oder abgelaufen.",
	InvalidFeedFilter: "Dieser Feed-Filter ist ungültig.",
	InvalidHistoryCursor: "Dieser Link zur Verlaufsseite ist ungültig oder abgelaufen.",
	UnitRevisionNotFound: "Diese Unit-Version wurde nicht gefunden.",
	CurrentRevisionContentVisibilityForbidden:
		"Stelle eine andere Version wieder her, bevor du den Inhalt der aktuellen Version ausblendest.",
	ImageAssetNotFound: "Diese Bilddatei wurde nicht gefunden.",
	ImageAssetUploadNotFound: "Das hochgeladene Bildobjekt wurde nicht gefunden.",
	ImageAssetUnsupportedType: "Dieses Bildformat wird nicht unterstützt.",
	ImageAssetInvalidSize: "Die Bildgröße ist ungültig.",
	ImageAssetContentMismatch: "Der Bildinhalt stimmt nicht mit seiner Upload-Angabe überein.",
	ImageAssetInvalidState: "Der Status der Bilddatei lässt diese Aktion nicht zu.",
	ImageAssetInvalidPresentation:
		"Der angezeigte Bereich ist für dieses Bild und diese Rolle ungültig.",
	ImageAssetInUse: "Eine verwendete Bilddatei kann nicht gelöscht werden.",
	UnitLocalizationOrderChanged:
		"Die Reihenfolge der Inhaltssprachen wurde an anderer Stelle geändert. Lade sie neu und versuche es erneut.",
	UnitLocalizationOrderInvalid:
		"Die Sprachreihenfolge muss jede vorhandene Inhaltssprache genau einmal enthalten.",
	UnitLocalizationNotFound: "Diese Inhaltssprache existiert nicht mehr.",
	UnitLastLocalizationRemovalForbidden: "Eine Unit muss mindestens eine Inhaltssprache behalten.",
	InvalidSlug: `${unitSlugTerms.label} muss eine 1 bis 63 Zeichen lange, kleingeschriebene und mit Bindestrichen getrennte ${verbatimTerms.ascii.value}-Bezeichnung sein.`,
	SlugTaken: `Diese ${unitSlugTerms.inline} wird in diesem Unit-Namensraum bereits verwendet.`,
	SlugReserved: `Diese ${unitSlugTerms.inline} ist reserviert und kann nicht verwendet werden.`,
	ProfileSlugChangeUnavailable: `Die ${unitSlugTerms.inline} deines Profils kann nach dem Festlegen derzeit nicht geändert werden.`,
	SlugScopeNotFound: `Der Unit-Namensraum für diese ${unitSlugTerms.inline} wurde nicht gefunden.`,
	SlugScopeUnavailable: `Nicht adressierte und gelöschte Units können keine kanonischen Namensräume für ${unitSlugTerms.plural} sein.`,
	SlugScopeCycle: `Diese Verschiebung würde einen Zyklus im Namensraum der ${unitSlugTerms.inline}en erzeugen.`,
	SlugDepthExceeded: `Der Pfad der Unit-${unitSlugTerms.inline} überschreitet die maximale Tiefe.`,
	UnitAddressMutationForbidden: `Diese Adresse der Unit-${unitSlugTerms.inline} kann diese Aktion nicht ausführen.`,
	SlugRedirectNotFound: `Die Weiterleitung für die ${unitSlugTerms.inline} wurde nicht gefunden.`,
	UnitSlugAddressNotFound: `Die Unit hat keine kanonische Adresse mit ${unitSlugTerms.inline}.`,
	GovernanceNoteNotFound: "Diese Governance-Notiz wurde nicht gefunden.",
	PostScoreDuplicate: `Ein ${postTerms.inline} kann dieselbe Bewertung nicht mehrmals anzeigen.`,
	PostScoreNotFound: "Eine ausgewählte Bewertung wurde nicht gefunden.",
	RealmScoreContextPostNotMounted: `Der als Bewertungskontext verwendete ${postTerms.inline} muss im ${realmTerms.inline} eingebunden sein.`,
	RealmScoreContextPostKindInvalid: `Für den Bewertungskontext muss ein regulärer ${postTerms.label} oder Wiki-Artikel verwendet werden.`,
	RealmTagContextNotFound: `Die Tag-Erklärung in diesem ${realmTerms.inline} wurde nicht gefunden.`,
	RealmTagContextPostNotMounted: `Der ${postTerms.inline} mit der Tag-Erklärung muss im ${realmTerms.inline} sichtbar sein.`,
	RealmTagContextAlreadyExists: `In diesem ${realmTerms.inline} gibt es bereits eine Erklärung für diesen Tag.`,
	RealmTagContextPostAlreadyUsed: `Dieser ${postTerms.inline} erklärt bereits einen anderen Tag in einem ${realmTerms.inline}.`,
	RealmTagVotingDisabled: `Tag-Abstimmungen sind in diesem ${realmTerms.inline} nicht aktiviert.`,
	RealmTagContextRequired: `Dieses ${realmTerms.inline} muss den Tag zuerst in einer derzeit sichtbaren offiziellen Erklärung beschreiben.`,
	RealmTagSelfReferenceForbidden: "Ein Tag kann nicht auf sich selbst angewendet werden.",
	SearchDocumentRevisionConflict:
		"Die Suchkonfiguration wurde geändert. Lade sie vor dem Speichern neu.",
	ZoneSearchFeatureNotFound: `Dieser ${zoneTerms.inline} hat keine aktivierte Suchfunktion.`,
	SharedSearchQueryNotFound: "Diese geteilte Suchanfrage wurde nicht gefunden.",
	InvalidTagStructure: `Dieser ${tagStructureTerms.inline} ist ungültig.`,
	TagStructureNotFound: `Dieser ${tagStructureTerms.inline} wurde nicht gefunden.`,
	TagStructureApplicationNotFound: `Diese Unit hat diesen ${tagStructureTerms.inline} nicht.`,
	TagStructureChanged: `Dieser ${tagStructureTerms.inline} wurde an anderer Stelle geändert. Aktualisiere die Seite und versuche es erneut.`,
	TagStructureDefinitionConflict: `Ein identischer ${tagStructureTerms.inline} ist bereits vorhanden.`,
	AssociationContextPostInvalid: `Der Beziehungskontext muss ein Wiki-${postTerms.inline} sein.`,
	ProgressEntryNotFound: "Dieses Fortschrittsereignis wurde nicht gefunden.",
	PostTagMentionVoteConflict: `Diese Tag-Erwähnung steht im Konflikt mit deiner vorhandenen Gegenstimme für den ${postTerms.inline}.`,
	UnitRealmPublicationNotFound: `Für diesen Inhalt besteht keine Veröffentlichungsrelation mit diesem ${realmTerms.label}.`,
	UnitRealmPublicationAlreadyExists: `Für diesen Inhalt besteht bereits eine Veröffentlichungsrelation mit diesem ${realmTerms.label}.`,
	UnitRealmPublicationTransitionInvalid:
		"Die Veröffentlichungsrelation befindet sich bereits im angeforderten Status.",
} satisfies typeof import("../zh-Hant/errorCodes").default;
