import * as m from "@rezics/i18n/messages";
import { Card, CardContent } from "@rezics/ui/shadcn";
import { Page } from "@/core/layouts/Page";

// MOCK: realm list page - backend API integration pending
export default function RealmsPage() {
  return (
    <Page
      title={m.admin_realm_title()}
      description={m.admin_realm_description()}
    >
      <Card>
        <CardContent>
          <h3 className="text-base font-semibold mb-2">
            {m.admin_realm_management_title()}
          </h3>
          <p className="text-sm text-text-secondary">
            {m.admin_realm_management_description()}
          </p>
        </CardContent>
      </Card>
    </Page>
  );
}
