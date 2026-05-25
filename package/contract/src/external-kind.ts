import { t } from "elysia";
import { type UnitType } from "./unit";

export const externalKinds = [
  "book",
  "author",
  "publisher",
  "person",
  "organization",
  "circle",
  "studio",
  "label",
  "series",
  "chapter",
] as const;

export type ExternalKind = (typeof externalKinds)[number];

export const externalKindRegistry: Record<
  ExternalKind,
  {
    key: ExternalKind;
    label: string;
    suggestedUnitTypes: readonly UnitType[];
  }
> = {
  book: {
    key: "book",
    label: "Book",
    suggestedUnitTypes: ["BOOK"],
  },
  author: {
    key: "author",
    label: "Author",
    suggestedUnitTypes: [],
  },
  publisher: {
    key: "publisher",
    label: "Publisher",
    suggestedUnitTypes: [],
  },
  person: {
    key: "person",
    label: "Person",
    suggestedUnitTypes: [],
  },
  organization: {
    key: "organization",
    label: "Organization",
    suggestedUnitTypes: [],
  },
  circle: {
    key: "circle",
    label: "Circle",
    suggestedUnitTypes: [],
  },
  studio: {
    key: "studio",
    label: "Studio",
    suggestedUnitTypes: [],
  },
  label: {
    key: "label",
    label: "Label",
    suggestedUnitTypes: [],
  },
  series: {
    key: "series",
    label: "Series",
    suggestedUnitTypes: [],
  },
  chapter: {
    key: "chapter",
    label: "Chapter",
    suggestedUnitTypes: ["BOOK"],
  },
};

export const externalKindKeySchema = t.Union(
  externalKinds.map((kind) => t.Literal(kind)) as [
    ReturnType<typeof t.Literal<ExternalKind>>,
    ReturnType<typeof t.Literal<ExternalKind>>,
    ...ReturnType<typeof t.Literal<ExternalKind>>[],
  ],
);

export function suggestExternalKinds(
  unitKind: UnitType | string,
  availableKinds: readonly ExternalKind[],
): ExternalKind[] {
  return [...availableKinds].sort((left, right) => {
    const leftSuggested = externalKindRegistry[
      left
    ].suggestedUnitTypes.includes(unitKind as UnitType);
    const rightSuggested = externalKindRegistry[
      right
    ].suggestedUnitTypes.includes(unitKind as UnitType);

    if (leftSuggested !== rightSuggested) {
      return leftSuggested ? -1 : 1;
    }

    return externalKinds.indexOf(left) - externalKinds.indexOf(right);
  });
}
