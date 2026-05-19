import type {
  SingleUnitRevisionResponse,
  UnitRevisionTimelinePage,
} from "@rezics/contract";
import { getApiConfig } from "../config";
import { apiFetch } from "../react-query/http";
import { buildQueryString } from "../utils/buildQuery";
import type { HistoryTimelineParams } from "./history.keys";

function historyEndpoint(path: string) {
  const historyBaseUrl = getApiConfig().historyBaseUrl;
  if (!historyBaseUrl) return path;
  return `${historyBaseUrl}${path}`;
}

const encodePathPart = (value: string | number) => encodeURIComponent(value);

export const historyApi = {
  listUnitRevisions(
    unitId: string,
    params?: HistoryTimelineParams,
  ): Promise<UnitRevisionTimelinePage> {
    return apiFetch<UnitRevisionTimelinePage>(
      historyEndpoint(
        `/unit/${encodePathPart(unitId)}/revisions${buildQueryString(params)}`,
      ),
    );
  },

  getUnitRevision(
    unitId: string,
    sequence: number,
  ): Promise<SingleUnitRevisionResponse> {
    return apiFetch<SingleUnitRevisionResponse>(
      historyEndpoint(
        `/unit/${encodePathPart(unitId)}/revisions/${encodePathPart(sequence)}`,
      ),
    );
  },
};
