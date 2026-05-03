import { Card, CardContent, Checkbox, Label } from "@rezics/ui/shadcn";
import React from "react";

import { Page } from "@/core/layouts/Page";

export default function SettingsPage() {
  const [dark, setDark] = React.useState(false);

  return (
    <Page title="Settings" description="示例：后台设置（主题/语言/偏好）">
      <Card>
        <CardContent>
          <h3 className="text-sm font-bold mb-2">Appearance</h3>
          <Label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={dark}
              onCheckedChange={(v) => setDark(v === true)}
            />
            <span>Dark mode（示例：后续可接入持久化 + ThemeProvider）</span>
          </Label>
        </CardContent>
      </Card>
    </Page>
  );
}
