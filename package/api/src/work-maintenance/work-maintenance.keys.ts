export const workMaintenanceKeys = {
  all: () => ["workMaintenance"] as const,
  detail: (unitId: string) =>
    [...workMaintenanceKeys.all(), "detail", unitId] as const,
} as const;
