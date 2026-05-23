import * as m from "@rezics/i18n/messages";
import { Card, CardContent } from "@rezics/ui/shadcn";
import { Page } from "@/core/layouts/Page";

// MOCK: shelf list page - backend API integration pending
export default function ShelvesPage() {
  return (
    <Page
      title={m.admin_shelf_title()}
      description={m.admin_shelf_description()}
    >
      <Card>
        <CardContent>
          <h3 className="text-base font-semibold mb-2">
            {m.admin_shelf_management_title()}
          </h3>
          <p className="text-sm text-text-secondary">
            {m.admin_shelf_management_description()}
          </p>
        </CardContent>
      </Card>
    </Page>
  );
}
