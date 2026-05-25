import {
  admin_shelf_description,
  admin_shelf_management_description,
  admin_shelf_management_title,
  admin_shelf_title,
} from "@rezics/i18n/messages";
import { useMessage } from "@rezics/i18n/react";
import { Card, CardContent } from "@rezics/ui/shadcn";
import { Page } from "@/core/layouts/Page";

const i18nMessages = {
  admin_shelf_description,
  admin_shelf_management_description,
  admin_shelf_management_title,
  admin_shelf_title,
};

// MOCK: shelf list page - backend API integration pending
export default function ShelvesPage() {
  const m = useMessage(i18nMessages);
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
