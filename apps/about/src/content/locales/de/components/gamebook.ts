const content = {
	reader: "Leseansicht",
	journey: "Aktuelle Journey",
	entrance: "Entrance",
	passageTitle: "Passage: Archiveingang",
	branchDescription:
		"Die lesende Person erreicht eine dokumentierte Verzweigung. Der gewählte Pfad wird als JourneyStep erfasst, getrennt vom allgemeinen Progress.",
	choose: "Auswahl treffen",
	choiceA: "Choice A · Weiter zum Lesesaal",
	choiceAOutcome: "Passage: Lesesaal",
	choiceAStep: "Choice A → Lesesaal",
	choiceB: "Choice B · Archiv verlassen",
	choiceBOutcome: "Ending: Später zurückkehren",
	choiceBStep: "Choice B → Ending",
	authoring: "Bearbeitung",
	validation: "Gültige Struktur · DAG-Prüfung bestanden",
	authoringSequence: "Bearbeitungssequenz für GameContentStructure",
	passage: "Passage",
	ending: "Ending",
	entry: "Einstieg",
	choicesTwo: "Auswahlmöglichkeiten: 2",
	retirable: "stilllegbar",
	constraints:
		"Entrance → Passage → Ending · keine Schleifen, Skripte, Variablen, Kämpfe oder Laufzeitregeln.",
} satisfies typeof import("../../en/components/gamebook").default;

export default content;
