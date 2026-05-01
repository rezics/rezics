import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { CustomSidebar } from "./CustomSidebar";

const meta = {
  title: "Composite/Layouts/CustomSidebar",
  component: CustomSidebar,
  args: { section: "Profile" },
} satisfies Meta<typeof CustomSidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: ({ section: initialSection }) => {
    const [section, setSection] = useState(initialSection);
    return (
      <div className="min-h-screen bg-gray-100 p-4">
        <div className="mb-3 text-sm text-gray-600">
          Current section: {section}
        </div>
        <CustomSidebar section={section} setSection={setSection} />
      </div>
    );
  },
};
