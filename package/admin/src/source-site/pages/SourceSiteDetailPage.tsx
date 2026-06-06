import { useParams } from "@tanstack/react-router";
import { SourceSiteDetail } from "./SourceSitesPage";

export default function SourceSiteDetailPage() {
  const { entityUnitId } = useParams({
    from: "/_admin/source-site/$entityUnitId",
  });

  return <SourceSiteDetail entityUnitId={entityUnitId} />;
}
