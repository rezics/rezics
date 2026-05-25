import { Card, CardContent } from "@rezics/ui/shadcn";
import { Page } from "@/core/layouts/Page";
import { useMessage } from "@rezics/i18n/react";
import {
  admin_realm_description,
  admin_realm_management_description,
  admin_realm_management_title,
  admin_realm_title,
} from "@rezics/i18n/messages";
const i18nMessages = {
  admin_realm_description,
  admin_realm_management_description,
  admin_realm_management_title,
  admin_realm_title,
};

// MOCK: realm list page - backend API integration pending
export default function RealmsPage() {
  const m = useMessage(i18nMessages);
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
