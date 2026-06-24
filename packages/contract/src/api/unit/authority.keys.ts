export const unitAuthorityKeys = {
  all: ["unit-authority"] as const,
  unit: (unitId: string) => [...unitAuthorityKeys.all, unitId] as const,
  collaborators: (unitId: string) =>
    [...unitAuthorityKeys.unit(unitId), "collaborators"] as const,
  fieldLocks: (unitId: string) =>
    [...unitAuthorityKeys.unit(unitId), "field-locks"] as const,
};
