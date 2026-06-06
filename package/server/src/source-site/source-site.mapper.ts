import {
  deriveSourceSiteCrawlStatus,
  type SourceSiteDTO,
  type SourceSiteRefRule,
} from "@rezics/contract";
import { mapEntityToDTO } from "../entity/entity.mapper";
import type { SourceSiteWithRelations } from "./source-site.types";

export function mapSourceSiteToDTO(
  row: SourceSiteWithRelations,
): SourceSiteDTO {
  const crawlStatus = deriveSourceSiteCrawlStatus({
    crawlSupport: row.crawlSupport as SourceSiteDTO["crawlSupport"],
    crawlEnabled: row.crawlEnabled,
    crawlerAdapterKey: row.crawlerAdapterKey,
  });

  return {
    entityUnitId: row.entityUnitId,
    key: row.key,
    crawlSupport: row.crawlSupport as SourceSiteDTO["crawlSupport"],
    crawlEnabled: row.crawlEnabled,
    crawlerAdapterKey: row.crawlerAdapterKey ?? undefined,
    refRules: row.refRules as SourceSiteRefRule[],
    ...crawlStatus,
    entity: row.entity ? mapEntityToDTO(row.entity as any) : undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
