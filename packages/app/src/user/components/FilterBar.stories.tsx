import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { FilterBar, type FilterBarConfig } from "./FilterBar";

const Wrapper = ({ config }: { config: FilterBarConfig }) => {
  const [values, setValues] = useState<Record<string, string>>({});
  return (
    <FilterBar
      config={config}
      values={values}
      onChange={(k, v) => setValues((prev) => ({ ...prev, [k]: v }))}
    />
  );
};

const meta = {
  title: "Domain/User/FilterBar",
  component: Wrapper,
  args: {
    config: {
      showSearch: true,
      searchPlaceholder: "Search shelves",
      dropdowns: [
        {
          key: "sort",
          label: "Sort",
          options: [
            { value: "recent", label: "Most recent" },
            { value: "popular", label: "Most popular" },
          ],
        },
        {
          key: "visibility",
          label: "Visibility",
          options: [
            { value: "public", label: "Public" },
            { value: "private", label: "Private" },
          ],
        },
      ],
    },
  },
} satisfies Meta<typeof Wrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Compact: Story = {
  args: { config: { showSearch: true } },
};
