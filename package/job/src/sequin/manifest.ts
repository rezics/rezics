export const ROUTED_SEQUIN_TABLES = [
  "HistoryOutbox",
  "Unit",
  "UnitTranslation",
  "UnitTag",
  "TagVote",
  "UnitAlias",
  "CreditAttribution",
  "SubjectAttribution",
  "UnitRealm",
  "RealmTagApplication",
  "RealmTagUnit",
  "ShelfItem",
  "ContentStructureNode",
  "Post",
  "User",
  "UserUnitProgress",
  "Comment",
  "ScoreEntry",
  "ScoreAggregate",
  "ReactionSummary",
  "Feedback",
] as const;

export type RoutedSequinTable = (typeof ROUTED_SEQUIN_TABLES)[number];

export function isRoutedSequinTable(table: string): table is RoutedSequinTable {
  return (ROUTED_SEQUIN_TABLES as readonly string[]).includes(table);
}
