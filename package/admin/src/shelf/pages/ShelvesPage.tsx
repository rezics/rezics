import { Card, CardContent } from "@rezics/ui/shadcn";
import { Page } from "@/core/layouts/Page";

// MOCK: shelf list page - backend API integration pending
export default function ShelvesPage() {
  return (
    <Page title="Shelves" description="Manage user shelves">
      <Card>
        <CardContent>
          <h3 className="text-base font-semibold mb-2">Shelf Management</h3>
          <p className="text-sm text-text-secondary">
            Shelf listing and management will be available once the shelf admin
            API endpoints are ready. Shelves are user-created collections that
            organize books and other content.
          </p>
        </CardContent>
      </Card>
    </Page>
  );
}
