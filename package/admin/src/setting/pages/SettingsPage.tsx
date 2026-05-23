import * as m from "@rezics/i18n/messages";
import { Card, CardContent, Checkbox, Label } from "@rezics/ui/shadcn";
import React from "react";

import { Page } from "@/core/layouts/Page";

export default function SettingsPage() {
  const [dark, setDark] = React.useState(false);

  return (
    <Page
      title={m.admin_setting_title()}
      description={m.admin_setting_description()}
    >
      <Card>
        <CardContent>
          <h3 className="text-sm font-bold mb-2">
            {m.admin_setting_appearance_title()}
          </h3>
          <Label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={dark}
              onCheckedChange={(v) => setDark(v === true)}
            />
            <span>{m.admin_setting_dark_mode_label()}</span>
          </Label>
        </CardContent>
      </Card>
    </Page>
  );
}
