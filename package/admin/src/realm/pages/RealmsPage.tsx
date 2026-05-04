import { Card, CardContent } from "@rezics/ui/shadcn";
import { Page } from "@/core/layouts/Page";

// MOCK: realm list page - backend API integration pending
export default function RealmsPage() {
  return (
    <Page title="Realms" description="Manage community realms">
      <Card>
        <CardContent>
          <h3 className="text-base font-semibold mb-2">Realm Management</h3>
          <p className="text-sm text-text-secondary">
            Realm listing and management will be available once the realm admin
            API endpoints are ready. Realms are community spaces that contain
            curated content, tags, and members.
          </p>
        </CardContent>
      </Card>
    </Page>
  );
}
