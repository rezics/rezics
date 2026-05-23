import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@rezics/ui/shadcn";

import { ThemeDemo } from "@/preference/sections/ThemeDemo.tsx";

export default function PersistentTabs() {
  const [value, setValue] = React.useState<"1" | "2">("1");

  return (
    <div>
      <div>
        <p className="text-blue-600 dark:text-gray-400">
          用 div tailwind css 重写，并重新布局，Avatar
          依然放在左边，但是改为方形，右侧内则分为三个DIV
        </p>
      </div>
      <ThemeDemo />
      <Tabs value={value} onValueChange={(v) => setValue(v as "1" | "2")}>
        <TabsList>
          <TabsTrigger value="1">面板一</TabsTrigger>
          <TabsTrigger value="2">面板二</TabsTrigger>
        </TabsList>
        <TabsContent value="1" />
        <TabsContent value="2" />
      </Tabs>
    </div>
  );
}
