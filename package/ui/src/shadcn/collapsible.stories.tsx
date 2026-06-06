import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChevronsUpDown } from "lucide-react";

import { Button } from "./button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./collapsible";

const meta = {
  title: "Primitives/Collapsible",
  component: Collapsible,
} satisfies Meta<typeof Collapsible>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Collapsible className="w-80 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Reading goals</span>
        <CollapsibleTrigger
          render={<Button variant="ghost" size="icon" aria-label="Toggle" />}
        >
          <ChevronsUpDown />
        </CollapsibleTrigger>
      </div>
      <div className="rounded-md border px-3 py-2 text-sm">
        12 books this year
      </div>
      <CollapsibleContent className="space-y-2">
        <div className="rounded-md border px-3 py-2 text-sm">
          24 hours per month
        </div>
        <div className="rounded-md border px-3 py-2 text-sm">
          3 highlights per chapter
        </div>
      </CollapsibleContent>
    </Collapsible>
  ),
};
