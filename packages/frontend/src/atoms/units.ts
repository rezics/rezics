import { ApiClient } from "@/lib/api-client";
import { Keys } from "./keys";

export const unitQuery = (unitId: string) =>
  ApiClient.query("units", "getUnit", {
    params: { unitId },
    reactivityKeys: [Keys.unit(unitId)],
  });
